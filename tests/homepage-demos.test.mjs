import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, script, migration] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../js/script.js', import.meta.url), 'utf8'),
  readFile(new URL('../db-migration-002.sql', import.meta.url), 'utf8'),
]);

test('homepage demos are sourced only from the admin-managed API', () => {
  const workSection = html.split('<section id="work">')[1]?.split('</section>')[0] || '';
  assert.match(workSection, /id="demoGrid"/);
  assert.doesNotMatch(workSection, /href="https:\/\//);
});

test('demo loading never leaves stale hard-coded cards visible when the API fails', () => {
  assert.match(script, /demoGrid\.textContent\s*=\s*["']Loading demos/);
  assert.match(script, /No live demos available right now/);
});


test('database migration does not publish unverified demo URLs by default', () => {
  assert.doesNotMatch(migration, /INSERT INTO public\\.maxweb_demos/i);
});
