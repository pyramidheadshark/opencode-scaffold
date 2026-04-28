'use strict';

const https = require('https');
const http = require('http');
const crypto = require('crypto');
const path = require('path');

function fetchFile(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout: timeoutMs }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
        res.resume();
        return;
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout fetching ${url}`)); });
  });
}

function verifySha256(buffer, expectedHash) {
  const actual = crypto.createHash('sha256').update(buffer).digest('hex');
  return actual === expectedHash;
}

async function downloadSkill(fs, sourceUrl, targetDir, expectedSha256) {
  const skillMdUrl = sourceUrl.endsWith('/') ? `${sourceUrl}SKILL.md` : `${sourceUrl}/SKILL.md`;
  const metaUrl = sourceUrl.endsWith('/') ? `${sourceUrl}skill-metadata.json` : `${sourceUrl}/skill-metadata.json`;

  const skillMdBuf = await fetchFile(skillMdUrl);

  if (expectedSha256 && !verifySha256(skillMdBuf, expectedSha256)) {
    throw new Error(`SHA-256 mismatch for ${skillMdUrl} — possible tampering`);
  }

  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(path.join(targetDir, 'SKILL.md'), skillMdBuf);

  try {
    const metaBuf = await fetchFile(metaUrl);
    fs.writeFileSync(path.join(targetDir, 'skill-metadata.json'), metaBuf);
  } catch {
    // metadata is optional
  }

  return { skillMdSize: skillMdBuf.length };
}

module.exports = { fetchFile, verifySha256, downloadSkill };
