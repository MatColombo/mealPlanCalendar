/**
 * Verify the static distribution locally and, only with an explicit URL,
 * compare the deployed HTTP bytes with that exact release.
 * This is not a browser, installation or offline-functionality test.
 */
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { setTimeout as wait } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createPwaWorker } from './pwa-build.mjs';

const PROJECT_ROOT = fileURLToPath(new URL('../', import.meta.url));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const filePath = url => url.split('/').map(decodeURIComponent).join(path.sep);
const mimeTypes = {
  '.html': ['text/html'],
  '.js': ['text/javascript', 'application/javascript'],
  '.mjs': ['text/javascript', 'application/javascript'],
  '.css': ['text/css'],
  '.png': ['image/png'],
  '.svg': ['image/svg+xml'],
  '.json': ['application/json'],
  '.webmanifest': ['application/manifest+json', 'application/json'],
  // Pages may serve an unknown extension as a download or plain text; fetch
  // parses this public demo as JSON independently of its Content-Type.
  '.diet': ['application/json', 'application/octet-stream', 'text/plain'],
};

function releaseError(code, message, details = {}) {
  return Object.assign(new Error(message), { code, ...details });
}

export function expectedMimeTypes(file) {
  return mimeTypes[path.extname(file).toLowerCase()] ?? ['application/octet-stream'];
}

async function listFiles(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(path.join(directory, prefix), { withFileTypes: true })) {
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(directory, relative));
    else if (entry.isFile()) files.push(relative);
    else throw releaseError('RELEASE_INVALID_LOCAL', 'La distribuzione contiene una voce non regolare.', {
      issues: [{ code: 'unsupported-entry', path: relative }],
    });
  }
  return files.sort();
}

/** Detect stale builds, modified/missing bytes and accidentally public files. */
export async function verifyLocalRelease({ root = PROJECT_ROOT, output } = {}) {
  root = path.resolve(root);
  output = path.resolve(output ?? path.join(root, 'dist'));
  const { release, worker } = await createPwaWorker(root);
  const resources = [...release.assets.map(asset => ({
    ...asset, path: filePath(asset.url), mimeTypes: expectedMimeTypes(asset.url),
  })), { url: 'sw.js', path: 'sw.js', sha256: sha256(worker), mimeTypes: expectedMimeTypes('sw.js') }];
  let actual;
  try { actual = new Set(await listFiles(output)); }
  catch (cause) {
    if (cause.code === 'RELEASE_INVALID_LOCAL') throw cause;
    throw releaseError('RELEASE_LOCAL_UNAVAILABLE', 'Distribuzione locale non leggibile: eseguire npm run build.', { cause });
  }
  const expected = new Set(resources.map(resource => resource.path));
  const issues = [...actual].filter(file => !expected.has(file) && file !== '.nojekyll')
    .map(file => ({ code: 'unexpected-file', path: file }));
  for (const resource of resources) {
    if (!actual.has(resource.path)) { issues.push({ code: 'missing-file', path: resource.path }); continue; }
    const received = sha256(await readFile(path.join(output, resource.path)));
    if (received !== resource.sha256) issues.push({
      code: 'hash-mismatch', path: resource.path, expected: resource.sha256, received,
    });
  }
  if (actual.has('.nojekyll') && (await readFile(path.join(output, '.nojekyll'))).length !== 0) {
    issues.push({ code: 'nonempty-marker', path: '.nojekyll' });
  }
  if (issues.length) throw releaseError('RELEASE_INVALID_LOCAL', 'La distribuzione non corrisponde ai sorgenti correnti.', { issues });
  return { output, version: release.version, hash: release.hash, resources, fileCount: actual.size };
}

export function normalizeReleaseUrl(input) {
  let url;
  try { url = new URL(input); }
  catch { throw releaseError('RELEASE_INVALID_URL', 'Specificare un URL HTTP o HTTPS della cartella pubblicata.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw releaseError('RELEASE_INVALID_URL', 'Specificare un URL HTTP o HTTPS senza credenziali.');
  }
  url.search = '';
  url.hash = '';
  if (url.pathname.endsWith('/index.html')) url.pathname = url.pathname.slice(0, -'index.html'.length);
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url;
}

async function concurrentMap(items, concurrency, operation) {
  let index = 0;
  const results = new Array(items.length);
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const current = index++;
      results[current] = await operation(items[current]);
    }
  }));
  return results;
}

function boundedInteger(value, name, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw releaseError('RELEASE_INVALID_OPTIONS', `${name} deve essere un intero fra ${min} e ${max}.`);
  }
}

