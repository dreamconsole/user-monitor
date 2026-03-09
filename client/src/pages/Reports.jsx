import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';
import useAuthStore from '@/lib/useAuthStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import UserSearchSelect from '@/components/UserSearchSelect';
import { Download, Search, Filter, FileText, Coffee, Monitor, Image as ImageIcon } from 'lucide-react';
import DateRangeFilter from '@/components/DateRangeFilter';
import { Badge } from '@/components/ui/badge';
import { utcToLocal } from '@/lib/dateUtils';
import { format } from 'date-fns';

const ExportButton = ({ data, filename, headers }) => {
    const exportToCSV = () => {
        if (!data || data.length === 0) return;

        const csvRows = [];
        csvRows.push(headers.join(','));

        for (const row of data) {
            const values = headers.map(header => {
                const val = row[header.toLowerCase().replace(' ', '_')];
                const escaped = ('' + (val ?? '')).replace(/"/g, '""');
                return `"${escaped}"`;
            });
            csvRows.push(values.join(','));
        }

        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <Button variant="outline" size="sm" onClick={exportToCSV} disabled={!data || data.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
        </Button>
    );
};

export default function Reports() {
    const { user } = useAuthStore();
    const [activeTab, setActiveTab] = useState('summary');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState([]);
    const [users, setUsers] = useState([]);

    // Filters
    const [filters, setFilters] = useState({
        startDate: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        userId: 'all'
    });

    useEffect(() => {
        if (user.role !== 'user') {
            fetchUsers();
        }
    }, [user]);

    useEffect(() => {
        fetchReport();
    }, [activeTab, filters]);

    const fetchUsers = async () => {
        try {
            const { data } = await api.get('/users');
            setUsers(data);
        } catch (error) {
            console.error('Failed to fetch users:', error);
        }
    };

    const fetchReport = async () => {
        setLoading(true);
        try {
            const params = { ...filters };
            if (params.userId === 'all') delete params.userId;

            const { data } = await api.get(`/reports/${activeTab}`, { params });
            setData(data);
        } catch (error) {
            console.error('Failed to fetch report:', error);
            setData([]);
        } finally {
            setLoading(false);
        }
    };

    const [selectedScreenshot, setSelectedScreenshot] = useState(null);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
                    <p className="text-muted-foreground">Analyze productivity and export activity logs.</p>
                </div>
                <div className="flex items-center gap-2">
                    <ExportButton
                        data={data}
                        filename={`report_${activeTab}`}
                        headers={
                            activeTab === 'summary' ? ['Work Date', 'User Name', 'Shift Start', 'Shift End', 'Work Hours', 'Idle Hours', 'Break Hours'] :
                                activeTab === 'breaks' ? ['User Name', 'Break Type', 'Duration Minutes', 'Start Time'] :
                                    activeTab === 'idle' ? ['User Name', 'Start Time', 'End Time', 'Duration Minutes'] :
                                        ['User Name', 'Captured At', 'File Path']
                        }
                    />
                    {['summary', 'breaks', 'screenshots'].includes(activeTab) && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                                try {
                                    const reportTypeMap = { summary: 'daily-summary', breaks: 'break-usage', screenshots: 'screenshots' };
                                    const params = new URLSearchParams({
                                        startDate: filters.startDate,
                                        endDate: filters.endDate,
                                    });
                                    if (filters.userId !== 'all') params.set('userId', filters.userId);
                                    const response = await api.get(`/exports/pdf/${reportTypeMap[activeTab]}?${params}`, {
                                        responseType: 'blob'
                                    });
                                    const blob = new Blob([response.data], { type: 'application/pdf' });
                                    const url = URL.createObjectURL(blob);
                                    const link = document.createElement('a');
                                    link.href = url;
                                    link.download = `report_${activeTab}_${filters.startDate}.pdf`;
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                    URL.revokeObjectURL(url);
                                    toast.success('PDF downloaded');
                                } catch {
                                    toast.error('Failed to generate PDF');
                                }
                            }}
                            disabled={!data || data.length === 0}
                        >
                            <Download className="w-4 h-4 mr-2" />
                            Export PDF
                        </Button>
                    )}
                </div>
            </div>

            {/* Filter Bar */}
            <Card className="bg-muted/30 border-none">
                <CardContent className="p-4">
                    <div className="space-y-4">
                        <DateRangeFilter
                            startDate={filters.startDate}
                            endDate={filters.endDate}
                            onChange={(start, end) => setFilters(f => ({ ...f, startDate: start, endDate: end }))}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                            {user.role !== 'user' && (
                                <div className="space-y-2">
                                    <Label className="text-xs uppercase font-bold text-muted-foreground">Team Member</Label>
                                    <UserSearchSelect
                                        users={users}
                                        value={filters.userId}
                                        onChange={(v) => setFilters(f => ({ ...f, userId: v }))}
                                        placeholder="All Users"
                                        showAllOption
                                        allOptionLabel="All Users"
                                    />
                                </div>
                            )}
                            <Button variant="secondary" className="h-9" onClick={fetchReport}>
                                <Filter className="w-4 h-4 mr-2" />
                                Apply Filters
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Tabs */}
            <div className="flex border-b overflow-x-auto">
                <button
                    onClick={() => setActiveTab('summary')}
                    className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === 'summary' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                >
                    <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Daily Summary
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab('breaks')}
                    className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === 'breaks' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                >
                    <div className="flex items-center gap-2">
                        <Coffee className="w-4 h-4" />
                        Break Usage
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab('idle')}
                    className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === 'idle' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                >
                    <div className="flex items-center gap-2">
                        <Monitor className="w-4 h-4" />
                        Idle Events
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab('screenshots')}
                    className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === 'screenshots' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                >
                    <div className="flex items-center gap-2">
                        <ImageIcon className="w-4 h-4" />
                        Screenshots
                    </div>
                </button>
            </div>

            {/* Report Content */}
            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="p-12 text-center text-muted-foreground animate-pulse">Loading report data...</div>
                    ) : (
                        <Table>
                            <TableHeader>
                                {activeTab === 'summary' && (
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>User</TableHead>
                                        <TableHead>Shift Start</TableHead>
                                        <TableHead>Shift End</TableHead>
                                        <TableHead>Work Hours</TableHead>
                                        <TableHead>Idle Hours</TableHead>
                                        <TableHead>Break Hours</TableHead>
                                        <TableHead className="text-right">Productivity</TableHead>
                                    </TableRow>
                                )}
                                {activeTab === 'breaks' && (
                                    <TableRow>
                                        <TableHead>Start Time</TableHead>
                                        <TableHead>User</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead className="text-right">Duration</TableHead>
                                    </TableRow>
                                )}
                                {activeTab === 'idle' && (
                                    <TableRow>
                                        <TableHead>Start Time</TableHead>
                                        <TableHead>End Time</TableHead>
                                        <TableHead>User</TableHead>
                                        <TableHead className="text-right">Duration</TableHead>
                                    </TableRow>
                                )}
                                {activeTab === 'screenshots' && (
                                    <TableRow>
                                        <TableHead>Captured At</TableHead>
                                        <TableHead>User</TableHead>
                                        <TableHead className="text-right">Preview</TableHead>
                                    </TableRow>
                                )}
                            </TableHeader>
                            <TableBody>
                                {data.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-24 text-center text-muted-foreground italic">No data found for the selected range.</TableCell>
                                    </TableRow>
                                ) : (
                                    data.map((row, i) => (
                                        <TableRow key={i}>
                                            {activeTab === 'summary' && (
                                                <>
                                                    <TableCell className="font-medium">{row.work_date ? format(new Date(row.work_date + 'T12:00:00'), 'MMM dd, yyyy') : '-'}</TableCell>
                                                    <TableCell>{row.user_name}</TableCell>
                                                    <TableCell>{row.shift_start ? utcToLocal(row.shift_start, user.org_timezone || user.timezone, 'HH:mm') : '-'}</TableCell>
                                                    <TableCell>{row.shift_end ? utcToLocal(row.shift_end, user.org_timezone || user.timezone, 'HH:mm') : 'Active'}</TableCell>
                                                    <TableCell>{parseFloat(row.work_hours).toFixed(1)}h</TableCell>
                                                    <TableCell>{parseFloat(row.idle_hours).toFixed(1)}h</TableCell>
                                                    <TableCell>{(parseFloat(row.break_seconds || 0) / 3600).toFixed(1)}h</TableCell>
                                                    <TableCell className="text-right">
                                                        <span className="text-xs font-bold">
                                                            {((row.work_hours / (parseFloat(row.work_hours) + parseFloat(row.idle_hours) || 1)) * 100).toFixed(0)}%
                                                        </span>
                                                    </TableCell>
                                                </>
                                            )}
                                            {activeTab === 'breaks' && (
                                                <>
                                                    <TableCell className="font-medium">{utcToLocal(row.start_time, user.org_timezone || user.timezone, 'MMM dd, HH:mm')}</TableCell>
                                                    <TableCell>{row.user_name}</TableCell>
                                                    <TableCell><Badge variant="outline">{row.break_type}</Badge></TableCell>
                                                    <TableCell className="text-right">{parseFloat(row.duration_minutes).toFixed(0)} min</TableCell>
                                                </>
                                            )}
                                            {activeTab === 'idle' && (
                                                <>
                                                    <TableCell className="font-medium">{utcToLocal(row.start_time, user.org_timezone || user.timezone, 'MMM dd, HH:mm')}</TableCell>
                                                    <TableCell className="text-muted-foreground">{utcToLocal(row.end_time, user.org_timezone || user.timezone, 'HH:mm')}</TableCell>
                                                    <TableCell>{row.user_name}</TableCell>
                                                    <TableCell className="text-right font-mono">{parseFloat(row.duration_minutes).toFixed(0)} min</TableCell>
                                                </>
                                            )}

                                            {activeTab === 'screenshots' && (
                                                <>
                                                    <TableCell className="font-medium">{utcToLocal(row.captured_at, user.org_timezone || user.timezone, 'MMM dd, HH:mm:ss')}</TableCell>
                                                    <TableCell>{row.user_name}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-primary hover:text-primary hover:bg-primary/10"
                                                            onClick={() => setSelectedScreenshot(row)}
                                                        >
                                                            View Image
                                                        </Button>
                                                    </TableCell>
                                                </>
                                            )}
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Screenshot Viewer Dialog */}
            {selectedScreenshot && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setSelectedScreenshot(null)}>
                    <div className="bg-background rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b flex items-center justify-between">
                            <div>
                                <h3 className="font-semibold">{selectedScreenshot.user_name}</h3>
                                <p className="text-xs text-muted-foreground">{utcToLocal(selectedScreenshot.captured_at, user.org_timezone || user.timezone, 'MMM dd, HH:mm:ss')}</p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setSelectedScreenshot(null)}>
                                <span className="sr-only">Close</span>
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                            </Button>
                        </div>
                        <div className="flex-1 overflow-auto bg-slate-950 flex items-center justify-center p-4">
                            <img
                                src={`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/${selectedScreenshot.file_path}`}
                                alt="Screenshot"
                                className="max-w-full max-h-full object-contain shadow-lg"
                                onError={(e) => { e.target.src = 'https://placehold.co/600x400?text=Image+Not+Found'; }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
