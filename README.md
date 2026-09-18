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
- Protected library, reader-preview, and settings routes
- Accessible loading, error, empty, and not-found states
- Reusable button, badge, card, header, navigation, and empty-state components
- ESLint, TypeScript, Vitest, production builds, dependency auditing, and CI
- Baseline security and privacy headers

The library and reader intentionally contain no fake documents. Document uploads and
processing remain disabled until secure object storage and ingestion are introduced.

## Local development

Requirements: Node.js 20.9 or newer and PostgreSQL 16 or newer.

```bash
cp .env.example .env
# Fill DATABASE_URL, AUTH_SECRET, and at least one sign-in provider.
npm ci
npm run db:migrate
npm run dev
```

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

## Data model

The initial relational model covers Better Auth accounts and sessions, owned documents,
assets, structured sections, reading progress, bookmarks, highlights, notes,
collections, playback preferences, audio jobs, and audio segments. All document
queries must include the authenticated owner ID.

## Privacy and security

SonicPages stores account and session records in PostgreSQL. It does not yet store
uploaded documents or collect analytics. Never commit environment files, uploaded
documents, generated thumbnails, credentials, or provider tokens. See
[SECURITY.md](SECURITY.md) for reporting guidance.

## Planned sequence

1. Secure storage and document ingestion
2. Library experience
3. Reader foundation
4. Speech and audio engine
5. Notes and reading tools
6. Reliable PWA and offline support
7. Production hardening

## License

MIT
