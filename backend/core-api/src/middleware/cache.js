const { getCache, setCache } = require('../utils/redis');

/**
 * Cache middleware factory
 * @param {number} ttl - Time to live in seconds (default 1 hour)
 */
function cacheMiddleware(ttl = 3600) {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const userId = req.user?.id || 'guest';
    const key = `cache:${userId}:${req.originalUrl || req.url}`;
    
    try {
      const cachedData = await getCache(key);
      if (cachedData) {
        // Add header to indicate cache hit
        res.setHeader('X-Cache', 'HIT');
        return res.json(cachedData);
      }

      // If no cache, override res.json to capture response
      const originalJson = res.json.bind(res);
      res.json = (body) => {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          setCache(key, body, ttl).catch(err => console.error('Set Cache Background Error:', err));
        }
        res.setHeader('X-Cache', 'MISS');
        return originalJson(body);
      };

      next();
    } catch (err) {
      console.error('Cache Middleware Error:', err);
      next();
    }
  };
}

module.exports = cacheMiddleware;
