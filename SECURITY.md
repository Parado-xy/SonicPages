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

The current application processes PDFs entirely in the browser. Documents selected
in the reader are not uploaded to the SonicPages server.
