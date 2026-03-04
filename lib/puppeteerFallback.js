/**
 * Optional Puppeteer fetch for profile pages (JS-rendered content).
 */
let browser = null;

async function getBrowser() {
  if (browser) return browser;
  const puppeteer = require('puppeteer');
  browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  return browser;
}

async function fetchHtmlWithPuppeteer(url, userAgent) {
  const b = await getBrowser();
  const page = await b.newPage();
  try {
    await page.setUserAgent(userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    return await page.content();
  } finally {
    await page.close();
  }
}

async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

module.exports = {
  fetchHtmlWithPuppeteer,
  getBrowser,
  closeBrowser,
};
