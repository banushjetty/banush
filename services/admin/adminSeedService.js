const { Admin } = require('../../mongoDB');
const { AdminActivityLog } = require('../../models/AdminActivityLog');
const bcrypt = require('bcrypt');

const SUB_ADMIN_ACTIVITY_SEED_SOURCE = 'seed:sub-admin-panel';

const SUB_ADMIN_ACTIVITY_SEED = [
    {
        userId: 'community-001',
        action: 'USER_REVIEW',
        details: 'Reviewed 8 pending influencer signups and approved profiles with complete social links.',
        minutesAgo: 14
    },
    {
        userId: 'finance-001',
        action: 'PAYMENT_VERIFIED',
        details: 'Verified Razorpay payment for Mamaearth Onion Hair Care and cleared the order for fulfillment.',
        minutesAgo: 27
    },
    {
        userId: 'analyst-001',
        action: 'CAMPAIGN_AUDIT',
        details: 'Checked conversion trends for boAt, Nykaa, and Lenskart campaigns in Advanced Analytics.',
        minutesAgo: 41
    },
    {
        userId: 'community-001',
        action: 'FEEDBACK_MODERATED',
        details: 'Closed duplicate feedback reports and escalated one creator payout concern to Finance.',
        minutesAgo: 68
    },
    {
        userId: 'finance-001',
        action: 'REFUND_REVIEW',
        details: 'Reviewed customer refund requests for delivered campaign orders and flagged 2 exceptions.',
        minutesAgo: 96
    },
    {
        userId: 'analyst-001',
        action: 'COLLAB_MONITORING',
        details: 'Reviewed active collaboration health and highlighted delayed deliverables for follow-up.',
        minutesAgo: 143
    },
    {
        userId: 'community-001',
        action: 'BRAND_APPROVAL',
        details: 'Approved a skincare brand after verifying website, contact details, and campaign fit.',
        minutesAgo: 210
    },
    {
        userId: 'finance-001',
        action: 'ORDER_AUDIT',
        details: 'Audited completed customer orders and matched settlement totals against payment records.',
        minutesAgo: 258
    },
    {
        userId: 'analyst-001',
        action: 'REPORT_EXPORTED',
        details: 'Exported weekly influencer performance report with reach, engagement, and revenue metrics.',
        minutesAgo: 325
    },
    {
        userId: 'community-001',
        action: 'PROFILE_CHECK',
        details: 'Checked reported influencer profiles for content quality and updated moderation notes.',
        minutesAgo: 420
    },
    {
        userId: 'finance-001',
        action: 'SETTLEMENT_CHECK',
        details: 'Compared pending brand settlements with completed orders before payment verification.',
        minutesAgo: 515
    },
    {
        userId: 'analyst-001',
        action: 'FUNNEL_REVIEW',
        details: 'Compared campaign click-through and cart conversion rates across customer shopping flows.',
        minutesAgo: 640
    }
];

/**
 * Seeds default admin users into the database.
 *
 * Roles and access:
 * - superadmin  : full access to all admin pages
 * - community   : Dashboard, UserManagement, FeedbackAndModeration
 * - finance     : Dashboard, CustomerManagement, PaymentVerification
 * - analyst     : Dashboard, AdvancedAnalytics, CollaborationMonitoring
 */
const initializeAdminUsers = async () => {
    const defaultAdmins = [
        {
            userId: 'superadmin-001',
            username: 'superadmin',
            password: 'Admin@123',
            role: 'superadmin'
        },
        {
            userId: 'community-001',
            username: 'community01',
            password: 'Community@123',
            role: 'community'
        },
        {
            userId: 'finance-001',
            username: 'finance01',
            password: 'Finance@123',
            role: 'finance'
        },
        {
            userId: 'analyst-001',
            username: 'analyst01',
            password: 'Analyst@123',
            role: 'analyst'
        }
    ];

    let created = 0;
    let skipped = 0;

    for (const adminData of defaultAdmins) {
        try {
            const existing = await Admin.findOne({ userId: adminData.userId });
            if (existing) {
                // Update role if it changed (handles re-seeding after role enum change)
                if (existing.role !== adminData.role) {
                    await Admin.updateOne({ userId: adminData.userId }, { role: adminData.role });
                    console.log(`🔄 Updated role for "${adminData.username}" to "${adminData.role}"`);
                }
                skipped++;
                continue;
            }

            const hashedPassword = await bcrypt.hash(adminData.password, 10);
            await Admin.create({
                userId: adminData.userId,
                username: adminData.username,
                password: hashedPassword,
                role: adminData.role
            });
            created++;
        } catch (error) {
            if (error.code === 11000) {
                skipped++;
            } else {
                console.error(`Error creating admin user "${adminData.username}":`, error.message);
            }
        }
    }

    if (created > 0) {
        console.log(`✅ Admin users seeded: ${created} created, ${skipped} already exist`);
    } else {
        console.log(`✅ Admin users already exist (${skipped} found)`);
    }

    console.log('🔐 Admin Credentials:');
    console.log('   superadmin   / Admin@123        (role: superadmin  — full access)');
    console.log('   community01  / Community@123    (role: community   — Dashboard, UserMgmt, Feedback)');
    console.log('   finance01    / Finance@123      (role: finance     — Dashboard, CustomerMgmt, Payment)');
    console.log('   analyst01    / Analyst@123      (role: analyst     — Dashboard, AdvancedAnalytics, Collab)');
};

const seedExistingSubAdminActivityLogs = async () => {
    const seedUserIds = [...new Set(SUB_ADMIN_ACTIVITY_SEED.map(entry => entry.userId))];
    const existingAdmins = await Admin.find(
        { userId: { $in: seedUserIds } },
        { userId: 1, username: 1, role: 1 }
    ).lean();

    const adminById = new Map(existingAdmins.map(admin => [admin.userId, admin]));
    const now = Date.now();

    const operations = SUB_ADMIN_ACTIVITY_SEED
        .map(entry => {
            const admin = adminById.get(entry.userId);
            if (!admin) return null;

            return {
                updateOne: {
                    filter: {
                        adminId: admin.userId,
                        action: entry.action,
                        details: entry.details,
                        ipAddress: SUB_ADMIN_ACTIVITY_SEED_SOURCE
                    },
                    update: {
                        $set: {
                            adminId: admin.userId,
                            username: admin.username,
                            role: admin.role,
                            action: entry.action,
                            details: entry.details,
                            ipAddress: SUB_ADMIN_ACTIVITY_SEED_SOURCE,
                            performedAt: new Date(now - entry.minutesAgo * 60 * 1000)
                        }
                    },
                    upsert: true
                }
            };
        })
        .filter(Boolean);

    if (operations.length === 0) {
        console.log('No existing sub-admin users found for activity seed. Skipping activity logs.');
        return { matchedUsers: 0, upserted: 0, updated: 0 };
    }

    const result = await AdminActivityLog.bulkWrite(operations, { ordered: false });
    const upserted = result.upsertedCount || 0;
    const updated = result.modifiedCount || 0;

    console.log(`Seeded sub-admin activity logs for ${existingAdmins.length} existing users (${upserted} inserted, ${updated} refreshed).`);

    return {
        matchedUsers: existingAdmins.length,
        upserted,
        updated
    };
};

module.exports = { initializeAdminUsers, seedExistingSubAdminActivityLogs };
