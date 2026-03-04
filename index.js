const { loadConfig } = require('./config');
const { fetchHtml } = require('./lib/httpClient');
const { getSearchUrl, extractProfileLinks, extractProfileLinksStrict } = require('./lib/searchScraper');
const { parseProfilePage } = require('./lib/profileScraper');
const { loadProgress, saveProgress, writeEmailsJson, writeEmailsCsv, writeAllCsv, ensureDir } = require('./lib/storage');
const { getNextUserAgent } = require('./lib/userAgents');
const { getLocations } = require('./lib/locations');

let usePuppeteer = false;
let puppeteerFallback;

function log(msg) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msg}`);
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Get profile links from a single search page HTML.
 */
function getLinksFromPage(html) {
  const strict = extractProfileLinksStrict(html);
  const broad = extractProfileLinks(html);
  const set = new Set([...strict, ...broad]);
  return Array.from(set);
}

/**
 * Process one profile: fetch page, parse, return row. Does not save.
 */
async function processOneProfile(profileUrl, config) {
  const username = (profileUrl.match(/github\.com\/([^/]+)/) || [])[1] || profileUrl;
  const { maxRetries, initialBackoffMs } = config;

  let html = null;
  try {
    html = await fetchHtml(profileUrl, { maxRetries, initialBackoffMs });
  } catch (err) {
    if (usePuppeteer && puppeteerFallback) {
      try {
        html = await puppeteerFallback.fetchHtmlWithPuppeteer(profileUrl, getNextUserAgent());
      } catch (e) {
        log(`  Request failed (axios + puppeteer): ${e.message}`);
      }
    } else {
      log(`  Request failed: ${err.message}`);
    }
  }

  let row = {
    username,
    profile_url: profileUrl,
    name: null,
    bio: null,
    location: null,
    email: null,
  };
  if (html) {
    row = parseProfilePage(html, profileUrl);
    if (row.email) {
      log(`  Email found: ${row.email}`);
    } else {
      log(`  No email found.`);
    }
  } else {
    log(`  No HTML; skipping.`);
  }
  return row;
}

/**
 * Process a page's profiles with limited concurrency.
 */
async function processProfilesForPage(todo, {
  config,
  locIndex,
  pageNum,
  results,
  processedUrls,
  outputDirectory,
}) {
  const { delayBetweenRequests, profileConcurrency } = config;
  const concurrency = Math.max(1, Number.isInteger(profileConcurrency) ? profileConcurrency : 1);
  let index = 0;

  async function worker(workerId) {
    // Simple work-stealing loop
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const current = index;
      if (current >= todo.length) break;
      index += 1;

      const profileUrl = todo[current];
      const username = (profileUrl.match(/github\.com\/([^/]+)/) || [])[1] || profileUrl;
      log(`  [w${workerId}] Processing user ${current + 1}/${todo.length}: ${username}...`);

      const row = await processOneProfile(profileUrl, config);
      results.push(row);
      processedUrls.add(profileUrl);
      saveProgress(outputDirectory, results, { locationIndex: locIndex, pageNum });

      if (current < todo.length - 1) {
        await delay(delayBetweenRequests);
      }
    }
  }

  const workers = [];
  for (let w = 0; w < concurrency; w++) {
    workers.push(worker(w + 1));
  }
  await Promise.all(workers);
}

async function main() {
  const config = loadConfig();
  const {
    startPage,
    maxPagesPerLocation,
    delayBetweenRequests,
    outputDirectory,
    usePuppeteer: usePup,
  } = config;

  usePuppeteer = usePup;
  if (usePuppeteer) {
    puppeteerFallback = require('./lib/puppeteerFallback');
  }

  const locations = getLocations(config);
  ensureDir(outputDirectory);
  log(`Config: ${locations.length} location(s), startPage=${startPage}, maxPagesPerLocation=${maxPagesPerLocation}, delay=${delayBetweenRequests}ms, output=${outputDirectory}, usePuppeteer=${usePuppeteer}`);

  const progress = loadProgress(outputDirectory);
  const results = [...progress.results];
  const savedState = progress.state;
  const processedUrls = new Set(results.map((r) => r.profile_url));

  const lastPagePerLocation = startPage + maxPagesPerLocation - 1;

  let startLocationIndex = 0;
  let startPageForFirstLocation = startPage;
  if (savedState && Number.isInteger(savedState.locationIndex) && Number.isInteger(savedState.pageNum)) {
    startLocationIndex = Math.min(savedState.locationIndex, locations.length - 1);
    startPageForFirstLocation = Math.max(startPage, savedState.pageNum);
    log(`Resuming from location index ${startLocationIndex} (page ${startPageForFirstLocation}). Already scraped ${results.length} profile(s).`);
  } else if (results.length > 0) {
    log(`Resuming: ${results.length} profile(s) already scraped (no page/location state; starting from first location).`);
  }

  for (let locIndex = startLocationIndex; locIndex < locations.length; locIndex++) {
    const location = locations[locIndex];
    log(`[Location ${locIndex + 1}/${locations.length}] "${location}"`);

    const pageStart = locIndex === startLocationIndex ? startPageForFirstLocation : startPage;

    for (let pageNum = pageStart; pageNum <= lastPagePerLocation; pageNum++) {
      log(`  Scraping page ${pageNum}...`);

      let pageLinks = [];
      try {
        const searchUrl = getSearchUrl(location, pageNum);
        const html = await fetchHtml(searchUrl, {
          maxRetries: config.maxRetries,
          initialBackoffMs: config.initialBackoffMs,
        });
        pageLinks = getLinksFromPage(html);
        log("searchUrl=>",searchUrl);
        log(`  Found ${pageLinks.length} users.`);
      } catch (err) {
        log(`  Error fetching search page: ${err.message}`);
      }

      const todo = pageLinks.filter((url) => !processedUrls.has(url));
      await processProfilesForPage(todo, {
        config,
        locIndex,
        pageNum,
        results,
        processedUrls,
        outputDirectory,
      });

      if (pageNum < lastPagePerLocation) await delay(delayBetweenRequests);
    }

    if (locIndex < locations.length - 1) await delay(delayBetweenRequests);
  }

  writeEmailsJson(outputDirectory, results);
  writeEmailsCsv(outputDirectory, results);
  writeAllCsv(outputDirectory, results);

  const withEmail = results.filter((r) => r.email).length;
  log(`Done. Total profiles: ${results.length}, with email: ${withEmail}.`);
  log(`Output: ${outputDirectory}/emails_found.json, ${outputDirectory}/emails_found.csv, ${outputDirectory}/all_scraped_data.csv`);

  if (puppeteerFallback) await puppeteerFallback.closeBrowser();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
