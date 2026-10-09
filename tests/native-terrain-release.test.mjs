import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { transformSync } from 'esbuild';

const root = new URL('../', import.meta.url);
const metadataURL = '/assets/geo/native/mapzen-z13-native-3x3.json';
const metadata = readFileSync(new URL('public' + metadataURL, root));
const info = JSON.parse(metadata);
const binary = readFileSync(new URL('public/assets/geo/native/' + info.dataFile, root));
const code = transformSync(readFileSync(new URL('src/scene/nativeTerrain.ts', root), 'utf8'),
  { loader: 'ts', format: 'esm' }).code;
const { AF_METADATA_SHA256, AF_BINARY_SHA256, loadNativeTerrain } =
  await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const sha = value => createHash('sha256').update(value).digest('hex');
const legacy = { bounds: info.outerEdgeExtentWGS84, cols: 2, rows: 2, heights: [0, 0, 0, 0] };

function serveAssets(t, { corruptMetadata = false, corruptBinary = false } = {}) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'location');
  Object.defineProperty(globalThis, 'location', { configurable: true, value: { href: 'http://localhost:4173/' } });
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'location', previous); else delete globalThis.location; });
  return t.mock.method(globalThis, 'fetch', async url => {
    if (new URL(url, globalThis.location.href).pathname === metadataURL) {
      return new Response(corruptMetadata ? Buffer.concat([metadata, Buffer.from(' ')]) : metadata);
    }
    const bytes = Buffer.from(binary);
    if (corruptBinary) bytes[0] ^= 1;
    return new Response(bytes);
  });
}

test('published terrain bytes match pinned SHA values after privacy cleanup and Git checkout', () => {
  assert.equal(metadata.includes(Buffer.from('\r\n')), false, 'Git release metadata uses LF');
  assert.equal(sha(metadata), AF_METADATA_SHA256);
  assert.equal(sha(binary), AF_BINARY_SHA256);
  assert.equal(info.dataSha256, AF_BINARY_SHA256);
  assert.equal(binary.length, info.dataBytes);
});

test('browser terrain loader accepts actual published metadata and elevation data', async t => {
  const fetch = serveAssets(t);
  const terrain = await loadNativeTerrain(legacy, metadataURL);
  assert.equal(terrain.samplingState.mode, 'native-loaded');
  assert.equal(terrain.samplingState.receivedMetadataSHA256, AF_METADATA_SHA256);
  assert.equal(terrain.nativeGrid.values.length, 768 * 768);
  assert.equal(fetch.mock.callCount(), 2);
});

test('terrain loader still rejects modified metadata before fetching elevations', async t => {
  const fetch = serveAssets(t, { corruptMetadata: true });
  await assert.rejects(loadNativeTerrain(legacy, metadataURL), /Native metadata SHA mismatch/);
  assert.equal(fetch.mock.callCount(), 1);
});

test('terrain loader still rejects modified elevation bytes', async t => {
  serveAssets(t, { corruptBinary: true });
  await assert.rejects(loadNativeTerrain(legacy, metadataURL), /Native terrain SHA mismatch/);
});
