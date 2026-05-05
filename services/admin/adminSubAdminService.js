const { Admin } = require('../../mongoDB');
const { AdminActivityLog } = require('../../models/AdminActivityLog');

/**
 * AdminSubAdminService
 * --------------------
 * Provides data for the superadmin's "Sub-Admin Management" panel:
 *   - count & details of each sub-admin role
 *   - recent activity log entries per user
 */

const SUB_ADMIN_ROLES = ['community', 'finance', 'analyst'];
const USER_ACTIVITY_LIMIT = 5;
const TIMELINE_ACTIVITY_LIMIT = 10;

// What each role can and cannot do (displayed in the UI)
const ROLE_PERMISSIONS = {
    finance: {
        label: 'Finance Manager',
        color: '#4ade80',
        gradient: 'linear-gradient(135deg, #16a34a, #4ade80)',
        icon: '💰',
        permitted: [
            'View dashboard overview',
            'Manage customer accounts',
            'Verify & update payment records',
            'View order analytics',
            'Export payment reports'
        ],
        restricted: [
            'User management (approve/reject)',
            'Feedback & moderation',
            'Collaboration monitoring',
            'Advanced analytics',
            'Admin settings'
        ]
    },
    analyst: {
        label: 'Data Analyst',
        color: '#60a5fa',
        gradient: 'linear-gradient(135deg, #2563eb, #60a5fa)',
        icon: '📊',
        permitted: [
            'View dashboard overview',
            'Access all analytics dashboards',
            'Monitor collaborations',
            'View brand & influencer analytics',
            'Access campaign analytics'
        ],
        restricted: [
            'Payment verification',
            'Customer management',
            'User approval',
            'Feedback moderation',
            'Admin settings'
        ]
    },
    community: {
        label: 'Community Manager',
        color: '#a78bfa',
        gradient: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
        icon: '👥',
        permitted: [
            'View dashboard overview',
            'Manage users (approve/reject)',
            'Review & moderate feedback',
            'View influencer & brand lists',
            'Manage community content'
        ],
        restricted: [
            'Payment verification',
            'Customer management',
            'Financial reports',
            'Advanced analytics',
            'Admin settings'
        ]
    }
};

/**
 * Returns full sub-admin panel data for the superadmin dashboard.
 */
const getSubAdminPanelData = async () => {
    // 1. Fetch all sub-admin users (exclude superadmin)
    const subAdmins = await Admin.find(
        { role: { $in: SUB_ADMIN_ROLES } },
        { userId: 1, username: 1, role: 1, createdAt: 1 }
    ).lean();

    // 2. Fetch recent activity for each sub-admin.
    const activityByUser = {};
    const activityCountsByUser = {};
    for (const sa of subAdmins) {
        const [logs, totalCount] = await Promise.all([
            AdminActivityLog.find({ adminId: sa.userId })
                .sort({ performedAt: -1 })
                .limit(USER_ACTIVITY_LIMIT)
                .lean(),
            AdminActivityLog.countDocuments({ adminId: sa.userId })
        ]);

        activityByUser[sa.userId] = logs;
        activityCountsByUser[sa.userId] = totalCount;
    }

    // 3. Build per-role groups
    const roleGroups = {};
    for (const role of SUB_ADMIN_ROLES) {
        const usersInRole = subAdmins.filter(u => u.role === role);
        roleGroups[role] = {
            ...ROLE_PERMISSIONS[role],
            role,
            count: usersInRole.length,
            users: usersInRole.map(u => ({
                userId: u.userId,
                username: u.username,
                createdAt: u.createdAt,
                recentActivityCount: activityCountsByUser[u.userId] || 0,
                recentActivity: activityByUser[u.userId] || []
            }))
        };
    }

    // 4. Recent activity across all sub-admins, sorted newest first.
    const allActivityFilter = { role: { $in: SUB_ADMIN_ROLES } };
    const [allRecentActivity, allRecentActivityCount] = await Promise.all([
        AdminActivityLog.find(allActivityFilter)
            .sort({ performedAt: -1 })
            .limit(TIMELINE_ACTIVITY_LIMIT)
            .lean(),
        AdminActivityLog.countDocuments(allActivityFilter)
    ]);

    return {
        totalSubAdmins: subAdmins.length,
        counts: {
            finance: roleGroups.finance?.count || 0,
            analyst: roleGroups.analyst?.count || 0,
            community: roleGroups.community?.count || 0
        },
        roles: roleGroups,
        activityLimits: {
            perUser: USER_ACTIVITY_LIMIT,
            timeline: TIMELINE_ACTIVITY_LIMIT
        },
        recentActivityCount: allRecentActivityCount,
        recentActivity: allRecentActivity
    };
};

