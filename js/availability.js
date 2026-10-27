/* Who can take a job, and when. The booking picker reads everything below.

   Times are Lynchburg time on a 24-hour clock. Each detailer has blocks per weekday:
     start / end   when they're free. A job has to be finished by `end`.
     allowed       only these job types fit in this block (e.g. ['interior']).
     latest        the latest start per job type. Taylor set his own, and they already allow for
                   sunset on that job type, so they win over the computed daylight check.

   Source: Chase's written availability and Taylor's schedule grid, both Oct 25 2026. */
window.WD_AVAILABILITY = {
  timeZone: 'America/New_York',
  location: { lat: 37.4138, lng: -79.1422 }, // Lynchburg, for sunset

  // Minutes. A job's length = base + vehicle size + condition + every add-on picked.
  durations: {
    base: { exterior: 120, interior: 120, full: 210 },
    size: { car: 0, suv: 30, truck: 45, 'three-row': 60 },
    condition: { light: 0, normal: 20, heavy: 45 },
    addons: {
      'pet-hair': 35,
      shampoo: 60,
      steam: 40,
      odor: 20,
      'clay-bar': 40,
      iron: 30,
      'water-spots': 35,
      headlights: 40,
      ceramic: 25,
      'tire-shine': 10,
      trim: 25,
      'engine-bay': 35,
    },
  },

  // Body styles from vehicles.js that get the 3-row SUV time instead of the regular size time.
  threeRowTypes: ['three-row', 'large-suv'],

  // Work that has to be finished before sunset. Everything else is fine with a work light.
  daylight: {
    jobs: ['exterior', 'full'],
    addons: ['headlights', 'water-spots', 'clay-bar', 'ceramic', 'trim', 'iron', 'tire-shine'],
  },

  bufferMinutes: 30, // travel and setup between back-to-back jobs for the same detailer
  slotStepMinutes: 30, // after a block's first start, times fall on the hour and half hour
  leadTimeHours: 12, // nothing sooner than this from now
  weeksAhead: 4,

  crew: {
    taylor: {
      name: 'Taylor',
      // Hard cutoff 18:45. No full details on Tuesday or Thursday — both windows are too short.
      week: {
        mon: [
          { start: '06:15', end: '10:00', latest: { full: '06:30', interior: '08:00' } },
          { start: '16:00', end: '18:45', allowed: ['interior'] },
        ],
        tue: [
          { start: '07:00', end: '09:15', allowed: ['interior'] },
          { start: '11:45', end: '13:45', allowed: ['interior'] },
        ],
        wed: [{ start: '06:15', end: '18:45', latest: { full: '16:00', interior: '17:00' } }],
        thu: [
          { start: '07:00', end: '09:15', allowed: ['interior'] },
          { start: '11:45', end: '13:45', allowed: ['interior'] },
        ],
        fri: [{ start: '07:00', end: '15:30', latest: { full: '10:00', interior: '11:30' } }],
        sat: [{ start: '06:15', end: '18:45', latest: { full: '16:00', interior: '17:00' } }],
        sun: [{ start: '13:00', end: '18:45', latest: { full: '17:00', interior: '17:00' } }],
      },
    },
    chase: {
      name: 'Chase',
      // Hard cutoff 18:00. His windows are raw availability, so the sunset check does real work here.
      week: {
        mon: [{ start: '16:00', end: '18:00' }], // might start at 15:00 if practice ends early
        tue: [{ start: '11:30', end: '15:00' }],
        wed: [{ start: '10:10', end: '18:00' }], // recovery day, his best for long details
        thu: [{ start: '11:30', end: '14:00' }],
        fri: [{ start: '10:10', end: '18:00' }],
        sat: [], // "mornings, varies" — can't be booked online until he gives a window
        sun: [{ start: '13:00', end: '18:00' }],
      },
    },
  },

  // Where bookings made on the site are kept, so a spot someone takes disappears for everyone.
  apiPath: '/api/slots',

  // The Google Calendar bridge: the web-app link from script.google.com (tools/calendar-bridge.gs).
  // Every booking is added to the Wischermann Detailing calendar, and anything on that calendar
  // blocks the site. Leave it empty to switch it off.
  calendarUrl: 'https://script.google.com/macros/s/AKfycbzh-4ks8Tyrwm1MAkXG15T6jIqnEJ81fM5vhaaHJJd9L9g-dEd8CPx54kOQZzXXuX72/exec',

  // Times blocked off by hand. '2026-11-07T10:00' blocks everyone for `blockMinutes`;
  // { slot: '2026-11-07T10:00', minutes: 90, crew: 'chase' } blocks one detailer.
  blockMinutes: 180,
  booked: [],
};
