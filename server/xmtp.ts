import * as crypto from 'crypto';
import { db } from './db';
import * as schema from '../shared/schema';
import { eq, and, or } from 'drizzle-orm';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { Client } from '@xmtp/node-sdk';

// Global flag tracking whether the XMTP network seems reachable.  When a call
// to the network fails we flip this to false and schedule a retry attempt a
// little while later.  Other code should inspect this flag before trying to
// make network requests.
export let xmtpAvailable = true;

// Simple in‑memory cache of clients keyed by agent id; the clients are cheap to
// recreate but caching avoids repeating the decryption/instantiate work on
// every message send.
const clients: Map<number, any> = new Map();

// Derive the symmetric encryption key from the session secret.  If the
// environment variable is missing we still derive a key (scrypt with empty
// salt) but warn so the developer knows something is wrong.
const SESSION_SECRET = process.env.SESSION_SECRET || '';
if (!SESSION_SECRET) {
  console.warn('[XMTP] SESSION_SECRET is empty, wallet keys will be encrypted with a weak key');
}
const ENCRYPTION_KEY = crypto.scryptSync(SESSION_SECRET, 'xmtp', 32);

function encryptPrivateKey(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return JSON.stringify({
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    encrypted: encrypted.toString('hex'),
  });
}

function decryptPrivateKey(blob: string): string {
  const { iv, authTag, encrypted } = JSON.parse(blob);
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    ENCRYPTION_KEY,
    Buffer.from(iv, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

async function ensureWalletPrivateKey(agentId: number): Promise<string> {
  const [agent] = await db
    .select()
    .from(schema.agents)
    .where(eq(schema.agents.id, agentId))
    .limit(1);
  if (!agent) {
    throw new Error('Agent not found');
  }

  if (agent.walletPrivateKey) {
    return decryptPrivateKey(agent.walletPrivateKey);
  }

  // no wallet yet, generate one and persist encrypted
  const pk = generatePrivateKey();
  const encrypted = encryptPrivateKey(pk);
  await db
    .update(schema.agents)
    .set({ walletPrivateKey: encrypted })
    .where(eq(schema.agents.id, agentId));
  return pk;
}

async function getClientForAgent(agentId: number): Promise<any> {
  if (clients.has(agentId)) {
    return clients.get(agentId);
  }

  // if we know network is unavailable just throw; callers can catch and
  // decide what to do (fall back to DB storage, etc.)
  if (!xmtpAvailable) {
    throw new Error('XMTP network currently unavailable');
  }

  try {
    const pk = await ensureWalletPrivateKey(agentId);
    // cast to satisfy the literal type requirement
    const account = privateKeyToAccount(pk as `0x${string}`);
    const client = await Client.create(account as any, { env: 'production' });
    clients.set(agentId, client);
    return client;
  } catch (err: any) {
    console.error('[XMTP] failed to create client for agent', agentId, err);
    markUnavailable();
    throw err;
  }
}

function markUnavailable() {
  if (!xmtpAvailable) return;
  xmtpAvailable = false;
  console.warn('[XMTP] network appears unavailable, will retry in 60s');
  setTimeout(() => {
    // simply reset the flag; the next call to getClientForAgent will attempt
    // a real connection again and flip the flag if it fails.
    xmtpAvailable = true;
  }, 60 * 1000);
}

interface SendResult {
  messageId: string | null;
  error?: any;
}

// send a direct message from one agent to another; content is a plain string.
// the function will always write a row to the `messages` table; if the XMTP
// network call succeeds the row will be updated with the `xmtpMessageId`.
// If the network is unreachable or the recipient cannot be reached we simply
// leave `xmtpMessageId` null so callers can still read the conversation later
// from the database.
export async function sendMessage(
  senderId: number,
  receiverUsername: string,
  content: string
): Promise<SendResult> {
  // look up the recipient and ensure they have a wallet as well
  const [receiver] = await db
    .select()
    .from(schema.agents)
    .where(eq(schema.agents.username, receiverUsername))
    .limit(1);
  if (!receiver) {
    return { messageId: null, error: new Error('recipient not found') };
  }

  // persist the message first; we'll update with XMTP id if the network call
  // succeeds.
  const [dbMessage] = await db
    .insert(schema.messages)
    .values({
      senderId,
      receiverId: receiver.id,
      content,
    })
    .returning();

  let xmtpMsgId: string | null = null;

  try {
    // ensure receiver also has a wallet so XMTP can deliver to them
    await ensureWalletPrivateKey(receiver.id);
    const client = await getClientForAgent(senderId);
    // derive the receiver address from their private key so we can open a DM
    const receiverPk = await ensureWalletPrivateKey(receiver.id);
    const receiverAccount = privateKeyToAccount(receiverPk as `0x${string}`);
    const conversation = await client.conversations.findOrCreateDm({
      address: receiverAccount.address,
    });
    const sent = await conversation.send(content);
    xmtpMsgId = sent?.id;

    if (xmtpMsgId) {
      await db
        .update(schema.messages)
        .set({ xmtpMessageId: xmtpMsgId })
        .where(eq(schema.messages.id, dbMessage.id));
    }
  } catch (err: any) {
    // mark network unavailable so we don't hammer it repeatedly
    markUnavailable();
    console.error('[XMTP] sendMessage error, falling back to DB only', err);
    return { messageId: null, error: err };
  }

  return { messageId: xmtpMsgId };
}

// helper to fetch conversation history stored in our database (networked or
// fallback entries)
export async function getConversation(
  agentA: number,
  agentB: number
): Promise<schema.Message[]> {
  return await db
    .select()
    .from(schema.messages)
    .where(
      // either direction
      or(
        and(eq(schema.messages.senderId, agentA), eq(schema.messages.receiverId, agentB)),
        and(eq(schema.messages.senderId, agentB), eq(schema.messages.receiverId, agentA))
      )
    )
    .orderBy(schema.messages.createdAt);
}
