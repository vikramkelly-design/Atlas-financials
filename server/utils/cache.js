const NodeCache = require('node-cache');

const ttl = parseInt(process.env.CACHE_TTL_SECONDS || '900', 10);
const cache = new NodeCache({ stdTTL: ttl, checkperiod: 120 });

async function withCache(key, fn) {
  const cached = cache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const result = await fn();
  cache.set(key, result);
  return result;
}

function clearCache(key) {
  if (key) {
    cache.del(key);
  } else {
    cache.flushAll();
  }
}

function getCacheStats() {
  return cache.getStats();
}

module.exports = { withCache, clearCache, getCacheStats };
