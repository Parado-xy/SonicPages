# Security policy

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability or exposed secret.
Contact the repository owner privately through GitHub instead.

## Secrets

SonicPages must not store credentials in source control. Local configuration belongs
in an ignored `.env` file. Use `.env.example` to document variable names without
including real values.

If a secret is committed, revoke it at the provider immediately. Removing it from a
later commit does not make the original secret safe.

## Uploaded documents

Document handling uses explicit ownership checks, an allowlist of supported file
types, private object storage, opaque per-user keys, short-lived upload policies, and
short-lived download URLs. Upload completion verifies the stored object's size,
content type, and leading file signature before making it available to the
application. Full archive validation remains part of the isolated ingestion phase.
Buckets must never be configured for public access.

Ingestion runs outside the web process. EPUB and DOCX archives are rejected when
paths attempt traversal, entry counts exceed the safety limit, or declared expanded
size exceeds 200 MiB. Extracted text is capped before persistence. Failed jobs retry
with bounded backoff and expose sanitized errors without leaking storage credentials.

## Authentication and ownership

Authentication uses OAuth or passwordless email with database-backed sessions.
Application queries for user-owned resources must include the authenticated user ID;
knowing a document identifier must never be sufficient to retrieve or mutate it.
