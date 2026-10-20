import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createPwaWorker, RELEASE_TOKEN } from './pwa-build.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index < 0 ? fallback : args[index + 1];
};

if (args.includes('--help')) {
  console.log('Uso: node scripts/dev.mjs [--dir .] [--port 5173] [--host 127.0.0.1]');
  process.exit(0);
}

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)), option('--dir', '.'));
const port = Number(option('--port', '5173'));
const host = option('--host', '127.0.0.1');
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('La porta deve essere un intero fra 1 e 65535.');
}
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.diet': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.md': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json'
};

const server = http.createServer(async (request, response) => {
  try {
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname.includes('\0') || pathname.split('/').some((part) => part.startsWith('.'))) {
      response.writeHead(404).end('Not found');
      return;
    }
    let file = path.resolve(root, '.' + pathname);
    if (file !== root && !file.startsWith(root + path.sep)) {
      response.writeHead(404).end('Not found');
      return;
    }
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    let content = await readFile(file);
    if (file === path.join(root, 'sw.js') && content.includes(RELEASE_TOKEN)) {
      content = Buffer.from((await createPwaWorker(root)).worker);
    }
    response.writeHead(200, {
      'Content-Type': types[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 404 : 400);
    response.end('File non disponibile.');
  }
});

server.on('error', (error) => {
  console.error('Impossibile avviare il server: ' + error.message);
  process.exitCode = 1;
});
server.listen(port, host, () => {
  console.log('Project Meal Planner: http://' + host + ':' + port + '/');
  console.log('Cartella: ' + root);
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
