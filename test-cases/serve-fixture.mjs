// Tiny zero-dependency static file server for the batch evaluator's local fixture site.
// Usage: node test-cases/serve-fixture.mjs [port]
// Serves test-cases/fixtures/ at http://localhost:<port>/, so test-cases/fixtures/acme/
// becomes http://localhost:8099/acme/ - matching the shape used in the assignment's
// Appendix B example and in test-cases/cases.json.

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, 'fixtures');
const PORT = Number(process.argv[2] ?? 8099);

const CONTENT_TYPES = { '.html': 'text/html', '.txt': 'text/plain' };

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    let filePath = path.join(ROOT, decodeURIComponent(url.pathname));
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    if (filePath.endsWith('/') || (await isDirectory(filePath))) {
      filePath = path.join(filePath, 'index.html');
    } else if (!(await fileExists(filePath)) && (await fileExists(`${filePath}.html`))) {
      // Extensionless URLs (e.g. /handbook/engineering/how-we-hire) are common on real
      // company sites, so fall back to the .html file the way most static hosts do.
      filePath = `${filePath}.html`;
    }
    const body = await fs.readFile(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': CONTENT_TYPES[ext] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

async function isDirectory(p) {
  try {
    return (await fs.stat(p)).isDirectory();
  } catch {
    return false;
  }
}

async function fileExists(p) {
  try {
    return (await fs.stat(p)).isFile();
  } catch {
    return false;
  }
}

server.listen(PORT, () => {
  console.log(`Serving ${ROOT} at http://localhost:${PORT}/`);
  console.log(`Try: http://localhost:${PORT}/acme/`);
});
