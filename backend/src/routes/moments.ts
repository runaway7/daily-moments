import { Router, Response } from 'express';
import { v4 as uuid } from 'uuid';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { getDatabase, persistDb } from '../db/database';
import { authMiddleware, type AuthRequest } from '../middleware/auth';

const router = Router();
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, uuid() + ext);
  },
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// Helper to query one row
function qOne(db: any, sql: string, params: any[]): any {
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

// Helper to query all rows
function qAll(db: any, sql: string, params: any[]): any[] {
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

// POST /api/moments
router.post('/', authMiddleware, upload.single('photo'), async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDatabase();
    const id = uuid();
    const now = Date.now();
    const photoUri = req.file ? `/uploads/${req.file.filename}` : '';
    const caption = req.body.caption || '';
    const emotion = req.body.emotion || null;

    db.run(
      'INSERT INTO moments (id, user_id, photo_uri, caption, emotion, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, req.user!.userId, photoUri, caption, emotion, now, now],
    );
    persistDb();

    res.status(201).json({ id, photoUri, caption, emotion, createdAt: now, updatedAt: now });
  } catch (err) {
    console.error('Create moment error:', err);
    res.status(500).json({ error: '创建失败' });
  }
});

// GET /api/moments
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDatabase();
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const rows = qAll(db,
      'SELECT id, photo_uri, caption, emotion, created_at, updated_at FROM moments WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [req.user!.userId, limit, offset],
    );

    const moments = rows.map((r: any) => ({
      id: r.id,
      photoUri: r.photo_uri,
      caption: r.caption,
      emotion: r.emotion,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    res.json({ moments });
  } catch (err) {
    console.error('List moments error:', err);
    res.status(500).json({ error: '获取失败' });
  }
});

// GET /api/moments/:id
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDatabase();
    const row = qOne(db,
      'SELECT id, photo_uri, caption, emotion, created_at, updated_at FROM moments WHERE id = ? AND user_id = ?',
      [req.params.id, req.user!.userId],
    );
    if (!row) { res.status(404).json({ error: '未找到' }); return; }
    res.json({ id: row.id, photoUri: row.photo_uri, caption: row.caption, emotion: row.emotion, createdAt: row.created_at, updatedAt: row.updated_at });
  } catch (err) {
    res.status(500).json({ error: '获取失败' });
  }
});

// PATCH /api/moments/:id
router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDatabase();
    const { caption, emotion } = req.body;
    const now = Date.now();

    if (caption !== undefined) {
      db.run('UPDATE moments SET caption = ?, updated_at = ? WHERE id = ? AND user_id = ?', [caption, now, req.params.id, req.user!.userId]);
    }
    if (emotion !== undefined) {
      db.run('UPDATE moments SET emotion = ?, updated_at = ? WHERE id = ? AND user_id = ?', [emotion, now, req.params.id, req.user!.userId]);
    }
    persistDb();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '更新失败' });
  }
});

// DELETE /api/moments/:id
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDatabase();
    const moment = qOne(db, 'SELECT photo_uri FROM moments WHERE id = ? AND user_id = ?', [req.params.id, req.user!.userId]);
    if (moment?.photo_uri) {
      const filePath = path.join(process.cwd(), moment.photo_uri);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    db.run('DELETE FROM append_notes WHERE moment_id = ?', [req.params.id]);
    db.run('DELETE FROM moments WHERE id = ? AND user_id = ?', [req.params.id, req.user!.userId]);
    persistDb();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '删除失败' });
  }
});

// POST /api/moments/:id/notes
router.post('/:id/notes', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDatabase();
    const id = uuid();
    const now = Date.now();
    const { text } = req.body;
    db.run('INSERT INTO append_notes (id, moment_id, text, created_at) VALUES (?, ?, ?, ?)', [id, req.params.id, text, now]);
    persistDb();
    res.status(201).json({ id, momentId: req.params.id, text, createdAt: now });
  } catch (err) {
    res.status(500).json({ error: '添加失败' });
  }
});

// GET /api/moments/:id/notes
router.get('/:id/notes', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const db = await getDatabase();
    const rows = qAll(db, 'SELECT id, moment_id, text, created_at FROM append_notes WHERE moment_id = ? ORDER BY created_at ASC', [req.params.id]);
    res.json({ notes: rows.map((r: any) => ({ id: r.id, momentId: r.moment_id, text: r.text, createdAt: r.created_at })) });
  } catch (err) {
    res.status(500).json({ error: '获取失败' });
  }
});

export default router;
