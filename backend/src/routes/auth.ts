import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import { getDatabase, persistDb } from '../db/database';
import type { JwtPayload } from '../types';
import { authMiddleware, type AuthRequest } from '../middleware/auth';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'moments-app-secret-change-in-production';

function generateToken(userId: string, username: string): string {
  const payload: JwtPayload = { userId, username };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

function queryOne(db: any, sql: string, params: any[]): any {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const cols = stmt.getColumnNames();
    const vals = stmt.get();
    const obj: any = {};
    cols.forEach((c: string, i: number) => { obj[c] = vals[i]; });
    stmt.free();
    return obj;
  }
  stmt.free();
  return undefined;
}

function queryAll(db: any, sql: string, params: any[]): any[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const cols = stmt.getColumnNames();
  const rows: any[] = [];
  while (stmt.step()) {
    const vals = stmt.get();
    const obj: any = {};
    cols.forEach((c: string, i: number) => { obj[c] = vals[i]; });
    rows.push(obj);
  }
  stmt.free();
  return rows;
}

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: '用户名和密码不能为空' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: '密码至少需要6位' });
      return;
    }

    const db = await getDatabase();
    const existing = queryOne(db, 'SELECT id FROM users WHERE username = ?', [username]);

    if (existing) {
      res.status(409).json({ error: '用户名已存在' });
      return;
    }

    const id = uuid();
    const passwordHash = bcrypt.hashSync(password, 10);

    db.run('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)', [id, username, passwordHash]);
    persistDb();

    const token = generateToken(id, username);

    res.status(201).json({
      token,
      user: { id, username },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: '注册失败，请重试' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: '用户名和密码不能为空' });
      return;
    }

    const db = await getDatabase();
    const user = queryOne(db, 'SELECT id, username, password_hash FROM users WHERE username = ?', [username]);

    if (!user) {
      res.status(401).json({ error: '用户名或密码错误' });
      return;
    }

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: '用户名或密码错误' });
      return;
    }

    const token = generateToken(user.id, user.username);

    res.json({
      token,
      user: { id: user.id, username: user.username },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: '登录失败，请重试' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDatabase();
    const user = queryOne(db, 'SELECT id, username, created_at FROM users WHERE id = ?', [req.user!.userId]);
    if (!user) {
      res.status(404).json({ error: '用户不存在' });
      return;
    }
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: '获取失败' });
  }
});

export default router;
