const goals = ['Weight loss', 'Strength and toning', 'Mobility and flexibility', 'General fitness', 'Post-pregnancy fitness'];
const plans = ['Pre-Recorded', 'Live Sessions', 'Live + Diet Plan', '90-Day Transformation'];
const privateHeaders = { 'Cache-Control': 'private, no-store' };

function numberInRange(value, min, max) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

async function notifyLead(env, lead) {
  if (!env.RESEND_API_KEY) return;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + env.RESEND_API_KEY,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'bliss-burn-lead/' + lead.id,
      },
      body: JSON.stringify({
        from: 'Bliss & Burn <info@rankdrift.agency>',
        to: ['info@digitalultras.com'],
        subject: lead.source === 'weight-check' ? 'New Bliss & Burn weight check enquiry' : 'New Bliss & Burn consultation enquiry',
        text: [
          'Name: ' + lead.name,
          'Phone: ' + lead.phone,
          'Goal: ' + lead.goal,
          ...(lead.plan ? ['Plan: ' + lead.plan] : []),
          'View saved lead details: https://bliss-burn-consultation.ramram424.chatgpt.site/leads.csv',
        ].join('\n'),
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) console.error('Lead email rejected by Resend', lead.id, response.status);
  } catch {
    console.error('Lead email request failed', lead.id);
  }
}

async function submitLead(request, env, ctx) {
  if (request.headers.get('Origin') !== new URL(request.url).origin) {
    return Response.json({ error: 'Please submit from the enquiry page.' }, { status: 403 });
  }
  let data;
  try {
    const raw = await request.text();
    if (raw.length > 4096) throw new Error('Oversized request');
    data = JSON.parse(raw);
  } catch {
    return Response.json({ error: 'Please check your details and try again.' }, { status: 400 });
  }
  if (!data || !['consultation', 'weight-check'].includes(data.source)) {
    return Response.json({ error: 'Please check your details and try again.' }, { status: 400 });
  }
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const phone = typeof data.phone === 'string' ? data.phone.replace(/[\s()-]/g, '') : '';
  const weightCheck = data.source === 'weight-check';
  const goal = weightCheck ? 'Weight loss' : data.goal;
  const plan = !weightCheck && plans.includes(data.plan) ? data.plan : null;
  if (!name || name.length > 100 || !/^\+?\d{10,15}$/.test(phone) || !goals.includes(goal)) {
    return Response.json({ error: 'Enter your name, a valid phone number, and your fitness goal.' }, { status: 400 });
  }
  if (weightCheck && (!numberInRange(data.height, 100, 250) || !numberInRange(data.currentWeight, 25, 500)
    || (data.goalWeight !== null && !numberInRange(data.goalWeight, 25, 500)))) {
    return Response.json({ error: 'Check that your height is in centimetres and weights are in kilograms.' }, { status: 400 });
  }
  const id = crypto.randomUUID();
  try {
    await env.DB.prepare(
      'INSERT INTO leads (id, created_at, source, name, phone, goal, plan, height, current_weight, goal_weight) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, new Date().toISOString(), data.source, name, phone, goal, plan,
      weightCheck ? data.height : null, weightCheck ? data.currentWeight : null, weightCheck ? data.goalWeight : null).run();
  } catch {
    return Response.json({ error: 'Your enquiry could not be saved. Please try again or contact us on WhatsApp.' }, { status: 503 });
  }
  ctx.waitUntil(notifyLead(env, { id, name, phone, goal, plan, source: data.source }));
  return Response.json({ saved: true }, { headers: privateHeaders });
}

function csvCell(value) {
  const text = String(value ?? '');
  const safe = /^[\s]*[=+@-]|^[\t\r\n]/.test(text) ? "'" + text : text;
  return '"' + safe.replaceAll('"', '""') + '"';
}

export default {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;
    if (path === '/api/leads' && request.method === 'POST') return submitLead(request, env, ctx);
    if (path === '/leads.csv' && request.method === 'GET') {
      const email = request.headers.get('oai-authenticated-user-email')?.toLowerCase();
      if (!email || email !== env.LEAD_OWNER_EMAIL?.toLowerCase()) {
        return new Response('Sign in as the Site owner to download leads.', { status: 403, headers: privateHeaders });
      }
      const columns = ['created_at', 'source', 'name', 'phone', 'goal', 'plan', 'height', 'current_weight', 'goal_weight'];
      const { results } = await env.DB.prepare('SELECT ' + columns.join(', ') + ' FROM leads ORDER BY created_at DESC').all();
      const csv = [columns.join(','), ...results.map((row) => columns.map((column) => csvCell(row[column])).join(','))].join('\r\n');
      return new Response(csv, { headers: { ...privateHeaders, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="bliss-and-burn-leads.csv"' } });
    }
    const asset = assets[path === '/' ? '/index.html' : path === '/thank-you' || path === '/thank-you/' ? '/thank-you.html' : path];
    if (!asset || !['GET', 'HEAD'].includes(request.method)) return new Response('Not found', { status: 404 });
    return new Response(request.method === 'HEAD' ? null : Uint8Array.from(atob(asset[1]), (char) => char.charCodeAt(0)), {
      headers: { 'Content-Type': asset[0], 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' },
    });
  },
};
