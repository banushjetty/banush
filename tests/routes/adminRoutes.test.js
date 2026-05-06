const request = require('supertest');
const app = require('../../testApp');
const { getAuthenticatedAgent } = require('../setup/authContext');
const { createTestAdmin } = require('../setup/testHelpers');
const { AdminActivityLog } = require('../../models/AdminActivityLog');

const waitForActivityCountToIncrease = async (filter, previousCount) => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
        const currentCount = await AdminActivityLog.countDocuments(filter);
        if (currentCount > previousCount) return currentCount;
        await new Promise(resolve => setTimeout(resolve, 25));
    }

    return AdminActivityLog.countDocuments(filter);
};

describe('Admin Routes Integration', () => {
    let adminAgent;
    let communityAgent;
    let communityAdmin;
    let financeAdmin;
    let analystAdmin;

    beforeAll(async () => {
        const ctx = await getAuthenticatedAgent('admin');
        adminAgent = ctx.agent;

        const suffix = Date.now();
        financeAdmin = await createTestAdmin({
            userId: `finance_admin_${suffix}`,
            username: `finance_admin_${suffix}`,
            role: 'finance'
        });
        analystAdmin = await createTestAdmin({
            userId: `analyst_admin_${suffix}`,
            username: `analyst_admin_${suffix}`,
            role: 'analyst'
        });

        const communityCtx = await getAuthenticatedAgent('admin', {
            userId: `community_admin_${suffix}`,
            username: `community_admin_${suffix}`,
            role: 'community'
        });
        communityAgent = communityCtx.agent;
        communityAdmin = communityCtx.user;

        await AdminActivityLog.create([
            {
                adminId: communityAdmin.userId,
                username: communityAdmin.username,
                role: 'community',
                action: 'VIEW_USER_MANAGEMENT',
                details: 'Opened user management queue during route test.',
                performedAt: new Date(Date.now() - 3000)
            },
            {
                adminId: financeAdmin.userId,
                username: financeAdmin.username,
                role: 'finance',
                action: 'UPDATE_PAYMENT',
                details: 'Payment verification updated during route test.',
                performedAt: new Date(Date.now() - 2000)
            },
            {
                adminId: analystAdmin.userId,
                username: analystAdmin.username,
                role: 'analyst',
                action: 'VIEW_ADVANCED_ANALYTICS',
                details: 'Opened advanced analytics during route test.',
                performedAt: new Date(Date.now() - 1000)
            }
        ]);
    });

    describe('Access Control', () => {
        it('should return 401 for unauthenticated requests to /admin/dashboard', async () => {
            const res = await request(app)
                .get('/admin/dashboard')
                .set('Accept', 'application/json');

            expect(res.status).toBe(401);
            expect(res.body).toHaveProperty('success', false);
        });

        it('should return 403 for a brand trying to access admin routes', async () => {
            const brandCtx = await getAuthenticatedAgent('brand');
            const res = await brandCtx.agent
                .get('/admin/dashboard')
                .set('Accept', 'application/json');

            expect(res.status).toBe(403);
            expect(res.body).toHaveProperty('success', false);
        });
    });

    describe('GET /admin/dashboard', () => {
        it('should return 200 with dashboard data for authenticated admin', async () => {
            const res = await adminAgent
                .get('/admin/dashboard')
                .set('Accept', 'application/json');

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('success', true);
            expect(res.body).toHaveProperty('stats');
        });
    });

    describe('GET /admin/notifications', () => {
        it('should return 200 with notification list', async () => {
            const res = await adminAgent
                .get('/admin/notifications')
                .set('Accept', 'application/json');

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('success', true);
            expect(res.body).toHaveProperty('notifications');
        });
    });

    describe('GET /admin/brand-analytics', () => {
        it('should return 200 with analytics data', async () => {
            const res = await adminAgent
                .get('/admin/brand-analytics')
                .set('Accept', 'application/json');

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('success', true);
        });
    });

    describe('GET /admin/customer-management', () => {
        it('should return 200 with customer management data', async () => {
            const res = await adminAgent
                .get('/admin/customer-management')
                .set('Accept', 'application/json');

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('success', true);
        });
    });

    describe('Sub-admin activity feature', () => {
        it('should return sub-admin panel data for a superadmin', async () => {
            const res = await adminAgent
                .get('/admin/sub-admins')
                .set('Accept', 'application/json');

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('success', true);
            expect(res.body.totalSubAdmins).toBeGreaterThanOrEqual(3);
            expect(res.body.counts).toEqual(expect.objectContaining({
                community: expect.any(Number),
                finance: expect.any(Number),
                analyst: expect.any(Number)
            }));
            expect(res.body.roles.finance.users).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        userId: financeAdmin.userId,
                        username: financeAdmin.username,
                        recentActivityCount: expect.any(Number)
                    })
                ])
            );
            expect(res.body.roles.analyst.users).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        userId: analystAdmin.userId,
                        username: analystAdmin.username
                    })
                ])
            );
            expect(res.body.recentActivity).toEqual(expect.any(Array));
        });

        it('should return paginated and filtered sub-admin activity for a superadmin', async () => {
            const res = await adminAgent
                .get('/admin/sub-admins/activity')
                .query({
                    role: 'finance',
                    action: 'UPDATE_PAYMENT',
                    search: 'Payment verification',
                    page: 1,
                    limit: 5
                })
                .set('Accept', 'application/json');

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('success', true);
            expect(res.body.meta).toEqual(expect.objectContaining({
                currentPage: 1,
                limit: 5,
                totalDocs: expect.any(Number),
                totalPages: expect.any(Number)
            }));
            expect(res.body.filters.roles).toEqual(expect.arrayContaining(['community', 'finance', 'analyst']));
            expect(res.body.filters.actions).toEqual(expect.arrayContaining(['UPDATE_PAYMENT']));
            expect(res.body.activities).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        adminId: financeAdmin.userId,
                        username: financeAdmin.username,
                        role: 'finance',
                        action: 'UPDATE_PAYMENT',
                        details: expect.stringContaining('Payment verification')
                    })
                ])
            );
            expect(res.body.activities.every(activity => activity.role === 'finance')).toBe(true);
            expect(res.body.activities.every(activity => activity.action === 'UPDATE_PAYMENT')).toBe(true);
        });

        it('should deny sub-admin panel access to non-superadmin admins', async () => {
            const panelRes = await communityAgent
                .get('/admin/sub-admins')
                .set('Accept', 'application/json');
            const activityRes = await communityAgent
                .get('/admin/sub-admins/activity')
                .set('Accept', 'application/json');

            expect(panelRes.status).toBe(403);
            expect(panelRes.body).toHaveProperty('success', false);
            expect(activityRes.status).toBe(403);
            expect(activityRes.body).toHaveProperty('success', false);
        });

        it('should log tracked admin route activity for a sub-admin', async () => {
            const logFilter = {
                adminId: communityAdmin.userId,
                action: 'VIEW_DASHBOARD'
            };
            const beforeCount = await AdminActivityLog.countDocuments(logFilter);

            const res = await communityAgent
                .get('/admin/dashboard')
                .set('Accept', 'application/json');

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('success', true);

            const afterCount = await waitForActivityCountToIncrease(logFilter, beforeCount);

            expect(afterCount).toBeGreaterThan(beforeCount);
        });
    });
});
