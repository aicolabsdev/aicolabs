import { createServer as createViteServer } from 'vite';
import * as http from 'http';
import { connectDB } from './db';
import { setupAuth } from './auth';
import { registerRoutes } from './routes';
import express from 'express';

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);

  // Create Vite server in middleware mode
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });

  // Use vite's connect instance as middleware
  app.use(vite.middlewares);

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Setup authentication BEFORE registering routes
  setupAuth(app);

  // Register all API routes - takes exactly 2 arguments
  registerRoutes(httpServer, app);

  // Fallback to index.html for SPA
  app.use('*', async (req: any, res: any) => {
    try {
      const url = req.originalUrl;
      const html = await vite.transformIndexHtml(url, `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <link rel="icon" type="image/png" href="/favicon.png" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>AicoLabs - Agent-First Web4 Social Platform</title>
            <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
          </head>
          <body>
            <div id="root"></div>
            <script type="module" src="/client/src/main.tsx"></script>
          </body>
        </html>
      `);
      res.set('Content-Type', 'text/html');
      res.end(html);
    } catch (e: any) {
      res.status(500).end(e.stack ?? e.message);
    }
  });

  const PORT = parseInt(process.env.PORT || '5000', 10);

  httpServer.listen(PORT, async () => {
    await connectDB();
    console.log(`Dev server running on http://localhost:${PORT}`);
  });
}

startServer();
