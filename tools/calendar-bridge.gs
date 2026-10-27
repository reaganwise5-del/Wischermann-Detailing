/* Wischermann Detailing — calendar bridge for wischermanndetailing.com

   Paste this into a new project at script.google.com (signed in to the Google account that owns
   the calendar), then Deploy -> New deployment -> Web app, execute as Me, access Anyone.

   What it does:
   - Every booking made on the website lands on the calendar below, marked "Pending".
   - Anything on that calendar blocks those times on the website. Put "Taylor" or "Chase" in an
     event's title to block only that person; anything else blocks both. All-day events block the
     whole day.

   The website only ever sees *when* someone is busy and for whom. Titles, customer details and
   anything else on the calendar never leave Google. */

const CALENDAR_NAME = 'Wischermann Detailing'; // your calendar's name (capital letters don't matter)
const CREW = ['taylor', 'chase'];
const WEEKS_AHEAD = 6;
const MAX_NEW_PER_HOUR = 15; // the website can't add more than this many bookings an hour

function calendar_() {
  const want = CALENDAR_NAME.trim().toLowerCase();
  const cal = CalendarApp.getAllCalendars().find((c) => c.getName().trim().toLowerCase() === want);
  if (!cal) throw new Error(`No calendar called "${CALENDAR_NAME}" on this Google account.`);
  return cal;
}

function json_(data) {
  return ContentService.createTextOutput(typeof data === 'string' ? data : JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// Who an event belongs to: tagged by the website, or named in the title. Neither means everyone.
function crewOf_(event) {
  const tagged = event.getTag('crew');
  if (CREW.includes(tagged)) return tagged;
  const title = event.getTitle().toLowerCase();
  const named = CREW.filter((id) => title.includes(id));
  return named.length === 1 ? named[0] : null;
}

// GET: busy times for the next few weeks. Add ?ping=1 to just check the calendar is found.
function doGet(e) {
  try {
    const cal = calendar_();
    if (e && e.parameter && e.parameter.ping) return json_({ ok: true, calendar: cal.getName() });

    const cache = CacheService.getScriptCache();
    const cached = cache.get('busy');
    if (cached) return json_(cached);

    const now = new Date();
    const until = new Date(now.getTime() + WEEKS_AHEAD * 7 * 86400000);
    const busy = cal.getEvents(now, until).map((event) => ({
      start: event.getStartTime().getTime(),
      end: event.getEndTime().getTime(),
      crew: crewOf_(event),
    }));
    const body = JSON.stringify({ ok: true, busy });
    cache.put('busy', body, 120); // two minutes; a new booking clears it straight away
    return json_(body);
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

// POST: add a booking from the website.
function doPost(e) {
  try {
    const b = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const now = Date.now();
    const start = new Date(b.start);
    const minutes = Math.round(Number(b.minutes));
    const crew = CREW.includes(b.crew) ? b.crew : null;

    if (isNaN(start.getTime()) || start.getTime() < now - 3600000 || start.getTime() > now + (WEEKS_AHEAD + 1) * 7 * 86400000) {
      return json_({ ok: false, error: 'start time out of range' });
    }
    if (!(minutes >= 15 && minutes <= 900)) return json_({ ok: false, error: 'job length out of range' });

    // A cap, in case anyone ever finds this address and tries to fill the calendar with junk.
    const cache = CacheService.getScriptCache();
    const hourKey = `added-${Math.floor(now / 3600000)}`;
    const added = Number(cache.get(hourKey) || 0);
    if (added >= MAX_NEW_PER_HOUR) return json_({ ok: false, error: 'too many bookings this hour' });
    cache.put(hourKey, String(added + 1), 3600);

    const text = (value, max) => String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max || 300);
    const who = crew ? crew.charAt(0).toUpperCase() + crew.slice(1) : 'Unassigned';
    const title = `Pending: ${text(b.package, 40)} for ${text(b.name, 60)} (${text(b.vehicle, 60)}) — ${who}`;
    const details = [
      ['Phone', b.phone], ['Email', b.email], ['Where', b.location], ['Vehicle', b.vehicle],
      ['Package', b.package], ['Add-ons', b.addons], ['Condition', b.condition], ['Estimate', b.estimate],
      ['Job length', b.jobLength], ['Detailer', who], ['Notes', b.notes],
    ].filter(([, value]) => text(value)).map(([label, value]) => `${label}: ${text(value, 500)}`).join('\n');

    const event = calendar_().createEvent(title, start, new Date(start.getTime() + minutes * 60000), {
      description: `${details}\n\nBooked on wischermanndetailing.com. Text the customer to confirm, then take "Pending" off the title.`,
      location: text(b.location, 200),
    });
    if (crew) event.setTag('crew', crew);
    event.setColor(CalendarApp.EventColor.YELLOW);
    cache.remove('busy');
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}
