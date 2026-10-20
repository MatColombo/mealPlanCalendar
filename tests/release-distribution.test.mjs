import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, appendFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildRelease } from '../scripts/build.mjs';
import { verifyLocalRelease, verifyPublishedRelease } from '../scripts/verify-release.mjs';

const PROJECT_ROOT = fileURLToPath(new URL('../', import.meta.url));

async function fixture(t) {
  const root = await mkdtemp(path.join(PROJECT_ROOT, '.release-distribution-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const files = {
    'package.json': JSON.stringify({ name: 'synthetic-release', version: '1.0.0', type: 'module' }),
    'index.html': '<!doctype html><html><script type="module" src="./src/main.js"></script></html>',
    'manifest.webmanifest': JSON.stringify({ name: 'Synthetic release', start_url: './', scope: './', display: 'standalone' }),
    'src/main.js': "export const demo = new URL('../examples/demo.diet', import.meta.url);\n",
    'src/styles.css': '@import url("./tokens.css"); body { color: green; }\n',
    'src/tokens.css': ':root { --color: green; }\n',
    'src/locales/it.js': 'export default { label: "Prova" };\n',
    'src/locales/en.js': 'export default { label: "Test" };\n',
    'public/assets/icon.png': await readFile(path.join(PROJECT_ROOT, 'public/assets/icon-192.png')),
    'examples/demo.diet': '{"synthetic":true}',
    'examples/not-used.diet': '{"notInRuntime":true}',
    'examples/full-backup.json': '{"notInRuntime":true}',
    'schemas/document.json': '{}',
    'docs/PROJECT_BRIEF.md': '# Documentation stays with the sources\n',
    'README.md': '# Source package\n',
    'sw.js': await readFile(path.join(PROJECT_ROOT, 'sw.js')),
  };
  await Promise.all(Object.entries(files).map(async ([file, body]) => {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), body);
  }));
  const build = await buildRelease({ root });
  return { root, output: build.output, build, local: await verifyLocalRelease({ root }) };
}

// Use independent HTTP Content-Types, including Pages-compatible alternatives.
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/json',
  '.diet': 'application/octet-stream',
};

async function httpDouble(local, base, transform = record => record) {
  const files = new Map(await Promise.all(local.resources.map(async resource => [resource.url, {
    body: await readFile(path.join(local.output, resource.path)), status: 200,
    mime: MIME[path.extname(resource.path)],
  }])));
  const calls = [];
  let active = 0;
  let peak = 0;
  return {
    calls,
    get peak() { return peak; },
    fetch: async (url, options) => {
      assert.ok(url.startsWith(base), url);
      const relative = url.slice(base.length) || 'index.html';
      calls.push({ url, relative, options });
      active += 1;
      peak = Math.max(peak, active);
      try {
        await Promise.resolve();
        const record = await transform({ ...files.get(relative), relative });
        return new Response(record.body, { status: record.status, headers: { 'Content-Type': record.mime } });
      } finally { active -= 1; }
    },
  };
}

test('minimal builds contain only runtime dependencies and verify over GET at root and a Pages subpath', async t => {
  const { root, output, build, local } = await fixture(t);
  assert.equal(local.version, build.release.version);
  assert.equal(local.fileCount, local.resources.length + 1); // empty .nojekyll
  assert.equal((await readFile(path.join(output, '.nojekyll'))).length, 0);
  assert.equal(await readFile(path.join(output, 'examples/demo.diet'), 'utf8'), '{"synthetic":true}');
  for (const omitted of ['README.md', 'package.json', 'docs/PROJECT_BRIEF.md', 'schemas/document.json',
    'examples/not-used.diet', 'examples/full-backup.json']) {
    await assert.rejects(readFile(path.join(output, omitted)), { code: 'ENOENT' });
    assert.ok((await readFile(path.join(root, omitted))).length > 0);
  }
  for (const base of ['https://release.example/', 'https://release.example/meal-planner/']) {
    const remote = await httpDouble(local, base);
    const result = await verifyPublishedRelease({ root, url: base.slice(0, -1), fetch: remote.fetch, attempts: 1, concurrency: 2 });
    assert.equal(result.url, base);
    assert.equal(result.attempts, 1);
    assert.equal(result.checkedResources, local.resources.length + 1); // directory start URL
    assert.equal(remote.calls.length, result.checkedResources);
    assert.ok(remote.calls.some(call => call.url === base));
    assert.ok(remote.calls.every(call => call.options.method === 'GET' && call.options.signal instanceof AbortSignal));
    assert.ok(remote.peak > 1 && remote.peak <= 2);
  }
});

