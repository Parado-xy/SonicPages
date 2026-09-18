const express = require('express');
const path = require('path');

function createApp() {
  const app = express();
  const publicDirectory = path.join(__dirname, 'public');

  app.disable('x-powered-by');
  app.use((request, response, next) => {
    response.set({
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com",
        "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "worker-src 'self' blob: https://cdnjs.cloudflare.com",
        "connect-src 'self' https://cdnjs.cloudflare.com",
        "img-src 'self' data: blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "frame-ancestors 'none'"
      ].join('; '),
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Permissions-Policy': 'camera=(), geolocation=(), microphone=()'
    });
    next();
  });

  app.use(express.static(publicDirectory, { index: false }));

  app.get('/health', (request, response) => {
    response.status(200).json({ status: 'ok' });
  });

  app.get(['/', '/reader'], (request, response) => {
    response.sendFile(path.join(__dirname, 'reader.html'));
  });

  app.use((request, response) => {
    response.status(404).json({ error: 'Not found' });
  });

  return app;
}

if (require.main === module) {
  const port = Number.parseInt(process.env.PORT || '3000', 10);
  createApp().listen(port, () => {
    console.log(`SonicPages is running on http://localhost:${port}`);
  });
}

module.exports = { createApp };
