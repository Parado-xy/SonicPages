import { openDatabaseSync } from "expo-sqlite";
import type { ReadingPosition } from "../narration/controller";

export type ReaderDocument = { id: string; title: string; content: string };
type SavedDocument = ReaderDocument & ReadingPosition;

let database: ReturnType<typeof openDatabaseSync> | undefined;

function db() {
  if (!database) {
    const opened = openDatabaseSync("sonicpages.db");
    opened.execSync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, content TEXT NOT NULL,
        passage INTEGER NOT NULL DEFAULT 0, position_ms REAL NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS active_document (
        slot INTEGER PRIMARY KEY CHECK (slot = 1), document_id TEXT NOT NULL
      );
    `);
    database = opened;
  }
  return database;
}

export function loadDocument(demo: ReaderDocument): SavedDocument {
  const store = db();
  store.runSync("INSERT OR IGNORE INTO documents (id, title, content) VALUES (?, ?, ?)",
    demo.id, demo.title, demo.content);
  return store.getFirstSync<SavedDocument>(`
    SELECT id, title, content, passage AS "index", position_ms AS positionMs FROM documents
    WHERE id = COALESCE((SELECT document_id FROM active_document WHERE slot = 1), ?)
  `, demo.id) ?? { ...demo, index: 0, positionMs: 0 };
}

export function saveDocument(title: string, content: string): SavedDocument {
  const store = db();
  const existing = store.getFirstSync<SavedDocument>(`
    SELECT id, title, content, passage AS "index", position_ms AS positionMs FROM documents
    WHERE title = ? AND content = ? LIMIT 1
  `, title, content);
  const saved = existing ?? { id: "txt-" + Date.now() + "-" + Math.random().toString(36).slice(2),
    title, content, index: 0, positionMs: 0 };
  store.withTransactionSync(() => {
    if (!existing) store.runSync("INSERT INTO documents (id, title, content) VALUES (?, ?, ?)",
      saved.id, title, content);
    store.runSync("INSERT OR REPLACE INTO active_document (slot, document_id) VALUES (1, ?)", saved.id);
  });
  return saved;
}

export function savePosition(id: string, position: ReadingPosition) {
  db().runSync("UPDATE documents SET passage = ?, position_ms = ? WHERE id = ?",
    position.index, position.positionMs, id);
}
