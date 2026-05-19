const { createClient } = require('redis');

const redisUrl = process.env.REDIS_URL;
let client = null;
let isReady = false;

if (redisUrl) {
  client = createClient({ url: redisUrl });

  client.on('error', (err) => {
    console.error('Redis Client Error:', err);
    isReady = false;
  });

  client.on('ready', () => {
    console.log('Redis Client Connected');
    isReady = true;
  });

  client.connect().catch((err) => {
    console.error('Redis Connection Failed:', err);
    isReady = false;
  });
}

/**
 * Get data from cache
 */
async function getCache(key) {
  if (!isReady || !client) return null;
  try {
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.error('Redis Get Error:', err);
    return null;
  }
}

/**
 * Set data to cache with TTL (seconds)
 */
async function setCache(key, value, ttl = 3600) {
  if (!isReady || !client) return;
  try {
    await client.set(key, JSON.stringify(value), {
      EX: ttl
    });
  } catch (err) {
    console.error('Redis Set Error:', err);
  }
}

/**
 * Delete cache key(s)
 */
async function delCache(key) {
  if (!isReady || !client) return;
  try {
    await client.del(key);
  } catch (err) {
    console.error('Redis Del Error:', err);
  }
}

module.exports = {
  getCache,
  setCache,
  delCache,
  isReady: () => isReady
};
