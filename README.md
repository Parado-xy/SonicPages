# SonicPages

SonicPages is a privacy-first PDF reader that renders documents and reads them aloud
with the browser's built-in speech synthesis. In the current foundation release, a
selected PDF stays in the browser and is not uploaded to the application server.

## Current features

- Local PDF rendering with PDF.js
- Browser text-to-speech and voice selection
- Play, pause, stop, previous-page, and next-page controls
- Optional automatic page progression
- Reading-position and voice preferences stored locally
- Installable progressive web application

## Local development

Requirements: Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Validation

```bash
npm test
npm audit
```

## Privacy and security

The former Notion-backed account and library implementation has been removed. The
application has no sign-in or server-side document storage until the replacement
database, authentication, and object-storage architecture is introduced.

Never commit `.env` files, uploaded documents, generated thumbnails, credentials, or
provider tokens. See [SECURITY.md](SECURITY.md) for reporting guidance.

## Rebuild roadmap

This repository is being rebuilt in stages. Planned work includes a TypeScript
application foundation, PostgreSQL-backed accounts and libraries, secure object
storage, multi-format document ingestion, an improved reader, annotations, generated
audio, and reliable offline support.

## License

MIT
