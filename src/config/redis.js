const { createClient } = require('redis');

const client = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

client.on('error', (err) => console.error('Redis client error:', err));
client.on('connect', () => console.log('Connecting to Redis...'));
client.on('ready', () => console.log('Redis connection ready'));

async function connectRedis() {
  if (!client.isOpen) {
    await client.connect();
  }
  return client;
}

module.exports = { client, connectRedis };
