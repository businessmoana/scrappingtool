const fs = require('fs');
const path = require('path');

const PROGRESS_FILE = 'progress.json';
const EMAILS_JSON = 'emails_found.json';
const EMAILS_CSV = 'emails_found.csv';
const ALL_CSV = 'all_scraped_data.csv';

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Load progress.
 * Shape:
 *   {
 *     results: Array<{...}>,
 *     state?: { locationIndex: number, pageNum: number }
 *   }
 * Older files without state are still supported.
 */
function loadProgress(outputDir) {
  const file = path.join(outputDir, PROGRESS_FILE);
  if (!fs.existsSync(file)) return { results: [], state: null };
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return {
      results: data.results || [],
      state: data.state || null,
    };
  } catch {
    return { results: [], state: null };
  }
}

/**
 * Save progress after each profile (results + state for resume).
 * state: { locationIndex: number, pageNum: number }
 */
function saveProgress(outputDir, results, state) {
  ensureDir(outputDir);
  const file = path.join(outputDir, PROGRESS_FILE);
  fs.writeFileSync(file, JSON.stringify({ results, state: state || null }, null, 2), 'utf8');
}

/**
 * Write emails_found.json (only rows with email).
 */
function writeEmailsJson(outputDir, results) {
  ensureDir(outputDir);
  const withEmail = results.filter((r) => r.email);
  const file = path.join(outputDir, EMAILS_JSON);
  fs.writeFileSync(file, JSON.stringify(withEmail, null, 2), 'utf8');
}

/**
 * Write emails_found.csv (only rows that have an email).
 */
function writeEmailsCsv(outputDir, results) {
  ensureDir(outputDir);
  const withEmail = results.filter((r) => r.email);
  const file = path.join(outputDir, EMAILS_CSV);
  const headers = ['username', 'profile_url', 'name', 'bio', 'location', 'email'];
  const escape = (v) => {
    const s = v == null ? '' : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const rows = [
    headers.join(','),
    ...withEmail.map((r) =>
      [
        escape(r.username),
        escape(r.profile_url),
        escape(r.name),
        escape(r.bio),
        escape(r.location),
        escape(r.email),
      ].join(',')
    ),
  ];
  fs.writeFileSync(file, rows.join('\n'), 'utf8');
}

/**
 * Write all_scraped_data.csv (all profiles, with email_found status).
 */
function writeAllCsv(outputDir, results) {
  ensureDir(outputDir);
  const file = path.join(outputDir, ALL_CSV);
  const headers = ['username', 'profile_url', 'name', 'bio', 'location', 'email', 'email_found'];
  const escape = (v) => {
    const s = v == null ? '' : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const rows = [
    headers.join(','),
    ...results.map((r) =>
      [
        escape(r.username),
        escape(r.profile_url),
        escape(r.name),
        escape(r.bio),
        escape(r.location),
        escape(r.email),
        r.email ? 'true' : 'false',
      ].join(',')
    ),
  ];
  fs.writeFileSync(file, rows.join('\n'), 'utf8');
}

module.exports = {
  loadProgress,
  saveProgress,
  writeEmailsJson,
  writeEmailsCsv,
  writeAllCsv,
  ensureDir,
  PROGRESS_FILE,
  EMAILS_JSON,
  EMAILS_CSV,
  ALL_CSV,
};
