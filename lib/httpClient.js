const axios = require('axios');
const { getHeaders } = require('./userAgents');

/**
 * Fetch HTML with retries and exponential backoff.
 * @param {string} url
 * @param {object} options - { maxRetries, initialBackoffMs }
 * @returns {Promise<string>} HTML body
 */
async function fetchHtml(url, options = {}) {
  const { maxRetries = 3, initialBackoffMs = 1000 } = options;
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const { data } = await axios.get(url, {
        headers: getHeaders(),
        responseType: 'text',
        timeout: 30000,
        maxRedirects: 5,
        validateStatus: (status) => status === 200,
      });
      return data;
    } catch (err) {
      lastError = err;
      const status = err.response?.status;
      if (status === 404) throw err;
      if (attempt < maxRetries) {
        const delay = initialBackoffMs * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

module.exports = { fetchHtml };
