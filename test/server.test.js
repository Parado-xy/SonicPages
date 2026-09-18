const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { createApp } = require('../server');

let server;
let baseUrl;

before(async () => {
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test('serves the reader at the root route', async () => {
  const response = await fetch(`${baseUrl}/`);
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/html/);
  assert.match(body, /Sonic Pages/);
});

test('exposes a health endpoint', async () => {
  const response = await fetch(`${baseUrl}/health`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
});

test('sets baseline security headers', async () => {
  const response = await fetch(`${baseUrl}/`);

  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.match(response.headers.get('content-security-policy'), /object-src 'none'/);
  assert.equal(response.headers.get('x-powered-by'), null);
});

test('does not expose removed account or upload routes', async () => {
  for (const route of ['/sign-on', '/api/notion/books', '/upload']) {
    const response = await fetch(`${baseUrl}${route}`);
    assert.equal(response.status, 404);
  }
});
