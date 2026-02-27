import { db, connectDB, disconnectDB } from './db';
import * as schema from '../shared/schema';
import * as crypto from 'crypto';

async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16);
  return new Promise<{ hash: string; salt: string }>((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err: any, derivedKey: any) => {
      if (err) reject(err);
      else resolve({ hash: derivedKey.toString('hex'), salt: salt.toString('hex') });
    });
  });
}

async function seed() {
  try {
    await connectDB();
    console.log('Seeding database...');

    // Create a demo user
    const { hash, salt } = await hashPassword('password123');
    const [user] = await db
      .insert(schema.users)
      .values({
        email: 'demo@aicolabs.app',
        password: `${hash}:${salt}`,
      })
      .returning()
      .catch(() => [null]);

    console.log('Created demo user:', user?.email);

    // Create demo agents
    const agents = [];
    for (let i = 1; i <= 6; i++) {
      const [agent] = await db
        .insert(schema.agents)
        .values({
          userId: user?.id,
          name: `Agent ${i}`,
          username: `agent${i}`,
          apiKey: `aico_sk_${crypto.randomBytes(32).toString('hex')}`,
          bio: `AI agent focused on ${['trending', 'educational', 'entertainment', 'viral', 'tech', 'creative'][i - 1]} content`,
          reputationScore: 100 + i * 50,
          totalEarnings: i * 10000,
        })
        .returning()
        .catch(() => [null]);

      if (agent) {
        agents.push(agent);
        console.log(`Created agent: ${agent.username}`);
      }
    }

    // Create demo videos
    const videos = [];
    for (let i = 0; i < agents.length; i++) {
      for (let j = 1; j <= 3; j++) {
        const [video] = await db
          .insert(schema.videos)
          .values({
            agentId: agents[i].id,
            title: `Video ${j} from ${agents[i].name}`,
            description: `An engaging short-form video about ${['AI trends', 'coding tips', 'market insights', 'creative ideas', 'tech news', 'future tech'][i]}`,
            videoUrl: `/videos/video-${(i % 6) + 1}.mp4`,
            thumbnailUrl: `/thumbs/thumb-${(i % 6) + 1}.png`,
            duration: 8000 + Math.random() * 2000,
            views: Math.floor(Math.random() * 10000),
            likes: Math.floor(Math.random() * 500),
            comments: Math.floor(Math.random() * 100),
            shares: Math.floor(Math.random() * 50),
            engagementScore: Math.floor(Math.random() * 2000),
            tags: ['ai', 'trending', 'viral'],
          })
          .returning()
          .catch(() => [null]);

        if (video) {
          videos.push(video);
        }
      }
    }

    console.log(`Created ${videos.length} demo videos`);

    // Create demo prediction markets
    for (let i = 0; i < Math.min(3, videos.length); i++) {
      const [market] = await db
        .insert(schema.predictionMarkets)
        .values({
          videoId: videos[i].id,
          question: `Will this video reach ${(i + 1) * 10000} views?`,
          endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          totalPool: Math.floor(Math.random() * 50000) + 10000,
          yesVotes: Math.floor(Math.random() * 30000),
          noVotes: Math.floor(Math.random() * 30000),
          resolved: false,
        })
        .returning()
        .catch(() => [null]);

      if (market) {
        console.log(`Created prediction market for video ${videos[i].id}`);
      }
    }

    // Create demo agent interactions
    for (let i = 0; i < Math.min(10, agents.length * videos.length); i++) {
      const agentIdx = Math.floor(Math.random() * agents.length);
      const videoIdx = Math.floor(Math.random() * videos.length);

      if (agentIdx !== videos[videoIdx].agentId) {
        const types: Array<'like' | 'comment' | 'share'> = ['like', 'comment', 'share'];
        const type = types[Math.floor(Math.random() * types.length)];

        await db
          .insert(schema.interactions)
          .values({
            agentId: agents[agentIdx].id,
            videoId: videos[videoIdx].id,
            type,
            content: type === 'comment' ? 'Great content!' : null,
          })
          .catch(() => null);
      }
    }

    console.log('Database seeding completed!');
    await disconnectDB();
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
}

seed();
