const cheerio = require('cheerio');

const GITHUB_SEARCH_PARAMS = 'type=users&s=joined&o=asc';

/**
 * Build search URL for a location and page number (1-based).
 * Uses GitHub format: location:"City, ST" (e.g. location:"San Francisco, CA")
 * @param {string} location - e.g. "San Francisco, CA"
 * @param {number} pageNumber - 1-based page
 */
function getSearchUrl(location, pageNumber) {
  const q = `location:"${location}"`;
  const base = `https://github.com/search?q=${encodeURIComponent(q)}&${GITHUB_SEARCH_PARAMS}`;
  return `${base}&p=${pageNumber}`;
}

/**
 * Parse search results HTML and return profile URLs.
 * GitHub user search lists users with links like /username in the results.
 */
function extractProfileLinks(html) {
  const $ = cheerio.load(html);
  const links = new Set();
  // User search result items: link to profile is often in .user-list-info a[href^="/"]
  $('a[href^="/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const match = href.match(/^\/([^/]+)\/?$/);
    if (match && !['search', 'settings', 'logout', 'login', 'signup', 'join', 'about', 'blog', 'pricing', 'contact', 'enterprise', 'topics', 'collections', 'trending', 'sponsors', 'readme', 'orgs', 'notifications', 'explore'].includes(match[1])) {
      links.add(`https://github.com${href.replace(/\/$/, '')}`);
    }
  });
  // More specific: look for user card / result rows that contain exactly one username path
  $('[data-hovercard-type="user"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const trimmed = href.replace(/\/$/, '');
    if (/^\/[^/]+$/.test(trimmed)) {
      links.add(`https://github.com${trimmed}`);
    }
  });
  return Array.from(links);
}

/**
 * GitHub search page structure: user results are in divs with link to /username.
 * Try selector that matches actual GitHub markup.
 */
function extractProfileLinksStrict(html) {
  const $ = cheerio.load(html);
  const links = new Set();
  // Primary: .user-list a that point to /Username (single segment)
  $('.user-list a[href^="/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const trimmed = href.replace(/\/$/, '');
    if (/^\/[^/]+$/.test(trimmed)) {
      links.add(`https://github.com${trimmed}`);
    }
  });
  // Fallback: any a[href="/username"] in the main content
  $('#user_search_results a[href^="/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const trimmed = href.replace(/\/$/, '');
    if (/^\/[^/]+$/.test(trimmed)) {
      links.add(`https://github.com${trimmed}`);
    }
  });
  return Array.from(links);
}

module.exports = {
  getSearchUrl,
  extractProfileLinks,
  extractProfileLinksStrict,
};
