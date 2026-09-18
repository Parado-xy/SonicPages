# SonicPages

SonicPages is being rebuilt as a private, accessible workspace for reading and
listening to documents. This branch establishes the typed application and design
foundation for the product.

## Current foundation

- Next.js App Router, React, and strict TypeScript
- Tailwind CSS design tokens with light, dark, and system themes
- Responsive desktop sidebar and mobile navigation
- Google OAuth and passwordless email authentication with database sessions
- PostgreSQL and Prisma data foundation
- Private S3-compatible document uploads with signed, short-lived transfers
- Server-enforced file validation, ownership checks, and per-user storage quotas
- Durable PostgreSQL ingestion jobs with retries and stale-lock recovery
- PDF, EPUB, DOCX, and TXT extraction into reader-ready sections
- Searchable, filterable library with collections, grid/list views, progress, and safe document actions
- Protected library, reader-preview, and settings routes
- Accessible loading, error, empty, and not-found states
- Reusable button, badge, card, header, navigation, and empty-state components
- ESLint, TypeScript, Vitest, production builds, dependency auditing, and CI
- Baseline security and privacy headers

The library and reader intentionally contain no fake documents. Document uploads and
processing remains queued until the ingestion worker is introduced.

## Local development

Requirements: Node.js 20.9 or newer and PostgreSQL 16 or newer.

```bash
cp .env.example .env
# Fill DATABASE_URL, AUTH_SECRET, and at least one sign-in provider.
npm ci
npm run db:migrate
npm run dev
```

Run the ingestion worker in a separate process:

```bash
npm run worker:ingestion
```

In production, deploy this command as a continuously running worker using the same
database and storage environment as the web service. Multiple workers can run safely;
PostgreSQL row locking ensures a job is claimed by only one worker.
Set `INGESTION_RUN_ONCE=true` for cron-style or health-check execution.

Open `http://localhost:3000`.

## Validation

```bash
npm run check
npm audit --omit=dev --audit-level=high
```

`npm run check` validates the Prisma schema, runs linting, strict type-checking,
unit tests, and an optimized production build.

## Authentication setup

SonicPages supports either or both of:

- Google OAuth through `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`
- Passwordless email through Resend using `RESEND_API_KEY` and `EMAIL_FROM`

Generate `AUTH_SECRET` with `openssl rand -base64 32`. Google and email variables
must be configured as complete pairs. Passwords are never accepted or stored.

## Private storage setup

Configure `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, and
`S3_SECRET_ACCESS_KEY`. `S3_ENDPOINT` and `S3_FORCE_PATH_STYLE` support
S3-compatible services such as Cloudflare R2, MinIO, and Backblaze B2. The bucket
must remain private; SonicPages issues ten-minute upload policies and five-minute
download URLs only after checking the authenticated owner.

The browser uploads directly to object storage, so the bucket CORS policy must allow
`POST` from the application origin and expose `ETag`. File size and account quota can
be adjusted with `MAX_DOCUMENT_BYTES` and `USER_STORAGE_QUOTA_BYTES`.

## Data model

The relational model covers Better Auth accounts and sessions, owned documents,
assets, durable ingestion jobs, structured sections, reading progress, bookmarks,
highlights, notes, collections, playback preferences, audio jobs, and audio segments.
All document queries must include the authenticated owner ID.

## Privacy and security

SonicPages stores account, session, and document metadata in PostgreSQL and original
documents in private object storage. It does not collect analytics. Never commit environment files, uploaded
documents, generated thumbnails, credentials, or provider tokens. See
[SECURITY.md](SECURITY.md) for reporting guidance.

## Planned sequence

1. Reader foundation
2. Speech and audio engine
3. Notes and reading tools
4. Reliable PWA and offline support
5. Production hardening

## License

MIT
