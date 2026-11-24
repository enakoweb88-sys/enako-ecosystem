# Passwords and Keys

The developer dashboard links to `/app/passwords-and-keys`. The public portion of
the page describes the vault; even platform names require email verification.
The vault is shared by the owner and engineering team, with a separate unlock
for each authenticated login session. Engineering eligibility comes from the
server's department record, never a browser-selected role. The owner can approve
a developer's access by sharing that session's code.

## Deployment configuration

Set these **backend-only** environment variables before enabling live access:

- `VAULT_OWNER_EMAIL`: `enakoweb88@gmail.com`, the fixed inbox that receives all vault codes. Users cannot change the recipient through the API.
- `VAULT_ENCRYPTION_KEY`: 64 hexadecimal characters representing 32 cryptographically random bytes. Generate this in a trusted secret manager and retain a secure backup. Never put it in frontend environment variables or source control.
- `VAULT_OWNER_USER_ID`: the owner's existing ENAKOOS user ID, when their login address differs from `VAULT_OWNER_EMAIL` and their CEO profile's personal email does not already match it.

Existing Resend or SMTP configuration delivers messages. The vault fails closed
when owner email or encryption key is absent, and never uses a development code.
Run the repository's normal `prisma migrate deploy` workflow for the new migration,
then deploy the backend, ENAKOOS frontend, and its Access proxy together. The proxy
must forward `X-Vault-Token`. No production migration or deployment is performed
by the local source update.

Codes expire in five minutes, allow five guesses, and can be requested once per
minute across the vault. Unlock access expires after ten minutes and can be
revoked using Lock vault. Leaving the page also attempts to revoke it; the
server deadline remains effective if the browser closes without sending that
request. Refreshing the page clears the in-memory unlock token.

Credential rows are encrypted with AES-256-GCM and fresh nonces; authentication
binds ciphertext to its platform and environment. The database contains only
encrypted row payloads, code/token hashes, and platform names. Browser database
roles have no direct table privileges. Audit events contain action and record
IDs, never credential values or codes. Saves use version checks to reject stale
edits from other tabs. All API responses use the existing no-store policy.

Back up the database and encryption key separately. Changing the encryption key
without first re-encrypting stored records makes existing credentials unreadable;
key rotation needs a separate migration procedure.

## Local verification

`npm run test:unit -- --runTestsByPath src/modules/vault/vault.crypto.spec.ts`
checks authenticated encryption and challenge hashes.
`node scripts/test-vault.cjs` runs migrations and vault workflows against a
disposable loopback PostgreSQL database, including browser-role denials. It does
not use deployment database URLs, send email, or contact a live database.
