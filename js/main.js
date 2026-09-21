/* Wischermann Detailing: site behavior. No dependencies. */
(() => {
  'use strict';

  const CONFIG = {
    phone: '+19196323198',
    // Formspree form ID: the code after /f/ in the form's endpoint (https://formspree.io/f/abcdwxyz -> 'abcdwxyz').
    // While it's empty, the quote form hands the finished request to the customer's texting app instead.
    formspreeId: 'mkjgnaaw',
    // The instant estimate shows this range around the calculated price.
    estimateRange: { low: 0.9, high: 1.15 },
  };

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const hasIO = 'IntersectionObserver' in window;
  const money = (n) => `$${n}`;
  const roundTo5 = (n) => Math.round(n / 5) * 5;

  /* ---------- Header + navigation ---------- */

  const header = $('.site-header');
  const syncHeader = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
  syncHeader();
  window.addEventListener('scroll', syncHeader, { passive: true });

  const navToggle = $('.nav-toggle');
  const mobileNav = $('#mobile-nav');
  const setNav = (open) => {
    document.body.classList.toggle('nav-open', open);
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    mobileNav.inert = !open;
  };
  setNav(false);
  navToggle.addEventListener('click', () => setNav(!document.body.classList.contains('nav-open')));
  mobileNav.addEventListener('click', (e) => {
    if (e.target.closest('a')) setNav(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('nav-open')) {
      setNav(false);
      navToggle.focus();
    }
  });
  window.matchMedia('(min-width: 960px)').addEventListener('change', (e) => {
    if (e.matches) setNav(false);
  });

  // Highlight the nav link for whichever section sits in the middle of the viewport.
  const navLinks = $$('.nav-links a[href^="#"]');
  if (hasIO) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((a) => a.classList.toggle('is-active', a.hash === `#${entry.target.id}`));
      });
    }, { rootMargin: '-45% 0px -54% 0px' });
    $$('main > section[id]').forEach((section) => spy.observe(section));
  }

  /* ---------- Scroll reveal ---------- */

  const revealEls = $$('[data-reveal]');
  if (hasIO && !reduceMotion.matches) {
    const io = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-visible'));
  }

  /* ---------- Package pricing ---------- */

  // Prices live on the package cards in index.html (data-car / data-suv / data-truck, data-price on add-ons).
  const packages = $$('.pkg[data-package]').map((el) => ({
    el,
    id: el.dataset.package,
    name: el.dataset.name,
    prices: { car: Number(el.dataset.car), suv: Number(el.dataset.suv), truck: Number(el.dataset.truck) },
  }));
  const addons = $$('.addon[data-addon]').map((el) => ({
    id: el.dataset.addon,
    name: el.dataset.name,
    price: Number(el.dataset.price),
  }));
  const sizeInputs = $$('[data-size-control] input');
  const sizeLabels = Object.fromEntries(sizeInputs.map((input) => [input.value, input.dataset.label]));
  let size = (sizeInputs.find((input) => input.checked) || sizeInputs[0]).value;
  let onSizeChange = () => {}; // set by the quote form

  const setText = (el, text) => {
    if (el.textContent === text) return;
    el.textContent = text;
    if (!reduceMotion.matches && el.animate) {
      el.animate(
        [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
        { duration: 280, easing: 'cubic-bezier(.2,.7,.2,1)' }
      );
    }
  };

  const setSize = (value, manual = false) => {
    size = value;
    sizeInputs.forEach((input) => { input.checked = input.value === value; });
    packages.forEach((p) => {
      setText($('[data-price]', p.el), String(p.prices[value]));
      $$(`[data-package-price="${p.id}"]`).forEach((el) => setText(el, money(p.prices[value])));
    });
    $$('[data-size-label]').forEach((el) => { el.textContent = sizeLabels[value]; });
    onSizeChange(manual);
  };

  sizeInputs.forEach((input) => input.addEventListener('change', () => setSize(input.value, true)));

  /* ---------- Quote form + instant estimate ---------- */

  const form = $('#quote-form');

  if (form) {
    const vehicles = window.WD_VEHICLES || { types: {}, makes: {} };
    const modelTypes = {};
    Object.entries(vehicles.makes).forEach(([make, groups]) => {
      modelTypes[make] = {};
      Object.entries(groups).forEach(([type, models]) => models.forEach((model) => { modelTypes[make][model] = type; }));
    });
    const byName = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    const addOptions = (select, values) => values.forEach((value) => select.add(new Option(value, value)));

    const yearSelect = $('#q-year');
    const makeSelect = $('#q-make');
    const modelSelect = $('#q-model');
    const otherWrap = $('#q-other-wrap');
    const otherInput = $('#q-other');
    const matchBox = $('#q-match');
    const matchText = $('#q-match-text');
    const estimateEl = $('#q-estimate');
    const estimateNote = $('#q-estimate-note');

    const thisYear = new Date().getFullYear();
    addOptions(yearSelect, Array.from({ length: thisYear + 2 - 1985 }, (_, i) => String(thisYear + 1 - i)));
    yearSelect.add(new Option('Older', 'Older'));
    addOptions(makeSelect, Object.keys(modelTypes).sort(byName));
    makeSelect.add(new Option('Other / not listed', 'other'));

    $('#q-packages').innerHTML = packages.map((p) => `
      <label class="option">
        <input type="radio" name="package" value="${p.id}">
        <span class="option-body">
          <span class="option-name">${p.name}</span>
          <span class="option-price" data-package-price="${p.id}">${money(p.prices[size])}</span>
        </span>
      </label>`).join('');

    $('#q-addons').innerHTML = addons.map((a) => `
      <label class="chip">
        <input type="checkbox" name="addons" value="${a.id}">
        <span class="chip-body">
          <svg class="chip-check" aria-hidden="true"><use href="#i-check"></use></svg>
          <span>${a.name}</span>
          <span class="chip-price">+${money(a.price)}</span>
        </span>
      </label>`).join('');

    let vehicleType = null; // body style from vehicles.js when the model is recognized
    let sizeOverridden = false; // the customer picked a different size than the one we matched
    let showLiveErrors = false;

    const selectedPackage = () => packages.find((p) => p.id === form.elements.package.value);
    const selectedAddons = () => $$('input[name="addons"]:checked', form).map((i) => addons.find((a) => a.id === i.value));
    const selectedCondition = () => $('input[name="condition"]:checked', form);
    const needsOtherVehicle = () => makeSelect.value === 'other' || modelSelect.value === 'other';

    const vehicleName = () => {
      const make = makeSelect.value === 'other' ? '' : makeSelect.value;
      const model = needsOtherVehicle() ? otherInput.value.trim() : modelSelect.value;
      return [yearSelect.value, make, model].filter(Boolean).join(' ');
    };

    const estimate = () => {
      const pkg = selectedPackage();
      if (!pkg) return null;
      const type = vehicleType && !sizeOverridden ? vehicles.types[vehicleType] : null;
      const condition = Number(selectedCondition()?.dataset.multiplier || 1);
      const total = pkg.prices[size] * (1 + (type ? type.adjust : 0)) * condition
        + selectedAddons().reduce((sum, a) => sum + a.price, 0);
      return { low: roundTo5(total * CONFIG.estimateRange.low), high: roundTo5(total * CONFIG.estimateRange.high) };
    };
    const estimateText = (range) => `${money(range.low)}–${money(range.high)}`;

    /* Week picker: start times come from js/availability.js */

    const availability = window.WD_AVAILABILITY;
    const weekGrid = $('#q-week-grid');
    const weekLabel = $('#q-week-label');
    const weekPrev = $('#q-week-prev');
    const weekNext = $('#q-week-next');
    const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    let weekOffset = 0;
    let chosenSlot = null;

    const pad2 = (n) => String(n).padStart(2, '0');
    const toMinutes = (hhmm) => {
      const [h, m] = hhmm.split(':').map(Number);
      return h * 60 + m;
    };
    const slotKey = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
    const slotTime = (date) => date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(':00', '');
    const slotLabel = (date) => `${date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;

    // How long we need to hold the spot: package time plus a bit more for bigger vehicles.
    const jobMinutes = () => {
      const pkg = selectedPackage();
      const base = pkg ? availability.durations[pkg.id] : 120;
      return base + (availability.sizeExtraMinutes[size] || 0);
    };

    const slotsFor = (day) => {
      const windows = availability.windows[DAY_KEYS[day.getDay()]] || [];
      const needed = jobMinutes();
      const earliest = Date.now() + availability.leadTimeHours * 3600000;
      const out = [];
      windows.forEach(([from, to]) => {
        const closes = toMinutes(to) + (availability.graceMinutes || 0);
        for (let start = toMinutes(from); start + needed <= closes; start += availability.slotStepMinutes) {
          const when = new Date(day);
          when.setHours(0, start, 0, 0);
          if (when.getTime() < earliest) continue;
          if (availability.booked.includes(slotKey(when))) continue;
          out.push(when);
        }
      });
      return out;
    };

    const startOfWeek = (offset) => {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - day.getDay() + offset * 7);
      return day;
    };

    const renderWeek = () => {
      // A longer job can swallow a slot that was free a moment ago.
      if (chosenSlot && !slotsFor(new Date(chosenSlot)).some((d) => slotKey(d) === slotKey(chosenSlot))) {
        chosenSlot = null;
      }

      const start = startOfWeek(weekOffset);
      const todayStamp = new Date().toDateString();

      weekGrid.replaceChildren(...Array.from({ length: 7 }, (_, i) => {
        const day = new Date(start);
        day.setDate(start.getDate() + i);

        const col = document.createElement('div');
        col.className = 'day';
        if (day.toDateString() === todayStamp) col.classList.add('day--today');

        const head = document.createElement('p');
        head.className = 'day-head';
        const name = document.createElement('span');
        name.className = 'day-name';
        name.textContent = DAY_NAMES[day.getDay()];
        const num = document.createElement('span');
        num.className = 'day-num';
        num.textContent = day.getDate();
        head.append(name, num);

        const list = document.createElement('div');
        list.className = 'day-slots';
        const slots = slotsFor(day);

        if (!slots.length) {
          col.classList.add('day--past');
          const none = document.createElement('span');
          none.className = 'day-empty';
          none.textContent = '–';
          none.title = 'No openings';
          list.append(none);
        } else {
          slots.forEach((when) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'slot';
            btn.textContent = slotTime(when);
            btn.setAttribute('aria-label', slotLabel(when));
            if (chosenSlot && slotKey(chosenSlot) === slotKey(when)) {
              btn.classList.add('is-chosen');
              btn.setAttribute('aria-pressed', 'true');
            }
            btn.addEventListener('click', () => {
              chosenSlot = when;
              renderWeek();
              if (showLiveErrors) renderErrors();
            });
            list.append(btn);
          });
        }

        col.append(head, list);
        return col;
      }));

      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      const fmt = { month: 'short', day: 'numeric' };
      weekLabel.textContent = `${start.toLocaleDateString('en-US', fmt)} – ${end.toLocaleDateString('en-US', fmt)}`;
      weekPrev.disabled = weekOffset <= 0;
      weekNext.disabled = weekOffset >= availability.weeksAhead;
    };

    weekPrev.addEventListener('click', () => {
      weekOffset = Math.max(0, weekOffset - 1);
      renderWeek();
    });
    weekNext.addEventListener('click', () => {
      weekOffset = Math.min(availability.weeksAhead, weekOffset + 1);
      renderWeek();
    });

    const setMatch = (strong, rest, matched) => {
      const parts = strong ? [Object.assign(document.createElement('strong'), { textContent: strong }), ` ${rest}`] : [rest];
      matchText.replaceChildren(...parts);
      matchBox.classList.toggle('is-matched', matched);
    };

    const refreshVehicle = () => {
      otherWrap.hidden = !needsOtherVehicle();
      const type = vehicleType && vehicles.types[vehicleType];
      if (type && sizeOverridden) {
        setMatch(vehicleName(), `· priced as ${sizeLabels[size]}, the size you picked.`, true);
      } else if (type) {
        setMatch(vehicleName(), `· ${type.label}, priced as ${sizeLabels[type.size]}.`, true);
      } else if (needsOtherVehicle()) {
        setMatch('', 'No problem. Tell us the vehicle and pick the closest size below.', false);
      } else if (makeSelect.value) {
        setMatch('', 'Now pick the model.', false);
      } else {
        setMatch('', 'Pick your vehicle and we’ll size it for you.', false);
      }

      const range = estimate();
      setText(estimateEl, range ? estimateText(range) : '—');
      const name = vehicleName();
      const knowsVehicle = Boolean(vehicleType) || (needsOtherVehicle() && otherInput.value.trim());
      if (!range) {
        estimateNote.textContent = 'Pick a package to see your estimate.';
      } else if (knowsVehicle) {
        estimateNote.textContent = `Rough estimate for your ${name}. Your exact price could land a little higher or lower once we see it, and we always confirm it with you before we start.`;
      } else {
        estimateNote.textContent = `Based on a ${sizeLabels[size]}. Pick your vehicle above for a closer estimate.`;
      }
      if (showLiveErrors) renderErrors();
    };

    onSizeChange = (manual) => {
      if (manual) sizeOverridden = Boolean(vehicleType) && vehicles.types[vehicleType].size !== size;
      refreshVehicle();
      renderWeek();
    };

    makeSelect.addEventListener('change', () => {
      const models = modelTypes[makeSelect.value];
      modelSelect.replaceChildren(new Option('Model', ''));
      if (models) {
        addOptions(modelSelect, Object.keys(models).sort(byName));
        modelSelect.add(new Option('Other / not listed', 'other'));
      }
      modelSelect.disabled = !models;
      vehicleType = null;
      sizeOverridden = false;
      refreshVehicle();
    });

    modelSelect.addEventListener('change', () => {
      vehicleType = (modelTypes[makeSelect.value] || {})[modelSelect.value] || null;
      sizeOverridden = false;
      if (vehicleType) setSize(vehicles.types[vehicleType].size);
      else refreshVehicle();
    });

    yearSelect.addEventListener('change', refreshVehicle);
    otherInput.addEventListener('input', refreshVehicle);

    form.addEventListener('change', (e) => {
      if (['package', 'addons', 'condition'].includes(e.target.name)) refreshVehicle();
      if (e.target.name === 'package') renderWeek(); // job length changed, so the openings change
    });

    /* Validation */

    const errors = {
      vehicle: $('#err-vehicle'),
      package: $('#err-package'),
      slot: $('#err-slot'),
      name: $('#err-name'),
      phone: $('#err-phone'),
      email: $('#err-email'),
      location: $('#err-location'),
    };
    const nameInput = $('#q-name');
    const phoneInput = $('#q-phone');
    const emailInput = $('#q-email');
    const locationInput = $('#q-location');

    // Each check returns the element to flag (and focus) when it fails, or null when it passes.
    const checks = () => [
      ['vehicle', [yearSelect, makeSelect, modelSelect].find((el) => !el.disabled && !el.value)
        || (needsOtherVehicle() && otherInput.value.trim().length < 2 ? otherInput : null),
      'Pick your vehicle’s year, make, and model.'],
      ['package', selectedPackage() ? null : $('input[name="package"]', form), 'Pick a package to continue.'],
      ['slot', chosenSlot ? null : ($('.slot', weekGrid) || weekNext), 'Pick a start time that works for you.'],
      ['name', nameInput.value.trim().length >= 2 ? null : nameInput, 'Please enter your name.'],
      ['phone', phoneInput.value.replace(/\D/g, '').length >= 10 ? null : phoneInput, 'Please enter a phone number we can text.'],
      ['email', !emailInput.value.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value.trim()) ? null : emailInput, 'That email doesn’t look quite right.'],
      ['location', locationInput.value.trim().length >= 2 ? null : locationInput, 'Let us know where the vehicle will be.'],
    ];

    const renderErrors = () => {
      $$('[aria-invalid="true"]', form).forEach((el) => el.removeAttribute('aria-invalid'));
      let first = null;
      checks().forEach(([key, el, message]) => {
        errors[key].textContent = el ? message : '';
        errors[key].hidden = !el;
        if (el) {
          if (!el.classList.contains('slot')) el.setAttribute('aria-invalid', 'true');
          first = first || el;
        }
      });
      return first;
    };

    form.addEventListener('input', () => {
      if (showLiveErrors) renderErrors();
    });

    // "Book" buttons on the package cards preselect that package in the form.
    $$('[data-book]').forEach((btn) => btn.addEventListener('click', () => {
      const radio = $(`input[name="package"][value="${btn.dataset.book}"]`, form);
      if (!radio) return;
      radio.checked = true;
      refreshVehicle();
      renderWeek();
    }));

    /* Submitting */

    const collect = () => {
      const type = vehicleType && vehicles.types[vehicleType];
      return {
        vehicle: vehicleName(),
        vehicleType: type ? type.label : 'Not in our list',
        size: sizeLabels[size],
        package: selectedPackage().name,
        addons: selectedAddons().map((a) => a.name),
        condition: selectedCondition()?.dataset.label || 'Average',
        estimate: estimateText(estimate()),
        slot: chosenSlot ? slotLabel(chosenSlot) : 'Flexible',
        name: nameInput.value.trim(),
        phone: phoneInput.value.trim(),
        email: emailInput.value.trim(),
        location: locationInput.value.trim(),
        notes: $('#q-notes').value.trim(),
      };
    };

    const summaryRows = (d) => [
      ['Requested', d.slot],
      ['Vehicle', `${d.vehicle} (${d.size})`],
      ['Package', d.package],
      ['Add-ons', d.addons.length ? d.addons.join(', ') : 'None'],
      ['Condition', d.condition],
      ['Estimate', d.estimate],
      ['Name', d.name],
      ['Phone', d.phone],
      ...(d.email ? [['Email', d.email]] : []),
      ['Location', d.location],
      ...(d.notes ? [['Notes', d.notes]] : []),
    ];

    const buildMessage = (d) => [
      "Hi! I'd like to book a detail with Wischermann Detailing.",
      '',
      ...summaryRows(d).map(([label, value]) => `${label}: ${value}`),
    ].join('\n');

    // Field names become the labels in the Formspree email.
    const formspreePayload = (d) => ({
      name: d.name,
      phone: d.phone,
      ...(d.email ? { email: d.email } : {}),
      requested_time: d.slot,
      vehicle: d.vehicle,
      vehicle_type: d.vehicleType,
      vehicle_size: d.size,
      package: d.package,
      add_ons: d.addons.join(', ') || 'None',
      condition: d.condition,
      estimate: d.estimate,
      location: d.location,
      notes: d.notes || 'None',
      _subject: `Booking request: ${d.slot} — ${d.vehicle}, ${d.package} (${d.estimate})`,
    });

    const result = $('#quote-result');
    const submitBtn = $('.quote-submit', form);
    const status = $('#quote-status');
    const copyBtn = $('#quote-copy');
    const editBtn = $('#quote-edit');
    let lastMessage = '';
    let lastMode = 'manual';

    const showResult = (d, mode) => {
      lastMessage = buildMessage(d);
      lastMode = mode;
      const firstName = d.name.split(/\s+/)[0];
      const sent = mode === 'sent';
      $('#quote-result-title').textContent = sent ? `Request sent. Thanks, ${firstName}!` : `Almost done, ${firstName}.`;
      $('#quote-result-text').textContent = sent
        ? `We’ll text you at ${d.phone} to confirm ${d.slot} and your exact price.`
        : mode === 'failed'
          ? 'We couldn’t send your request automatically. Tap below to text it to us instead.'
          : 'Tap below to text your request to us. We’ll confirm the time and your exact price.';
      $('#quote-summary').replaceChildren(...summaryRows(d).map(([label, value]) => {
        const row = document.createElement('div');
        const dt = document.createElement('dt');
        const dd = document.createElement('dd');
        dt.textContent = label;
        dd.textContent = value;
        row.append(dt, dd);
        return row;
      }));
      $('#quote-sms').href = `sms:${CONFIG.phone}?&body=${encodeURIComponent(lastMessage)}`;
      $('#quote-send').hidden = sent;
      editBtn.querySelector('span').textContent = sent ? 'Start a new request' : 'Edit request';
      form.hidden = true;
      result.hidden = false;
      result.focus({ preventScroll: true });
      result.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      showLiveErrors = true;
      const firstInvalid = renderErrors();
      if (firstInvalid) {
        status.textContent = 'Please fix the highlighted fields.';
        firstInvalid.focus();
        firstInvalid.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'center' });
        return;
      }
      status.textContent = '';
      const request = collect();

      if (form.elements._gotcha.value) { // spam bot filled the hidden field
        showResult(request, 'sent');
        return;
      }
      if (!CONFIG.formspreeId) {
        showResult(request, 'manual');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.classList.add('is-loading');
      try {
        const res = await fetch(`https://formspree.io/f/${CONFIG.formspreeId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(formspreePayload(request)),
        });
        if (!res.ok) throw new Error(`Formspree responded with ${res.status}`);
        showResult(request, 'sent');
      } catch (err) {
        console.error(err);
        showResult(request, 'failed');
      } finally {
        submitBtn.disabled = false;
        submitBtn.classList.remove('is-loading');
      }
    });

    copyBtn.addEventListener('click', async () => {
      const label = copyBtn.querySelector('span');
      try {
        await navigator.clipboard.writeText(lastMessage);
        label.textContent = 'Copied';
      } catch {
        label.textContent = 'Copy failed';
      }
      setTimeout(() => { label.textContent = 'Copy details'; }, 2000);
    });

    editBtn.addEventListener('click', () => {
      if (lastMode === 'sent') {
        form.reset();
        showLiveErrors = false;
        chosenSlot = null;
        weekOffset = 0;
        Object.values(errors).forEach((el) => { el.hidden = true; el.textContent = ''; });
        $$('[aria-invalid="true"]', form).forEach((el) => el.removeAttribute('aria-invalid'));
        makeSelect.dispatchEvent(new Event('change'));
        setSize((sizeInputs.find((input) => input.defaultChecked) || sizeInputs[0]).value);
        renderWeek();
      }
      result.hidden = true;
      form.hidden = false;
      yearSelect.focus();
    });

    refreshVehicle();
    renderWeek();
  }

  setSize(size);

  /* ---------- Before / after slider ---------- */

  // The hidden range input handles keyboard and screen readers; dragging anywhere on the photo moves it too.
  $$('.ba').forEach((ba) => {
    const range = $('.ba-range', ba);
    const sync = () => ba.style.setProperty('--pos', `${range.value}%`);
    const fromPointer = (e) => {
      const rect = ba.getBoundingClientRect();
      range.value = String(((e.clientX - rect.left) / rect.width) * 100);
      sync();
    };
    let dragging = false;
    ba.addEventListener('pointerdown', (e) => {
      dragging = true;
      ba.setPointerCapture(e.pointerId);
      range.focus({ preventScroll: true });
      fromPointer(e);
    });
    ba.addEventListener('pointermove', (e) => {
      if (dragging) fromPointer(e);
    });
    ['pointerup', 'pointercancel'].forEach((type) => ba.addEventListener(type, () => { dragging = false; }));
    range.addEventListener('input', sync);
    sync();
  });

  /* ---------- Video ---------- */

  // Nothing plays on its own for visitors who prefer reduced motion; posters stay put.
  if (reduceMotion.matches) {
    $$('video[autoplay]').forEach((video) => {
      video.removeAttribute('autoplay');
      video.pause();
    });
  }

  $$('.work-item--video').forEach((tile) => {
    const video = $('video', tile);
    const toggle = $('.video-toggle', tile);
    const icon = $('use', toggle);
    let userPaused = reduceMotion.matches;

    const sync = () => {
      toggle.setAttribute('aria-label', video.paused ? 'Play video' : 'Pause video');
      icon.setAttribute('href', video.paused ? '#i-play' : '#i-pause');
    };

    if (userPaused) {
      video.removeAttribute('autoplay');
      video.pause();
    }
    toggle.addEventListener('click', () => {
      userPaused = !video.paused;
      if (userPaused) video.pause();
      else video.play().catch(() => {});
    });
    video.addEventListener('play', sync);
    video.addEventListener('pause', sync);
    video.addEventListener('error', () => { tile.hidden = true; });

    // Only play while the clip is on screen.
    if (hasIO) {
      new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting && !userPaused) video.play().catch(() => {});
        else if (!entry.isIntersecting) video.pause();
      }, { threshold: 0.25 }).observe(tile);
    }
    sync();
  });

  /* ---------- Photo lightbox ---------- */

  const lightbox = $('#lightbox');
  const photos = $$('.work-item > img');
  if (lightbox && photos.length) {
    const lbImg = $('.lightbox-img', lightbox);
    const lbCaption = $('.lightbox-caption', lightbox);
    let index = 0;

    const show = (i) => {
      index = (i + photos.length) % photos.length;
      const img = photos[index];
      const tile = img.closest('.work-item');
      const tag = $('.photo-tag', tile);
      const caption = $('figcaption', tile);
      lbImg.src = img.src.replace('-600.', '-1200.');
      lbImg.alt = img.alt;
      lbCaption.textContent = [caption && caption.textContent.trim(), tag && tag.textContent.trim()].filter(Boolean).join(' · ');
    };

    photos.forEach((img, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'work-open';
      btn.setAttribute('aria-label', `View larger: ${img.alt}`);
      btn.addEventListener('click', () => {
        show(i);
        lightbox.showModal();
      });
      img.closest('.work-item').append(btn);
    });

    $('.lightbox-prev', lightbox).addEventListener('click', () => show(index - 1));
    $('.lightbox-next', lightbox).addEventListener('click', () => show(index + 1));
    $('.lightbox-close', lightbox).addEventListener('click', () => lightbox.close());
    lightbox.addEventListener('click', (e) => { if (e.target === lightbox) lightbox.close(); });
    lightbox.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') show(index - 1);
      if (e.key === 'ArrowRight') show(index + 1);
    });
  } else if (lightbox) {
    lightbox.remove();
  }

  /* ---------- Mobile call / quote bar ---------- */

  const mobileCta = $('.mobile-cta');
  const hero = $('.hero');
  const quoteSection = $('#quote');
  if (mobileCta && hero && quoteSection && hasIO) {
    let heroVisible = true;
    let quoteVisible = false;
    const sync = () => {
      const show = !heroVisible && !quoteVisible;
      document.body.classList.toggle('show-mobile-cta', show);
      mobileCta.inert = !show;
    };
    new IntersectionObserver(([entry]) => { heroVisible = entry.isIntersecting; sync(); }).observe(hero);
    new IntersectionObserver(([entry]) => { quoteVisible = entry.isIntersecting; sync(); }, { threshold: 0.1 }).observe(quoteSection);
    sync();
  }

  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
})();
