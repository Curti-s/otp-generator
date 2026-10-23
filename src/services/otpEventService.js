const { pool } = require('../config/db');

async function logOtpEvent({ userId, email, eventType }) {
  await pool.query(
    `INSERT INTO otp_events (user_id, email, event_type) VALUES ($1, $2, $3)`,
    [userId, email, eventType]
  );
}

module.exports = { logOtpEvent };
