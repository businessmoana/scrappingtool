const fs = require('fs');
const path = require('path');

/**
 * Default U.S. locations (used if no file or config list provided).
 */
const DEFAULT_US_LOCATIONS = [
  'San Francisco, CA',
  'New York, NY',
  'Los Angeles, CA',
  'Chicago, IL',
  'Houston, TX',
  'Seattle, WA',
  'Boston, MA',
  'Austin, TX',
  'Denver, CO',
  'San Diego, CA',
  'Washington, DC',
  'Portland, OR',
  'Atlanta, GA',
  'Miami, FL',
  'Phoenix, AZ',
  'Philadelphia, PA',
  'Dallas, TX',
  'San Jose, CA',
];

/**
 * Load locations from a file (one location per line, trim empty lines).
 * @param {string} filePath - Path to .txt file
 * @returns {string[]}
 */
function loadLocationsFromFile(filePath) {
  const resolved = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  if (!fs.existsSync(resolved)) {
    return [];
  }
  const content = fs.readFileSync(resolved, 'utf8');
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Resolve the list of locations from config.
 * Precedence: config.locations array > config.locationsFile > DEFAULT_US_LOCATIONS.
 * @param {object} config - { locations?: string[], locationsFile?: string }
 * @returns {string[]}
 */
function getLocations(config) {
  if (config.locations && Array.isArray(config.locations) && config.locations.length > 0) {
    return config.locations;
  }
  if (config.locationsFile) {
    const fromFile = loadLocationsFromFile(config.locationsFile);
    if (fromFile.length > 0) return fromFile;
  }
  return [...DEFAULT_US_LOCATIONS];
}

module.exports = {
  getLocations,
  loadLocationsFromFile,
  DEFAULT_US_LOCATIONS,
};