const getPaginatedSubAdminActivity = async (query = {}) => {
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const requestedLimit = parseInt(query.limit, 10) || 10;
    const limit = Math.min(Math.max(requestedLimit, 5), 50);
    const skip = (page - 1) * limit;
    const filter = { role: { $in: SUB_ADMIN_ROLES } };

    if (query.role && SUB_ADMIN_ROLES.includes(query.role)) {
        filter.role = query.role;
    }

    if (query.adminId) {
        filter.adminId = query.adminId;
    }

    if (query.action) {
        filter.action = query.action;
    }

    if (query.search) {
        const searchRegex = { $regex: String(query.search).trim(), $options: 'i' };
        filter.$or = [
            { username: searchRegex },
            { action: searchRegex },
            { details: searchRegex }
        ];
    }

    const [activities, totalDocs, actions] = await Promise.all([
        AdminActivityLog.find(filter)
            .sort({ performedAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        AdminActivityLog.countDocuments(filter),
        AdminActivityLog.distinct('action', { role: { $in: SUB_ADMIN_ROLES } })
    ]);

    return {
        activities,
        meta: {
            totalDocs,
            currentPage: page,
            totalPages: Math.max(Math.ceil(totalDocs / limit), 1),
            limit,
            hasNextPage: page * limit < totalDocs,
            hasPrevPage: page > 1
        },
        filters: {
            roles: SUB_ADMIN_ROLES,
            actions: actions.sort()
        }
    };
};

const getPathId = (path) => path.split('/').filter(Boolean).pop();

const truncate = (value, length = 80) => {
    if (!value) return '';
    const text = String(value).trim();
    return text.length > length ? `${text.slice(0, length - 3)}...` : text;
};

const ACTIVITY_ROUTE_MAP = [
    ['GET', /^\/dashboard$/, 'VIEW_DASHBOARD', 'Opened admin dashboard overview.'],
    ['GET', /^\/notifications$/, 'VIEW_NOTIFICATIONS', 'Viewed admin notifications.'],
    ['POST', /^\/notifications\/mark-all-read$/, 'NOTIFICATIONS_READ', 'Marked all admin notifications as read.'],

    ['GET', /^\/brand-analytics$/, 'VIEW_BRAND_ANALYTICS', 'Viewed brand analytics dashboard.'],
    ['GET', /^\/influencer-analytics$/, 'VIEW_INFLUENCER_ANALYTICS', 'Viewed influencer analytics dashboard.'],
    ['GET', /^\/campaign-analytics$/, 'VIEW_CAMPAIGN_ANALYTICS', 'Viewed campaign analytics dashboard.'],
    ['GET', /^\/analytics$/, 'VIEW_ADVANCED_ANALYTICS', 'Opened advanced analytics overview.'],
    ['GET', /^\/analytics\/influencer-roi$/, 'VIEW_INFLUENCER_ROI', 'Reviewed influencer ROI analytics.'],
    ['GET', /^\/analytics\/campaign-revenue$/, 'VIEW_CAMPAIGN_REVENUE', 'Reviewed campaign revenue leaderboard.'],
    ['GET', /^\/analytics\/matchmaking\/[^/]+$/, 'VIEW_MATCHMAKING', path => `Viewed matchmaking recommendations for brand ${getPathId(path)}.`],
    ['GET', /^\/analytics\/ecosystem$/, 'VIEW_ECOSYSTEM_ANALYTICS', 'Viewed ecosystem graph analytics.'],

    ['GET', /^\/user_management$/, 'VIEW_USER_MANAGEMENT', 'Opened user management queue.'],
    ['POST', /^\/user_management\/approve\/[^/]+$/, 'APPROVE_USER', path => `Approved pending user ${getPathId(path)}.`],
    ['GET', /^\/user_management\/brand\/[^/]+$/, 'VIEW_BRAND_DETAILS', path => `Viewed brand review details for ${getPathId(path)}.`],
    ['GET', /^\/user_management\/influencer\/[^/]+$/, 'VIEW_INFLUENCER_DETAILS', path => `Viewed influencer review details for ${getPathId(path)}.`],
    ['GET', /^\/verified-brands$/, 'VIEW_VERIFIED_BRANDS', 'Viewed verified brand accounts.'],
    ['GET', /^\/verified-influencers$/, 'VIEW_VERIFIED_INFLUENCERS', 'Viewed verified influencer accounts.'],

    ['GET', /^\/collaboration_monitoring$/, 'VIEW_COLLABORATIONS', 'Opened collaboration monitoring dashboard.'],
    ['GET', /^\/collaboration_monitoring\/[^/]+$/, 'VIEW_COLLABORATION_DETAILS', path => `Viewed collaboration details for ${getPathId(path)}.`],

    ['GET', /^\/payment_verification$/, 'VIEW_PAYMENT_QUEUE', 'Opened payment verification queue.'],
    ['GET', /^\/payment_verification\/categories$/, 'VIEW_PAYMENT_CATEGORIES', 'Viewed influencer payment categories.'],
    ['GET', /^\/payment_verification\/[^/]+$/, 'VIEW_PAYMENT_DETAILS', path => `Viewed payment details for ${getPathId(path)}.`],
    ['POST', /^\/payment_verification\/update\/[^/]+$/, 'UPDATE_PAYMENT', path => `Updated payment verification status for ${getPathId(path)}.`],

    ['GET', /^\/feedback_and_moderation$/, 'VIEW_FEEDBACK_QUEUE', 'Opened feedback and moderation queue.'],
    ['GET', /^\/feedback_and_moderation\/[^/]+$/, 'VIEW_FEEDBACK_DETAILS', path => `Viewed feedback report ${getPathId(path)}.`],
    ['POST', /^\/feedback_and_moderation\/update\/[^/]+$/, 'UPDATE_FEEDBACK', path => `Updated moderation status for feedback ${getPathId(path)}.`],
    ['DELETE', /^\/feedback_and_moderation\/[^/]+$/, 'DELETE_FEEDBACK', path => `Deleted feedback report ${getPathId(path)}.`],

    ['GET', /^\/customer-management$/, 'VIEW_CUSTOMER_MANAGEMENT', 'Opened customer management dashboard.'],
    ['GET', /^\/completed-orders$/, 'VIEW_COMPLETED_ORDERS', 'Viewed completed customer orders.'],
    ['GET', /^\/product-analytics$/, 'VIEW_PRODUCT_ANALYTICS', 'Viewed product analytics.'],
    ['GET', /^\/customer-details\/[^/]+$/, 'VIEW_CUSTOMER_DETAILS', path => `Viewed customer details for ${getPathId(path)}.`],
    ['PUT', /^\/customer-status\/[^/]+$/, 'UPDATE_CUSTOMER_STATUS', path => `Updated customer account status for ${getPathId(path)}.`],
    ['GET', /^\/customer-analytics$/, 'VIEW_CUSTOMER_ANALYTICS', 'Viewed customer analytics.'],
    ['GET', /^\/all-customers$/, 'VIEW_ALL_CUSTOMERS', 'Viewed all customer accounts.'],

    ['GET', /^\/orders\/analytics$/, 'VIEW_ORDER_ANALYTICS', 'Viewed order analytics.'],
    ['GET', /^\/orders\/all$/, 'VIEW_ORDER_LIST', 'Viewed all admin orders.'],
    ['GET', /^\/search$/, 'GLOBAL_SEARCH', (path, req) => {
        const term = truncate(req.query?.q || req.query?.query || req.query?.search);
        return term ? `Ran global admin search for "${term}".` : 'Ran global admin search.';
    }],

    ['GET', /^\/settings$/, 'VIEW_SETTINGS', 'Opened admin settings.'],
    ['POST', /^\/reset-password$/, 'RESET_ADMIN_PASSWORD', (path, req) => {
        const username = truncate(req.body?.username);
        return username ? `Reset password for admin user ${username}.` : 'Reset an admin password.';
    }],
    ['GET', /^\/logout$/, 'LOGOUT', 'Signed out of the admin panel.']
];

const getAdminActivityDescriptor = (req) => {
    const method = req.method.toUpperCase();
    const path = req.path.split('?')[0];
    const match = ACTIVITY_ROUTE_MAP.find(([routeMethod, pattern]) => (
        routeMethod === method && pattern.test(path)
    ));

    if (!match) return null;

    const [, , action, details] = match;
    return {
        action,
        details: typeof details === 'function' ? details(path, req) : details
    };
};

/**
 * Logs a sub-admin action.  Call this from any controller after a
 * protected action is performed.
 */
const logSubAdminAction = async (req, action, details = '') => {
    if (!req.user) return;
    const ip = req.ip || req.headers['x-forwarded-for'] || '';
    await AdminActivityLog.log(
        req.user.userId,
        req.user.username,
        req.user.role,
        action,
        details,
        ip
    );
};

const trackSubAdminActivity = (req, res, next) => {
    if (!req.user || !SUB_ADMIN_ROLES.includes(req.user.role)) {
        return next();
    }

    const descriptor = getAdminActivityDescriptor(req);
    if (!descriptor) {
        return next();
    }

    res.on('finish', () => {
        if (req.activityLoggedManually) return;
        if (res.statusCode >= 400) return;

        logSubAdminAction(req, descriptor.action, descriptor.details).catch(error => {
            console.error('[ActivityLog] Failed to track admin route activity:', error.message);
        });
    });

    next();
};

module.exports = {
    getSubAdminPanelData,
    getPaginatedSubAdminActivity,
    logSubAdminAction,
    trackSubAdminActivity,
    ROLE_PERMISSIONS
};
