import { displayTitle } from "../imports/documentTitle";
import type { File } from "expo-file-system";
import { keepOriginal, originalFile } from "./originalFiles";
import { openDatabaseSync } from "expo-sqlite";
import type { ReadingPosition } from "../narration/controller";

export type ReaderDocument = { id: string; title: string; content: string };
export type SavedDocument = ReaderDocument & ReadingPosition & { pageStarts?: number[]; sourceName?: string; author?: string };

export type LibraryEntry = Pick<SavedDocument, "id" | "title" | "index"> & { format: string; sourceName?: string; progress?: number };

type DocumentRow = SavedDocument & { sourceName: string; automaticTitle: string | null; overrideTitle: string | null; pageJson: string | null };
function hydrate(row: DocumentRow): SavedDocument {
  return { ...row, title: row.overrideTitle ?? displayTitle(row.sourceName, row.automaticTitle),
    author: preference("author:" + row.id),
    pageStarts: row.pageJson ? JSON.parse(row.pageJson) : undefined };
}

const documentProjection = `documents.id, COALESCE(document_titles.title, documents.title) AS title,
  documents.title AS sourceName, document_titles.title AS overrideTitle,
  document_metadata.title AS automaticTitle, document_metadata.pages AS pageJson,
  content, passage AS "index", position_ms AS positionMs`;
const documentTables = "documents LEFT JOIN document_titles ON document_titles.document_id = documents.id LEFT JOIN document_metadata ON document_metadata.document_id = documents.id";

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
      CREATE TABLE IF NOT EXISTS document_metadata (
        document_id TEXT PRIMARY KEY, title TEXT, pages TEXT
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
  const row = store.getFirstSync<DocumentRow>(`
    SELECT ${documentProjection} FROM ${documentTables}
    ORDER BY CASE WHEN documents.id = (SELECT document_id FROM active_document WHERE slot = 1) THEN 0 ELSE 1 END, documents.id LIMIT 1
  `);
  return row ? hydrate(row) : { ...demo, index: 0, positionMs: 0 };
}

export function saveDocument(title: string, content: string, source: File, metadata?: { title?: string | null; author?: string | null; pageStarts?: number[] }): SavedDocument {
  const store = db();
  const matches = store.getAllSync<DocumentRow>(`
    SELECT ${documentProjection} FROM ${documentTables}
    WHERE documents.title = ? AND content = ? ORDER BY documents.id
  `, title, content);
  const hash = source.md5;
  const existing = matches.find(document => {
    const original = originalFile(document.id);
    return hash !== null && original.md5 === hash;
  }) ?? matches.find(document => !originalFile(document.id).exists);
  const saved = existing ? hydrate(existing) : { id: "txt-" + Date.now() + "-" + Math.random().toString(36).slice(2),
    title, content, index: 0, positionMs: 0 };
  keepOriginal(saved.id, source);
  try {
    store.withTransactionSync(() => {
      if (!existing) store.runSync("INSERT INTO documents (id, title, content) VALUES (?, ?, ?)",
        saved.id, title, content);
      if (metadata) saveMetadata(saved.id, metadata.title, metadata.pageStarts, metadata.author);
      setActiveDocument(saved.id);
    });
  } catch (error) {
    if (!existing) originalFile(saved.id).delete();
    throw error;
  }
  return { ...saved, author: metadata?.author?.trim() || (existing && preference("author:" + saved.id)), sourceName: title, title: existing?.overrideTitle ?? displayTitle(title, metadata?.title), pageStarts: metadata?.pageStarts ?? saved.pageStarts };
}

export function savePosition(id: string, position: ReadingPosition) {
  db().runSync("UPDATE documents SET passage = ?, position_ms = ? WHERE id = ?",
    position.index, position.positionMs, id);
}


export function listDocuments(): LibraryEntry[] {
  return db().getAllSync<LibraryEntry & Pick<DocumentRow, "sourceName" | "automaticTitle" | "overrideTitle">>(`
    SELECT documents.id, COALESCE(document_titles.title, documents.title) AS title, passage AS "index", documents.title AS sourceName, document_metadata.title AS automaticTitle,
      document_titles.title AS overrideTitle,
      CAST((SELECT value FROM reader_preferences WHERE key = 'percent:' || documents.id) AS INTEGER) AS progress,
      CASE WHEN lower(documents.title) LIKE '%.pdf' THEN 'PDF'
           WHEN lower(documents.title) LIKE '%.epub' THEN 'EPUB' ELSE 'TXT' END AS format
    FROM ${documentTables}
    ORDER BY title COLLATE NOCASE, documents.id
  `).map(row => ({ ...row, title: row.overrideTitle ?? displayTitle(row.sourceName, row.automaticTitle) }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

function setActiveDocument(id: string) {
  db().runSync("INSERT OR REPLACE INTO active_document (slot, document_id) VALUES (1, ?)", id);
}

export function openDocument(id: string): SavedDocument {
  const document = db().getFirstSync<DocumentRow>(`
    SELECT ${documentProjection} FROM ${documentTables} WHERE documents.id = ?
  `, id);
  if (!document) throw new Error("This document is missing from your library.");
  setActiveDocument(id);
  return hydrate(document);
}

export function renameDocument(id: string, title: string) {
  const name = title.trim();
  if (!name) throw new Error("Enter a document title.");
  db().runSync(`INSERT INTO document_titles (document_id, title) VALUES (?, ?)
    ON CONFLICT(document_id) DO UPDATE SET title = excluded.title`, id, name);
}


export function getExportDocument(id: string) {
  const document = db().getFirstSync<DocumentRow>(
    `SELECT ${documentProjection} FROM ${documentTables} WHERE documents.id = ?`, id);
  if (!document) throw new Error("This document is missing from your library.");
  return { ...hydrate(document), title: document.sourceName };
}

export function preference(key: string) {
  return db().getFirstSync<{ value: string }>("SELECT value FROM reader_preferences WHERE key = ?", key)?.value;
}

export function savePreference(key: string, value: string) {
  db().runSync("INSERT OR REPLACE INTO reader_preferences (key, value) VALUES (?, ?)", key, value);
}


export function saveMetadata(id: string, title?: string | null, pages?: number[], author?: string | null) {
  if (author?.trim()) savePreference("author:" + id, author.trim());
  db().runSync(`INSERT INTO document_metadata (document_id, title, pages) VALUES (?, ?, ?)
    ON CONFLICT(document_id) DO UPDATE SET title = COALESCE(excluded.title, document_metadata.title),
    pages = COALESCE(excluded.pages, document_metadata.pages)`,
    id, title ?? null, pages ? JSON.stringify(pages) : null);
}

export function deleteDocument(id: string) {
  const store = db();
  store.withTransactionSync(() => {
    store.runSync("DELETE FROM active_document WHERE document_id = ?", id);
    store.runSync("DELETE FROM document_titles WHERE document_id = ?", id);
    store.runSync("DELETE FROM document_metadata WHERE document_id = ?", id);
    store.runSync("DELETE FROM documents WHERE id = ?", id);
    store.runSync("DELETE FROM reader_preferences WHERE key IN (?, ?, ?, ?)", "author:" + id, "bookmark:" + id, "pdfPage:" + id, "percent:" + id);
  });
}
