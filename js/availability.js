/* When appointments can start.
   Right now these are Taylor's "Car detailing" windows from his weekly schedule.
   Edit the windows below any time: ['start', 'end'] on a 24-hour clock, as many per day as you like. */
window.WD_AVAILABILITY = {
  windows: {
    sun: [['13:00', '17:00']],
    mon: [['10:00', '12:00'], ['17:30', '20:30']],
    tue: [['17:30', '20:30']],
    wed: [['10:00', '12:00'], ['17:30', '20:30']],
    thu: [['17:30', '20:30']],
    fri: [['10:00', '12:00'], ['17:30', '20:30']],
    sat: [['10:00', '12:00'], ['13:30', '17:30']],
  },

  // A start time is offered every 30 minutes, as long as the whole job fits inside the window.
  slotStepMinutes: 30,

  // Don't offer anything sooner than this many hours from now.
  leadTimeHours: 12,

  // A job may run this many minutes past the end of a window (Taylor's schedule has a 30-minute
  // grace period after detailing). Raise it if you're happy to run later, lower it to be strict.
  graceMinutes: 30,

  // How many weeks ahead the arrows go.
  weeksAhead: 4,

  // Roughly how long each package takes, in minutes. Bigger vehicles add the extra below.
  durations: { exterior: 90, interior: 120, full: 180 },
  sizeExtraMinutes: { car: 0, suv: 30, truck: 45 },

  // Times already taken or blocked off. Format: 'YYYY-MM-DDTHH:MM'.
  // Add one here and it disappears from the site, e.g. '2026-09-23T17:30'.
  booked: [],
};
