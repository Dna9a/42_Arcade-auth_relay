# 42 Auth Relay

A tiny serverless relay that handles the 42 School OAuth2 flow on behalf of arcade cabinets. Cabinets never touch the client secret — they only know the relay's public URL.

## How it works

1. Cabinet requests `POST /api/session` → gets a `sessionId` and a `loginUrl`
2. Cabinet shows `loginUrl` as a QR code on screen
3. Player scans the QR on their phone, logs into 42
4. 42 redirects to `GET /api/callback` on this relay
5. Relay exchanges the code for a token, fetches `/v2/me`, stores `{ id, login, avatar }`
6. Cabinet polls `GET /api/session/:id` until it gets the user back
7. Session is deleted after one read (or after 5 minutes if never read)

Tokens are never stored or returned to the cabinet — only the user's public profile.

## Setup

### 1. Register a 42 OAuth application

Go to https://profile.intra.42.fr/oauth/applications and create a new app:
- **Redirect URI**: the relay's callback URL (e.g. `https://your-relay.vercel.app/api/callback`)
- **Scopes**: check `public` (the default — sufficient for id, login, avatar)

Note the **UID** (client ID) and **Secret**.

### 2. Supabase table

The relay stores sessions in a Supabase `sessions` table. The table already exists with this schema:

```sql
create table sessions (
  id text primary key,
  data jsonb not null,
  expires_at timestamptz not null
);
alter table sessions enable row level security;
-- No RLS policies — accessed only via service_role key
grant all on sessions to service_role;
```

### 3. Deploy to Vercel

```bash
npm install
npx vercel --prod
```

Set environment variables in the Vercel dashboard (or via CLI):

| Variable | Value |
|----------|-------|
| `FORTYTWO_CLIENT_ID` | The UID from your 42 app |
| `FORTYTWO_CLIENT_SECRET` | The secret from your 42 app |
| `REDIRECT_URI` | `https://<your-vercel-domain>/api/callback` |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key (not the anon key) |

### 4. Point the launcher at the relay

In the launcher's `executables.config.cts`, set:
```ts
authRelayUrl: 'https://your-relay.vercel.app',
```

That's it — no credentials needed on the cabinet.

## Local development

```bash
npx vercel dev
```

This starts the relay at `http://localhost:3000`. Set `REDIRECT_URI` to `http://localhost:3000/api/callback` in your 42 app settings (you can have multiple redirect URIs, or use a separate 42 app for dev).

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/session` | Create a new login session |
| GET | `/api/callback` | 42 OAuth redirect target |
| GET | `/api/session/:id` | Poll for login result |

## Notes

- Sessions are stored in Supabase (Postgres) with a 5-minute TTL. Expired rows are cleaned up opportunistically on each new session creation.
- Polling is race-safe: the poll endpoint uses an atomic `DELETE ... RETURNING` so two simultaneous polls can't both receive the user.
