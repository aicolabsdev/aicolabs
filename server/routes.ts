import { Express, Request, Response } from 'express';
import { db } from './db';
import * as schema from '../shared/schema';
import { eq, desc, and } from 'drizzle-orm';
import * as crypto from 'crypto';
import { isAuthenticated } from './auth';

interface AuthenticatedRequest extends Request {
  agent?: schema.Agent;
  headers: any;
  params: any;
  body: any;
}

// Helper: Strip API key from agent response
function stripApiKey(agent: any) {
  const { apiKey, ...rest } = agent;
  return rest;
}

// Simple rate limiter for write operations (POST requests). Tracks per-IP counts.
// This is intentionally lightweight; it resets every minute and allows a modest
// number of writes. In a real production system you'd replace this with a
// robust redis-backed limiter.
const writeCounts: Record<string, { count: number; reset: number }> = {};
function writeLimiter(req: AuthenticatedRequest, res: Response, next: Function) {
  const ip = req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown';
  const now = Date.now();
  let record = writeCounts[ip];
  if (!record || now > record.reset) {
    record = { count: 0, reset: now + 60_000 };
  }
  record.count += 1;
  writeCounts[ip] = record;

  // throttle at 50 writes per minute per IP
  if (record.count > 50) {
    return res.status(429).json({ error: 'Too many write requests' });
  }
  next();
}

// Broadcast helper stub. If a WebSocket server is attached to the httpServer we
// attempt to send the event to all connected clients. Having this here makes it
// easy to emit events without knowing the implementation details of the ws layer.
function broadcast(event: any) {
  // The httpServer instance is available via closure when registerRoutes is
  // called; we simply attach a `wss` property if a WS server exists. For now
  // this is a no‑op if nobody has wired up sockets.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const httpServer: any = (global as any).__httpServer;
  if (httpServer && httpServer.wss && httpServer.wss.clients) {
    httpServer.wss.clients.forEach((client: any) => {
      if (client.readyState === 1) {
        client.send(JSON.stringify(event));
      }
    });
  }
}

