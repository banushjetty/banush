const mongoose = require('mongoose');

/**
 * AdminActivityLog
 * ----------------
 * Stores a lightweight record every time a sub-admin performs a
 * meaningful action (login, page view, data mutation, etc.).
 *
 * The middleware/controller that handles each action is responsible
 * for calling AdminActivityLog.log(adminId, role, action, details).
 */
const adminActivityLogSchema = new mongoose.Schema({
    adminId: {
        type: String,
        required: true,
        index: true
    },
    username: {
        type: String,
        required: true
    },
    role: {
        type: String,
        required: true,
        enum: ['superadmin', 'community', 'finance', 'analyst']
    },
    action: {
        type: String,
        required: true,
        // e.g.  'LOGIN', 'VIEW_DASHBOARD', 'APPROVE_USER', 'UPDATE_PAYMENT', etc.
    },
    details: {
        type: String,
        default: ''
        // Human-readable description: "Approved brand XYZ", "Marked payment #123 as verified"
    },
    ipAddress: {
        type: String,
        default: ''
    },
    performedAt: {
        type: Date,
        default: Date.now,
        index: true
    }
}, {
    collection: 'adminActivityLogs',
    timestamps: false  // we use performedAt instead
});

// Convenience static so controllers can call: await AdminActivityLog.log(...)
adminActivityLogSchema.statics.log = async function (adminId, username, role, action, details = '', ipAddress = '') {
    try {
        await this.create({ adminId, username, role, action, details, ipAddress });
    } catch (err) {
        // Logging should never crash the app
        console.error('[ActivityLog] Failed to write log entry:', err.message);
    }
};

const AdminActivityLog = mongoose.models.AdminActivityLog
    || mongoose.model('AdminActivityLog', adminActivityLogSchema);

module.exports = { AdminActivityLog };
