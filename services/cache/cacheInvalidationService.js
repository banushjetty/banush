'use strict';

const cache = require('./redisCacheService');

async function delPatterns(patterns) {
  const counts = await Promise.all(patterns.map((pattern) => cache.delByPattern(pattern)));
  return counts.reduce((sum, count) => sum + count, 0);
}

async function invalidateDashboardCaches() {
  return delPatterns(['*:dashboard:*', 'dashboard:*']);
}

async function invalidateExploreCaches() {
  return delPatterns(['*:explore:*', 'explore:*']);
}

async function invalidateRankingsCaches() {
  return delPatterns(['*:rankings:*', 'rankings:*']);
}

async function invalidateSearchCaches() {
  return delPatterns(['*:search:*', 'search:*']);
}

async function invalidateStatsCaches() {
  return delPatterns([
    '*:stats:*',
    '*:dashboard:*',
    '*:rankings:*',
    'stats:*',
    'dashboard:*',
    'rankings:*',
  ]);
}

module.exports = {
  invalidateDashboardCaches,
  invalidateExploreCaches,
  invalidateRankingsCaches,
  invalidateSearchCaches,
  invalidateStatsCaches,
};

