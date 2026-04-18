'use strict';

const CSI_RE = /\x1b\[[0-9;?]*[A-Za-z]/g;
const OSC_RE = /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g;
const OTHER_RE = /\x1b[^[\]]/g;

function stripAnsi(str) {
  return str
    .replace(CSI_RE, '')
    .replace(OSC_RE, '')
    .replace(OTHER_RE, '')
    .replace(/\r/g, '');
}

module.exports = { stripAnsi };
