const {
    getSubAdminPanelData,
    getPaginatedSubAdminActivity
} = require('../../services/admin/adminSubAdminService');

const AdminSubAdminController = {
    /**
     * GET /admin/sub-admins
     * Returns all sub-admin accounts with counts, permissions, and recent activity.
     * Restricted to superadmin role only.
     */
    async getSubAdminPanel(req, res) {
        try {
            // Only superadmin can access this endpoint
            if (req.user?.role !== 'superadmin') {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied: superadmin only'
                });
            }

            const data = await getSubAdminPanelData();

            return res.status(200).json({
                success: true,
                ...data
            });
        } catch (error) {
            console.error('[AdminSubAdminController] Error fetching sub-admin panel data:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to load sub-admin data',
                error: error.message
            });
        }
    },

    /**
     * GET /admin/sub-admins/activity
     * Returns paginated sub-admin activity history.
     * Restricted to superadmin role only.
     */
    async getSubAdminActivity(req, res) {
        try {
            if (req.user?.role !== 'superadmin') {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied: superadmin only'
                });
            }

            const data = await getPaginatedSubAdminActivity(req.query);

            return res.status(200).json({
                success: true,
                ...data
            });
        } catch (error) {
            console.error('[AdminSubAdminController] Error fetching sub-admin activity:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to load sub-admin activity',
                error: error.message
            });
        }
    }
};

module.exports = AdminSubAdminController;
