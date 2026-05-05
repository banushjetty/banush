const cache = require('../../services/cache/redisCacheService');
const cacheInvalidation = require('../../services/cache/cacheInvalidationService');

jest.mock('../../services/cache/redisCacheService');

describe('Cache Invalidation Service', () => {
    beforeEach(() => {
        cache.delByPattern.mockReset();
        cache.delByPattern.mockResolvedValue(1);
    });

    it('invalidates namespaced dashboard cache keys', async () => {
        const deleted = await cacheInvalidation.invalidateDashboardCaches();

        expect(deleted).toBe(2);
        expect(cache.delByPattern).toHaveBeenCalledWith('*:dashboard:*');
        expect(cache.delByPattern).toHaveBeenCalledWith('dashboard:*');
    });

    it('invalidates namespaced explore cache keys', async () => {
        const deleted = await cacheInvalidation.invalidateExploreCaches();

        expect(deleted).toBe(2);
        expect(cache.delByPattern).toHaveBeenCalledWith('*:explore:*');
        expect(cache.delByPattern).toHaveBeenCalledWith('explore:*');
    });

    it('invalidates stats plus dependent dashboard and rankings cache keys', async () => {
        const deleted = await cacheInvalidation.invalidateStatsCaches();

        expect(deleted).toBe(6);
        expect(cache.delByPattern).toHaveBeenCalledWith('*:stats:*');
        expect(cache.delByPattern).toHaveBeenCalledWith('*:dashboard:*');
        expect(cache.delByPattern).toHaveBeenCalledWith('*:rankings:*');
        expect(cache.delByPattern).toHaveBeenCalledWith('stats:*');
        expect(cache.delByPattern).toHaveBeenCalledWith('dashboard:*');
        expect(cache.delByPattern).toHaveBeenCalledWith('rankings:*');
    });
});
