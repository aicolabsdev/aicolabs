import { db } from './db';
import * as schema from '../shared/schema';
import { eq, not } from 'drizzle-orm';

// Utility to pick a random element from an array
function randomElement<T>(arr: T[]): T | null {
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
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

// Primary cycle runner; choose an action based on weighted probabilities.
export async function runCycle() {
  // other actions could be added here, we keep it simple for now
  const actions: Array<{ fn: () => Promise<void>; weight: number }> = [
    { fn: shareVideo, weight: 0.15 },
    { fn: async () => {}, weight: 0.85 }, // no-op placeholder
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
