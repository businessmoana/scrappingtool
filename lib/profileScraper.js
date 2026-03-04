const cheerio = require('cheerio');

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const EMAIL_REGEX_ONE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

/**
 * Extract first valid email from string or null.
 */
function extractEmailFromText(text) {
  if (!text || typeof text !== 'string') return null;
  const match = text.match(EMAIL_REGEX);
  return match ? match[0] : null;
}

/**
 * Deobfuscate common patterns (e.g. "user at domain dot com") then extract email.
 */
function extractEmailFromObfuscatedText(text) {
  if (!text || typeof text !== 'string') return null;
  const lower = text.toLowerCase();
  let decoded = text
    .replace(/\s+at\s+/gi, '@')
    .replace(/\s*\[at\]\s*/gi, '@')
    .replace(/\s*\(at\)\s*/gi, '@')
    .replace(/\s+at\s+/g, '@')
    .replace(/\s*dot\s*/gi, '.')
    .replace(/\s*\[dot\]\s*/gi, '.')
    .replace(/\s*\(dot\)\s*/gi, '.');
  return extractEmailFromText(decoded);
}

/**
 * Extract first email from mailto: href string (handles Mailto:, encoding, query params).
 */
function emailFromMailtoHref(href) {
  if (!href || typeof href !== 'string') return null;
  const raw = href.replace(/^mailto:/i, '').trim().split(/[?&#]/)[0].trim();
  if (!raw) return null;
  const decoded = decodeURIComponent(raw);
  return EMAIL_REGEX_ONE.test(decoded) ? decoded : null;
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

  let email = null;

  // 1) Any mailto link (case-insensitive, from DOM and raw HTML)
  $('a[href]').each((_, el) => {
    if (email) return;
    const href = $(el).attr('href') || '';
    if (href.toLowerCase().startsWith('mailto:')) {
      const m = emailFromMailtoHref(href);
      if (m) email = m;
    }
  });
  if (!email) {
    const mailtoMatches = html.match(/mailto:([^"'\s>)\]]+)/gi);
    if (mailtoMatches && mailtoMatches.length) {
      for (const mt of mailtoMatches) {
        const m = emailFromMailtoHref(mt);
        if (m) { email = m; break; }
      }
    }
  }

  // 2) itemprop="email" and u-email (microformats)
  if (!email) {
    $('[itemprop="email"], .u-email, a.u-email').each((_, el) => {
      if (email) return;
      const href = $(el).attr('href');
      if (href) {
        const m = emailFromMailtoHref(href);
        if (m) email = m;
      }
      if (!email) {
        const text = $(el).text().trim() || $(el).attr('content');
        if (text) email = extractEmailFromText(text) || extractEmailFromObfuscatedText(text);
      }
    });
  }

  // 3) Profile sidebar / vcard: detail rows that look like email (icon or label)
  if (!email) {
    $('.vcard-detail, [class*="vcard-detail"], [data-testid="profile-details"]').each((_, el) => {
      if (email) return;
      const $el = $(el);
      const text = $el.text();
      const lower = text.toLowerCase();
      if (lower.includes('email') || lower.includes('mail') || $el.find('.octicon-mail, [class*="mail"]').length) {
        const link = $el.find('a[href]').first().attr('href');
        if (link && link.toLowerCase().startsWith('mailto:')) {
          const m = emailFromMailtoHref(link);
          if (m) email = m;
        }
        if (!email && text) email = extractEmailFromText(text) || extractEmailFromObfuscatedText(text);
      }
    });
  }

  // 4) Bio / profile description
  if (!email) {
    const bioSelectors = [
      '[data-bio-text]', '.p-note', '.user-profile-bio', '[itemprop="description"]',
      '.js-profile-editable-area [data-bio-text]', '[class*="profile-bio"]', '.ProfileHeaderCard-bio',
    ];
    let bioText = '';
    for (const sel of bioSelectors) {
      $(sel).each((_, el) => {
        bioText += ' ' + ($(el).text() || $(el).attr('data-bio-text') || '');
      });
    }
    bioText = bioText.trim() || $('.p-note').text() || $('.user-profile-bio').text() || '';
    if (bioText) email = extractEmailFromText(bioText) || extractEmailFromObfuscatedText(bioText);
  }

  // 5) Profile link text (website, company, custom links that might be email)
  if (!email) {
    const linkTexts = [];
    $('a[data-testid="profile-link"], .Link--primary, [itemprop="url"], a.vcard-detail, .vcard-detail a').each((_, el) => {
      linkTexts.push($(el).text().trim());
      const href = $(el).attr('href') || '';
      if (href.toLowerCase().startsWith('mailto:')) linkTexts.push(emailFromMailtoHref(href) || '');
    });
    const combined = linkTexts.join(' ');
    if (combined) email = extractEmailFromText(combined) || extractEmailFromObfuscatedText(combined);
  }

  // 6) data-email or similar in raw HTML
  if (!email) {
    const dataEmailMatch = html.match(/data-email=["']([^"']+)["']/i) || html.match(/data-email=["']([^"']+)/i);
    if (dataEmailMatch && EMAIL_REGEX_ONE.test(dataEmailMatch[1])) email = dataEmailMatch[1];
  }

  // 7) Obfuscated or plain email in body text (last resort)
  if (!email) {
    const bodyText = $('body').text();
    email = extractEmailFromText(bodyText) || extractEmailFromObfuscatedText(bodyText);
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
