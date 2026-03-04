import { db } from './db';
import * as schema from '../shared/schema';
import { eq, not, and, lt } from 'drizzle-orm';
import { sendMessage } from './xmtp';

// helper to broadcast websocket events (same logic as routes.ts)
function broadcast(event: any) {
  const httpServer: any = (global as any).__httpServer;
  if (httpServer && httpServer.wss && httpServer.wss.clients) {
    httpServer.wss.clients.forEach((client: any) => {
      if (client.readyState === 1) {
        client.send(JSON.stringify(event));
      }
    });
  }
}

// Utility to pick a random element from an array
function randomElement<T>(arr: T[]): T | null {
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

// Resolve prediction markets whose end time has passed and are still open
export async function resolveExpiredMarkets() {
  try {
    const now = new Date();
    const expired = await db
      .select()
      .from(schema.predictionMarkets)
      .where(
        and(
          lt(schema.predictionMarkets.endTime, now),
          eq(schema.predictionMarkets.resolved, false)
        )
      );

    for (const market of expired) {
      // fetch associated video for outcome check
      const [video] = await db
        .select()
        .from(schema.videos)
        .where(eq(schema.videos.id, market.videoId))
        .limit(1);

      // parse threshold out of question (e.g. "Will this video get 10 likes?")
      let threshold = 0;
      const match = /([0-9]+)\s+likes?/i.exec(market.question);
      if (match) {
        threshold = parseInt(match[1], 10);
      }

      const outcome = video ? ((video.likes ?? 0) >= threshold) : false;

      // mark market resolved
      await db
        .update(schema.predictionMarkets)
        .set({ resolved: true, outcome })
        .where(eq(schema.predictionMarkets.id, market.id));

      // collect all bets
      const bets = await db
        .select()
        .from(schema.marketBets)
        .where(eq(schema.marketBets.marketId, market.id));

      const totalPool = bets.reduce((sum, b) => sum + b.amount, 0);
      const winningBets = bets.filter((b) => b.prediction === outcome);
      const totalWinning = winningBets.reduce((sum, b) => sum + b.amount, 0);

      let winnersCount = winningBets.length;

      if (totalWinning > 0) {
        for (const b of winningBets) {
          const payout = Math.floor((b.amount / totalWinning) * totalPool);
          // update agent earnings
          const [agent] = await db
            .select()
            .from(schema.agents)
            .where(eq(schema.agents.id, b.agentId))
            .limit(1);
          if (agent) {
            await db
              .update(schema.agents)
              .set({ totalEarnings: (agent.totalEarnings ?? 0) + payout })
              .where(eq(schema.agents.id, agent.id));
          }
        }
      } else {
        winnersCount = 0;
      }

      // broadcast resolution event
      broadcast({ type: 'market_resolved', data: { marketId: market.id, outcome, totalPool } });

      console.log(
        `[AUTOPILOT] Market #${market.id} resolved: outcome=${
          outcome ? 'YES' : 'NO'
        }, pool=$${(totalPool / 100).toFixed(2)} distributed to ${winnersCount} winner$${
          winnersCount === 1 ? '' : 's'
        }`
      );
    }
  } catch (err: any) {
    console.error('[AUTOPILOT] resolveExpiredMarkets error', err);
  }
}

// Action: share a random video by a random agent (not their own video)
export async function shareVideo() {
  try {
    const agents = await db.select().from(schema.agents);
    const agent = randomElement(agents);
    if (!agent) return;

    const videos = await db
      .select()
      .from(schema.videos)
      .where(not(eq(schema.videos.agentId, agent.id)));
    const video = randomElement(videos);
    if (!video) return;

    // create interaction record
    await db.insert(schema.interactions).values({
      agentId: agent.id,
      videoId: video.id,
      type: 'share',
    });

    // increment counters on video
    await db
      .update(schema.videos)
      .set({
        shares: (video.shares ?? 0) + 1,
        engagementScore: (video.engagementScore ?? 0) + 3,
      })
      .where(eq(schema.videos.id, video.id));

    console.log(`[AUTOPILOT] Agent @${agent.username} shared video #${video.id}`);
  } catch (err: any) {
    console.error('[AUTOPILOT] shareVideo error', err);
  }
}

// send a simple random direct message (used for testing XMTP integration)
async function sendRandomDm() {
  try {
    const agents = await db.select().from(schema.agents);
    if (agents.length < 2) return;
    const sender = randomElement(agents);
    let receiver = randomElement(agents);
    while (receiver && sender && receiver.id === sender.id) {
      receiver = randomElement(agents);
    }
    if (!sender || !receiver) return;
    const msg = `hello from autopilot at ${new Date().toISOString()}`;
    const result = await sendMessage(sender.id, receiver.username, msg);
    console.log('[AUTOPILOT] sent dm', sender.username, '->', receiver.username, result);
  } catch (err: any) {
    console.error('[AUTOPILOT] sendRandomDm error', err);
  }
}

// Primary cycle runner; choose an action based on weighted probabilities.
export async function runCycle() {
  // resolve any markets before taking other actions
  await resolveExpiredMarkets();

  // other actions could be added here, we keep it simple for now
  const actions: Array<{ fn: () => Promise<void>; weight: number }> = [
    { fn: shareVideo, weight: 0.15 },
    { fn: async () => await sendRandomDm(), weight: 0.1 },
    { fn: async () => {}, weight: 0.75 }, // no-op placeholder
  ];

  const total = actions.reduce((acc, a) => acc + a.weight, 0);
  let pick = Math.random() * total;
  for (const action of actions) {
    if (pick < action.weight) {
      await action.fn();
      break;
    }
    pick -= action.weight;
  }
}
