'use strict';

const { getRedisConnection } = require('../queues/redisConnection');

const PREFIX = 'collabsync:cache:';

function getClient() {
  return getRedisConnection();
}

function withPrefix(key) {
  return `${PREFIX}${key}`;
}

async function getJSON(key) {
  const client = getClient();
  if (!client) return null;

  let value;
  try {
    value = await client.get(withPrefix(key));
    if (!value) return null;
  } catch (_) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch (_) {
    return null;
  }
}

async function setJSON(key, data, ttlSeconds) {
  const client = getClient();
  if (!client) return false;

  const payload = JSON.stringify(data);
  const fullKey = withPrefix(key);
  try {
    if (ttlSeconds && Number(ttlSeconds) > 0) {
      await client.set(fullKey, payload, 'EX', Number(ttlSeconds));
    } else {
      await client.set(fullKey, payload);
    }
  } catch (_) {
    return false;
  }
  return true;
}

async function delByPattern(pattern) {
  const client = getClient();
  if (!client) return 0;

  const fullPattern = withPrefix(pattern);
  let cursor = '0';
  let deleted = 0;

  do {
    try {
      const [nextCursor, keys] = await client.scan(cursor, 'MATCH', fullPattern, 'COUNT', 200);
      cursor = nextCursor;
      if (keys.length) {
        deleted += await client.del(...keys);
      }
    } catch (_) {
      return deleted;
    }
  } while (cursor !== '0');

  return deleted;
}

module.exports = {
  getClient,
  getJSON,
  setJSON,
  delByPattern,
};

