/**
 * Configuration for GitHub email scraper.
 * Override via command-line: node index.js --startPage=1 --maxPages=5 --delayBetweenRequests=3000
 */

const path = require('path');

const defaultConfig = {
  /** Path to file with one U.S. location per line (e.g. "San Francisco, CA"). If not set, uses built-in list. */
  locationsFile: path.join(process.cwd(), 'data', 'us-locations.txt'),
  /** First search results page per location (e.g., 1 = start at ?p=1) */
  startPage: 1,
  /** Max number of search pages to scrape per location (e.g. 100; can be smaller if location has fewer results) */
  maxPagesPerLocation: 100,
  /** Delay in ms between requests (search + profile) */
  delayBetweenRequests: 2000,
  /** Directory for output files and progress */
  outputDirectory: path.join(process.cwd(), 'output'),
  /** Use Puppeteer for profile pages (fallback when Axios/Cheerio fails or for JS-rendered content) */
  usePuppeteer: false,
  /** Max retries per request */
  maxRetries: 3,
  /** Initial backoff ms; doubles each retry */
  initialBackoffMs: 1000,
};

/**
 * Parse CLI args like --startPage=8 --maxPages=1
 */
function parseArgs() {
  const overrides = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--') && arg.includes('=')) {
      const [key, value] = arg.slice(2).split('=');
      const numKeys = ['startPage', 'maxPagesPerLocation', 'delayBetweenRequests', 'maxRetries', 'initialBackoffMs'];
      overrides[key] = numKeys.includes(key) ? parseInt(value, 10) : value;
      if (key === 'usePuppeteer') overrides[key] = value === 'true' || value === '1';
    }
  }
  return overrides;
}

function loadConfig() {
  const overrides = parseArgs();
  return { ...defaultConfig, ...overrides };
}

module.exports = { loadConfig, defaultConfig };
