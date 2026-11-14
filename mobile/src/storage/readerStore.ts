import type { File } from "expo-file-system";
import { keepOriginal, originalFile } from "./originalFiles";
import { openDatabaseSync } from "expo-sqlite";
import type { ReadingPosition } from "../narration/controller";

export type ReaderDocument = { id: string; title: string; content: string };
export type SavedDocument = ReaderDocument & ReadingPosition;

export type LibraryEntry = Pick<SavedDocument, "id" | "title" | "index"> & { format: string };

const documentProjection = `documents.id, COALESCE(document_titles.title, documents.title) AS title,
  content, passage AS "index", position_ms AS positionMs`;
const documentTables = "documents LEFT JOIN document_titles ON document_titles.document_id = documents.id";

let database: ReturnType<typeof openDatabaseSync> | undefined;

function db() {
  if (!database) {
    const opened = openDatabaseSync("sonicpages.db");
    opened.execSync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS reader_preferences (
        key TEXT PRIMARY KEY, value TEXT NOT NULL
      );
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

export function saveDocument(title: string, content: string, source: File): SavedDocument {
  const store = db();
  const matches = store.getAllSync<SavedDocument>(`
    SELECT ${documentProjection} FROM ${documentTables}
    WHERE documents.title = ? AND content = ? ORDER BY documents.id
  `, title, content);
  const hash = source.md5;
  const existing = matches.find(document => {
    const original = originalFile(document.id);
    return hash !== null && original.md5 === hash;
  }) ?? matches.find(document => !originalFile(document.id).exists);
  const saved = existing ?? { id: "txt-" + Date.now() + "-" + Math.random().toString(36).slice(2),
    title, content, index: 0, positionMs: 0 };
  keepOriginal(saved.id, source);
  try {
    store.withTransactionSync(() => {
      if (!existing) store.runSync("INSERT INTO documents (id, title, content) VALUES (?, ?, ?)",
        saved.id, title, content);
      setActiveDocument(saved.id);
    });
  } catch (error) {
    if (!existing) originalFile(saved.id).delete();
    throw error;
  }
  return saved;
}

export function savePosition(id: string, position: ReadingPosition) {
  db().runSync("UPDATE documents SET passage = ?, position_ms = ? WHERE id = ?",
    position.index, position.positionMs, id);
}


export function listDocuments(): LibraryEntry[] {
  return db().getAllSync<LibraryEntry>(`
    SELECT documents.id, COALESCE(document_titles.title, documents.title) AS title, passage AS "index",
      CASE WHEN lower(documents.title) LIKE '%.pdf' THEN 'PDF'
           WHEN lower(documents.title) LIKE '%.epub' THEN 'EPUB' ELSE 'TXT' END AS format
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


export function getExportDocument(id: string) {
  const document = db().getFirstSync<{ title: string; content: string }>(
    "SELECT title, content FROM documents WHERE id = ?", id);
  if (!document) throw new Error("This document is missing from your library.");
  return document;
}

export function preference(key: string) {
  return db().getFirstSync<{ value: string }>("SELECT value FROM reader_preferences WHERE key = ?", key)?.value;
}

export function savePreference(key: string, value: string) {
  db().runSync("INSERT OR REPLACE INTO reader_preferences (key, value) VALUES (?, ?)", key, value);
}
