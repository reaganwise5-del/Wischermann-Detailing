/* Booked start times, shared by every visitor.
   GET  /api/slots                                  -> { booked: [{ slot, minutes }], storage }
   POST /api/slots  { slot: '2026-09-26T13:30', minutes: 180 }

   Storage is a Redis database over its REST API, so there are no packages to install. Connect one
   in Vercel (Storage -> Upstash Redis) and this switches itself on. With no database connected the
   site still works exactly as before — it just can't remember bookings between visitors. */

const KEY = 'wd:booked';
const MAX_ENTRIES = 800;
const SLOT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

const credentials = () => {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/+$/, ''), token } : null;
};

const command = async (creds, parts) => {
  const res = await fetch(creds.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${creds.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(parts),
  });
  if (!res.ok) throw new Error(`Redis responded with ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.result;
};

// Slots are written in the shop's own local time, so compare loosely and keep a day of slack.
const isPast = (entry) => {
  const stamp = Date.parse(`${entry.slot}:00Z`);
  return Number.isFinite(stamp) && stamp < Date.now() - 36 * 3600000;
};

const load = async (creds) => {
  const raw = await command(creds, ['GET', KEY]);
  if (!raw) return [];
  const list = JSON.parse(raw);
  return Array.isArray(list) ? list.filter((entry) => entry && SLOT_RE.test(entry.slot) && !isPast(entry)) : [];
};

const save = (creds, list) => command(creds, ['SET', KEY, JSON.stringify(list.slice(-MAX_ENTRIES))]);

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  const creds = credentials();
  if (!creds) return res.status(200).json({ booked: [], storage: false });

  try {
    if (req.method === 'GET') {
      return res.status(200).json({ booked: await load(creds), storage: true });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const slot = String(body.slot || '').trim();
      const minutes = Math.round(Number(body.minutes));
      if (!SLOT_RE.test(slot) || !(minutes >= 15 && minutes <= 600)) {
        return res.status(400).json({ ok: false, error: 'Expected { slot: "YYYY-MM-DDTHH:MM", minutes }' });
      }

      const list = await load(creds);
      const existing = list.find((entry) => entry.slot === slot);
      if (existing) {
        existing.minutes = Math.max(existing.minutes, minutes); // keep the longer hold
      } else {
        list.push({ slot, minutes, at: new Date().toISOString() });
      }
      await save(creds, list);
      return res.status(200).json({ ok: true, storage: true, booked: list });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    // Never let the storage layer break a booking: the quote itself is emailed separately.
    console.error('slots endpoint failed', err);
    return res.status(200).json({ booked: [], storage: false, error: 'unavailable' });
  }
};
