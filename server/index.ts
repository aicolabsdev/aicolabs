import express from 'express';
import { createServer } from 'http';
import { connectDB } from './db';
import { setupAuth } from './auth';
import { registerRoutes } from './routes';

const app = express();
const httpServer = createServer(app);

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
  app.get('*', (req, res) => {
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
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();

export { app, httpServer };
