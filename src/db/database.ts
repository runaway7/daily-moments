import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;
let dbReady: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  if (dbReady) return dbReady;

  dbReady = (async () => {
    const newDb = await SQLite.openDatabaseAsync('moments.db');

    try {
      await newDb.execAsync(`
        CREATE TABLE IF NOT EXISTS moments (
          id TEXT PRIMARY KEY,
          photo_uri TEXT NOT NULL,
          caption TEXT DEFAULT '',
          emotion TEXT,
          emotion_reason TEXT DEFAULT '',
          is_favorite INTEGER DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS append_notes (
          id TEXT PRIMARY KEY,
          moment_id TEXT NOT NULL,
          text TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (moment_id) REFERENCES moments(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS tags (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE
        );

        CREATE TABLE IF NOT EXISTS moment_tags (
          moment_id TEXT NOT NULL,
          tag_id INTEGER NOT NULL,
          PRIMARY KEY (moment_id, tag_id),
          FOREIGN KEY (moment_id) REFERENCES moments(id) ON DELETE CASCADE,
          FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS streak_state (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          current_streak INTEGER DEFAULT 0,
          longest_streak INTEGER DEFAULT 0,
          freeze_cards INTEGER DEFAULT 0,
          last_active_date TEXT DEFAULT '',
          rekindle_deadline INTEGER DEFAULT 0,
          streak_before_break INTEGER DEFAULT 0,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS user_account (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          nickname TEXT DEFAULT '',
          password_hash TEXT DEFAULT '',
          security_question TEXT DEFAULT '',
          security_answer_hash TEXT DEFAULT '',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_moments_created_at ON moments(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_append_notes_moment ON append_notes(moment_id);
        CREATE INDEX IF NOT EXISTS idx_moment_tags_moment ON moment_tags(moment_id);
      `);

      // Migrate existing databases
      try { await newDb.execAsync('ALTER TABLE moments ADD COLUMN emotion_reason TEXT DEFAULT \'\''); } catch {}
      try { await newDb.execAsync('ALTER TABLE moments ADD COLUMN is_favorite INTEGER DEFAULT 0'); } catch {}

      // Init streak state if not exists
      const streakRow = await newDb.getFirstAsync<{ id: number }>('SELECT id FROM streak_state WHERE id = 1');
      if (!streakRow) {
        await newDb.runAsync(
          'INSERT INTO streak_state (id, current_streak, longest_streak, freeze_cards, last_active_date, rekindle_deadline, streak_before_break, updated_at) VALUES (1, 0, 0, 0, \'\', 0, 0, ?)',
          [Date.now()],
        );
      }

      db = newDb;
      return db;
    } catch (e) {
      console.error('[database] schema creation failed:', e);
      dbReady = null;
      throw e;
    }
  })();

  return dbReady;
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}
