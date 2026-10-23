const express = require('express');
const { requestOtp, verifyOtp } = require('../services/otpService');
const { requireAuthApi } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuthApi);

router.post('/request', async (req, res) => {
  const { email, id: userId } = req.session.user;

  try {
    await requestOtp(email, userId);
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
  const { email, id: userId } = req.session.user;
  const { otp } = req.body;

  if (typeof otp !== 'string') {
    return res.status(400).json({ error: 'Code is required.' });
  }

  try {
    await verifyOtp(email, otp, userId);
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
