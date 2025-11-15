const fs = require('fs');
const path = require('path');

function format(ts) {
  const pad = n => (n < 10 ? '0' + n : '' + n);
  const y = ts.getFullYear();
  const M = pad(ts.getMonth() + 1);
  const d = pad(ts.getDate());
  const h = pad(ts.getHours());
  const m = pad(ts.getMinutes());
  const s = pad(ts.getSeconds());
  return `${y}${M}${d}${h}${m}${s}`;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

class Logger {
  constructor(baseDir) {
    this.baseDir = baseDir || path.join(__dirname, '..', 'log');
    ensureDir(this.baseDir);
    this.file = path.join(this.baseDir, `${format(new Date())}.log`);
  }
  write(message, data) {
    const line = `[${new Date().toISOString()}] ${message}${data ? ' ' + JSON.stringify(data) : ''}\n`;
    fs.appendFileSync(this.file, line);
  }
}

module.exports = Logger;