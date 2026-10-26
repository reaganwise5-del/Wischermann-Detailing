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
      // A fast scroll can carry an element straight past the viewport without the observer
      // ever seeing it intersect, which would leave it stuck invisible. Sweep those up.
      revealEls.forEach((el) => {
        if (el.classList.contains('is-visible') || el.getBoundingClientRect().bottom > 0) return;
        el.classList.add('is-visible');
        observer.unobserve(el);
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
      const addons = selectedAddons().reduce((sum, a) => sum + a.price, 0);
      const total = pkg.prices[size] * (1 + (type ? type.adjust : 0)) * condition + addons;
      // The package price is advertised, so never quote under it — the range only ever goes up.
      const floor = pkg.prices[size] + addons;
      return {
        low: Math.max(floor, roundTo5(total * CONFIG.estimateRange.low)),
        high: Math.max(floor, roundTo5(total * CONFIG.estimateRange.high)),
      };
    };
    const estimateText = (range) => `${money(range.low)}–${money(range.high)}`;

    /* Time picker: pick a day, then a time. Who can work when lives in js/availability.js. */

    const schedule = window.WD_AVAILABILITY;
    const quick = $('#q-quick');
    const weekDays = $('#q-week-days');
    const weekTimes = $('#q-week-times');
    const weekNote = $('#q-week-note');
    const weekLabel = $('#q-week-label');
    const weekPrev = $('#q-week-prev');
    const weekNext = $('#q-week-next');
    const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const CREW_IDS = Object.keys(schedule.crew);
    let weekOffset = 0;
    let chosenSlot = null; // { key, day, minute, at, crew }
    let activeDay = null;

    const pad2 = (n) => String(n).padStart(2, '0');
    const toMinutes = (hhmm) => {
      const [h, m] = hhmm.split(':').map(Number);
      return h * 60 + m;
    };
    const lengthText = (mins) => (mins % 60 ? `${Math.floor(mins / 60)} hr ${mins % 60} min` : `${mins / 60} hr`);

    /* Shop time. Every slot is worked out in Lynchburg time, whatever clock the visitor's device is on. */

    const TZ = schedule.timeZone;
    const partsFormat = new Intl.DateTimeFormat('en-US', {
      timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
    const zoned = (ms) => {
      const p = Object.fromEntries(partsFormat.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
      return { y: +p.year, m: +p.month, d: +p.day, hh: +p.hour % 24, mm: +p.minute };
    };
    const offsetAt = (ms) => {
      const z = zoned(ms);
      return Date.UTC(z.y, z.m - 1, z.d, z.hh, z.mm) - Math.floor(ms / 60000) * 60000;
    };
    // Each day carries its UTC offset, taken at noon. DST switches at 2 am, hours before any job.
    const dayCache = new Map();
    const dayOf = (y, m, d) => {
      const u = new Date(Date.UTC(y, m - 1, d));
      const key = `${u.getUTCFullYear()}-${pad2(u.getUTCMonth() + 1)}-${pad2(u.getUTCDate())}`;
      if (dayCache.has(key)) return dayCache.get(key);
      const day = { y: u.getUTCFullYear(), m: u.getUTCMonth() + 1, d: u.getUTCDate(), wd: u.getUTCDay(), key };
      const noonGuess = Date.UTC(day.y, day.m - 1, day.d, 12);
      day.offset = offsetAt(noonGuess - offsetAt(noonGuess));
      day.noon = noonGuess - day.offset;
      dayCache.set(key, day);
      return day;
    };
    // The instant a shop-clock time happens on a given day.
    const atLocal = (day, minutes) => Date.UTC(day.y, day.m - 1, day.d, 0, minutes) - day.offset;
    const today = () => {
      const z = zoned(Date.now());
      return dayOf(z.y, z.m, z.d);
    };
    const addDays = (day, n) => dayOf(day.y, day.m, day.d + n);
    const daysBetween = (a, b) => Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86400000);
    const sameDay = (a, b) => Boolean(a && b && a.key === b.key);

    const timeText = (ms) => new Date(ms).toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });
    const dateText = (day, opts) => new Date(day.noon).toLocaleDateString('en-US', { timeZone: TZ, ...opts });
    const slotTime = (slot) => timeText(slot.at).replace(':00', '');
    const slotLabel = (slot) => `${dateText(slot.day, { weekday: 'short', month: 'short', day: 'numeric' })} at ${timeText(slot.at)}`;
    const keyFor = (day, minute) => `${day.key}T${pad2(Math.floor(minute / 60))}:${pad2(minute % 60)}`;

    /* Sunset in Lynchburg for any date — the standard sunrise equation, good to a minute or two. */

    const sunsets = new Map();
    const sunsetFor = (day) => {
      if (sunsets.has(day.key)) return sunsets.get(day.key);
      const { lat, lng } = schedule.location;
      const rad = Math.PI / 180;
      // Days since J2000, counted at noon UTC on this calendar date (rounding up instead lands on tomorrow).
      const n = Math.round(Date.UTC(day.y, day.m - 1, day.d, 12) / 86400000 + 2440587.5 - 2451545.0);
      const jStar = n - lng / 360;
      const meanAnomaly = (357.5291 + 0.98560028 * jStar) % 360;
      const centre = 1.9148 * Math.sin(meanAnomaly * rad) + 0.02 * Math.sin(2 * meanAnomaly * rad) + 0.0003 * Math.sin(3 * meanAnomaly * rad);
      const longitude = (meanAnomaly + centre + 180 + 102.9372) % 360;
      const transit = 2451545.0 + jStar + 0.0053 * Math.sin(meanAnomaly * rad) - 0.0069 * Math.sin(2 * longitude * rad);
      const sinDec = Math.sin(longitude * rad) * Math.sin(23.4397 * rad);
      const cosHour = (Math.sin(-0.833 * rad) - Math.sin(lat * rad) * sinDec) / (Math.cos(lat * rad) * Math.cos(Math.asin(sinDec)));
      const hourAngle = Math.acos(Math.min(1, Math.max(-1, cosHour))) / rad;
      const set = (transit + hourAngle / 360 - 2440587.5) * 86400000;
      sunsets.set(day.key, set);
      return set;
    };

    /* The job being booked: how long it runs and whether it needs daylight. */

    const jobPlan = () => {
      const d = schedule.durations;
      const job = selectedPackage()?.id || null;
      const addonIds = selectedAddons().map((a) => a.id);
      const threeRow = vehicleType && !sizeOverridden && schedule.threeRowTypes.includes(vehicleType);
      const minutes = (job ? d.base[job] : Math.min(...Object.values(d.base)))
        + (threeRow ? d.size['three-row'] : (d.size[size] || 0))
        + (d.condition[selectedCondition()?.value] ?? d.condition.normal)
        + addonIds.reduce((sum, id) => sum + (d.addons[id] || 0), 0);
      return {
        job,
        minutes,
        daylightJob: Boolean(job) && schedule.daylight.jobs.includes(job),
        daylightAddon: addonIds.some((id) => schedule.daylight.addons.includes(id)),
      };
    };

    /* Time already spoken for — blocked by hand in availability.js, or booked through the site. */

    let takenLocal = [];
    let takenShared = [];

    const parseSlot = (value) => {
      const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(value || '').trim());
      return m ? atLocal(dayOf(+m[1], +m[2], +m[3]), +m[4] * 60 + +m[5]) : null;
    };

    // Accepts '2026-11-07T10:00', ['2026-11-07T10:00', 90], or { slot, minutes, crew }.
    // No crew means the time is blocked for everyone.
    const toBusy = (entry) => {
      const isObj = entry && typeof entry === 'object' && !Array.isArray(entry);
      const raw = Array.isArray(entry) ? entry[0] : (isObj ? entry.slot : entry);
      const mins = Array.isArray(entry) ? entry[1] : (isObj ? entry.minutes : null);
      const crew = isObj && CREW_IDS.includes(entry.crew) ? entry.crew : null;
      const start = parseSlot(raw);
      if (start === null) return null;
      const length = Number(mins) > 0 ? Number(mins) : (schedule.blockMinutes || 180);
      return { start, end: start + length * 60000, crew };
    };

    takenLocal = (schedule.booked || []).map(toBusy).filter(Boolean);
    const allBusy = () => takenLocal.concat(takenShared);

    // A detailer can't take a job that runs into another one, with travel time either side.
    const isBusy = (crewId, start, end, busy) => {
      const gap = schedule.bufferMinutes * 60000;
      return busy.some((b) => (!b.crew || b.crew === crewId) && start < b.end + gap && end + gap > b.start);
    };

    // When both can take it, give it to whoever has less on the books that week, so jobs alternate.
    const pickCrew = (crews, day, busy) => {
      if (crews.length === 1) return crews[0];
      const weekStart = atLocal(addDays(day, -((day.wd + 6) % 7)), 0);
      const weekEnd = weekStart + 7 * 86400000;
      const load = (id) => busy.reduce((sum, b) => sum + (b.crew === id && b.start >= weekStart && b.start < weekEnd ? b.end - b.start : 0), 0);
      return crews.reduce((best, id) => (load(id) < load(best) ? id : best));
    };

    const loadShared = async () => {
      if (!schedule.apiPath) return false;
      const res = await fetch(schedule.apiPath, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`Slots endpoint responded with ${res.status}`);
      const data = await res.json();
      takenShared = (data.booked || []).map(toBusy).filter(Boolean);
      return data.storage === true;
    };

    // Tell the site a spot is gone so it stops showing up for everyone else.
    const holdSlot = async (slot, minutes) => {
      if (!schedule.apiPath || !slot) return;
      await fetch(schedule.apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ slot: slot.key, minutes, crew: slot.crew }),
      });
      takenShared.push({ start: slot.at, end: slot.at + minutes * 60000, crew: slot.crew });
    };

    // After a block's first start, starts fall on the hour and half hour.
    const nextStart = (minute) => {
      const step = schedule.slotStepMinutes;
      return minute % step ? Math.ceil(minute / step) * step : minute + step;
    };

    // Every start time on this day that at least one detailer can take, with who'd take it.
    const slotsFor = (day, plan) => {
      const busy = allBusy();
      const earliest = Date.now() + schedule.leadTimeHours * 3600000;
      const sunset = sunsetFor(day);
      const byMinute = new Map();

      CREW_IDS.forEach((crewId) => {
        (schedule.crew[crewId].week[DAY_KEYS[day.wd]] || []).forEach((block) => {
          if (plan.job && block.allowed && !block.allowed.includes(plan.job)) return;
          const latest = plan.job && block.latest && block.latest[plan.job] ? toMinutes(block.latest[plan.job]) : null;
          // Taylor's latest starts already allow for daylight on the job itself. A daylight add-on he
          // didn't plan around still has to be done before sunset.
          const mustBeatSunset = plan.daylightAddon || (plan.daylightJob && latest === null);
          const close = toMinutes(block.end);

          for (let minute = toMinutes(block.start); minute + plan.minutes <= close; minute = nextStart(minute)) {
            if (latest !== null && minute > latest) break;
            const start = atLocal(day, minute);
            const end = start + plan.minutes * 60000;
            if (mustBeatSunset && end > sunset) break; // later starts only finish later
            if (start < earliest || isBusy(crewId, start, end, busy)) continue;
            const slot = byMinute.get(minute) || { key: keyFor(day, minute), day, minute, at: start, crews: [] };
            slot.crews.push(crewId);
            byMinute.set(minute, slot);
          }
        });
      });

      return [...byMinute.values()]
        .sort((a, b) => a.minute - b.minute)
        .map((slot) => ({ ...slot, crew: pickCrew(slot.crews, day, busy) }));
    };

    // Times sit in these bands so a day never turns into one long list.
    const BANDS = [['Morning', 0, 12 * 60], ['Afternoon', 12 * 60, 17 * 60], ['Evening', 17 * 60, 24 * 60]];
    const QUICK_PICKS = 4;

    // The week runs from today, not from Sunday, so a day that has already gone never shows up.
    const windowStart = (offset) => addDays(today(), offset * 7);
    const offsetFor = (day) => Math.max(0, Math.floor(daysBetween(today(), day) / 7));
    const dayRelative = (day) => {
      const n = daysBetween(today(), day);
      if (n === 0) return 'Today';
      if (n === 1) return 'Tomorrow';
      return dateText(day, { weekday: 'long' });
    };

    const isChosen = (slot) => Boolean(chosenSlot && chosenSlot.key === slot.key);

    const chooseSlot = (slot) => {
      chosenSlot = slot;
      activeDay = slot.day;
      weekOffset = offsetFor(slot.day);
      renderWeek();
      if (showLiveErrors) renderErrors();
    };

    const slotButton = (slot) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'slot';
      btn.textContent = slotTime(slot);
      btn.setAttribute('aria-label', slotLabel(slot));
      btn.setAttribute('aria-pressed', isChosen(slot) ? 'true' : 'false');
      if (isChosen(slot)) btn.classList.add('is-chosen');
      btn.addEventListener('click', () => chooseSlot(slot));
      return btn;
    };

    // The next few openings, for anyone who just wants the soonest one.
    const renderQuick = (plan) => {
      const picks = [];
      for (let i = 0; i <= schedule.weeksAhead * 7 && picks.length < QUICK_PICKS; i++) {
        // At most two per day, so the row spreads across days instead of stacking on one.
        slotsFor(addDays(today(), i), plan).slice(0, 2).forEach((slot) => { if (picks.length < QUICK_PICKS) picks.push(slot); });
      }

      quick.hidden = !picks.length;
      if (!picks.length) return;

      const label = document.createElement('p');
      label.className = 'quick-label';
      label.textContent = picks.length < QUICK_PICKS ? 'Next opening' : 'Soonest openings';

      const row = document.createElement('div');
      row.className = 'quick-row';
      picks.forEach((slot) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'quick-pick';
        if (isChosen(slot)) btn.classList.add('is-chosen');
        btn.setAttribute('aria-pressed', isChosen(slot) ? 'true' : 'false');
        btn.setAttribute('aria-label', slotLabel(slot));
        btn.append(
          Object.assign(document.createElement('span'), { className: 'quick-day', textContent: dayRelative(slot.day) }),
          Object.assign(document.createElement('span'), { className: 'quick-time', textContent: slotTime(slot) }),
        );
        btn.addEventListener('click', () => chooseSlot(slot));
        row.append(btn);
      });

      quick.replaceChildren(label, row);
    };

    const renderTimes = (day, slots) => {
      if (!day) {
        weekTimes.replaceChildren(Object.assign(document.createElement('p'), {
          className: 'times-empty',
          textContent: 'Nothing open in these seven days — try the arrow for the next stretch.',
        }));
        return;
      }

      const head = document.createElement('div');
      head.className = 'times-head';
      head.append(
        Object.assign(document.createElement('p'), { className: 'times-day', textContent: dateText(day, { weekday: 'long', month: 'short', day: 'numeric' }) }),
        Object.assign(document.createElement('p'), { className: 'times-meta', textContent: slots.length ? `${slots.length} open` : 'No openings' }),
      );

      const body = document.createElement('div');
      body.className = 'times-body';

      if (!slots.length) {
        body.append(Object.assign(document.createElement('p'), {
          className: 'times-empty',
          textContent: 'Nothing open this day. Pick another day above, or text us and we’ll work you in.',
        }));
      } else {
        BANDS.forEach(([name, from, to]) => {
          const inBand = slots.filter((slot) => slot.minute >= from && slot.minute < to);
          if (!inBand.length) return;
          const band = document.createElement('div');
          band.className = 'times-band';
          band.append(Object.assign(document.createElement('p'), { className: 'times-band-label', textContent: name }));
          const row = document.createElement('div');
          row.className = 'times-row';
          inBand.forEach((slot) => row.append(slotButton(slot)));
          band.append(row);
          body.append(band);
        });
      }

      weekTimes.replaceChildren(head, body);
    };

    const renderWeek = () => {
      const plan = jobPlan();

      // A longer job, a daylight add-on or someone else's booking can take a spot that was free a
      // moment ago. If it's still there, pick up who'd now take it.
      if (chosenSlot) {
        chosenSlot = slotsFor(chosenSlot.day, plan).find((slot) => slot.key === chosenSlot.key) || null;
      }
      if (chosenSlot) activeDay = chosenSlot.day;

      const start = windowStart(weekOffset);
      const days = Array.from({ length: 7 }, (_, i) => {
        const date = addDays(start, i);
        return { date, slots: slotsFor(date, plan) };
      });

      // Land on a day that has something on it rather than an empty one.
      let current = days.find((d) => sameDay(d.date, activeDay));
      if (!current || !current.slots.length) current = days.find((d) => d.slots.length) || null;
      activeDay = current ? current.date : null;

      const todayDay = today();
      weekDays.replaceChildren(...days.map(({ date, slots }) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'day';
        btn.disabled = !slots.length;
        if (sameDay(date, todayDay)) btn.classList.add('day--today');
        if (sameDay(date, activeDay)) btn.classList.add('is-active');
        btn.setAttribute('aria-pressed', sameDay(date, activeDay) ? 'true' : 'false');
        btn.setAttribute('aria-label', `${dateText(date, { weekday: 'long', month: 'long', day: 'numeric' })} — ${slots.length ? `${slots.length} open` : 'nothing open'}`);
        btn.append(
          Object.assign(document.createElement('span'), { className: 'day-name', textContent: DAY_NAMES[date.wd] }),
          Object.assign(document.createElement('span'), { className: 'day-num', textContent: date.d }),
          Object.assign(document.createElement('span'), { className: 'day-dot' }),
        );
        btn.addEventListener('click', () => {
          activeDay = date;
          renderWeek();
        });
        return btn;
      }));

      renderTimes(activeDay, current ? current.slots : []);
      renderQuick(plan);

      const fmt = { month: 'short', day: 'numeric' };
      const end = addDays(start, 6);
      weekLabel.textContent = weekOffset === 0
        ? `Today – ${dateText(end, fmt)}`
        : `${dateText(start, fmt)} – ${dateText(end, fmt)}`;
      const outside = plan.daylightJob || plan.daylightAddon;
      weekNote.textContent = `Each opening fits your job — about ${lengthText(plan.minutes)}${outside ? ', wrapping up before dark' : ''}. We’ll text you to confirm the spot before it’s locked in.`;
      weekPrev.disabled = weekOffset <= 0;
      weekNext.disabled = weekOffset >= schedule.weeksAhead;
    };

    weekPrev.addEventListener('click', () => {
      weekOffset = Math.max(0, weekOffset - 1);
      activeDay = null;
      renderWeek();
    });
    weekNext.addEventListener('click', () => {
      weekOffset = Math.min(schedule.weeksAhead, weekOffset + 1);
      activeDay = null;
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
      if (!['package', 'addons', 'condition'].includes(e.target.name)) return;
      refreshVehicle();
      renderWeek(); // job length or daylight need changed, so the openings change
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
      ['slot', chosenSlot ? null : ($('.slot', weekTimes) || weekNext), 'Pick a start time that works for you.'],
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
        detailer: chosenSlot ? schedule.crew[chosenSlot.crew].name : 'Unassigned',
        jobLength: lengthText(jobPlan().minutes),
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
      // Internal only: who the calendar was blocked for, and for how long. Reassign freely.
      detailer: d.detailer,
      job_length: d.jobLength,
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

      const plan = jobPlan();
      let held = chosenSlot;

      submitBtn.disabled = true;
      submitBtn.classList.add('is-loading');
      try {
        // Someone may have taken this spot while the form was open.
        try {
          await loadShared();
        } catch (err) {
          console.warn('Could not refresh booked times', err);
        }
        // Still open? If one detailer got booked meanwhile, the other may still be free for it.
        held = held && (slotsFor(held.day, plan).find((slot) => slot.key === held.key) || null);
        if (held) {
          chosenSlot = held;
          request.detailer = schedule.crew[held.crew].name;
        } else {
          chosenSlot = null;
          renderWeek();
          showLiveErrors = true;
          renderErrors();
          status.textContent = 'Sorry — that spot was just booked. Please pick another time.';
          weekTimes.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'center' });
          return;
        }

        const res = await fetch(`https://formspree.io/f/${CONFIG.formspreeId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(formspreePayload(request)),
        });
        if (!res.ok) throw new Error(`Formspree responded with ${res.status}`);
        try {
          await holdSlot(held, plan.minutes);
        } catch (err) {
          console.warn('Could not mark the spot as taken', err); // the request still went through
        }
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

    // Spots other people already booked, so they stop showing up here.
    loadShared().then(renderWeek).catch((err) => console.warn('Could not load booked times', err));
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

  /* ---------- Reviews ---------- */

  {
    const data = window.WD_REVIEWS;
    const scoreBox = $('#review-score');
    const feedBox = $('#review-feed');

    if (data && scoreBox && feedBox) {
      const svgNS = 'http://www.w3.org/2000/svg';
      const icon = (id, className) => {
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('class', className);
        svg.setAttribute('aria-hidden', 'true');
        const use = document.createElementNS(svgNS, 'use');
        use.setAttribute('href', `#${id}`);
        svg.append(use);
        return svg;
      };

      // Nextdoor's own mark isn't ours to ship, so the name stands in for it.
      const sourceMark = (key) => {
        const wrap = document.createElement('span');
        wrap.className = `mark mark--${key}`;
        if (key === 'google') {
          wrap.append(icon('logo-google', 'mark-logo'), Object.assign(document.createElement('span'), { textContent: 'Google' }));
        } else {
          wrap.append(Object.assign(document.createElement('span'), { className: 'mark-word', textContent: 'Nextdoor' }));
        }
        return wrap;
      };

      const stars = (rating) => {
        const row = document.createElement('span');
        row.className = 'stars';
        row.setAttribute('role', 'img');
        row.setAttribute('aria-label', `${rating} out of 5 stars`);
        for (let i = 0; i < 5; i++) {
          const star = icon('i-star', 'star');
          if (i >= Math.round(rating)) star.classList.add('star--off');
          row.append(star);
        }
        return row;
      };

      // The panel asks for a review rather than counting them.
      const renderScore = () => {
        const google = data.sources.google || {};
        const parts = [];

        if (google.rating) {
          const score = document.createElement('div');
          score.className = 'score-rating';
          score.append(
            stars(google.rating),
            Object.assign(document.createElement('p'), { className: 'score-number', textContent: `${Number(google.rating).toFixed(1)} on Google` }),
          );
          parts.push(score);
        }

        const pitch = document.createElement('div');
        pitch.className = 'score-pitch';
        pitch.append(
          Object.assign(document.createElement('p'), { className: 'score-eyebrow', textContent: 'Reviews mean everything' }),
          Object.assign(document.createElement('p'), { className: 'score-title', textContent: 'Had us out? Tell people.' }),
          Object.assign(document.createElement('p'), { className: 'score-copy', textContent: 'We’re a young crew building this one car at a time. If we did right by yours, a review on Google does more for us than anything else.' }),
        );
        parts.push(pitch);

        const target = google.writeUrl && !google.writeUrl.endsWith('=') ? google.writeUrl : google.url;
        if (target) {
          const cta = document.createElement('a');
          cta.className = 'btn btn-primary score-link';
          cta.href = target;
          cta.target = '_blank';
          cta.rel = 'noopener';
          cta.append(icon('logo-google', 'mark-logo'), Object.assign(document.createElement('span'), { textContent: 'Review us on Google' }));
          parts.push(cta);
        }

        scoreBox.replaceChildren(...parts);
      };

      const renderFeed = () => {
        const ordered = data.list.slice().sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));

        feedBox.replaceChildren(...ordered.map((review) => {
          const card = document.createElement('figure');
          card.className = 'review';
          if (review.featured) card.classList.add('review--featured');

          const top = document.createElement('div');
          top.className = 'review-top';
          top.append(sourceMark(review.source));
          if (review.rating) top.append(stars(review.rating));

          const quote = document.createElement('blockquote');
          quote.append(Object.assign(document.createElement('p'), { textContent: review.text }));

          const cap = document.createElement('figcaption');
          const who = document.createElement('span');
          who.append(
            Object.assign(document.createElement('span'), { className: 'review-name', textContent: review.name }),
            Object.assign(document.createElement('span'), { className: 'review-source', textContent: review.place || data.sources[review.source].name }),
          );
          cap.append(
            Object.assign(document.createElement('span'), { className: 'review-avatar', textContent: review.name.trim().charAt(0), ariaHidden: 'true' }),
            who,
          );

          card.append(top, quote, cap);
          return card;
        }));
      };

      renderScore();
      renderFeed();
    }
  }

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
