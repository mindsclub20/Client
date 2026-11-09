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
  assert.ok(config.rewrites.some((rule) => rule.source === '/favicon.ico' && rule.destination === '/favicon.svg'));
});

test('homepage clips decorative overflow at the viewport boundary', () => {
  assert.match(css, /html\s*\{[^}]*overflow-x\s*:\s*clip\s*;/s);
});


test('mobile hero clips the animated 3D scene and scales its ring to the viewport', () => {
  assert.match(css, /@media\s*\(max-width:\s*560px\)[\s\S]*?\.stage\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.ring\s*\{[^}]*width:\s*min\(400px,\s*calc\(100vw\s*-\s*100px\)\)/s);
});

test('mobile hero disables perspective translation on floating labels and scene', () => {
  assert.match(css, /\.scene\s*\{transform:\s*none;overflow:\s*hidden\}/);
  assert.match(css, /\.scene\s+\.chip\s*\{transform:\s*none/);
  assert.match(css, /\.scene\s+\.c1\s*\{left:\s*8%/);
  assert.match(css, /\.scene\s+\.c3\s*\{left:\s*8%/);
});
