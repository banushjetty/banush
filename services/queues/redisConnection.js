'use strict';

const IORedis = require('ioredis');

let redisConnection = null;
let warnedInvalidRedisUrl = false;
let lastRedisErrorMessage = null;

function getRedisConnection() {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) return null;

  if (!/^rediss?:\/\//i.test(redisUrl)) {
    if (!warnedInvalidRedisUrl) {
      console.warn('[Redis] Invalid REDIS_URL. Use redis:// or rediss://, not the Upstash HTTPS REST URL. Redis features are disabled.');
      warnedInvalidRedisUrl = true;
    }
    return null;
  }

  if (!redisConnection) {
    const isTLS = redisUrl.startsWith('rediss://');
    redisConnection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      ...(isTLS && { tls: { rejectUnauthorized: false } })
    });

    redisConnection.on('error', (error) => {
      if (error.message !== lastRedisErrorMessage) {
        console.warn(`[Redis] Connection error: ${error.message}`);
        lastRedisErrorMessage = error.message;
      }
    });
  }

  return redisConnection;
}

module.exports = {
  getRedisConnection,
};

