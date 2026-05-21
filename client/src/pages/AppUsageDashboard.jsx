import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { TrendingUp, Clock, PieChart as PieChartIcon, Users as UsersIcon, Globe, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import UserSearchSelect from '@/components/UserSearchSelect';
import DateFromToPicker from '@/components/DateFromToPicker';
import { getTodayInTimezone } from '@/lib/dateUtils';
import { format, subDays, parseISO } from 'date-fns';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import useAuthStore from '@/lib/useAuthStore';

const COLORS = {
    productive: '#10b981',
    non_productive: '#ef4444',
    neutral: '#6b7280'
};

const BROWSER_MAP = {
    chrome: ['chrome.exe', 'chrome', 'google-chrome', 'google-chrome-stable', 'google chrome'],
    edge: ['msedge.exe', 'msedge', 'microsoft-edge', 'microsoft edge'],
    brave: ['brave.exe', 'brave', 'brave-browser', 'brave browser'],
    opera: ['opera.exe', 'opera', 'opera internet browser', 'opera browser', 'opera gx'],
    firefox: ['firefox.exe', 'firefox', 'mozilla firefox'],
    vivaldi: ['vivaldi.exe', 'vivaldi'],
    arc: ['arc.exe', 'arc'],
    chromium: ['chromium.exe', 'chromium', 'chromium-browser'],
    waterfox: ['waterfox.exe', 'waterfox'],
    librewolf: ['librewolf.exe', 'librewolf'],
    duckduckgo: ['duckduckgo.exe', 'duckduckgo'],
    whale: ['whale.exe', 'whale'],
    yandex: ['yandex.exe', 'browser.exe', 'yandex browser'],
    maxthon: ['maxthon.exe', 'maxthon'],
    tor: ['tor browser', 'tor'],
    floorp: ['floorp.exe', 'floorp'],
    samsung: ['samsung internet'],
};

function isBrowserApp(executableName) {
    if (!executableName) return false;
    const lower = executableName.toLowerCase().trim();
    return Object.values(BROWSER_MAP).some(patterns =>
        patterns.some(b => lower === b || lower.includes(b))
    );
}

function getBrowserKey(executableName) {
    if (!executableName) return null;
    const lower = executableName.toLowerCase().trim();
    for (const [key, patterns] of Object.entries(BROWSER_MAP)) {
        if (patterns.some(b => lower === b || lower.includes(b))) return key;
    }
    return null;
}

export default function AppUsageDashboard() {
    const { user, isAuthenticated } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState({ start_date: '', end_date: '' });

    useEffect(() => {
        if (!user) return;
        const tz = user.org_timezone || user.timezone || 'UTC';
        const end = getTodayInTimezone(tz);
        const anchor = parseISO(`${end}T12:00:00.000Z`);
        setDateRange({
            start_date: format(subDays(anchor, 7), 'yyyy-MM-dd'),
            end_date: end,
        });
    }, [user?.org_id, user?.org_timezone, user?.timezone]);
    const [dashboardData, setDashboardData] = useState(null);
    const [productivityData, setProductivityData] = useState([]);
    const [error, setError] = useState(null);

    // For Manager/Admin: user selection
    const [availableUsers, setAvailableUsers] = useState([]);
    const [selectedUserId, setSelectedUserId] = useState(null);

    // Browser activity drill-down
    const [expandedBrowser, setExpandedBrowser] = useState(null);
    const [browserDomains, setBrowserDomains] = useState([]);
    const [browserDomainsLoading, setBrowserDomainsLoading] = useState(false);

    useEffect(() => {
        if (!isAuthenticated || !user) {
            setError('Please login to view app usage data');
            setLoading(false);
            return;
        }

        // For regular users, show their own data
        if (user.role === 'user') {
            setSelectedUserId(user.id);
        } else {
            // For Manager/Admin, fetch list of users they can view
            fetchAvailableUsers();
        }
    }, [user, isAuthenticated]);

    useEffect(() => {
        if (selectedUserId && dateRange.start_date && dateRange.end_date) {
            fetchDashboardData(selectedUserId);
        }
    }, [dateRange, selectedUserId]);

    const fetchAvailableUsers = async () => {
        try {
            const response = await api.get('/users');
            const users = response.data;

            setAvailableUsers(users);

            // Auto-select first user or current user
            if (users.length > 0) {
                const defaultUser = users.find(u => u.id === user.id) || users[0];
                setSelectedUserId(defaultUser.id);
            } else {
                setError('No users found');
                setLoading(false);
            }
        } catch (error) {
            setError('Failed to load users list');
            setLoading(false);
        }
    };

    const fetchDashboardData = async (userId) => {
        setLoading(true);
        setError(null);
        setExpandedBrowser(null);
        setBrowserDomains([]);

        try {
            const [dashboardRes, productivityRes] = await Promise.all([
                api.get(`/app-tracking/reports/user/${userId}?start_date=${dateRange.start_date}&end_date=${dateRange.end_date}`),
                api.get(`/app-tracking/reports/productivity/${userId}?start_date=${dateRange.start_date}&end_date=${dateRange.end_date}`)
            ]);

            setDashboardData(dashboardRes.data);
            setProductivityData(productivityRes.data);
        } catch (error) {
            let errorMessage = 'Failed to load dashboard data';
            if (error.response?.status === 403) {
                errorMessage = 'You do not have permission to view this data.';
            } else if (error.response?.data?.error) {
                errorMessage = error.response.data.error;
            }

            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const fetchBrowserDomains = async (appIndex, executableName) => {
        if (expandedBrowser === appIndex) {
            setExpandedBrowser(null);
            setBrowserDomains([]);
            return;
        }

        setBrowserDomainsLoading(true);
        setExpandedBrowser(appIndex);

        try {
            const browserKey = getBrowserKey(executableName);
            let url = `/app-tracking/reports/browser-activity/${selectedUserId}?start_date=${dateRange.start_date}&end_date=${dateRange.end_date}`;
            if (browserKey) url += `&browser=${browserKey}`;

            const res = await api.get(url);
            setBrowserDomains(res.data.domains || []);
        } catch (err) {
            console.error('Failed to fetch browser domains:', err);
            setBrowserDomains([]);
            toast.error('Failed to load browser activity details');
        } finally {
            setBrowserDomainsLoading(false);
        }
    };

    const formatTime = (seconds) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${minutes}m`;
    };

    const getTotalSeconds = () => {
        const summaryTotal = dashboardData?.summary?.length
            ? dashboardData.summary.reduce((sum, day) => sum + (Number(day.total_working_seconds) || 0), 0)
            : 0;

        if (summaryTotal > 0) return summaryTotal;

        // Fallback when user_app_summary is not populated yet.
        const liveTotal = dashboardData?.live_summary?.length
            ? dashboardData.live_summary.reduce((sum, item) => sum + (Number(item.total_seconds) || 0), 0)
            : 0;
        if (liveTotal > 0) return liveTotal;

        // Last fallback: derive from top apps if available.
        const topAppsTotal = dashboardData?.top_apps?.length
            ? dashboardData.top_apps.reduce((sum, app) => sum + (Number(app.total_seconds) || 0), 0)
            : 0;
        return topAppsTotal;
    };

    const getProductivityPieData = () => {
        // Use live_summary if available (calculated from logs), otherwise fallback to daily summary
        if (dashboardData?.live_summary?.length > 0) {
            return dashboardData.live_summary.map(item => ({
                name: (item.productivity_type || 'neutral').split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
                value: parseInt(item.total_seconds),
                color: COLORS[item.productivity_type] || COLORS.neutral
            })).filter(item => item.value > 0);
        }

        if (!dashboardData?.summary?.length) return [];

        const totals = dashboardData.summary.reduce((acc, day) => ({
            productive: acc.productive + (day.total_productive_seconds || 0),
            non_productive: acc.non_productive + (day.total_non_productive_seconds || 0),
            neutral: acc.neutral + (day.total_neutral_seconds || 0)
        }), { productive: 0, non_productive: 0, neutral: 0 });

        return [
            { name: 'Productive', value: totals.productive, color: COLORS.productive },
            { name: 'Non-Productive', value: totals.non_productive, color: COLORS.non_productive },
            { name: 'Neutral', value: totals.neutral, color: COLORS.neutral }
        ].filter(item => item.value > 0);
    };

    const getCategoryBarData = () => {
        return productivityData.map(cat => ({
            name: cat.category_name || 'Uncategorized',
            seconds: cat.total_seconds,
            hours: (cat.total_seconds / 3600).toFixed(1)
        }));
    };

    if (error) {
        return (
            <div className="flex items-center justify-center h-64 border rounded-lg bg-card mt-6">
                <div className="text-center p-6">
                    <div className="text-destructive text-lg font-semibold mb-2">{error}</div>
                    <p className="text-muted-foreground mb-6">Check the browser console (F12) for more details</p>
                    <button
                        onClick={() => window.location.href = '/login'}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                    >
                        Go to Login
                    </button>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64 border rounded-lg bg-card mt-6">
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <span>Loading dashboard...</span>
                </div>
            </div>
        );
    }

    const pieData = getProductivityPieData();
    const barData = getCategoryBarData();

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">App Usage Dashboard</h1>
                    <p className="text-muted-foreground mt-1">Track your application usage and productivity</p>
                </div>
                <div className="flex gap-4 items-center">
                    {/* User Selector for Manager/Admin */}
                    {(user.role === 'orgadmin' || user.role === 'manager') && availableUsers.length > 0 && (
                        <div className="flex items-center gap-2">
                            <UsersIcon size={20} className="text-muted-foreground" />
                            <UserSearchSelect
                                users={availableUsers}
                                value={selectedUserId}
                                onChange={setSelectedUserId}
                                placeholder="Select user..."
                                className="w-[250px]"
                            />
                        </div>
                    )}

                    <DateFromToPicker
                        startDate={dateRange.start_date}
                        endDate={dateRange.end_date}
                        maxDate={getTodayInTimezone(user?.org_timezone || user?.timezone || 'UTC')}
                        onChange={(start, end) => setDateRange({ start_date: start, end_date: end })}
                    />
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-card text-card-foreground border rounded-lg shadow-sm p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Total Time</p>
                            <p className="text-2xl font-bold mt-1">
                                {formatTime(getTotalSeconds())}
                            </p>
                        </div>
                        <Clock className="text-blue-500 text-primary" size={32} />
                    </div>
                </div>
                <div className="bg-card text-card-foreground border rounded-lg shadow-sm p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Top App</p>
                            <p className="text-2xl font-bold mt-1 max-w-[150px] truncate" title={dashboardData?.top_apps?.[0]?.display_name || 'N/A'}>
                                {dashboardData?.top_apps?.[0]?.display_name || 'N/A'}
                            </p>
                        </div>
                        <TrendingUp className="text-green-500" size={32} />
                    </div>
                </div>
                <div className="bg-card text-card-foreground border rounded-lg shadow-sm p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Categories</p>
                            <p className="text-2xl font-bold mt-1">
                                {productivityData.length}
                            </p>
                        </div>
                        <PieChartIcon className="text-purple-500" size={32} />
                    </div>
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Productivity Pie Chart */}
                <div className="bg-card border text-card-foreground rounded-lg shadow-sm p-6">
                    <h2 className="text-lg font-semibold mb-4 text-foreground">Productivity Breakdown</h2>
                    {pieData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value) => formatTime(value)} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="text-center text-muted-foreground py-12">No data available</div>
                    )}
                </div>

                {/* Category Bar Chart */}
                <div className="bg-card border text-card-foreground rounded-lg shadow-sm p-6">
                    <h2 className="text-lg font-semibold mb-4 text-foreground">Time by Category</h2>
                    {barData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={barData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip formatter={(value) => `${value} hours`} />
                                <Bar dataKey="hours" fill="#3b82f6" />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="text-center text-muted-foreground py-12">No data available</div>
                    )}
                </div>
            </div>

            {/* Top Apps Table */}
            <div className="bg-card text-card-foreground border rounded-lg shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b">
                    <h2 className="text-lg font-semibold">Top Applications</h2>
                    <p className="text-xs text-muted-foreground mt-1">Click on a browser app to see domain-level breakdown</p>
                </div>
                <table className="min-w-full divide-y divide-border">
                    <thead className="bg-muted/50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Application
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Category
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Type
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Time Spent
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {dashboardData?.top_apps?.map((app, index) => {
                            const isBrowser = isBrowserApp(app.executable_name);
                            const isExpanded = expandedBrowser === index;

                            return (
                                <React.Fragment key={index}>
                                    <tr
                                        className={`hover:bg-muted/30 ${isBrowser ? 'cursor-pointer' : ''} ${isExpanded ? 'bg-primary/5' : ''}`}
                                        onClick={() => isBrowser && fetchBrowserDomains(index, app.executable_name)}
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                {isBrowser && (
                                                    isExpanded
                                                        ? <ChevronDown size={16} className="text-primary flex-shrink-0" />
                                                        : <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />
                                                )}
                                                <div>
                                                    <div className="text-sm font-medium text-foreground flex items-center gap-1.5">
                                                        {app.display_name}
                                                        {isBrowser && <Globe size={14} className="text-blue-500" />}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">{app.executable_name}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                                            {app.category_name || 'Uncategorized'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${app.productivity_type === 'productive' ? 'bg-green-100 text-green-800' :
                                                app.productivity_type === 'non_productive' ? 'bg-red-100 text-red-800' :
                                                    'bg-gray-100 text-gray-800'
                                                }`}>
                                                {app.productivity_type?.replace('_', ' ') || 'neutral'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-foreground">
                                            {formatTime(app.total_seconds)}
                                        </td>
                                    </tr>

                                    {/* Expanded browser domain rows */}
                                    {isBrowser && isExpanded && (
                                        <tr>
                                            <td colSpan={4} className="p-0">
                                                <div className="bg-primary/5 border-t border-b">
                                                    {browserDomainsLoading ? (
                                                        <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground">
                                                            <Loader2 size={16} className="animate-spin" />
                                                            <span className="text-sm">Loading domain details...</span>
                                                        </div>
                                                    ) : browserDomains.length === 0 ? (
                                                        <div className="text-center py-6 text-muted-foreground text-sm">
                                                            No browser activity data for this date range
                                                        </div>
                                                    ) : (
                                                        <table className="min-w-full">
                                                            <thead>
                                                                <tr className="bg-primary/10">
                                                                    <th className="px-10 py-2 text-left text-xs font-medium text-primary uppercase">Page Title</th>
                                                                    <th className="px-6 py-2 text-left text-xs font-medium text-primary uppercase">Browser</th>
                                                                    <th className="px-6 py-2 text-left text-xs font-medium text-primary uppercase">Category</th>
                                                                    <th className="px-6 py-2 text-left text-xs font-medium text-primary uppercase">Type</th>
                                                                    <th className="px-6 py-2 text-center text-xs font-medium text-primary uppercase">Visits</th>
                                                                    <th className="px-6 py-2 text-right text-xs font-medium text-primary uppercase">Time Spent</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-border">
                                                                {browserDomains.map((domain, dIdx) => (
                                                                    <tr key={dIdx} className="hover:bg-primary/5 transition-colors">
                                                                        <td className="px-10 py-2.5">
                                                                            <div className="flex items-center gap-2">
                                                                                <Globe size={14} className="text-primary flex-shrink-0" />
                                                                                <div className="text-sm font-medium text-foreground truncate max-w-md">
                                                                                    {domain.domain}
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-6 py-2.5 text-sm text-muted-foreground capitalize">
                                                                            {domain.browser}
                                                                        </td>
                                                                        <td className="px-6 py-2.5 text-sm text-muted-foreground">
                                                                            {domain.category_name || 'Uncategorized'}
                                                                        </td>
                                                                        <td className="px-6 py-2.5">
                                                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                                                domain.productivity_type === 'productive' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                                                                                domain.productivity_type === 'non_productive' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                                                                                'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                                                                            }`}>
                                                                                {domain.productivity_type?.replace('_', ' ') || 'neutral'}
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-6 py-2.5 text-center text-sm text-muted-foreground">
                                                                            {domain.visit_count}
                                                                        </td>
                                                                        <td className="px-6 py-2.5 text-right text-sm font-medium text-foreground">
                                                                            {formatTime(domain.total_seconds)}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
                {(!dashboardData?.top_apps || dashboardData.top_apps.length === 0) && (
                    <div className="text-center py-12 text-muted-foreground">
                        No application usage data for the selected date range
                    </div>
                )}
            </div>
        </div>
    );
}
