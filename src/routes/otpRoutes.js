const express = require('express');
const { requestOtp, verifyOtp } = require('../services/otpService');

const router = express.Router();

const isValidEmail = (email) => typeof email === 'string' && /\S+@\S+\.\S+/.test(email);

router.post('/request', async (req, res) => {
  const { email } = req.body;

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'A valid email is required.' });
  }

  try {
    await requestOtp(email);
    return res.json({ message: 'Code sent.' });
  } catch (err) {
    if (err.code === 'COOLDOWN') {
      return res.status(429).json({ error: err.message });
    }
    console.error('requestOtp failed:', err);
    return res.status(500).json({ error: 'Could not send code. Try again later.' });
  }
});

router.post('/verify', async (req, res) => {
  const { email, otp } = req.body;

  if (!isValidEmail(email) || typeof otp !== 'string') {
    return res.status(400).json({ error: 'Email and code are required.' });
  }

  try {
    await verifyOtp(email, otp);
    return res.json({ message: 'Verified.' });
  } catch (err) {
    if (['NOT_FOUND', 'TOO_MANY_ATTEMPTS', 'INVALID'].includes(err.code)) {
      return res.status(400).json({ error: err.message });
    }
    console.error('verifyOtp failed:', err);
    return res.status(500).json({ error: 'Could not verify code. Try again later.' });
  }
});

module.exports = router;
