const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const { findOrCreateUser } = require('../services/userService');
const { requireAuthApi } = require('../middleware/auth');

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.get('/config', (req, res) => {
  res.json({ clientId: process.env.GOOGLE_CLIENT_ID });
});

router.post('/google', async (req, res) => {
  const { credential } = req.body;
  if (!credential) {
    return res.status(400).json({ error: 'Missing Google credential.' });
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    if (!payload.email_verified) {
      return res.status(401).json({ error: 'Google account email is not verified.' });
    }

    const user = await findOrCreateUser({
      googleId: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    });

    req.session.user = { id: user.id, email: user.email, name: user.name };
    return res.json({ message: 'Logged in.' });
  } catch (err) {
    console.error('Google sign-in failed:', err);
    return res.status(401).json({ error: 'Google sign-in failed.' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ message: 'Logged out.' }));
});

router.get('/me', requireAuthApi, (req, res) => {
  res.json({ user: req.session.user });
});

module.exports = router;
