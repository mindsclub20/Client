import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, css, favicon, config] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../css/style.css', import.meta.url), 'utf8'),
  readFile(new URL('../favicon.svg', import.meta.url), 'utf8'),
  readFile(new URL('../vercel.json', import.meta.url), 'utf8').then(JSON.parse),
]);

test('homepage declares a same-origin SVG favicon', () => {
  assert.match(html, /<link[^>]+rel=["']icon["'][^>]+href=["']\/favicon\.svg["']/i);
  assert.match(favicon, /<svg[\s>]/i);
});

test('homepage clips decorative overflow at the viewport boundary', () => {
  assert.match(css, /html\s*\{[^}]*overflow-x\s*:\s*clip\s*;/s);
});
