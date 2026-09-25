/* Customer reviews and where they came from.

   To add a review, copy one of the blocks in `list` and change it. `source` must be
   'google' or 'nextdoor'. `rating` is that customer's star rating (leave it out for
   Nextdoor recommendations, which don't have stars). Mark one `featured: true` and it
   sits at the top of the feed.

   Only paste reviews people actually left you. */
window.WD_REVIEWS = {
  sources: {
    google: {
      name: 'Google',
      // Your Google business profile — the link the Share button gives you.
      url: 'https://share.google/CcHpPjaMXIDrGmY3s',
      // Optional: a link that opens Google with the star picker already showing.
      writeUrl: '',
      // Optional: your star rating. Set it and the stars appear above the ask.
      // The number of reviews is never shown.
      rating: null,
    },
    nextdoor: {
      name: 'Nextdoor',
      url: '',
    },
  },

  list: [
    {
      source: 'nextdoor',
      name: 'Larry H.',
      place: 'Rivermont Ave, Lynchburg',
      featured: true,
      text: 'Reagan completely transformed my car… the cabin was so sparkly and clean it was like driving a new car… Reagan was punctual, has excellent communications skills, worked tirelessly… He is worth hiring.',
    },
    {
      source: 'nextdoor',
      name: 'Tuba B.',
      place: 'Lynchburg',
      text: 'A highly responsible young man, Reagan came and cleaned my SUV in and out in a very detailed way… I definitely recommend his service to everyone. He did an excellent job. He was also very kind and reliable.',
    },
    {
      source: 'nextdoor',
      name: 'Sydney L.',
      place: 'Lynchburg',
      text: 'I really recommend Reagan! … reliable, affordable, pleasant, and very detailed! We are so happy with our vehicles! … He responds quickly!!',
    },
  ],
};
