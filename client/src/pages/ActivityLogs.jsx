import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import TableSkeleton from '@/components/TableSkeleton';
import EmptyState from '@/components/EmptyState';
import {
    ClipboardList, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
    Search, Filter, X, User, Settings, Coffee, Layers, AppWindow
} from 'lucide-react';
import DateRangeFilter from '@/components/DateRangeFilter';
import { utcToLocal } from '@/lib/dateUtils';
import useAuthStore from '@/lib/useAuthStore';

const ACTION_LABELS = {
    USER_CREATED: 'User Created',
    USER_UPDATED: 'User Updated',
    USER_DELETED: 'User Deleted',
    USER_FORCE_LOGOUT: 'Force Logout',
    USER_PASSWORD_RESET: 'Password Reset',
    USER_FEATURES_UPDATED: 'Features Updated',
    ORG_SETTINGS_UPDATED: 'Org Settings Updated',
    BREAK_CREATED: 'Break Created',
    BREAK_UPDATED: 'Break Updated',
    BREAK_DELETED: 'Break Deleted',
    APP_CATEGORY_CREATED: 'Category Created',
    APP_CATEGORY_UPDATED: 'Category Updated',
    APP_CATEGORY_DELETED: 'Category Deleted',
    APP_CREATED: 'App Created',
    APP_UPDATED: 'App Updated',
    APP_MAPPED: 'App Mapped',
    APP_DELETED: 'App Deleted',
};

const ENTITY_ICONS = {
    user: User,
    org_settings: Settings,
    break: Coffee,
    app_category: Layers,
    tracked_app: AppWindow,
};

const ENTITY_COLORS = {
    user: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    org_settings: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
    break: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
    app_category: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    tracked_app: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300',
};

const ACTION_COLORS = {
    CREATED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
    UPDATED: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-300',
    DELETED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    FORCE_LOGOUT: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
    PASSWORD_RESET: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-300',
    MAPPED: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300',
};

function getActionColor(action) {
    for (const [key, color] of Object.entries(ACTION_COLORS)) {
        if (action?.includes(key)) return color;
    }
    return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
}

// Remove unused formatDate function as we use utcToLocal now

function ChangeDiff({ oldValues, newValues }) {
    if (!oldValues && !newValues) {
        return <p className="text-xs text-muted-foreground italic">No change details recorded</p>;
    }

    const old = oldValues || {};
    const newV = newValues || {};
    const allKeys = [...new Set([...Object.keys(old), ...Object.keys(newV)])];
    const sensitiveKeys = ['password', 'newPassword', 'currentPassword', 'password_hash', 'token'];
    const skipKeys = ['id', 'org_id', 'created_at', 'updated_at'];

    const changes = allKeys.filter(k => {
        if (skipKeys.includes(k)) return false;
        if (sensitiveKeys.includes(k)) return true;
        const oldVal = JSON.stringify(old[k]);
        const newVal = JSON.stringify(newV[k]);
        return oldVal !== newVal;
    });

    if (changes.length === 0) {
        return <p className="text-xs text-muted-foreground italic">No field changes detected</p>;
    }

    return (
        <div className="space-y-1">
            {changes.map(key => (
                <div key={key} className="flex items-start gap-2 text-xs font-mono">
                    <span className="text-muted-foreground min-w-[140px] font-medium">{key}:</span>
                    {key in old && (
                        <span className="text-red-500 line-through max-w-[200px] truncate">
                            {sensitiveKeys.includes(key) ? '***' : String(old[key] ?? 'null')}
                        </span>
                    )}
                    <span className="text-muted-foreground">→</span>
                    {key in newV && (
                        <span className="text-green-600 dark:text-green-400 max-w-[200px] truncate">
                            {sensitiveKeys.includes(key) ? '***' : String(newV[key] ?? 'null')}
                        </span>
                    )}
                </div>
            ))}
        </div>
    );
}

