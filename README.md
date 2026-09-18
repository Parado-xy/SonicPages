# SonicPages

SonicPages is being rebuilt as a private, accessible workspace for reading and
listening to documents. This branch establishes the typed application and design
foundation for the product.

## Foundation features

- Next.js App Router, React, and strict TypeScript
- Tailwind CSS design tokens with light, dark, and system themes
- Responsive desktop sidebar and mobile navigation
- Home, library, reader-preview, and settings routes
- Accessible loading, error, empty, and not-found states
- Reusable button, badge, card, header, navigation, and empty-state components
- ESLint, TypeScript, Vitest, production builds, dependency auditing, and CI
- Baseline security and privacy headers

The library and reader intentionally contain no fake documents. Authentication,
database persistence, uploads, and document processing are introduced in subsequent
phases.

## Local development

Requirements: Node.js 20.9 or newer.

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`.

## Validation

```bash
npm run check
npm audit --omit=dev --audit-level=high
```

`npm run check` runs linting, strict type-checking, unit tests, and an optimized
production build.

## Privacy and security

SonicPages currently has no accounts, server-side document storage, or analytics.
Never commit environment files, uploaded documents, generated thumbnails, credentials,
or provider tokens. See [SECURITY.md](SECURITY.md) for reporting guidance.

## Planned sequence

1. Authentication and PostgreSQL-backed data model
2. Secure storage and document ingestion
3. Library experience
4. Reader foundation
5. Speech and audio engine
6. Notes and reading tools
7. Reliable PWA and offline support
8. Production hardening

## License

MIT
