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

The foundation release has no document upload or storage capability. Future document
handling must use explicit ownership checks, validated file types, private object
storage, and short-lived access URLs.
