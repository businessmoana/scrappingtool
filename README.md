# GitHub Email Scraper

Production-ready Node.js tool that scrapes email addresses from GitHub user profiles. It filters by U.S. location (city/region), then for each location and each search page collects profile links and visits each profile to extract email and profile data.

## Requirements

- Node.js 16+
- npm

## Install

```bash
npm install
```

## Usage

```bash
# Default config (locations from data/us-locations.txt, startPage=1, maxPagesPerLocation=100, delay=2000ms)
npm start
# or
node index.js
```

### Configuration

Edit `config.js` or pass options via CLI:

| Option | Default | Description |
|--------|---------|-------------|
| `locationsFile` | `./data/us-locations.txt` | Path to file with one U.S. location per line (e.g. `San Francisco, CA`). If missing, a built-in list is used. |
| `startPage` | 1 | First search results page per location (e.g. `?p=1`) |
| `maxPagesPerLocation` | 100 | Max search pages to scrape per location (each location may have fewer) |
| `delayBetweenRequests` | 2000 | Delay in ms between requests |
| `outputDirectory` | `./output` | Directory for output and progress files |
| `usePuppeteer` | false | Use Puppeteer for profile pages (fallback when Axios fails) |

**CLI examples:**

```bash
node index.js --startPage=1 --maxPagesPerLocation=10
node index.js --delayBetweenRequests=3000 --outputDirectory=./out
node index.js --locationsFile=./data/us-locations.txt --usePuppeteer=true
```

## Workflow

The tool filters by **U.S. location** (city/region), then works **page by page** per location: for each search page it gets that page’s profile links, then immediately visits each profile and extracts email before moving to the next page.

Locations are read from `data/us-locations.txt` (one per line, e.g. `San Francisco, CA`) or a built-in list. Each location is queried with GitHub’s format: `location:"San Francisco, CA"` ([example](https://github.com/search?q=+location%3A%22San+Francisco%2C+CA%22+&type=users)).

1. **For each location** in the list:
2. **For each page** (from `startPage` to `startPage + maxPagesPerLocation - 1`) for that location:
   - Fetch the GitHub search URL  
     `https://github.com/search?q=location:"<location>"&type=users&s=joined&o=asc&p={page}`  
     and parse it with Cheerio to get profile links for that page only.
3. **For each profile link** on that page (skip if already in progress):
   - Fetch the profile page (Axios, with optional Puppeteer fallback).
   - Extract email using: `mailto:` links, bio regex, website/company text, `data-email` in HTML, and a final body-text scan.
   - Extract: `username`, `profile_url`, `name`, `bio`, `location`.
   - Save progress, then apply the delay before the next request.
3. **Next page**: repeat with the next search page.

So the order is: **get one page of links → get email per profile on that page → next page → same**, with rate limiting (configurable delay), retries with exponential backoff, and User-Agent rotation.

## Resume

Progress is saved after each profile in `output/progress.json` (results only). If the script stops, run it again with the same `outputDirectory`. On resume, search pages are re-fetched, but any profile URL that already appears in saved results is skipped, so you never re-scrape the same user.

## Output

- **`emails_found.json`** – Only profiles where an email was found.
- **`emails_found.csv`** – Same list as above, in CSV (only rows with an email).
- **`all_scraped_data.csv`** – All visited profiles with columns: `username`, `profile_url`, `name`, `bio`, `location`, `email`, `email_found`.

Files are written to the configured `outputDirectory` (default `./output`).

## Tech

- **Axios** – HTTP requests  
- **Cheerio** – HTML parsing  
- **Puppeteer** – Optional fallback for JS-rendered profile pages  

## Disclaimer

Use responsibly and in line with GitHub’s Terms of Service and robots.txt. This tool is for educational purposes; respect rate limits and avoid overloading GitHub’s servers.
