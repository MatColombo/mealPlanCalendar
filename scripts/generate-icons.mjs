/** Optional authoring tool. PNGs are committed; builds do not require sharp. */
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
let sharp;
try { sharp = require('sharp'); }
catch { throw new Error('Per rigenerare le icone serve sharp come strumento locale. La build usa i PNG già inclusi.'); }

const directory = fileURLToPath(new URL('../public/assets/', import.meta.url));
const source = await readFile(path.join(directory, 'sprout.svg'), 'utf8');
const drawing = source.match(/<svg\b[^>]*>([\s\S]*)<\/svg>/)?.[1];
if (!drawing) throw new Error('Il sorgente vettoriale sprout.svg non è leggibile.');
const png = { compressionLevel: 9, adaptiveFiltering: false, palette: false };
for (const size of [192, 512]) {
  await writeFile(path.join(directory, `icon-${size}.png`),
    await sharp(Buffer.from(source)).resize(size, size).png(png).toBuffer());
}
// An opaque background and inset preserve the entire existing drawing inside
// the maskable safe circle. No AI generation or new illustration is involved.
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" fill="#d9edbc"/><g transform="translate(13.44 13.44) scale(0.72)">${drawing}</g></svg>`;
await writeFile(path.join(directory, 'icon-maskable-512.png'),
  await sharp(Buffer.from(maskable)).resize(512, 512).png(png).toBuffer());
await writeFile(path.join(directory, 'apple-touch-icon.png'),
  await sharp(Buffer.from(source)).resize(180, 180).flatten({ background: '#fff8ed' }).png(png).toBuffer());
console.log('Quattro icone PNG ricavate deterministicamente da sprout.svg.');