export default function ActivityLogs() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
    const [expandedRow, setExpandedRow] = useState(null);

    // Filters
    const [search, setSearch] = useState('');
    const [entityType, setEntityType] = useState('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const orgTimezone = useAuthStore(state => state.user?.timezone) || 'UTC';

    const fetchLogs = useCallback(async (page = 1) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page, limit: pagination.limit });
            if (search) params.set('search', search);
            if (entityType && entityType !== 'all') params.set('entityType', entityType);
            if (dateFrom) params.set('dateFrom', dateFrom);
            if (dateTo) params.set('dateTo', dateTo);

            const { data } = await api.get(`/audit-logs?${params.toString()}`);
            setLogs(data.logs);
            setPagination(data.pagination);
        } catch (err) {
            toast.error('Failed to fetch activity logs');
        } finally {
            setLoading(false);
        }
    }, [search, entityType, dateFrom, dateTo, pagination.limit]);

    useEffect(() => {
        fetchLogs(1);
    }, [fetchLogs]);

    const clearFilters = () => {
        setSearch('');
        setEntityType('all');
        setDateFrom('');
        setDateTo('');
    };

    const hasActiveFilters = search || (entityType && entityType !== 'all') || dateFrom || dateTo;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <ClipboardList className="h-6 w-6" />
                        Activity Logs
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Track all changes and actions performed in your organization
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="gap-2">
                    <Filter className="h-4 w-4" />
                    Filters
                    {hasActiveFilters && <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">!</Badge>}
                </Button>
            </div>

            {showFilters && (
                <Card>
                    <CardContent className="pt-4 pb-4">
                        <div className="flex flex-wrap gap-3 items-end">
                            <div className="flex-1 min-w-[200px]">
                                <label className="text-xs font-medium text-muted-foreground mb-1 block">Search</label>
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search by name, action..."
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        className="pl-9"
                                    />
                                </div>
                            </div>
                            <div className="min-w-[160px]">
                                <label className="text-xs font-medium text-muted-foreground mb-1 block">Entity Type</label>
                                <Select value={entityType} onValueChange={setEntityType}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="All types" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Types</SelectItem>
                                        <SelectItem value="user">User</SelectItem>
                                        <SelectItem value="org_settings">Org Settings</SelectItem>
                                        <SelectItem value="break">Break</SelectItem>
                                        <SelectItem value="app_category">App Category</SelectItem>
                                        <SelectItem value="tracked_app">Tracked App</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <DateRangeFilter
                                startDate={dateFrom}
                                endDate={dateTo}
                                onChange={(start, end) => { setDateFrom(start); setDateTo(end); }}
                            />
                            {hasActiveFilters && (
                                <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                                    <X className="h-3 w-3" /> Clear
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="p-4">
                            <TableSkeleton columns={6} rows={8} />
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="p-8">
                            <EmptyState
                                icon={ClipboardList}
                                title="No activity logs found"
                                description={hasActiveFilters ? "Try adjusting your filters." : "Activity will appear here as changes are made."}
                            />
                        </div>
                    ) : (
                        <>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[180px]">Timestamp</TableHead>
                                        <TableHead className="w-[180px]">Actor</TableHead>
                                        <TableHead className="w-[160px]">Action</TableHead>
                                        <TableHead className="w-[120px]">Entity</TableHead>
                                        <TableHead>Target</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {logs.map((log) => {
                                        const isExpanded = expandedRow === log.id;
                                        const EntityIcon = ENTITY_ICONS[log.entity_type] || ClipboardList;
                                        return (
                                            <>
                                                <TableRow
                                                    key={log.id}
                                                    className="cursor-pointer"
                                                    onClick={() => setExpandedRow(isExpanded ? null : log.id)}
                                                >
                                                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                                        {utcToLocal(log.performed_at, orgTimezone, 'MMM d, yyyy hh:mm a')}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-medium">{log.actor_name || 'System'}</span>
                                                            {log.actor_role && (
                                                                <Badge variant="outline" className="w-fit text-[10px] mt-0.5">
                                                                    {log.actor_role}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge className={`text-[11px] font-medium ${getActionColor(log.action)}`}>
                                                            {ACTION_LABELS[log.action] || log.action}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        {log.entity_type && (
                                                            <div className="flex items-center gap-1.5">
                                                                <EntityIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                                                <span className="text-xs capitalize">{log.entity_type?.replace('_', ' ')}</span>
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-sm">
                                                        {log.target_name || (log.target_id ? `ID: ${log.target_id.substring(0, 8)}...` : '-')}
                                                    </TableCell>
                                                    <TableCell>
                                                        {isExpanded
                                                            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                                            : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                                        }
                                                    </TableCell>
                                                </TableRow>
                                                {isExpanded && (
                                                    <TableRow key={`${log.id}-detail`}>
                                                        <TableCell colSpan={6} className="bg-muted/30 p-4">
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                                <div>
                                                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Changes</h4>
                                                                    <ChangeDiff oldValues={log.old_values} newValues={log.new_values} />
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Details</h4>
                                                                    <div className="text-xs space-y-1">
                                                                        <div className="flex gap-2">
                                                                            <span className="text-muted-foreground min-w-[80px]">Actor:</span>
                                                                            <span>{log.actor_name} ({log.actor_email})</span>
                                                                        </div>
                                                                        <div className="flex gap-2">
                                                                            <span className="text-muted-foreground min-w-[80px]">Role:</span>
                                                                            <span className="capitalize">{log.actor_role || '-'}</span>
                                                                        </div>
                                                                        <div className="flex gap-2">
                                                                            <span className="text-muted-foreground min-w-[80px]">IP Address:</span>
                                                                            <span className="font-mono">{log.ip_address || '-'}</span>
                                                                        </div>
                                                                        {log.target_id && (
                                                                            <div className="flex gap-2">
                                                                                <span className="text-muted-foreground min-w-[80px]">Target ID:</span>
                                                                                <span className="font-mono text-[11px]">{log.target_id}</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </>
                                        );
                                    })}
                                </TableBody>
                            </Table>

                            {/* Pagination */}
                            <Separator />
                            <div className="flex items-center justify-between px-4 py-3">
                                <span className="text-sm text-muted-foreground">
                                    Showing {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} logs
                                </span>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={pagination.page <= 1}
                                        onClick={() => fetchLogs(pagination.page - 1)}
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <span className="text-sm font-medium">
                                        Page {pagination.page} of {pagination.totalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={pagination.page >= pagination.totalPages}
                                        onClick={() => fetchLogs(pagination.page + 1)}
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
