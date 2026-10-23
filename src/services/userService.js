const { pool } = require('../config/db');

async function findOrCreateUser({ googleId, email, name, picture }) {
  const { rows } = await pool.query(
    `INSERT INTO users (google_id, email, name, picture)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (google_id)
     DO UPDATE SET email = $2, name = $3, picture = $4, last_login_at = now()
     RETURNING id, google_id, email, name, picture`,
    [googleId, email, name, picture]
  );
  return rows[0];
}

module.exports = { findOrCreateUser };
