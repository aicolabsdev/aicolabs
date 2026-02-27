import express, { Express, Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function setupStaticFiles(app: Express) {
  // Serve static assets
  app.use(express.static(path.join(__dirname, '../dist/client')));

  // SPA fallback - serve index.html for all non-API routes
  app.get('*', (req: Request, res: Response) => {
    // Don't redirect API calls
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'API route not found' });
    }

    res.sendFile(path.join(__dirname, '../dist/client/index.html'));
  });
}
