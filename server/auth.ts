import { Express, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import session from 'express-session';
import ConnectPgSimple from 'connect-pg-simple';
import { db, pool } from './db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import * as crypto from 'crypto';

// Scrypt password hashing (built-in Node.js crypto)
async function hashPassword(password: string, salt?: Buffer): Promise<{ hash: string; salt: string }> {
  salt = salt || crypto.randomBytes(16);
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err: any, derivedKey: any) => {
      if (err) reject(err);
      else resolve({ hash: derivedKey.toString('hex'), salt: salt!.toString('hex') });
    });
  });
}

async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  try {
    const { hash: newHash } = await hashPassword(password, Buffer.from(salt, 'hex'));
    return newHash === hash;
  } catch {
    return false;
  }
}

// Passport Local Strategy
passport.use(
  new LocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password',
      passReqToCallback: true,
    },
    async (_req: any, email: any, password: any, done: any) => {
      try {
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email.toLowerCase()))
          .limit(1);

        if (!user) {
          return done(null, false, { message: 'Invalid email or password' });
        }

        const [hash, salt] = user.password.split(':');
        const isValid = await verifyPassword(password, hash, salt);

        if (!isValid) {
          return done(null, false, { message: 'Invalid email or password' });
        }

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

passport.serializeUser((user: any, done: any) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: number, done: any) => {
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    done(null, user || null);
  } catch (err) {
    done(err);
  }
});

export function setupAuth(app: Express) {
  const PgSession = ConnectPgSimple(session);

  app.use(
    session({
      store: new PgSession({
        pool,
        tableName: 'session',
      }),
      secret: process.env.SESSION_SECRET || 'your-secret-key',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  // Auth Routes
  app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
      }

      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);

      if (existingUser.length > 0) {
        return res.status(400).json({ error: 'Email already registered' });
      }

      const { hash, salt } = await hashPassword(password);
      const hashedPassword = `${hash}:${salt}`;

      const [newUser] = await db
        .insert(users)
        .values({
          email: email.toLowerCase(),
          password: hashedPassword,
        })
        .returning();

      req.login(newUser, (err: any) => {
        if (err) return res.status(500).json({ error: 'Login failed' });
        res.json({ user: { id: newUser.id, email: newUser.email } });
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/auth/login', passport.authenticate('local'), (req: Request, res: Response) => {
    const user = req.user as any;
    res.json({ user: { id: user.id, email: user.email } });
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    req.logout((err: any) => {
      if (err) return res.status(500).json({ error: 'Logout failed' });
      res.json({ success: true });
    });
  });

  app.get('/api/auth/me', (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const user = req.user as any;
    res.json({ user: { id: user.id, email: user.email } });
  });
}

// Middleware to check if user is authenticated
export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated?.()) {
    return next();
  }
  res.status(401).json({ error: 'Not authenticated' });
}
