import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../../services/api';
import styles from '../../styles/admin/SubAdminPanel.module.css';

const ROLE_META = {
    finance: {
        label: 'Finance Manager',
        icon: '💰',
        accentColor: '#4ade80',
        badgeClass: 'finance'
    },
    analyst: {
        label: 'Data Analyst',
        icon: '📊',
        accentColor: '#60a5fa',
        badgeClass: 'analyst'
    },
    community: {
        label: 'Community Manager',
        icon: '👥',
        accentColor: '#a78bfa',
        badgeClass: 'community'
    }
};

function timeAgo(dateStr) {
    if (!dateStr) return 'Never';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}

export default function SubAdminPanel({ currentUserRole }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('overview');
    const [expandedUser, setExpandedUser] = useState(null);

    useEffect(() => {
        if (currentUserRole !== 'superadmin') return;
        fetchSubAdminData();
        const refreshId = setInterval(() => fetchSubAdminData({ silent: true }), 30000);

        return () => clearInterval(refreshId);
    }, [currentUserRole]);

    const fetchSubAdminData = async ({ silent = false } = {}) => {
        try {
            if (!silent) setLoading(true);
            const res = await fetch(`${API_BASE_URL}/admin/sub-admins`, {
                headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
                credentials: 'include'
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            if (json.success) {
                setData(json);
                setError(null);
            }
            else throw new Error(json.message || 'Failed to load');
        } catch (err) {
            setError(err.message);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    // Only render for superadmin
    if (currentUserRole !== 'superadmin') return null;

    return (
        <section className={styles.panel}>
            {/* ── Header ── */}
            <div className={styles.panelHeader}>
                <div className={styles.titleGroup}>
                    <span className={styles.titleIcon}>🛡️</span>
                    <div>
                        <h2 className={styles.panelTitle}>Sub-Admin Management</h2>
                        <p className={styles.panelSubtitle}>
                            Monitor all sub-admin accounts, their roles, permissions and recent activity
                        </p>
                    </div>
                </div>
                <div className={styles.headerRight}>
                    <span className={styles.superadminBadge}>Superadmin View</span>
                    <Link className={styles.viewAllLink} to="/admin/sub-admin-activity">
                        View Full Activity
                    </Link>
                    <button className={styles.refreshBtn} onClick={fetchSubAdminData} title="Refresh">
                        🔄 Refresh
                    </button>
                </div>
            </div>

            {loading && (
                <div className={styles.loadingState}>
                    <div className={styles.spinner} />
                    <p>Loading sub-admin data…</p>
                </div>
            )}

            {error && (
                <div className={styles.errorState}>
                    <span>⚠️ {error}</span>
                    <button onClick={fetchSubAdminData}>Retry</button>
                </div>
            )}

            {data && !loading && (
                <>
                    {/* ── Count Summary Cards ── */}
                    <div className={styles.countGrid}>
                        <div className={styles.countCard + ' ' + styles.totalCard}>
                            <span className={styles.countNumber}>{data.totalSubAdmins}</span>
                            <span className={styles.countLabel}>Total Sub-Admins</span>
                        </div>
                        {Object.entries(data.counts).map(([role, count]) => (
                            <div
                                key={role}
                                className={`${styles.countCard} ${styles[role + 'Card']}`}
                                style={{ '--accent': ROLE_META[role]?.accentColor }}
                            >
                                <span className={styles.countIcon}>{ROLE_META[role]?.icon}</span>
                                <span className={styles.countNumber}>{count}</span>
                                <span className={styles.countLabel}>{ROLE_META[role]?.label}</span>
                            </div>
                        ))}
                    </div>

                    {/* ── Tabs ── */}
                    <div className={styles.tabs}>
                        {['overview', 'activity'].map(tab => (
                            <button
                                key={tab}
                                className={`${styles.tab} ${activeTab === tab ? styles.activeTab : ''}`}
                                onClick={() => setActiveTab(tab)}
                            >
                                {tab === 'overview' ? '👤 Role Overview' : '📋 Recent Activity'}
                            </button>
                        ))}
                    </div>

                    {/* ── OVERVIEW TAB: one card per role ── */}
                    {activeTab === 'overview' && (
                        <div className={styles.rolesGrid}>
                            {Object.values(data.roles).map(roleData => {
                                const meta = ROLE_META[roleData.role];
                                return (
                                    <div
                                        key={roleData.role}
                                        className={styles.roleCard}
                                        style={{ '--accent': meta.accentColor }}
                                    >
                                        {/* Card Header */}
                                        <div className={styles.roleCardHeader}>
                                            <div className={styles.roleAvatar} style={{ background: roleData.gradient }}>
                                                {meta.icon}
                                            </div>
                                            <div>
                                                <h3 className={styles.roleCardTitle}>{meta.label}</h3>
                                                <span className={`${styles.roleBadge} ${styles[meta.badgeClass + 'Badge']}`}>
                                                    {roleData.role}
                                                </span>
                                            </div>
                                            <div className={styles.userCountBubble}>{roleData.count} user{roleData.count !== 1 ? 's' : ''}</div>
                                        </div>

                                        {/* Users List */}
                                        <div className={styles.usersList}>
                                            {roleData.users.length === 0 ? (
                                                <p className={styles.noUsers}>No users in this role</p>
                                            ) : (
                                                roleData.users.map(user => (
                                                    <div key={user.userId} className={styles.userRow}>
                                                        <div className={styles.userRowLeft}>
                                                            <div className={styles.userAvatar}>{user.username[0].toUpperCase()}</div>
                                                            <div>
                                                                <div className={styles.userName}>{user.username}</div>
                                                                <div className={styles.userId}>ID: {user.userId}</div>
                                                            </div>
                                                        </div>
                                                        <div className={styles.userRowRight}>
                                                            <div className={styles.userMeta}>
                                                                Joined {timeAgo(user.createdAt)}
                                                            </div>
                                                            <button
                                                                className={styles.activityToggle}
                                                                onClick={() => setExpandedUser(
                                                                    expandedUser === user.userId ? null : user.userId
                                                                )}
                                                            >
                                                                {expandedUser === user.userId ? '▲ Hide' : '▼ Activity'}
                                                            </button>
                                                        </div>
                                                        {/* Inline Activity for this user */}
                                                        {expandedUser === user.userId && (
                                                            <div className={styles.inlineActivity}>
                                                                {user.recentActivity.length === 0 ? (
                                                                    <p className={styles.noActivity}>No activity recorded yet</p>
                                                                ) : (
                                                                    <>
                                                                        <div className={styles.activitySummary}>
                                                                            Showing {user.recentActivity.length} recent of {user.recentActivityCount || user.recentActivity.length} activities
                                                                        </div>
                                                                        <ul className={styles.activityList}>
                                                                            {user.recentActivity.map((log, i) => (
                                                                                <li key={i} className={styles.activityItem}>
                                                                                    <span className={styles.activityDot} />
                                                                                    <div className={styles.activityContent}>
                                                                                        <span className={styles.activityAction}>{log.action}</span>
                                                                                        {log.details && (
                                                                                            <span className={styles.activityDetails}> — {log.details}</span>
                                                                                        )}
                                                                                    </div>
                                                                                    <span className={styles.activityTime}>{timeAgo(log.performedAt)}</span>
                                                                                </li>
                                                                            ))}
                                                                        </ul>
                                                                    </>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))
                                            )}
                                        </div>

                                        {/* Permissions */}
                                        <div className={styles.permissionsSection}>
                                            <div className={styles.permCol}>
                                                <h4 className={styles.permTitle}>✅ Can do</h4>
                                                <ul className={styles.permList}>
                                                    {(roleData.permitted || []).map((p, i) => (
                                                        <li key={i}>{p}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                            <div className={styles.permCol}>
                                                <h4 className={`${styles.permTitle} ${styles.restrictedTitle}`}>🚫 Cannot do</h4>
                                                <ul className={`${styles.permList} ${styles.restrictedList}`}>
                                                    {(roleData.restricted || []).map((r, i) => (
                                                        <li key={i}>{r}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* ── ACTIVITY TAB: timeline of all recent changes ── */}
                    {activeTab === 'activity' && (
                        <div className={styles.activityTimeline}>
                            <div className={styles.timelineHeader}>
                                <h3 className={styles.timelineTitle}>Recent Changes Across All Sub-Admins</h3>
                                <span className={styles.timelineCount}>
                                    Showing {data.recentActivity.length} recent of {data.recentActivityCount || data.recentActivity.length}
                                </span>
                            </div>
                            {data.recentActivity.length === 0 ? (
                                <div className={styles.emptyActivity}>
                                    <span>📭</span>
                                    <p>No activity recorded yet. Activity will appear here once sub-admins log in and perform actions.</p>
                                </div>
                            ) : (
                                <div className={styles.timeline}>
                                    {data.recentActivity.map((log, i) => {
                                        const meta = ROLE_META[log.role] || {};
                                        return (
                                            <div key={i} className={styles.timelineItem}>
                                                <div
                                                    className={styles.timelineDot}
                                                    style={{ background: meta.accentColor || '#6366f1' }}
                                                >
                                                    {meta.icon || '👤'}
                                                </div>
                                                <div className={styles.timelineContent}>
                                                    <div className={styles.timelineTop}>
                                                        <span className={styles.timelineUser}>{log.username}</span>
                                                        <span
                                                            className={styles.timelineRole}
                                                            style={{ color: meta.accentColor }}
                                                        >
                                                            {meta.label || log.role}
                                                        </span>
                                                        <span className={styles.timelineTime}>{timeAgo(log.performedAt)}</span>
                                                    </div>
                                                    <div className={styles.timelineAction}>
                                                        <span className={styles.actionBadge}>{log.action}</span>
                                                        {log.details && <span className={styles.timelineDetails}>{log.details}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Quick Reference Table ── */}
                    <div className={styles.referenceTable}>
                        <h3 className={styles.tableTitle}>📋 Permissions Quick Reference</h3>
                        <div className={styles.tableWrapper}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Permission</th>
                                        <th>💰 Finance</th>
                                        <th>📊 Analyst</th>
                                        <th>👥 Community</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[
                                        ['Dashboard Overview',          true,  true,  true],
                                        ['User Management',             false, false, true],
                                        ['Feedback & Moderation',       false, false, true],
                                        ['Payment Verification',        true,  false, false],
                                        ['Customer Management',         true,  false, false],
                                        ['Order Analytics',             true,  false, false],
                                        ['Collaboration Monitoring',    false, true,  false],
                                        ['Brand Analytics',             false, true,  false],
                                        ['Influencer Analytics',        false, true,  false],
                                        ['Campaign Analytics',          false, true,  false],
                                        ['Admin Settings',              false, false, false],
                                    ].map(([perm, fin, ana, com], i) => (
                                        <tr key={i}>
                                            <td>{perm}</td>
                                            <td><span className={fin ? styles.yes : styles.no}>{fin ? '✅' : '❌'}</span></td>
                                            <td><span className={ana ? styles.yes : styles.no}>{ana ? '✅' : '❌'}</span></td>
                                            <td><span className={com ? styles.yes : styles.no}>{com ? '✅' : '❌'}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </section>
    );
}
