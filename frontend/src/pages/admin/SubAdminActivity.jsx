import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AdminNavbar from '../../components/admin/AdminNavbar';
import { API_BASE_URL } from '../../services/api';
import adminStyles from '../../styles/admin/admin_dashboard.module.css';
import styles from '../../styles/admin/SubAdminActivity.module.css';

const DEFAULT_META = {
    totalDocs: 0,
    currentPage: 1,
    totalPages: 1,
    limit: 10,
    hasNextPage: false,
    hasPrevPage: false
};

const DEFAULT_FILTERS = {
    role: '',
    action: '',
    search: '',
    limit: 10
};

const ROLE_META = {
    community: {
        label: 'Community Manager',
        icon: 'fas fa-users',
        className: 'community'
    },
    finance: {
        label: 'Finance Manager',
        icon: 'fas fa-wallet',
        className: 'finance'
    },
    analyst: {
        label: 'Data Analyst',
        icon: 'fas fa-chart-line',
        className: 'analyst'
    }
};

function formatDate(value) {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'N/A';

    return new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short'
    }).format(date);
}

function formatTimeAgo(value) {
    if (!value) return 'No timestamp';
    const timestamp = new Date(value).getTime();
    if (Number.isNaN(timestamp)) return 'No timestamp';

    const diffMs = Math.max(Date.now() - timestamp, 0);
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;

    const months = Math.floor(days / 30);
    return `${months}mo ago`;
}

function formatActionLabel(action) {
    if (!action) return 'Unknown action';

    return String(action)
        .split('_')
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');
}

function getActionTone(action = '') {
    if (action.includes('DELETE') || action.includes('LOGOUT')) return 'dangerAction';
    if (action.includes('UPDATE') || action.includes('APPROVE') || action.includes('RESET')) return 'successAction';
    if (action.includes('PAYMENT') || action.includes('ORDER')) return 'financeAction';
    if (action.includes('ANALYTICS') || action.includes('REPORT') || action.includes('ROI')) return 'analyticsAction';
    return 'viewAction';
}

function getInitials(value = 'Admin') {
    const parts = String(value)
        .trim()
        .split(/[\s._-]+/)
        .filter(Boolean);

    const initials = parts.slice(0, 2).map(part => part[0]?.toUpperCase()).join('');
    return initials || 'A';
}

