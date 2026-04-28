'use strict';

const DEFAULT_SOURCES = {
  version: '1.0',
  sources: [
    {
      name: 'scaffold-official',
      url: 'https://raw.githubusercontent.com/pyramidheadshark/claude-scaffold/main/registry/skills.json',
      trust: 'verified',
    },
    {
      name: 'awesome-llm-skills',
      url: 'https://raw.githubusercontent.com/Prat011/awesome-llm-skills/main/registry.json',
      trust: 'community',
    },
  ],
  cache_ttl_hours: 168,
};

function loadSources(fs, sourcesPath) {
  if (!fs.existsSync(sourcesPath)) return DEFAULT_SOURCES;
  try {
    return JSON.parse(fs.readFileSync(sourcesPath, 'utf8'));
  } catch {
    return DEFAULT_SOURCES;
  }
}

function saveSources(fs, sourcesPath, data) {
  fs.writeFileSync(sourcesPath, JSON.stringify(data, null, 2), 'utf8');
}

function addSource(fs, sourcesPath, name, url, trust = 'community') {
  const data = loadSources(fs, sourcesPath);
  const existing = data.sources.find(s => s.name === name);
  if (existing) {
    existing.url = url;
    existing.trust = trust;
  } else {
    data.sources.push({ name, url, trust });
  }
  saveSources(fs, sourcesPath, data);
  return data;
}

module.exports = { DEFAULT_SOURCES, loadSources, saveSources, addSource };
