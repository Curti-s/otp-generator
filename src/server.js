require('dotenv').config();

const path = require('path');
const express = require('express');
const { connectRedis } = require('./config/redis');
const otpRoutes = require('./routes/otpRoutes');

const PORT = process.env.PORT || 3000;

async function main() {
  await connectRedis();

  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.use('/otp', otpRoutes);

  app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
