import { openDatabaseSync } from "expo-sqlite";
import type { ReadingPosition } from "../narration/controller";

export type ReaderDocument = { id: string; title: string; content: string };
export type SavedDocument = ReaderDocument & ReadingPosition;

export type LibraryEntry = Pick<SavedDocument, "id" | "title" | "index">;

const documentProjection = `documents.id, COALESCE(document_titles.title, documents.title) AS title,
  content, passage AS "index", position_ms AS positionMs`;
const documentTables = "documents LEFT JOIN document_titles ON document_titles.document_id = documents.id";

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
      CREATE TABLE IF NOT EXISTS document_titles (
        document_id TEXT PRIMARY KEY, title TEXT NOT NULL
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
    SELECT ${documentProjection} FROM ${documentTables}
    WHERE id = COALESCE((SELECT document_id FROM active_document WHERE slot = 1), ?)
  `, demo.id) ?? { ...demo, index: 0, positionMs: 0 };
}

export function saveDocument(title: string, content: string): SavedDocument {
  const store = db();
  const existing = store.getFirstSync<SavedDocument>(`
    SELECT ${documentProjection} FROM ${documentTables}
    WHERE documents.title = ? AND content = ? LIMIT 1
  `, title, content);
  const saved = existing ?? { id: "txt-" + Date.now() + "-" + Math.random().toString(36).slice(2),
    title, content, index: 0, positionMs: 0 };
  store.withTransactionSync(() => {
    if (!existing) store.runSync("INSERT INTO documents (id, title, content) VALUES (?, ?, ?)",
      saved.id, title, content);
    setActiveDocument(saved.id);
  });
  return saved;
}

export function savePosition(id: string, position: ReadingPosition) {
  db().runSync("UPDATE documents SET passage = ?, position_ms = ? WHERE id = ?",
    position.index, position.positionMs, id);
}


export function listDocuments(): LibraryEntry[] {
  return db().getAllSync<LibraryEntry>(`
    SELECT documents.id, COALESCE(document_titles.title, documents.title) AS title, passage AS "index"
    FROM ${documentTables}
    ORDER BY title COLLATE NOCASE, documents.id
  `);
}

function setActiveDocument(id: string) {
  db().runSync("INSERT OR REPLACE INTO active_document (slot, document_id) VALUES (1, ?)", id);
}

export function openDocument(id: string): SavedDocument {
  const document = db().getFirstSync<SavedDocument>(`
    SELECT ${documentProjection} FROM ${documentTables} WHERE documents.id = ?
  `, id);
  if (!document) throw new Error("This document is missing from your library.");
  setActiveDocument(id);
  return document;
}

export function renameDocument(id: string, title: string) {
  const name = title.trim();
  if (!name) throw new Error("Enter a document title.");
  db().runSync(`INSERT INTO document_titles (document_id, title) VALUES (?, ?)
    ON CONFLICT(document_id) DO UPDATE SET title = excluded.title`, id, name);
}
