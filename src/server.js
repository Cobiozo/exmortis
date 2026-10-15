/**
 * Production Node.js server for exmortis
 * Deployed on Cyberfolks.pl (Phusion Passenger)
 *
 * Serwuje zbudowane pliki statyczne z katalogu 'dist'
 * i obsługuje routing po stronie przeglądarki (SPA).
 *
 * Wymaga wcześniejszego: `npm run build`
 * Plik startowy w panelu Passenger: server.js
 */

import express from 'express';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';

// Kompresja gzip
app.use(compression());

// Nagłówki bezpieczeństwa
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// Passenger: zamykaj połączenie po każdej odpowiedzi (szybsze zwalnianie zasobów)
app.use((req, res, next) => {
  res.setHeader('Connection', 'close');
  next();
});

// Pliki statyczne z builda.
// Podpisy w nazwach plików (assets z hashem) pozwalają na długi cache,
// ale sw.js / manifest / index.html muszą być zawsze świeże (PWA).
app.use(express.static(path.join(__dirname, 'dist'), {
  index: false,
  maxAge: '1y',
  etag: true,
  setHeaders(res, file) {
    const base = path.basename(file);
    if (base === 'index.html' || base === 'sw.js' || file.endsWith('.webmanifest')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
}));

// Health check (monitoring cyberfolks / uptime)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// SPA: każdy pozostały adres → index.html, routing obsługuje React Router
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Obsługa błędów
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message,
  });
});

let server;

server = app.listen(PORT, HOST, () => {
  console.log('='.repeat(60));
  console.log('🚀 EXMORTIS Server (Passenger)');
  console.log('='.repeat(60));
  console.log(`📍 Server running at: http://${HOST}:${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'production'}`);
  console.log(`📅 Started at: ${new Date().toLocaleString('pl-PL')}`);
  console.log('='.repeat(60));
});

// Limity dla shared hostingu (Passenger)
server.maxConnections = 50;
server.keepAliveTimeout = 5000;
server.headersTimeout = 6000;

// Graceful shutdown dla Passenger
const gracefulShutdown = (signal) => {
  console.log(`${signal} received: closing HTTP server`);
  if (typeof server.closeAllConnections === 'function') {
    server.closeAllConnections();
  }
  server.close((err) => {
    if (err) {
      console.error('Error during server close:', err);
      process.exit(1);
    }
    console.log('HTTP server closed successfully');
    process.exit(0);
  });
  const forceExitTimer = setTimeout(() => {
    console.error('Forcing shutdown after timeout');
    process.exit(1);
  }, 5000);
  forceExitTimer.unref();
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));