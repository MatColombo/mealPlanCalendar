import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { appResourceFiles, createPwaWorker } from './pwa-build.mjs';

const PROJECT_ROOT = fileURLToPath(new URL('../', import.meta.url));

/** Distribute only files actually required by the app shell. */
export async function buildRelease({ root = PROJECT_ROOT, output } = {}) {
  root = path.resolve(root);
  output = path.resolve(output ?? path.join(root, 'dist'));
  const resources = await appResourceFiles(root);
  const template = path.join(root, 'sw.js');
  if ([...resources, template, path.join(root, 'package.json')]
    .some(file => file === output || file.startsWith(output + path.sep))) {
    throw new Error('La cartella di build non può contenere i sorgenti del progetto.');
  }
  const { version } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  await Promise.all([...resources, template].map(async source => {
    const target = path.join(output, path.relative(root, source));
    await mkdir(path.dirname(target), { recursive: true });
    await cp(source, target);
  }));
  // Hash the exact copied files, so the generated worker and distribution
  // describe the same snapshot. Package/docs/other examples stay in the repo.
  const pwa = await createPwaWorker(output, { version });
  await writeFile(path.join(output, 'sw.js'), pwa.worker);
  await writeFile(path.join(output, '.nojekyll'), '');
  return { output, release: pwa.release, fileCount: pwa.release.assets.length + 2 };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await buildRelease();
    console.log('Build statica minima pronta in dist/ (' + result.fileCount + ' file).');
    console.log('PWA ' + result.release.version + ': ' + result.release.assets.length + ' risorse con hash verificabile.');
    console.log('Include soltanto la shell, il worker compilato e il marker .nojekyll.');
  } catch (error) {
    console.error('Build non completata: ' + error.message);
    process.exitCode = 1;
  }
}
