#!/usr/bin/env node
/**
 * Zero-Dependency Dev-Server mit Live-Reload.
 *
 * Startet einen statischen Webserver (nur Node-Bordmittel, kein
 * `npm install` nötig) und lädt jeden verbundenen Browser-Tab automatisch
 * neu, sobald sich eine Datei im servierten Ordner ändert.
 *
 * Serviert standardmäßig das Repo-Root – also exakt dieselbe Struktur wie
 * die öffentliche Test-URL: "/" ist die Spieleübersicht, "/games/<name>/"
 * das jeweilige Spiel.
 *
 * Nutzung:
 *   node scripts/dev-server.js [ordner] [port]
 *   npm run dev                       -> serviert das Repo-Root auf Port 5173
 *
 * Live-Reload läuft über Server-Sent Events (/__livereload), ganz ohne
 * WebSocket-Bibliothek. In jede ausgelieferte .html-Datei wird ein
 * kleines Inline-Script injiziert, das bei einem Reload-Event die Seite
 * neu lädt.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const REPO_ROOT = path.resolve(__dirname, '..');
const servedArg = process.argv[2] || '.';
const ROOT = path.resolve(REPO_ROOT, servedArg);
const PORT = parseInt(process.argv[3] || process.env.PORT || '5173', 10);

if (!fs.existsSync(ROOT)) {
  console.error(`Ordner nicht gefunden: ${ROOT}`);
  process.exit(1);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.txt': 'text/plain; charset=utf-8',
};

const LIVERELOAD_SNIPPET = `
<script>
(function () {
  try {
    var es = new EventSource('/__livereload');
    es.onmessage = function (e) {
      if (e.data === 'reload') location.reload();
    };
  } catch (err) { /* Live-Reload optional, Spiel funktioniert auch ohne */ }
})();
</script>`;

// ---------- SSE Clients ----------

const clients = new Set();

function broadcastReload() {
  for (const res of clients) {
    try { res.write('data: reload\n\n'); } catch (e) { /* Client evtl. schon weg */ }
  }
}

// ---------- Statischer Dateiserver ----------

function safeJoin(root, urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const resolved = path.normalize(path.join(root, decoded));
  if (!resolved.startsWith(root)) return null; // Path-Traversal verhindern
  return resolved;
}

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';

  if (ext === '.html') {
    fs.readFile(filePath, 'utf8', function (err, data) {
      if (err) return send404(res);
      const withReload = data.includes('</body>')
        ? data.replace('</body>', LIVERELOAD_SNIPPET + '\n</body>')
        : data + LIVERELOAD_SNIPPET;
      res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-cache' });
      res.end(withReload);
    });
    return;
  }

  fs.readFile(filePath, function (err, data) {
    if (err) return send404(res);
    res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

function send404(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404 – nicht gefunden');
}

const server = http.createServer(function (req, res) {
  if (req.url === '/__livereload') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write('\n');
    clients.add(res);
    req.on('close', function () { clients.delete(res); });
    return;
  }

  let filePath = safeJoin(ROOT, req.url === '/' ? '/index.html' : req.url);
  if (!filePath) return send404(res);

  fs.stat(filePath, function (err, stat) {
    if (!err && stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
    fs.stat(filePath, function (err2) {
      if (err2) return send404(res);
      serveFile(res, filePath);
    });
  });
});

// ---------- Rekursives Watchen (ohne Abhängigkeiten) ----------

const IGNORED_DIRS = new Set(['.git', 'node_modules']);
let debounceTimer = null;

function scheduleReload() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(broadcastReload, 80);
}

function watchDir(dir) {
  try {
    fs.watch(dir, function (eventType, filename) {
      scheduleReload();
      // Neue Unterordner ebenfalls beobachten
      if (filename) {
        const full = path.join(dir, filename);
        fs.stat(full, function (err, stat) {
          if (!err && stat.isDirectory() && !IGNORED_DIRS.has(filename)) {
            watchDir(full);
          }
        });
      }
    });
  } catch (e) { /* z.B. Ordner zwischenzeitlich gelöscht */ }
}

function watchTree(root) {
  watchDir(root);
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory() && !IGNORED_DIRS.has(entry.name)) {
      watchTree(path.join(root, entry.name));
    }
  }
}

watchTree(ROOT);

function lanUrl() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return `http://${net.address}:${PORT}/`;
    }
  }
  return null;
}

server.listen(PORT, function () {
  console.log(`\n  Dev-Server läuft`);
  console.log(`  Ordner:  ${path.relative(REPO_ROOT, ROOT) || '.'}`);
  console.log(`  Lokal:   http://localhost:${PORT}/`);
  const lan = lanUrl();
  if (lan) console.log(`  Im WLAN: ${lan}   (fürs Testen auf dem Handy im selben Netz)`);
  console.log(`  Live-Reload aktiv – Speichern genügt, kein manuelles Neuladen.\n`);
});