async function checkHttpResource(resource, base, fetchRequest, requestTimeoutMs) {
  const url = new URL(resource.url, base).href;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetchRequest(url, {
      method: 'GET', cache: 'no-store', redirect: 'error', signal: controller.signal,
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (response.status !== 200 || response.redirected) {
      await response.body?.cancel();
      return [{ code: 'http-status', path: resource.path, url, status: response.status }];
    }
    const issues = [];
    const receivedMime = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (!resource.mimeTypes.includes(receivedMime)) issues.push({
      code: 'mime-mismatch', path: resource.path, url, expected: resource.mimeTypes, received: receivedMime,
    });
    const receivedHash = sha256(Buffer.from(await response.arrayBuffer()));
    if (receivedHash !== resource.sha256) issues.push({
      code: 'hash-mismatch', path: resource.path, url, expected: resource.sha256, received: receivedHash,
    });
    return issues;
  } catch (cause) {
    return [{ code: controller.signal.aborted ? 'request-timeout' : 'network-error', path: resource.path, url, message: cause.message }];
  } finally { clearTimeout(timeout); }
}

/**
 * Run local verification first, then bounded complete HTTP passes. A later
 * attempt checks every resource again instead of accepting a mixed snapshot.
 * fetch/delay are injectable; tests need neither a server nor real requests.
 */
export async function verifyPublishedRelease({
  root = PROJECT_ROOT, output, url,
  fetch: fetchRequest = globalThis.fetch, delay = milliseconds => wait(milliseconds),
  attempts = 5, retryDelayMs = 3000, requestTimeoutMs = 10000, concurrency = 4,
  onAttempt,
} = {}) {
  const local = await verifyLocalRelease({ root, output });
  const base = normalizeReleaseUrl(url);
  boundedInteger(attempts, 'attempts', 1, 5);
  boundedInteger(retryDelayMs, 'retryDelayMs', 0, 30000);
  boundedInteger(requestTimeoutMs, 'requestTimeoutMs', 1, 30000);
  boundedInteger(concurrency, 'concurrency', 1, 8);
  if (typeof fetchRequest !== 'function' || typeof delay !== 'function') {
    throw releaseError('RELEASE_INVALID_OPTIONS', 'fetch e delay devono essere funzioni.');
  }
  const index = local.resources.find(resource => resource.url === 'index.html');
  // The entry URL returned by Pages must open the same index as index.html.
  const resources = [...local.resources, { ...index, url: '', path: '(avvio)' }];
  let issues;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    issues = (await concurrentMap(resources, concurrency,
      resource => checkHttpResource(resource, base, fetchRequest, requestTimeoutMs))).flat();
    await onAttempt?.({ attempt, attempts, issues });
    if (issues.length === 0) return { ...local, url: base.href, attempts: attempt, checkedResources: resources.length };
    if (attempt < attempts) await delay(retryDelayMs);
  }
  throw releaseError('RELEASE_HTTP_MISMATCH', 'Le risposte HTTP non corrispondono alla distribuzione locale.', {
    url: base.href, version: local.version, attempts, issues,
  });
}

/** CLI accepts no implicit remote target: only --url or MEAL_PLANNER_URL. */
export async function runVerificationCli(args = process.argv.slice(2), { env = process.env } = {}) {
  if (args.length === 1 && args[0] === '--help') {
    console.log('Uso: node scripts/verify-release.mjs [--url https://utente.github.io/meal-planner/]');
    console.log('Senza --url usa MEAL_PLANNER_URL, se impostato; altrimenti verifica soltanto dist/.');
    console.log('HTTP: 5 tentativi, intervallo 3 s, timeout 10 s, massimo 4 richieste contemporanee.');
    console.log('Verifica artefatti e risposte HTTP; non esegue un collaudo browser, installazione o offline.');
    return;
  }
  if (args.length !== 0 && (args.length !== 2 || args[0] !== '--url' || !args[1]?.trim())) {
    throw releaseError('RELEASE_INVALID_OPTIONS', 'Uso: node scripts/verify-release.mjs [--url URL]');
  }
  const url = args[1] ?? env.MEAL_PLANNER_URL?.trim();
  console.log('Verifica degli artefatti statici; non è un collaudo browser, installazione o offline.');
  if (url) {
    const result = await verifyPublishedRelease({ url, onAttempt: ({ attempt, attempts, issues }) => {
      console.log(`HTTP ${attempt}/${attempts}: ${issues.length === 0 ? 'risposte conformi' : issues.length + ' discrepanze'}.`);
    } });
    console.log(`Release ${result.version}: ${result.checkedResources} risposte HTTP verificate su ${result.url}`);
    return result;
  }
  const result = await verifyLocalRelease();
  console.log(`Release ${result.version}: ${result.fileCount} file locali verificati. Nessuna richiesta HTTP eseguita.`);
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await runVerificationCli(); }
  catch (error) {
    console.error((error.code ?? 'RELEASE_CHECK_FAILED') + ': ' + error.message);
    for (const issue of error.issues ?? []) {
      console.error(`- ${issue.path}: ${issue.code}${issue.status === undefined ? '' : ' (' + issue.status + ')'}`);
    }
    process.exitCode = 1;
  }
}
