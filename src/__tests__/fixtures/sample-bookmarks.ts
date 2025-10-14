/**
 * Sample bookmark data for integration testing
 * This represents a realistic set of bookmarks that would trigger the empty categories bug
 */

export const sampleBookmarks = [
  // Technology & Development
  {
    id: '1',
    title: 'GitHub - The world\'s leading software development platform',
    url: 'https://github.com'
  },
  {
    id: '2',
    title: 'Stack Overflow - Where Developers Learn, Share, & Build Careers',
    url: 'https://stackoverflow.com'
  },
  {
    id: '3',
    title: 'MDN Web Docs',
    url: 'https://developer.mozilla.org'
  },
  {
    id: '4',
    title: 'TypeScript: JavaScript With Syntax For Types',
    url: 'https://www.typescriptlang.org'
  },
  {
    id: '5',
    title: 'React – A JavaScript library for building user interfaces',
    url: 'https://react.dev'
  },

  // News & Media
  {
    id: '6',
    title: 'BBC News - Home',
    url: 'https://www.bbc.com/news'
  },
  {
    id: '7',
    title: 'The New York Times',
    url: 'https://www.nytimes.com'
  },
  {
    id: '8',
    title: 'TechCrunch – Startup and Technology News',
    url: 'https://techcrunch.com'
  },

  // Shopping
  {
    id: '9',
    title: 'Amazon.com: Online Shopping',
    url: 'https://www.amazon.com'
  },
  {
    id: '10',
    title: 'eBay: Electronics, Cars, Fashion & More',
    url: 'https://www.ebay.com'
  },
  {
    id: '11',
    title: 'Etsy - Shop for handmade, vintage, custom',
    url: 'https://www.etsy.com'
  },

  // Entertainment
  {
    id: '12',
    title: 'YouTube',
    url: 'https://www.youtube.com'
  },
  {
    id: '13',
    title: 'Netflix',
    url: 'https://www.netflix.com'
  },
  {
    id: '14',
    title: 'Spotify - Web Player',
    url: 'https://open.spotify.com'
  },
  {
    id: '15',
    title: 'Reddit - Dive into anything',
    url: 'https://www.reddit.com'
  },

  // Social Media
  {
    id: '16',
    title: 'Twitter / X',
    url: 'https://twitter.com'
  },
  {
    id: '17',
    title: 'LinkedIn: Log In or Sign Up',
    url: 'https://www.linkedin.com'
  },
  {
    id: '18',
    title: 'Instagram',
    url: 'https://www.instagram.com'
  },

  // Education & Learning
  {
    id: '19',
    title: 'Coursera | Online Courses',
    url: 'https://www.coursera.org'
  },
  {
    id: '20',
    title: 'Khan Academy | Free Online Courses',
    url: 'https://www.khanacademy.org'
  },
  {
    id: '21',
    title: 'edX | Free Online Courses',
    url: 'https://www.edx.org'
  }
];

// Empty categories configuration that would trigger the bug
export const emptyCategories: string[] = [];

// Minimal categories configuration (1-2 categories)
export const minimalCategories = [
  'Technology',
  'Other'
];

// Good categories configuration
export const goodCategories = [
  'Technology & Development',
  'News & Media',
  'Shopping & E-commerce',
  'Entertainment & Streaming',
  'Social Media',
  'Education & Learning'
];

// Excessive categories (too many, would cause issues)
export const excessiveCategories = [
  'JavaScript',
  'TypeScript',
  'React',
  'Vue',
  'Angular',
  'Node.js',
  'Python',
  'Java',
  'C++',
  'Rust',
  'Go',
  'Ruby',
  'PHP',
  'Swift',
  'Kotlin',
  'Databases',
  'DevOps',
  'Cloud',
  'AI/ML',
  'Security'
];
