# OTP Email Verification (Node.js + Redis + Postgres)

A small learning project implementing email OTP (one-time password) verification,
gated behind Google sign-in, with an audit trail in Postgres. Built to demonstrate
Redis as a TTL-based store for short-lived, single-use codes.

## How it works

1. **Sign in with Google** (`/login`) — uses Google Identity Services; the ID token
   is verified server-side (`google-auth-library`), and a session is created
   (stored in Redis via `connect-redis`). The user's verified Google email and
   Google account ID are upserted into Postgres (`users` table).
2. **Request an OTP** (`/`, guarded) — generates a 6-digit code, stores it in Redis
   with a TTL (`SET ... EX`), and "sends" it by email. Email sending is stubbed to
   the console by default; set `EMAIL_ENABLED=true` with SendGrid credentials to
   send real emails.
3. **Verify the OTP** — compares the submitted code against Redis. Each OTP is
   single-use (deleted on success) and attempt-limited (deleted after too many
   wrong tries). Every request/verify outcome is logged to Postgres
   (`otp_events`) for audit purposes.
4. Resending a code is rate-limited by a per-email cooldown key in Redis.

## Stack

| Concern              | Technology                                   |
|-----------------------|-----------------------------------------------|
| App server            | Node.js + Express                             |
| OTP storage/TTL       | Redis                                         |
| Sessions              | `express-session` + `connect-redis` (Redis-backed) |
| Sign-in               | Google Identity Services (ID token verified via `google-auth-library`) |
| Audit log / users     | PostgreSQL (`pg`)                             |
| Email delivery        | SendGrid (`@sendgrid/mail`), stubbed to console by default |
| Containerization      | Docker + Docker Compose                       |

## Project structure

```
src/
  config/
    redis.js        Redis client/connection
    db.js            Postgres pool + schema migration (users, otp_events)
  middleware/
    auth.js          Session guards for pages (redirect) and APIs (401 JSON)
  routes/
    authRoutes.js    /auth/config, /auth/google, /auth/logout, /auth/me
    otpRoutes.js     /otp/request, /otp/verify (session-gated)
  services/
    otpService.js       OTP generation, Redis TTL/attempts/cooldown logic
    otpEventService.js  Writes audit rows to otp_events
    userService.js      Upserts the signed-in user into Postgres
    emailService.js     Sends (or stubs) the OTP email
  server.js          Express app wiring: sessions, static files, route guards
public/
  login.html         Google sign-in button
  index.html         OTP request/verify page (shown only when authenticated)
Dockerfile
docker-compose.yml   app + redis + postgres services
```

## Prerequisites

- Docker and Docker Compose
- A Google OAuth 2.0 Client ID (see below)
- (Optional) A SendGrid API key, if you want real emails instead of the console stub

## Setup

### 1. Create a Google OAuth Client ID

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create/select a project.
2. **APIs & Services → OAuth consent screen**: User type `External`, fill in the
   required fields, leave publishing status as `Testing`, and add your own
   Google account under "Test users".
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: `Web application`
   - Authorized JavaScript origins: `http://localhost:3000`
   - Authorized redirect URIs: none needed (Identity Services button flow doesn't use one)
4. Copy the generated **Client ID** (`....apps.googleusercontent.com`). Only the
   Client ID is needed — not the secret — since the backend verifies ID tokens.

### 2. Configure environment variables

```bash
cp .env.example .env
```

Fill in `.env`:

```
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
SESSION_SECRET=some-long-random-string
```

Generate a session secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Leave `EMAIL_ENABLED=false` to keep OTPs logged to the console instead of emailed
(useful for testing). To send real emails, set `EMAIL_ENABLED=true` and fill in
`SENDGRID_API_KEY` and `SENDGRID_FROM_EMAIL` (the sender must be a verified
sender/domain in your SendGrid account).

### 3. Run

```bash
docker compose up --build
```

This starts three containers: `app` (port 3000), `redis` (port 6379), and
`postgres` (port 5432). The app waits for Postgres to report healthy before
starting, and creates its schema automatically on boot.

Open **http://localhost:3000** — you'll be redirected to `/login`, sign in with
Google, then land on the OTP page showing your signed-in email.

## Environment variables

| Variable                        | Purpose                                              | Default (docker-compose) |
|----------------------------------|-------------------------------------------------------|---------------------------|
| `PORT`                            | App listen port                                       | `3000`                    |
| `REDIS_URL`                       | Redis connection string                                | `redis://redis:6379`      |
| `DATABASE_URL`                    | Postgres connection string                             | `postgres://otp:otp@postgres:5432/otp` |
| `OTP_TTL_SECONDS`                  | How long an OTP is valid                               | `300`                     |
| `OTP_MAX_ATTEMPTS`                 | Wrong-guess limit before the code is invalidated       | `5`                       |
| `OTP_REQUEST_COOLDOWN_SECONDS`     | Minimum time between OTP requests per email            | `60`                      |
| `GOOGLE_CLIENT_ID`                 | OAuth client ID used for sign-in and ID token verification | —                     |
| `SESSION_SECRET`                   | Secret used to sign the session cookie                 | —                         |
| `EMAIL_ENABLED`                    | `true` to send via SendGrid, `false` to log to console | `false`                   |
| `SENDGRID_API_KEY` / `SENDGRID_FROM_EMAIL` | SendGrid credentials (only used if `EMAIL_ENABLED=true`) | —            |

## API reference

| Method | Path            | Auth required | Description                                  |
|--------|-----------------|---------------|-----------------------------------------------|
| GET    | `/login`        | No            | Login page                                     |
| GET    | `/`             | Yes (redirects)| OTP request/verify page                       |
| GET    | `/auth/config`  | No            | Returns the Google Client ID for the frontend  |
| POST   | `/auth/google`  | No            | Verifies a Google ID token, creates the session|
| POST   | `/auth/logout`  | Yes           | Destroys the session                           |
| GET    | `/auth/me`      | Yes           | Returns the signed-in user                     |
| POST   | `/otp/request`  | Yes           | Generates and sends an OTP to the signed-in user's email |
| POST   | `/otp/verify`   | Yes           | Verifies a submitted OTP (`{ "otp": "123456" }`) |
| GET    | `/health`       | No            | Liveness check                                 |

## Data model (Postgres)

```sql
users (id, google_id, email, name, picture, first_login_at, last_login_at)
otp_events (id, user_id, email, event_type, created_at)
  -- event_type ∈ requested | verified | invalid | expired | too_many_attempts
```

## Notes / limitations

This is a learning project, not production-hardened:

- `docker-compose.yml` ships default Postgres credentials (`otp`/`otp`) — change
  these for anything beyond local use.
- Session cookies are only marked `secure` when `NODE_ENV=production` (requires
  HTTPS in front of the app).
- No migration tool is used — schema is created with `CREATE TABLE IF NOT EXISTS`
  on startup, which is fine for a single evolving table set but wouldn't scale to
  a team project.
