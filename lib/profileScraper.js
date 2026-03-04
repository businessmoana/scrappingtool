const cheerio = require('cheerio');

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/**
 * Extract first valid email from string or null.
 */
function extractEmailFromText(text) {
  if (!text || typeof text !== 'string') return null;
  const match = text.match(EMAIL_REGEX);
  return match ? match[0] : null;
}

/**
 * Extract all emails from text (unique).
 */
function extractAllEmailsFromText(text) {
  if (!text || typeof text !== 'string') return [];
  const matches = text.match(EMAIL_REGEX) || [];
  return [...new Set(matches)];
}

/**
 * Parse profile page HTML and return structured data + email (if any).
 */
function parseProfilePage(html, profileUrl) {
  const $ = cheerio.load(html);
  const username = (profileUrl.match(/github\.com\/([^/]+)/) || [])[1] || null;

  // 1) mailto: in bio / profile section
  let email = null;
  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const m = href.replace(/^mailto:/i, '').trim().split(/[?&#]/)[0].trim();
    if (m && EMAIL_REGEX.test(m)) {
      email = m;
      return false; // break
    }
  });

  // 2) Bio text regex
  if (!email) {
    const bioEl = $('[data-bio-text], .p-note, .user-profile-bio, .js-profile-editable-area [data-bio-text], [itemprop="description"]');
    let bioText = '';
    bioEl.each((_, el) => { bioText += ' ' + ($(el).text() || $(el).attr('data-bio-text') || ''); });
    if (!bioText) bioText = $('.p-note').text() || $('.user-profile-bio').text() || '';
    const fromBio = extractEmailFromText(bioText);
    if (fromBio) email = fromBio;
  }

  // 3) Website / company / link fields
  if (!email) {
    const linkTexts = [];
    $('a[data-testid="profile-link"]').each((_, el) => { linkTexts.push($(el).text()); });
    $('.Link--primary').each((_, el) => { linkTexts.push($(el).text()); });
    $('[itemprop="url"]').each((_, el) => { linkTexts.push($(el).text()); });
    $('a.vcard-detail .Link--primary').each((_, el) => { linkTexts.push($(el).text()); });
    const combined = linkTexts.join(' ');
    const fromLinks = extractEmailFromText(combined);
    if (fromLinks) email = fromLinks;
  }

  // 4) data-email or similar in raw HTML
  if (!email) {
    const dataEmailMatch = html.match(/data-email=["']([^"']+)["']/i) || html.match(/data-email=["']([^"']+)/i);
    if (dataEmailMatch && EMAIL_REGEX.test(dataEmailMatch[1])) email = dataEmailMatch[1];
  }

  // 5) Scan full body text for email as last resort
  if (!email) {
    const bodyText = $('body').text();
    email = extractEmailFromText(bodyText);
  }

  // Name (profile header)
  let name = $('[itemprop="name"]').text().trim()
    || $('.p-name').text().trim()
    || $('.vcard-fullname').text().trim()
    || $('h1 span[itemprop="name"]').text().trim()
    || null;
  if (!name) name = $('h1').first().text().trim() || null;

  // Bio
  let bio = $('[data-bio-text]').attr('data-bio-text')
    || $('.p-note').text().trim()
    || $('.user-profile-bio').text().trim()
    || $('[itemprop="description"]').text().trim()
    || null;

  // Location
  let location = $('[itemprop="homeLocation"]').text().trim()
    || $('.p-label').text().trim()
    || $('[itemprop="address"]').text().trim()
    || null;
  $('.vcard-detail').each((_, el) => {
    const $el = $(el);
    if ($el.find('.octicon-location').length || $el.text().toLowerCase().includes('location')) {
      const t = $el.text().trim().replace(/^location\s*/i, '').trim();
      if (t) location = t;
    }
  });

  return {
    username,
    profile_url: profileUrl,
    name: name || null,
    bio: bio || null,
    location: location || null,
    email,
  };
}

module.exports = {
  parseProfilePage,
  extractEmailFromText,
  extractAllEmailsFromText,
  EMAIL_REGEX,
};
