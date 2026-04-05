'use strict';

function parseSimpleYaml(text) {
  const result = {};
  let currentKey = null;
  let currentList = null;
  let currentObj = null;
  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    if (line.startsWith("#") || line.trim() === "") continue;
    const topMatch = line.match(/^(\w[\w_-]*):\s*(.*)$/);
    if (topMatch) {
      if (currentObj && currentKey && currentList) {
        currentList.push(currentObj);
        currentObj = null;
      }
      currentKey = topMatch[1];
      const val = topMatch[2].trim();
      if (val && val !== "" && !val.startsWith("#")) {
        result[currentKey] = val.replace(/^["']|["']$/g, "");
      } else {
        result[currentKey] = [];
        currentList = result[currentKey];
        currentObj = null;
      }
      continue;
    }
    if (Array.isArray(result[currentKey])) {
      const itemMatch = line.match(/^\s+-\s+(\w[\w_-]*):\s*(.+)$/);
      const plainItem = line.match(/^\s+-\s+"?([^"]+)"?\s*$/);
      if (itemMatch) {
        if (itemMatch[1] === "repo" || itemMatch[1] === "id" || itemMatch[1] === "name") {
          if (currentObj) currentList.push(currentObj);
          currentObj = {};
        }
        if (currentObj) currentObj[itemMatch[1]] = itemMatch[2].replace(/^["']|["']$/g, "").trim();
      } else if (plainItem) {
        if (currentObj) { currentList.push(currentObj); currentObj = null; }
        currentList.push(plainItem[1].trim());
      } else {
        const kvMatch = line.match(/^\s+(\w[\w_-]*):\s*(.+)$/);
        if (kvMatch && currentObj) {
          currentObj[kvMatch[1]] = kvMatch[2].replace(/^["']|["']$/g, "").trim();
        }
      }
    }
  }
  if (currentObj && currentKey && Array.isArray(result[currentKey])) result[currentKey].push(currentObj);
  return result;
}

function parseBlockers(yamlText) {
  const parsed = parseSimpleYaml(yamlText);
  if (!Array.isArray(parsed.blockers)) return [];
  return parsed.blockers.filter(b => typeof b === 'object');
}

module.exports = { parseSimpleYaml, parseBlockers };
