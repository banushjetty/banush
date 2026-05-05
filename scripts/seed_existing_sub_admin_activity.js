const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { connectDB, closeConnection } = require('../mongoDB');
const { seedExistingSubAdminActivityLogs } = require('../services/admin/adminSeedService');

const run = async () => {
    try {
        await connectDB();
        const result = await seedExistingSubAdminActivityLogs();

        console.log(
            `Sub-admin activity seed complete: ${result.matchedUsers} existing users, ` +
            `${result.upserted} inserted, ${result.updated} refreshed.`
        );
    } catch (error) {
        console.error('Failed to seed existing sub-admin activity logs:', error.message);
        process.exitCode = 1;
    } finally {
        await closeConnection();
    }
};

run();
