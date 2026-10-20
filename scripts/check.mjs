import { readdir, readFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createPwaWorker } from './pwa-build.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const list = async (directory) => {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await list(full));
    else result.push(full);
  }
  return result;
};
const files = (await Promise.all(['src', 'scripts', 'tests', 'schemas', 'examples'].map(
  (directory) => list(path.join(root, directory))
))).flat();
files.push(path.join(root, 'sw.js'));
let jsCount = 0;
let jsonCount = 0;
for (const file of files) {
  if (/\.(m?js)$/.test(file)) {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (result.status !== 0) throw new Error(result.stderr || 'Errore sintattico: ' + file);
    const content = await readFile(file, 'utf8');
    for (const match of content.matchAll(/(?:from\s+|import\s*)['"](\.[^'"]+)['"]/g)) {
      await access(path.resolve(path.dirname(file), match[1]));
    }
    jsCount += 1;
  } else if (/\.(json|diet)$/.test(file)) {
    JSON.parse(await readFile(file, 'utf8'));
    jsonCount += 1;
  }
}
const html = await readFile(path.join(root, 'index.html'), 'utf8');
for (const match of html.matchAll(/(?:src|href)=["'](\.\/[^"']+)["']/g)) {
  await access(path.join(root, match[1]));
}
JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const manifest = JSON.parse(await readFile(path.join(root, 'manifest.webmanifest'), 'utf8'));
jsonCount += 1;
// An explicit relative id resolves against the origin, not the manifest path.
// Omitting it inherits start_url and keeps separate GitHub Pages apps distinct.
if (Object.hasOwn(manifest, 'id') || manifest.start_url !== './' || manifest.scope !== './'
  || manifest.display !== 'standalone') throw new Error('Il manifest deve ereditare l’identità da start_url e mantenere lo scope relativo al progetto.');
for (const icon of [...manifest.icons, { src: './public/assets/apple-touch-icon.png', sizes: '180x180' }]) {
  const image = await readFile(path.join(root, icon.src));
  const [width, height] = icon.sizes.split('x').map(Number);
  if (image.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a'
    || image.readUInt32BE(16) !== width || image.readUInt32BE(20) !== height) {
    throw new Error('Icona PNG o dimensioni non coerenti: ' + icon.src);
  }
}
const pwa = await createPwaWorker(root);
const compiled = spawnSync(process.execPath, ['--check'], { input: pwa.worker, encoding: 'utf8' });
if (compiled.status !== 0) throw new Error(compiled.stderr || 'Service worker generato non leggibile.');
console.log('Sintassi: ' + jsCount + ' moduli JS e ' + jsonCount + ' documenti JSON/.diet.');
console.log('Riferimenti locali dei moduli e della pagina presenti.');
console.log('Manifest, icone e shell PWA: ' + pwa.release.assets.length + ' risorse, release ' + pwa.release.version + '.');
console.log('Nessuna verifica nutrizionale o di validità dei pasti eseguita.');
