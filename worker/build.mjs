import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';

const types = { html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8', webp: 'image/webp', png: 'image/png' };
const assets = {};
for (const filename of (await readdir('public')).sort()) {
  const type = types[filename.split('.').at(-1)];
  if (!type) throw new Error('Unsupported asset: ' + filename);
  const bytes = await readFile('public/' + filename);
  assets['/' + filename] = [type, bytes.toString('base64')];
}
await mkdir('dist/server', { recursive: true });
const worker = await readFile('worker/index.js', 'utf8');
await writeFile('dist/server/index.js', 'const assets = ' + JSON.stringify(assets) + '\n' + worker);
