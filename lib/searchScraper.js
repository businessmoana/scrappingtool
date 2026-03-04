const cheerio = require('cheerio');

const GITHUB_SEARCH_PARAMS = 'type=users&s=joined&o=asc';

/** Path segments we never treat as user profiles (login, signup, nav, etc.) */
const NON_PROFILE_SEGMENTS = new Set([
  'search', 'settings', 'logout', 'login', 'signup', 'join', 'about', 'blog',
  'pricing', 'contact', 'enterprise', 'topics', 'collections', 'trending',
  'sponsors', 'readme', 'orgs', 'notifications', 'explore', 'session',
]);

/**
 * Normalize href to pathname only (no query or hash). Returns null if not a single-segment path.
 * @returns {{ pathname: string, segment: string } | null}
 */
function parseProfilePath(href) {
  if (!href || !href.startsWith('/')) return null;
  const pathname = href.split('?')[0].split('#')[0].replace(/\/$/, '');
  const match = pathname.match(/^\/([^/]+)$/);
  if (!match) return null;
  const segment = match[1];
  if (NON_PROFILE_SEGMENTS.has(segment)) return null;
  return { pathname, segment };
}

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
 * Ignores path-only (no query/hash) so /login?return_to=... and /signup?ref_cta=... are excluded.
 */
function extractProfileLinks(html) {
  const $ = cheerio.load(html);
  const links = new Set();
  // User search result items: link to profile is often in .user-list-info a[href^="/"]
  $('a[href^="/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const parsed = parseProfilePath(href);
    if (parsed) {
      links.add(`https://github.com${parsed.pathname}`);
    }
  });
  // More specific: look for user card / result rows that contain exactly one username path
  $('[data-hovercard-type="user"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const pathname = (href.split('?')[0].split('#')[0] || '').replace(/\/$/, '');
    if (/^\/[^/]+$/.test(pathname)) {
      const segment = pathname.slice(1);
      if (!NON_PROFILE_SEGMENTS.has(segment)) {
        links.add(`https://github.com${pathname}`);
      }
    }
  });
  return Array.from(links);
}

/**
 * GitHub search page structure: user results are in divs with link to /username.
 * Try selector that matches actual GitHub markup.
 * Uses pathname-only so /login?return_to=... and /signup?ref_cta=... are excluded.
 */
function extractProfileLinksStrict(html) {
  const $ = cheerio.load(html);
  const links = new Set();
  // Primary: .user-list a that point to /Username (single segment, no query)
  $('.user-list a[href^="/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const parsed = parseProfilePath(href);
    if (parsed) links.add(`https://github.com${parsed.pathname}`);
  });
  // Fallback: any a[href="/username"] in the main content
  $('#user_search_results a[href^="/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const parsed = parseProfilePath(href);
    if (parsed) links.add(`https://github.com${parsed.pathname}`);
  });
  return Array.from(links);
}

module.exports = {
  getSearchUrl,
  extractProfileLinks,
  extractProfileLinksStrict,
};
