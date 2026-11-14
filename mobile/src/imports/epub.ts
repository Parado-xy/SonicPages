import { unzipSync, strFromU8 } from "fflate";
import { parseDocument } from "htmlparser2";
import type { AnyNode, Element } from "domhandler";

const MAX_EXPANDED_BYTES = 64 * 1024 * 1024;
const MAX_TEXT_LENGTH = 4_000_000;

function elements(nodes: AnyNode[], name: string): Element[] {
  const found: Element[] = [];
  const pending = [...nodes].reverse();
  while (pending.length) {
    const node = pending.pop()!;
    if (!("children" in node)) continue;
    if ("name" in node && node.name.split(":").at(-1) === name) found.push(node);
    for (let i = node.children.length - 1; i >= 0; i--) pending.push(node.children[i]);
  }
  return found;
}

function entryPath(base: string, href: string) {
  const path = decodeURIComponent(href.split(/[?#]/, 1)[0]);
  if (!path || /^(?:\/|[\w+.-]+:)|\\/.test(path)) throw new Error("EPUB contains an invalid local chapter path.");
  const parts = base.split("/").slice(0, -1);
  for (const part of path.split("/")) {
    if (part === "..") {
      if (!parts.length) throw new Error("EPUB chapter is outside the book.");
      parts.pop();
    } else if (part && part !== ".") parts.push(part);
  }
  return parts.join("/");
}

function chapterText(markup: string) {
  const doc = parseDocument(markup);
  const body = elements(doc.children, "body")[0];
  const blocks = /^(address|article|aside|blockquote|br|div|h[1-6]|li|p|pre|section|tr)$/;
  const out: string[] = [];
  const pending: (AnyNode | null)[] = [...(body?.children ?? doc.children)].reverse();
  while (pending.length) {
    const node = pending.pop();
    if (!node) { out.push("\n"); continue; }
    if (node.type === "text") out.push(node.data.replace(/\s+/g, " "));
    if (!("attribs" in node) || /^(script|style|head|nav|svg|rt)$/.test(node.name) ||
        node.attribs.hidden !== undefined || node.attribs["aria-hidden"] === "true") continue;
    if (blocks.test(node.name)) {
      out.push("\n");
      pending.push(null);
    }
    for (let i = node.children.length - 1; i >= 0; i--) pending.push(node.children[i]);
  }
  return out.join("").split("\n").map(line => line.trim().replace(/ +/g, " ")).filter(Boolean).join("\n\n");
}

export function extractEpubText(bytes: Uint8Array): string {
  let expanded = 0;
  const archive = unzipSync(bytes, { filter: entry => {
    if (!/\.(?:xml|opf|x?html?|htm)$/i.test(entry.name)) return false;
    expanded += entry.originalSize;
    if (expanded > MAX_EXPANDED_BYTES) throw new Error("This EPUB is too large to extract.");
    return true;
  } });
  const read = (path: string) => {
    if (!Object.hasOwn(archive, path)) throw new Error("The EPUB is missing a chapter or package file.");
    return strFromU8(archive[path]);
  };
  const xml = (path: string) => parseDocument(read(path), { xmlMode: true });
  const container = xml("META-INF/container.xml");
  const root = elements(container.children, "rootfile")[0]?.attribs["full-path"];
  if (!root) throw new Error("This EPUB has no package file.");
  const packagePath = entryPath("", root);
  const book = xml(packagePath);
  const manifest = new Map(elements(book.children, "item").map(item => [item.attribs.id, item.attribs]));
  const spine = elements(book.children, "spine")[0];
  if (!spine) throw new Error("This EPUB has no reading order.");
  const chapters: string[] = [];
  let length = 0;
  for (const ref of elements(spine.children, "itemref")) {
    if (ref.attribs.linear === "no") continue;
    const item = manifest.get(ref.attribs.idref);
    if (!item) throw new Error("The EPUB reading order references a missing chapter.");
    if (!/^(application\/xhtml\+xml|text\/html)$/.test(item["media-type"])) continue;
    const text = chapterText(read(entryPath(packagePath, item.href ?? "")));
    length += text.length + 2;
    if (length > MAX_TEXT_LENGTH) throw new Error("This EPUB contains too much text to import.");
    if (text) chapters.push(text);
  }
  if (!chapters.length) throw new Error("No readable text was found. This EPUB may be image-only or protected.");
  return chapters.join("\n\n");
}

export function extractEpubCover(bytes: Uint8Array) {
  const packageFiles = unzipSync(bytes, { filter: entry =>
    /^(META-INF\/container\.xml)$|\.opf$/i.test(entry.name) && entry.originalSize <= 1024 * 1024 });
  const container = packageFiles["META-INF/container.xml"];
  if (!container) return undefined;
  const xml = (data: Uint8Array) => parseDocument(strFromU8(data), { xmlMode: true });
  const path = elements(xml(container).children, "rootfile")[0]?.attribs["full-path"];
  if (!path) return undefined;
  const packagePath = entryPath("", path);
  const packageData = packageFiles[packagePath];
  if (!packageData) return undefined;
  const book = xml(packageData);
  const items = elements(book.children, "item");
  const legacy = elements(book.children, "meta").find(meta => meta.attribs.name === "cover")?.attribs.content;
  const item = items.find(candidate => candidate.attribs.properties?.split(/\s+/).includes("cover-image"))
    ?? (legacy ? items.find(candidate => candidate.attribs.id === legacy) : undefined);
  if (!item?.attribs.href) return undefined;
  const extension = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as Record<string, string>)[item.attribs["media-type"]];
  if (!extension) return undefined;
  const imagePath = entryPath(packagePath, item.attribs.href);
  const data = unzipSync(bytes, { filter: entry => entry.name === imagePath && entry.originalSize <= 4 * 1024 * 1024 })[imagePath];
  return data?.length ? { data, extension } : undefined;
}
