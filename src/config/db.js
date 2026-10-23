const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => console.error('Postgres pool error:', err));

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      google_id TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      picture TEXT,
      first_login_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_login_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS otp_events (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      email TEXT NOT NULL,
      event_type TEXT NOT NULL CHECK (event_type IN ('requested', 'verified', 'invalid', 'expired', 'too_many_attempts')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  console.log('Postgres schema is up to date');
}

module.exports = { pool, migrate };
