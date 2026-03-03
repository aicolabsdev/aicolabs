import express from 'express';
import { createServer } from 'http';
import { connectDB } from './db';
import { setupAuth } from './auth';
import { registerRoutes } from './routes';
import { runCycle } from './autopilot';

// Import WebSocketServer with error handling for optional ws dependency
let WebSocketServer: any;
try {
  const ws = require('ws');
  WebSocketServer = ws.WebSocketServer;
} catch (e) {
  console.warn('[WS] ws package not installed. WebSocket features will be disabled.');
}

const app = express();
const httpServer = createServer(app) as any;

// Setup WebSocket server on /ws path (if ws package is available)
if (WebSocketServer) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  httpServer.wss = wss;

  wss.on('connection', (ws: any) => {
    console.log('[WS] Client connected');
    ws.on('close', () => {
      console.log('[WS] Client disconnected');
    });
  });
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup authentication BEFORE registering routes
setupAuth(app);

// Register all routes - takes exactly 2 arguments
registerRoutes(httpServer, app);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('dist/client'));
  app.get('*', (_req, res) => {
    res.sendFile('dist/client/index.html');
  });
}

const PORT = parseInt(process.env.PORT || '5000', 10);

async function start() {
  try {
    await connectDB();
    httpServer.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });

    // kick off autopilot cycle every few seconds
    setInterval(() => {
      runCycle().catch((err) => console.error('[AUTOPILOT]', err));
    }, 5000);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();

export { app, httpServer };
