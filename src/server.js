require('dotenv').config();

const path = require('path');
const express = require('express');
const session = require('express-session');
const { default: RedisStore } = require('connect-redis');
const { client: redisClient, connectRedis } = require('./config/redis');
const { migrate } = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const otpRoutes = require('./routes/otpRoutes');
const { requireAuthPage } = require('./middleware/auth');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

async function main() {
  await connectRedis();
  await migrate();

  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());

  app.use(
    session({
      store: new RedisStore({ client: redisClient, prefix: 'sess:' }),
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60 * 8,
      },
    })
  );

  app.use(express.static(PUBLIC_DIR, { index: false }));

  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.use('/auth', authRoutes);
  app.use('/otp', otpRoutes);

  app.get('/login', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'login.html')));
  app.get('/', requireAuthPage, (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

  app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