test('missing, modified, extra and stale local files stop publication verification before any HTTP request', async t => {
  const { root, output } = await fixture(t);
  await writeFile(path.join(output, 'src/main.js'), '// changed distribution');
  await writeFile(path.join(output, 'sw.js'), '// uncompiled or stale worker');
  await rm(path.join(output, 'src/styles.css'));
  await mkdir(path.join(output, 'docs'));
  await writeFile(path.join(output, 'docs/unwanted.md'), 'Not a runtime dependency.');
  let requests = 0;
  await assert.rejects(verifyPublishedRelease({
    root, url: 'https://release.example/', fetch: () => { requests += 1; throw new Error('HTTP must not run.'); }, attempts: 1,
  }), error => {
    assert.equal(error.code, 'RELEASE_INVALID_LOCAL');
    assert.deepEqual(new Set(error.issues.map(issue => issue.code + ':' + issue.path)), new Set([
      'unexpected-file:docs/unwanted.md', 'missing-file:src/styles.css', 'hash-mismatch:src/main.js', 'hash-mismatch:sw.js',
    ]));
    return true;
  });
  assert.equal(requests, 0);

  await buildRelease({ root });
  await appendFile(path.join(root, 'src/main.js'), '// source changed after the build\n');
  await assert.rejects(verifyLocalRelease({ root }), error => {
    assert.equal(error.code, 'RELEASE_INVALID_LOCAL');
    assert.deepEqual(error.issues.map(issue => issue.path).sort(), ['src/main.js', 'sw.js']);
    return true;
  });
});

test('HTTP verification reports missing assets, wrong bytes, stale workers and incompatible MIME in one bounded pass', async t => {
  const { root, local } = await fixture(t);
  const remote = await httpDouble(local, 'https://release.example/meal-planner/', record => {
    if (record.relative === 'public/assets/icon.png') return { ...record, body: 'Missing', status: 404 };
    if (record.relative === 'src/main.js') return { ...record, body: '// different application bytes' };
    if (record.relative === 'sw.js') return { ...record, body: '// previous release worker' };
    if (record.relative === 'src/styles.css') return { ...record, mime: 'text/html; charset=utf-8' };
    return record;
  });
  await assert.rejects(verifyPublishedRelease({ root, url: 'https://release.example/meal-planner/', fetch: remote.fetch, attempts: 1 }), error => {
    assert.equal(error.code, 'RELEASE_HTTP_MISMATCH');
    assert.equal(error.attempts, 1);
    assert.deepEqual(new Set(error.issues.map(issue => issue.code + ':' + issue.path)), new Set([
      'http-status:public/assets/icon.png', 'hash-mismatch:src/main.js', 'hash-mismatch:sw.js', 'mime-mismatch:src/styles.css',
    ]));
    assert.equal(error.issues.find(issue => issue.code === 'http-status').status, 404);
    return true;
  });
  assert.equal(remote.calls.length, local.resources.length + 1);
});

test('deployment propagation retries a complete release with injected delays and stops immediately on success', async t => {
  const { root, local } = await fixture(t);
  let propagated = false;
  const delays = [];
  const attempts = [];
  const remote = await httpDouble(local, 'https://release.example/', record => {
    if (!propagated && record.relative === 'sw.js') return { ...record, body: '// publication still propagating' };
    return record;
  });
  const result = await verifyPublishedRelease({
    root, url: 'https://release.example/', fetch: remote.fetch,
    delay: async milliseconds => { delays.push(milliseconds); propagated = true; },
    onAttempt: report => attempts.push([report.attempt, report.issues.length]),
  });
  assert.deepEqual(delays, [3000]);
  assert.deepEqual(attempts, [[1, 1], [2, 0]]);
  assert.equal(result.attempts, 2);
  assert.equal(remote.calls.length, (local.resources.length + 1) * 2);
  for (const resource of local.resources) {
    assert.equal(remote.calls.filter(call => call.url === 'https://release.example/' + resource.url).length, 2);
  }
});
