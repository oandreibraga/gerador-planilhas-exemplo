// Servidor estático mínimo para os testes de navegador: serve dist/ em http://127.0.0.1:4173,
// como o site publicado (sem cabeçalhos especiais: a CSP vem do próprio HTML, como no GitHub Pages).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../dist');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const PORTA = Number(process.env.PORTA || 4173);

http.createServer((req, res) => {
  const caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const nome = caminho === '/' ? 'index.html' : caminho.slice(1);
  const arquivo = path.join(dist, nome);
  if (req.method !== 'GET' || !arquivo.startsWith(dist + path.sep) || !fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('não encontrado');
    return;
  }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arquivo)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(arquivo).pipe(res);
}).listen(PORTA, '127.0.0.1', () => console.log('servindo dist/ em http://127.0.0.1:' + PORTA));
