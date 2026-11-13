const leadForm = document.querySelector('#lead');
const weightForm = document.querySelector('#weight-form');

if (leadForm && weightForm) {
  const chosen = document.querySelector('#chosen');
  const contact = document.querySelector('#weight-contact');
  const next = document.querySelector('#weight-next');
  let plan = '';

  document.querySelectorAll('[data-plan]').forEach((link) => {
    link.addEventListener('click', () => {
      plan = link.dataset.plan;
      chosen.textContent = 'Interested in ' + plan;
      chosen.hidden = false;
    });
  });

  next.addEventListener('click', () => {
    if (!weightForm.reportValidity()) return;
    contact.hidden = false;
    contact.disabled = false;
    next.hidden = true;
    contact.querySelector('[name="name"]').focus();
  });

  for (const form of [leadForm, weightForm]) {
    const phone = form.elements.phone;
    phone.addEventListener('input', () => phone.setCustomValidity(''));

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (form === weightForm && contact.disabled) {
        next.click();
        return;
      }
      if (!/^\+?\d{10,15}$/.test(phone.value.replace(/[\s()-]/g, ''))) {
        phone.setCustomValidity('Enter a valid phone number.');
        phone.reportValidity();
        return;
      }

      const isWeightCheck = form === weightForm;
      const data = {
        source: isWeightCheck ? 'weight-check' : 'consultation',
        name: form.elements.name.value.trim(),
        phone: phone.value,
      };
      if (isWeightCheck) {
        data.height = form.elements.height.valueAsNumber;
        data.currentWeight = form.elements.currentWeight.valueAsNumber;
        data.goalWeight = form.elements.goalWeight.value === '' ? null : form.elements.goalWeight.valueAsNumber;
      } else {
        data.goal = form.elements.goal.value;
        data.plan = plan;
      }

      const button = form.querySelector('[type="submit"]');
      const error = form.querySelector('.lead-error');
      error.hidden = true;
      button.disabled = true;
      try {
        const response = await fetch(form.action, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        const result = await response.json();
        if (!response.ok || !result.saved) throw new Error(result.error || 'Please try again.');

        // Keep the result out of the URL and show it only after the lead is saved.
        try {
          if (isWeightCheck) {
            sessionStorage.setItem('bliss-weight-result', JSON.stringify({
              height: data.height, currentWeight: data.currentWeight, goalWeight: data.goalWeight,
            }));
          } else {
            sessionStorage.removeItem('bliss-weight-result');
          }
        } catch {
          if (isWeightCheck) {
            window.location.assign("/thank-you");
            return;
          }
        }
        window.location.assign('/thank-you');
      } catch (failure) {
        error.textContent = failure.message || 'Please try again or contact us on WhatsApp.';
        error.hidden = false;
        button.disabled = false;
      }
    });
  }
}

const resultPanel = document.querySelector('#weight-result');
if (resultPanel) {
  let result;
  try {
    result = JSON.parse(sessionStorage.getItem('bliss-weight-result'));
    sessionStorage.removeItem('bliss-weight-result');
  } catch {
    result = null;
  }
  if (result) {
    document.querySelector('#weight-summary').textContent =
      result.currentWeight + ' kg current weight · ' + result.height + ' cm height';
    if (result.goalWeight !== null) {
      const difference = Math.round(Math.abs(result.currentWeight - result.goalWeight) * 10) / 10;
      document.querySelector('#weight-difference').textContent =
        'Goal weight: ' + result.goalWeight + ' kg · ' + difference + ' kg difference';
    }
    resultPanel.hidden = false;
  }
}
