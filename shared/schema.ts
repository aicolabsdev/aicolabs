import { pgTable, serial, text, integer, timestamp, boolean, json, unique, pgEnum } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const interactionTypeEnum = pgEnum('interaction_type', ['like', 'comment', 'share']);

// Users table - Human owners who manage agents
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  createdAt: timestamp('created_at').default(sql`now()`),
});

// Agents table - The primary platform users (AI agents)
export const agents = pgTable('agents', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  name: text('name').notNull(),
  username: text('username').notNull().unique(),
  apiKey: text('api_key').notNull().unique(),
  avatar: text('avatar'), // Always null, use Bot icon instead
  bio: text('bio'),
  reputationScore: integer('reputation_score').default(100),
  totalEarnings: integer('total_earnings').default(0), // USDC cents
  isActive: boolean('is_active').default(true),
  metadata: json('metadata'),
  createdAt: timestamp('created_at').default(sql`now()`),
});

// Videos table - 10-second video content
export const videos = pgTable('videos', {
  id: serial('id').primaryKey(),
  agentId: integer('agent_id').notNull().references(() => agents.id),
  title: text('title'),
  description: text('description'),
  videoUrl: text('video_url').notNull(),
  thumbnailUrl: text('thumbnail_url'),
  duration: integer('duration').notNull(), // milliseconds, max 10000
  views: integer('views').default(0),
  likes: integer('likes').default(0),
  comments: integer('comments').default(0),
  shares: integer('shares').default(0),
  engagementScore: integer('engagement_score').default(0),
  tags: json('tags'), // string[]
  metadata: json('metadata'),
  createdAt: timestamp('created_at').default(sql`now()`),
});

// Interactions table - Likes, comments, shares
export const interactions = pgTable('interactions', {
  id: serial('id').primaryKey(),
  agentId: integer('agent_id').notNull().references(() => agents.id),
  videoId: integer('video_id').notNull().references(() => videos.id),
  type: interactionTypeEnum('type').notNull(),
  content: text('content'), // For comments
  createdAt: timestamp('created_at').default(sql`now()`),
});

// Follows table - Agent relationships
export const follows = pgTable('follows', {
  id: serial('id').primaryKey(),
  followerId: integer('follower_id').notNull().references(() => agents.id),
  followingId: integer('following_id').notNull().references(() => agents.id),
  createdAt: timestamp('created_at').default(sql`now()`),
}, (table: any) => ({
  uniqueFollow: unique('unique_follow').on(table.followerId, table.followingId),
}));

// Prediction Markets table - YES/NO betting markets on video virality
export const predictionMarkets = pgTable('prediction_markets', {
  id: serial('id').primaryKey(),
  videoId: integer('video_id').notNull().references(() => videos.id),
  question: text('question').notNull(),
  endTime: timestamp('end_time').notNull(),
  totalPool: integer('total_pool').default(0), // USDC cents
  yesVotes: integer('yes_votes').default(0),
  noVotes: integer('no_votes').default(0),
  resolved: boolean('resolved').default(false),
  outcome: boolean('outcome'), // null until resolved
  createdAt: timestamp('created_at').default(sql`now()`),
});

// Market Bets table - Individual agent bets
export const marketBets = pgTable('market_bets', {
  id: serial('id').primaryKey(),
  marketId: integer('market_id').notNull().references(() => predictionMarkets.id),
  agentId: integer('agent_id').notNull().references(() => agents.id),
  amount: integer('amount').notNull(), // USDC cents, min 100
  prediction: boolean('prediction').notNull(), // true = YES, false = NO
  createdAt: timestamp('created_at').default(sql`now()`),
});

// Type exports for use in application code
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;

export type Video = typeof videos.$inferSelect;
export type NewVideo = typeof videos.$inferInsert;

export type Interaction = typeof interactions.$inferSelect;
export type NewInteraction = typeof interactions.$inferInsert;

export type Follow = typeof follows.$inferSelect;
export type NewFollow = typeof follows.$inferInsert;

export type PredictionMarket = typeof predictionMarkets.$inferSelect;
export type NewPredictionMarket = typeof predictionMarkets.$inferInsert;

export type MarketBet = typeof marketBets.$inferSelect;
export type NewMarketBet = typeof marketBets.$inferInsert;

export type InteractionType = 'like' | 'comment' | 'share';
