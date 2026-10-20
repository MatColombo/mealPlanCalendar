/** Deterministic app-shell inventory shared by build, check and dev. */
import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

export const RELEASE_TOKEN = '/*__MEAL_PLANNER_RELEASE__*/ null';
const digest = value => createHash('sha256').update(value).digest('hex');

async function listFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(file));
    else if (entry.isFile()) files.push(file);
  }
  return files;
}

/** Never enumerate imported user files, backups, docs or all example plans. */
export async function appResourceFiles(root) {
  const resources = new Set(['index.html', 'manifest.webmanifest'].map(file => path.join(root, file)));
  const sourceFiles = await listFiles(path.join(root, 'src'));
  for (const file of [...sourceFiles, ...await listFiles(path.join(root, 'public/assets'))]) resources.add(file);
  // Literal module-relative URLs include the demo the UI can load offline.
  // Directories (e.g. the IndexedDB namespace) and the generated worker are
  // not app-shell resources. Every included reference must remain local.
  for (const file of sourceFiles.filter(file => /\.m?js$/.test(file))) {
    const content = await readFile(file, 'utf8');
    for (const match of content.matchAll(/new\s+URL\(\s*(['"])(\.[^'"]+)\1\s*,\s*import\.meta\.url\s*\)/g)) {
      const target = path.resolve(path.dirname(file), match[2]);
      if (target !== root && !target.startsWith(root + path.sep)) throw new Error('Risorsa PWA esterna al progetto: ' + match[2]);
      if (target === path.join(root, 'sw.js')) continue;
      if ((await stat(target)).isFile()) resources.add(target);
    }
  }
  return [...resources].sort();
}

/** Include worker behavior as well as the complete immutable asset inventory. */
export function createReleaseMetadata({ version, assets, template }) {
  const workerHash = digest(template);
  const hash = digest(JSON.stringify({ version, workerHash, assets }));
  return { version: `${version}+${hash.slice(0, 16)}`, hash, assets };
}

export function compileServiceWorker(template, release) {
  if (template.split(RELEASE_TOKEN).length !== 2) throw new Error('Il template sw.js deve contenere un solo segnaposto di release.');
  return template.replace(RELEASE_TOKEN, () => JSON.stringify(release));
}

/** Build from the actual tree to be served, including a copied dist snapshot. */
export async function createPwaWorker(root, { version } = {}) {
  root = path.resolve(root);
  if (version === undefined) version = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')).version;
  const template = await readFile(path.join(root, 'sw.js'), 'utf8');
  const assets = await Promise.all((await appResourceFiles(root)).map(async file => ({
    url: path.relative(root, file).split(path.sep).map(encodeURIComponent).join('/'),
    sha256: digest(await readFile(file)),
  })));
  const release = createReleaseMetadata({ version, assets, template });
  return { release, worker: compileServiceWorker(template, release) };
}
