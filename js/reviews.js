/* Customer reviews, shown as two columns on the site: Google scrolling up, Nextdoor scrolling down.

   To add a review, copy one of the blocks in `list` and change it. `source` is 'google' or
   'nextdoor'. Use first name + last initial. Only paste reviews people actually left you, and
   leave out family and anyone who works for the business.

   When the Google numbers change, update `rating` and `count` below. */
window.WD_REVIEWS = {
  google: {
    // Your Google business profile — the link the Share button gives you.
    url: 'https://share.google/CcHpPjaMXIDrGmY3s',
    rating: 5.0,
    count: 16,
  },

  list: [
    {
      source: 'google',
      name: 'Nate S.',
      text: 'Scheduled a detail because my car was a MESS and this was an affordable price. Was hoping for it to be tidied up, but it was left looking brand new! Amazing experience and Taylor was a great guy!',
    },
    {
      source: 'google',
      name: 'MJ',
      text: 'I got a full detail and it was very well done! Taylor did an awesome job!',
    },
    {
      source: 'google',
      name: 'Morne E.',
      text: 'Best in the Business! Highly Recommend giving them a try.',
    },
    {
      // Cut off on Google's "View full review"; paste the rest in when you have it.
      source: 'google',
      name: 'Brian K.',
      text: 'Great Experience! I had considerable stains in the front seats of my Honda Civic…',
    },
    {
      source: 'google',
      name: 'Hashim K.',
      text: 'Great service, will use again soon',
    },
    {
      // Cut off on Google's "View full review"; paste the rest in when you have it.
      source: 'google',
      name: 'Chris S.',
      text: 'I had an excellent experience with Wischermann Power Washing and detailing…',
    },
    {
      source: 'google',
      name: 'Jake',
      text: 'Great service. Really good detail job. Highly recommend!',
    },
    {
      source: 'google',
      name: 'Jayron L.',
      text: 'Good',
    },

    {
      source: 'nextdoor',
      name: 'Larry H.',
      place: 'Rivermont Ave, Lynchburg',
      text: 'Reagan completely transformed my car… the cabin was so sparkly and clean it was like driving a new car… Reagan was punctual, has excellent communications skills, worked tirelessly… He is worth hiring.',
    },
    {
      source: 'nextdoor',
      name: 'St B.',
      place: 'Wooldridge/Village',
      text: 'Very professional during the quote and schedule process. The detailing was thorough, and was based on a knowledge of products and techniques. I didn’t expect the great results! I can highly recommend Wischermann Detailing.',
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