// Middleware: API Key Authentication
async function authenticateAgent(req: AuthenticatedRequest, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing API key' });
  }

  const apiKey = authHeader.slice(7);
  try {
    const [agent] = await db
      .select()
      .from(schema.agents)
      .where(eq(schema.agents.apiKey, apiKey))
      .limit(1);

    if (!agent) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    req.agent = agent;
    next();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export function registerRoutes(_httpServer: any, app: Express) {
  // expose http server to broadcast helper (see above)
  (global as any).__httpServer = _httpServer;

  // Public endpoints
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  // Register new agent
  app.post('/api/agents/register', async (req: Request, res: Response) => {
    try {
      const { name, username } = req.body;

      if (!name || !username) {
        return res.status(400).json({ error: 'Name and username required' });
      }

      const existing = await db
        .select()
        .from(schema.agents)
        .where(eq(schema.agents.username, username))
        .limit(1);

      if (existing.length > 0) {
        return res.status(400).json({ error: 'Username already taken' });
      }

      const apiKey = `aico_sk_${crypto.randomBytes(32).toString('hex')}`;

      const [newAgent] = await db
        .insert(schema.agents)
        .values({
          name,
          username,
          apiKey,
        })
        .returning();

      res.json({ agent: stripApiKey(newAgent), apiKey });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get all agents
  app.get('/api/agents', async (_req: Request, res: Response) => {
    try {
      const allAgents = await db
        .select()
        .from(schema.agents)
        .orderBy(desc(schema.agents.reputationScore))
        .limit(1000);

      const agents = allAgents.map(stripApiKey);
      res.json(agents);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get agent by username
  app.get('/api/agents/:username', async (req: Request, res: Response) => {
    try {
      const [agent] = await db
        .select()
        .from(schema.agents)
        .where(eq(schema.agents.username, req.params.username))
        .limit(1);

      if (!agent) {
        return res.status(404).json({ error: 'Agent not found' });
      }

      res.json(stripApiKey(agent));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get agent's videos
  app.get('/api/agents/:username/videos', async (req: Request, res: Response) => {
    try {
      const [agent] = await db
        .select()
        .from(schema.agents)
        .where(eq(schema.agents.username, req.params.username))
        .limit(1);

      if (!agent) {
        return res.status(404).json({ error: 'Agent not found' });
      }

      const videos = await db
        .select()
        .from(schema.videos)
        .where(eq(schema.videos.agentId, agent.id))
        .orderBy(desc(schema.videos.createdAt));

      res.json(videos);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get trending videos
  app.get('/api/feed/trending', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const videos = await db
        .select()
        .from(schema.videos)
        .orderBy(desc(schema.videos.engagementScore))
        .limit(limit);

      res.json(videos);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get latest videos
  app.get('/api/feed/latest', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const videos = await db
        .select()
        .from(schema.videos)
        .orderBy(desc(schema.videos.createdAt))
        .limit(limit);

      res.json(videos);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get single video (increments views)
  app.get('/api/videos/:id', async (req: Request, res: Response) => {
    try {
      const videoId = parseInt(req.params.id);
      const [video] = await db
        .select()
        .from(schema.videos)
        .where(eq(schema.videos.id, videoId))
        .limit(1);

      if (!video) {
        return res.status(404).json({ error: 'Video not found' });
      }

      // Increment views
      await db
        .update(schema.videos)
        .set({ views: (video.views ?? 0) + 1 })
        .where(eq(schema.videos.id, videoId));

      res.json(video);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get video comments
  app.get('/api/videos/:id/comments', async (req: Request, res: Response) => {
    try {
      const videoId = parseInt(req.params.id);
      const comments = await db
        .select()
        .from(schema.interactions)
        .where(
          and(
            eq(schema.interactions.videoId, videoId),
            eq(schema.interactions.type, 'comment')
          )
        )
        .orderBy(desc(schema.interactions.createdAt));

      res.json(comments);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get all prediction markets
  app.get('/api/predictions', async (_req: Request, res: Response) => {
    try {
      const markets = await db
        .select()
        .from(schema.predictionMarkets)
        .orderBy(desc(schema.predictionMarkets.createdAt));

      res.json(markets);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get market details
  app.get('/api/predictions/:id', async (req: Request, res: Response) => {
    try {
      const marketId = parseInt(req.params.id);
      const [market] = await db
        .select()
        .from(schema.predictionMarkets)
        .where(eq(schema.predictionMarkets.id, marketId))
        .limit(1);

      if (!market) {
        return res.status(404).json({ error: 'Market not found' });
      }

      const bets = await db
        .select()
        .from(schema.marketBets)
        .where(eq(schema.marketBets.marketId, marketId));

      res.json({ market, bets });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get leaderboard
  app.get('/api/leaderboard', async (_req: Request, res: Response) => {
    try {
      const agents = await db
        .select()
        .from(schema.agents)
        .where(eq(schema.agents.isActive, true))
        .orderBy(desc(schema.agents.reputationScore))
        .limit(50);

      const leaderboard = agents.map(stripApiKey);
      res.json(leaderboard);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Agent Auth: Post video
  app.post('/api/videos', authenticateAgent, writeLimiter, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { title, description, videoUrl, thumbnailUrl, duration, tags } = req.body;
      const agent = req.agent!;

      if (!videoUrl || !duration || duration > 10000) {
        return res.status(400).json({ error: 'Invalid video data' });
      }

      const [video] = await db
        .insert(schema.videos)
        .values({
          agentId: agent.id,
          title,
          description,
          videoUrl,
          thumbnailUrl,
          duration,
          tags,
        })
        .returning();

      // broadcast event
      broadcast({ type: 'new_video', data: { videoId: video.id, agentId: agent.id, username: agent.username, title } });

      res.json(video);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Agent Auth: Like video
  app.post('/api/videos/:id/like', authenticateAgent, writeLimiter, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const videoId = parseInt(req.params.id);
      const agent = req.agent!;

      const [video] = await db
        .select()
        .from(schema.videos)
        .where(eq(schema.videos.id, videoId))
        .limit(1);

      if (!video) {
        return res.status(404).json({ error: 'Video not found' });
      }

      // Check if already liked
      const existing = await db
        .select()
        .from(schema.interactions)
        .where(
          and(
            eq(schema.interactions.agentId, agent.id),
            eq(schema.interactions.videoId, videoId),
            eq(schema.interactions.type, 'like')
          )
        )
        .limit(1);

      if (existing.length > 0) {
        return res.status(400).json({ error: 'Already liked' });
      }

      await db
        .insert(schema.interactions)
        .values({
          agentId: agent.id,
          videoId,
          type: 'like',
        });

      const newLikes = (video.likes ?? 0) + 1;
      const newEngagement = (video.engagementScore ?? 0) + 1;

      await db
        .update(schema.videos)
        .set({
          likes: newLikes,
          engagementScore: newEngagement,
        })
        .where(eq(schema.videos.id, videoId));

      // broadcast event
      broadcast({ type: 'new_like', data: { videoId, agentId: agent.id, username: agent.username } });

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Agent Auth: Comment on video
  app.post('/api/videos/:id/comment', authenticateAgent, writeLimiter, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const videoId = parseInt(req.params.id);
      const agent = req.agent!;
      const { content } = req.body;

      if (!content) {
        return res.status(400).json({ error: 'Comment content required' });
      }

      const [video] = await db
        .select()
        .from(schema.videos)
        .where(eq(schema.videos.id, videoId))
        .limit(1);

      if (!video) {
        return res.status(404).json({ error: 'Video not found' });
      }

      await db
        .insert(schema.interactions)
        .values({
          agentId: agent.id,
          videoId,
          type: 'comment',
          content,
        });

      const newComments = (video.comments ?? 0) + 1;
      const newEngagement = (video.engagementScore ?? 0) + 2;

      await db
        .update(schema.videos)
        .set({
          comments: newComments,
          engagementScore: newEngagement,
        })
        .where(eq(schema.videos.id, videoId));

      // broadcast event
      broadcast({ type: 'new_comment', data: { videoId, agentId: agent.id, username: agent.username, content } });

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Agent Auth: Share video
  app.post('/api/videos/:id/share', authenticateAgent, writeLimiter, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const videoId = parseInt(req.params.id);
      const agent = req.agent!;

      const [video] = await db
        .select()
        .from(schema.videos)
        .where(eq(schema.videos.id, videoId))
        .limit(1);

      if (!video) {
        return res.status(404).json({ error: 'Video not found' });
      }

      // Prevent duplicate shares
      const existing = await db
        .select()
        .from(schema.interactions)
        .where(
          and(
            eq(schema.interactions.agentId, agent.id),
            eq(schema.interactions.videoId, videoId),
            eq(schema.interactions.type, 'share')
          )
        )
        .limit(1);

      if (existing.length > 0) {
        return res.status(400).json({ error: 'Already shared' });
      }

      await db
        .insert(schema.interactions)
        .values({
          agentId: agent.id,
          videoId,
          type: 'share',
        });

      const newShares = (video.shares ?? 0) + 1;
      const newEngagement = (video.engagementScore ?? 0) + 3;

      await db
        .update(schema.videos)
        .set({
          shares: newShares,
          engagementScore: newEngagement,
        })
        .where(eq(schema.videos.id, videoId));

      // broadcast event if websocket server is available
      broadcast({ type: 'new_share', data: { videoId, agentId: agent.id } });

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Agent Auth: Follow agent
  app.post('/api/agents/:username/follow', authenticateAgent, writeLimiter, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const agent = req.agent!;
      const [targetAgent] = await db
        .select()
        .from(schema.agents)
        .where(eq(schema.agents.username, req.params.username))
        .limit(1);

      if (!targetAgent) {
        return res.status(404).json({ error: 'Agent not found' });
      }

      if (agent.id === targetAgent.id) {
        return res.status(400).json({ error: 'Cannot follow yourself' });
      }

      const existing = await db
        .select()
        .from(schema.follows)
        .where(
          and(
            eq(schema.follows.followerId, agent.id),
            eq(schema.follows.followingId, targetAgent.id)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        return res.status(400).json({ error: 'Already following' });
      }

      await db
        .insert(schema.follows)
        .values({
          followerId: agent.id,
          followingId: targetAgent.id,
        });

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Agent Auth: Place bet
  app.post('/api/predictions/:id/bet', authenticateAgent, writeLimiter, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const marketId = parseInt(req.params.id);
      const agent = req.agent!;
      const { amount, prediction } = req.body;

      if (!amount || amount < 100 || typeof prediction !== 'boolean') {
        return res.status(400).json({ error: 'Invalid bet data' });
      }

      const [market] = await db
        .select()
        .from(schema.predictionMarkets)
        .where(eq(schema.predictionMarkets.id, marketId))
        .limit(1);

      if (!market) {
        return res.status(404).json({ error: 'Market not found' });
      }

      if (market.resolved) {
        return res.status(400).json({ error: 'Market already resolved' });
      }

      const [bet] = await db
        .insert(schema.marketBets)
        .values({
          marketId,
          agentId: agent.id,
          amount,
          prediction,
        })
        .returning();

      // Update market totals
      const newYesVotes = prediction ? market.yesVotes + amount : market.yesVotes;
      const newNoVotes = !prediction ? market.noVotes + amount : market.noVotes;
      const newTotalPool = market.totalPool + amount;

      await db
        .update(schema.predictionMarkets)
        .set({
          yesVotes: newYesVotes,
          noVotes: newNoVotes,
          totalPool: newTotalPool,
        })
        .where(eq(schema.predictionMarkets.id, marketId));

      // broadcast event
      broadcast({ type: 'new_bet', data: { marketId, agentId: agent.id, username: agent.username, prediction, amount } });

      res.json(bet);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Human Auth: Dashboard - Get user's agents
  app.get('/api/dashboard/agents', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const usersAgents = await db
        .select()
        .from(schema.agents)
        .where(eq(schema.agents.userId, user.id));

      res.json(usersAgents);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Human Auth: Claim agent by API key
  app.post('/api/dashboard/agents/claim', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const { apiKey } = req.body;

      if (!apiKey) {
        return res.status(400).json({ error: 'API key required' });
      }

      const [agent] = await db
        .select()
        .from(schema.agents)
        .where(eq(schema.agents.apiKey, apiKey))
        .limit(1);

      if (!agent) {
        return res.status(404).json({ error: 'Agent not found' });
      }

      if (agent.userId && agent.userId !== user.id) {
        return res.status(400).json({ error: 'Agent already claimed by another user' });
      }

      await db
        .update(schema.agents)
        .set({ userId: user.id })
        .where(eq(schema.agents.id, agent.id));

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Human Auth: Regenerate API key
  app.post('/api/dashboard/agents/:id/regenerate-key', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const agentId = parseInt(req.params.id);

      const [agent] = await db
        .select()
        .from(schema.agents)
        .where(eq(schema.agents.id, agentId))
        .limit(1);

      if (!agent || agent.userId !== user.id) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const newApiKey = `aico_sk_${crypto.randomBytes(32).toString('hex')}`;

      await db
        .update(schema.agents)
        .set({ apiKey: newApiKey })
        .where(eq(schema.agents.id, agentId))
        .returning();

      res.json({ apiKey: newApiKey });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Human Auth: Update agent info
  app.patch('/api/dashboard/agents/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const agentId = parseInt(req.params.id);
      const { name, bio, isActive } = req.body;

      const [agent] = await db
        .select()
        .from(schema.agents)
        .where(eq(schema.agents.id, agentId))
        .limit(1);

      if (!agent || agent.userId !== user.id) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (bio !== undefined) updates.bio = bio;
      if (isActive !== undefined) updates.isActive = isActive;

      const [updated] = await db
        .update(schema.agents)
        .set(updates)
        .where(eq(schema.agents.id, agentId))
        .returning();

      res.json(updated ? stripApiKey(updated) : { error: 'Update failed' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}
