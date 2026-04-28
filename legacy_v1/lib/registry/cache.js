'use strict';

const https = require('https');
const http = require('http');

function fetchIndex(url, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout: timeoutMs }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} from ${url}`));
        res.resume();
        return;
      }
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Invalid JSON from ${url}: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout fetching ${url}`)); });
  });
}

function mergeIndices(fetchedIndices) {
  const merged = [];
  const seen = new Set();
  for (const { source, index } of fetchedIndices) {
    for (const skill of (index.skills || [])) {
      const key = skill.name;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push({ ...skill, _source: source });
      }
    }
  }
  return merged;
}

function isCacheStale(fs, cachePath, ttlHours) {
  if (!fs.existsSync(cachePath)) return true;
  try {
    const stat = fs.statSync(cachePath);
    const ageMs = Date.now() - stat.mtimeMs;
    return ageMs > ttlHours * 3600 * 1000;
  } catch {
    return true;
  }
}

function loadCache(fs, cachePath) {
  if (!fs.existsSync(cachePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  } catch {
    return null;
  }
}

function saveCache(fs, cachePath, data) {
  const path = require('path');
  const dir = path.dirname(cachePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(data, null, 2), 'utf8');
}

module.exports = { fetchIndex, mergeIndices, isCacheStale, loadCache, saveCache };