export default function SubAdminActivity() {
    const [user, setUser] = useState({ name: 'Admin' });
    const [notifications, setNotifications] = useState([]);
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [meta, setMeta] = useState(DEFAULT_META);
    const [filterOptions, setFilterOptions] = useState({ roles: [], actions: [] });
    const [filters, setFilters] = useState(DEFAULT_FILTERS);
    const [page, setPage] = useState(1);

    const queryString = useMemo(() => {
        const params = new URLSearchParams({
            page: String(page),
            limit: String(filters.limit)
        });

        if (filters.role) params.set('role', filters.role);
        if (filters.action) params.set('action', filters.action);
        if (filters.search.trim()) params.set('search', filters.search.trim());

        return params.toString();
    }, [page, filters.role, filters.action, filters.search, filters.limit]);

    const fetchUserData = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/admin/verify`, {
                headers: { Accept: 'application/json' },
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                if (data.authenticated) setUser(data.user);
            }
        } catch (err) {
            console.error('Error fetching admin user:', err);
        }
    }, []);

    const fetchNotifications = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/admin/notifications`, {
                headers: { Accept: 'application/json' },
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) setNotifications(data.notifications || []);
            }
        } catch (err) {
            console.error('Error fetching notifications:', err);
        }
    }, []);

    const fetchActivities = useCallback(async () => {
        try {
            setLoading(true);
            setError('');

            const response = await fetch(`${API_BASE_URL}/admin/sub-admins/activity?${queryString}`, {
                headers: { Accept: 'application/json' },
                credentials: 'include'
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            if (!data.success) throw new Error(data.message || 'Failed to load activity');

            setActivities(data.activities || []);
            setMeta(data.meta || DEFAULT_META);
            setFilterOptions(data.filters || { roles: [], actions: [] });
        } catch (err) {
            setActivities([]);
            setError(err.message || 'Failed to load activity');
        } finally {
            setLoading(false);
        }
    }, [queryString]);

    useEffect(() => {
        fetchUserData();
        fetchNotifications();
    }, [fetchUserData, fetchNotifications]);

    useEffect(() => {
        fetchActivities();
    }, [fetchActivities]);

    const updateFilter = (key, value) => {
        setFilters(current => ({ ...current, [key]: value }));
        setPage(1);
    };

    const clearFilters = () => {
        setFilters(DEFAULT_FILTERS);
        setPage(1);
    };

    const firstItem = meta.totalDocs === 0 ? 0 : (meta.currentPage - 1) * meta.limit + 1;
    const lastItem = Math.min(meta.currentPage * meta.limit, meta.totalDocs);
    const activeFilterCount = [
        filters.role,
        filters.action,
        filters.search.trim(),
        filters.limit !== DEFAULT_FILTERS.limit ? filters.limit : ''
    ].filter(Boolean).length;
    const hasActiveFilters = activeFilterCount > 0;
    const rolesTracked = filterOptions.roles.length || Object.keys(ROLE_META).length;
    const latestActivity = activities[0]?.performedAt ? formatTimeAgo(activities[0].performedAt) : 'No records yet';

    return (
        <AdminNavbar user={user} notifications={notifications}>
            <main className={adminStyles.mainContent}>
                <section className={styles.page} aria-labelledby="sub-admin-activity-title">
                    <header className={styles.hero}>
                        <div className={styles.heroCopy}>
                            <span className={styles.eyebrow}>
                                <i className="fas fa-shield-alt" aria-hidden="true"></i>
                                Superadmin audit console
                            </span>
                            <h1 id="sub-admin-activity-title">Sub-Admin Activity</h1>
                            <p>Monitor every tracked action from community, finance, and analyst admin accounts.</p>
                        </div>

                        <div className={styles.heroActions}>
                            <span className={styles.livePill}>
                                <span className={styles.liveDot}></span>
                                Live audit trail
                            </span>
                            <button
                                type="button"
                                className={styles.refreshButton}
                                onClick={fetchActivities}
                                disabled={loading}
                            >
                                <i className={`fas fa-sync-alt ${loading ? styles.spin : ''}`} aria-hidden="true"></i>
                                {loading ? 'Refreshing' : 'Refresh'}
                            </button>
                        </div>
                    </header>

                    <div className={styles.summaryGrid}>
                        <article className={`${styles.summaryCard} ${styles.totalCard}`}>
                            <span className={styles.summaryIcon}><i className="fas fa-list-check" aria-hidden="true"></i></span>
                            <div>
                                <strong>{meta.totalDocs.toLocaleString('en-IN')}</strong>
                                <span>Total activities</span>
                            </div>
                        </article>

                        <article className={`${styles.summaryCard} ${styles.visibleCard}`}>
                            <span className={styles.summaryIcon}><i className="fas fa-eye" aria-hidden="true"></i></span>
                            <div>
                                <strong>{firstItem}-{lastItem}</strong>
                                <span>Visible records</span>
                            </div>
                        </article>

                        <article className={`${styles.summaryCard} ${styles.rolesCard}`}>
                            <span className={styles.summaryIcon}><i className="fas fa-user-shield" aria-hidden="true"></i></span>
                            <div>
                                <strong>{filters.role ? ROLE_META[filters.role]?.label || filters.role : rolesTracked}</strong>
                                <span>{filters.role ? 'Role in focus' : 'Roles tracked'}</span>
                            </div>
                        </article>

                        <article className={`${styles.summaryCard} ${styles.latestCard}`}>
                            <span className={styles.summaryIcon}><i className="fas fa-clock" aria-hidden="true"></i></span>
                            <div>
                                <strong>{latestActivity}</strong>
                                <span>Latest on this page</span>
                            </div>
                        </article>
                    </div>

                    <section className={styles.filterPanel} aria-label="Activity filters">
                        <div className={styles.filterHeader}>
                            <div>
                                <h2>Refine Activity</h2>
                                <p>{activeFilterCount} filter{activeFilterCount === 1 ? '' : 's'} active</p>
                            </div>
                            <button
                                type="button"
                                className={styles.secondaryButton}
                                onClick={clearFilters}
                                disabled={!hasActiveFilters || loading}
                            >
                                Clear
                            </button>
                        </div>

                        <div className={styles.filters}>
                            <div className={styles.filterControl}>
                                <label htmlFor="activity-role">Role</label>
                                <div className={styles.fieldShell}>
                                    <i className="fas fa-user-tag" aria-hidden="true"></i>
                                    <select
                                        id="activity-role"
                                        value={filters.role}
                                        onChange={(e) => updateFilter('role', e.target.value)}
                                    >
                                        <option value="">All roles</option>
                                        {filterOptions.roles.map(role => (
                                            <option key={role} value={role}>{ROLE_META[role]?.label || role}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className={styles.filterControl}>
                                <label htmlFor="activity-action">Action</label>
                                <div className={styles.fieldShell}>
                                    <i className="fas fa-bolt" aria-hidden="true"></i>
                                    <select
                                        id="activity-action"
                                        value={filters.action}
                                        onChange={(e) => updateFilter('action', e.target.value)}
                                    >
                                        <option value="">All actions</option>
                                        {filterOptions.actions.map(action => (
                                            <option key={action} value={action}>{formatActionLabel(action)}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className={`${styles.filterControl} ${styles.searchControl}`}>
                                <label htmlFor="activity-search">Search</label>
                                <div className={styles.fieldShell}>
                                    <i className="fas fa-magnifying-glass" aria-hidden="true"></i>
                                    <input
                                        id="activity-search"
                                        type="search"
                                        value={filters.search}
                                        onChange={(e) => updateFilter('search', e.target.value)}
                                        placeholder="Username, action, or details"
                                        autoComplete="off"
                                    />
                                </div>
                            </div>

                            <div className={styles.filterControl}>
                                <label htmlFor="activity-limit">Rows</label>
                                <div className={styles.fieldShell}>
                                    <i className="fas fa-table" aria-hidden="true"></i>
                                    <select
                                        id="activity-limit"
                                        value={filters.limit}
                                        onChange={(e) => updateFilter('limit', Number(e.target.value))}
                                    >
                                        <option value={10}>10 rows</option>
                                        <option value={25}>25 rows</option>
                                        <option value={50}>50 rows</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </section>

                    {error && (
                        <div className={styles.error} role="alert">
                            <i className="fas fa-circle-exclamation" aria-hidden="true"></i>
                            <span>{error}</span>
                            <button type="button" onClick={fetchActivities}>Retry</button>
                        </div>
                    )}

                    <section className={styles.tableCard} aria-live="polite">
                        <div className={styles.tableHeader}>
                            <div>
                                <h2>Activity Timeline</h2>
                                <p>Showing {firstItem}-{lastItem} of {meta.totalDocs.toLocaleString('en-IN')} records</p>
                            </div>
                            {hasActiveFilters && (
                                <span className={styles.filterBadge}>
                                    <i className="fas fa-filter" aria-hidden="true"></i>
                                    Filtered
                                </span>
                            )}
                        </div>

                        <div className={styles.tableWrap}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Time</th>
                                        <th>Admin</th>
                                        <th>Role</th>
                                        <th>Action</th>
                                        <th>Details</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        Array.from({ length: Math.min(Number(filters.limit) || 10, 6) }).map((_, index) => (
                                            <tr key={`skeleton-${index}`} className={styles.skeletonRow}>
                                                <td><span className={styles.skeletonLine}></span></td>
                                                <td><span className={styles.skeletonLine}></span></td>
                                                <td><span className={styles.skeletonPill}></span></td>
                                                <td><span className={styles.skeletonPill}></span></td>
                                                <td><span className={styles.skeletonLine}></span></td>
                                            </tr>
                                        ))
                                    ) : activities.length === 0 ? (
                                        <tr>
                                            <td colSpan="5">
                                                <div className={styles.emptyState}>
                                                    <span><i className="fas fa-inbox" aria-hidden="true"></i></span>
                                                    <strong>No activity found</strong>
                                                    <p>Try clearing filters or refreshing the audit log.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        activities.map(activity => {
                                            const role = ROLE_META[activity.role] || {
                                                label: activity.role || 'Unknown role',
                                                icon: 'fas fa-user-shield',
                                                className: ''
                                            };
                                            const actionTone = getActionTone(activity.action);

                                            return (
                                                <tr key={activity._id}>
                                                    <td>
                                                        <div className={styles.timeCell}>
                                                            <strong>{formatDate(activity.performedAt)}</strong>
                                                            <span>{formatTimeAgo(activity.performedAt)}</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className={styles.adminProfile}>
                                                            <span className={styles.adminAvatar}>{getInitials(activity.username)}</span>
                                                            <div className={styles.adminCell}>
                                                                <span>{activity.username || 'Unknown admin'}</span>
                                                                <small>{activity.adminId || 'No admin ID'}</small>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className={`${styles.roleBadge} ${styles[role.className] || ''}`}>
                                                            <i className={role.icon} aria-hidden="true"></i>
                                                            {role.label}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div className={styles.actionCell}>
                                                            <span className={`${styles.actionBadge} ${styles[actionTone]}`}>
                                                                {formatActionLabel(activity.action)}
                                                            </span>
                                                            <small>{activity.action || 'UNKNOWN'}</small>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className={styles.details}>
                                                            <span>{activity.details || 'No additional details recorded.'}</span>
                                                            {activity.ipAddress && <small>IP {activity.ipAddress}</small>}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <footer className={styles.pagination}>
                        <div className={styles.paginationSummary}>
                            <strong>Page {meta.currentPage}</strong>
                            <span>of {meta.totalPages}</span>
                        </div>

                        <div className={styles.paginationControls}>
                            <button
                                type="button"
                                onClick={() => setPage(1)}
                                disabled={!meta.hasPrevPage || loading}
                                aria-label="First page"
                            >
                                <i className="fas fa-angles-left" aria-hidden="true"></i>
                                First
                            </button>
                            <button
                                type="button"
                                onClick={() => setPage(current => Math.max(current - 1, 1))}
                                disabled={!meta.hasPrevPage || loading}
                                aria-label="Previous page"
                            >
                                <i className="fas fa-angle-left" aria-hidden="true"></i>
                                Previous
                            </button>
                            <button
                                type="button"
                                onClick={() => setPage(current => current + 1)}
                                disabled={!meta.hasNextPage || loading}
                                aria-label="Next page"
                            >
                                Next
                                <i className="fas fa-angle-right" aria-hidden="true"></i>
                            </button>
                            <button
                                type="button"
                                onClick={() => setPage(meta.totalPages)}
                                disabled={!meta.hasNextPage || loading}
                                aria-label="Last page"
                            >
                                Last
                                <i className="fas fa-angles-right" aria-hidden="true"></i>
                            </button>
                        </div>
                    </footer>
                </section>
            </main>
        </AdminNavbar>
    );
}
