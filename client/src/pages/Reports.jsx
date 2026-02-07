import { useState, useEffect } from 'react';
import api from '@/lib/api';
import useAuthStore from '@/lib/useAuthStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Search, Filter, FileText, Coffee, Image as ImageIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { utcToLocal } from '@/lib/dateUtils';

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
                            activeTab === 'summary' ? ['Work Date', 'User Name', 'Work Hours', 'Idle Hours'] :
                                activeTab === 'breaks' ? ['User Name', 'Break Type', 'Duration Minutes', 'Start Time'] :
                                    ['User Name', 'Captured At', 'File Path']
                        }
                    />
                </div>
            </div>

            {/* Filter Bar */}
            <Card className="bg-muted/30 border-none">
                <CardContent className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div className="space-y-2">
                            <Label className="text-xs uppercase font-bold text-muted-foreground">Start Date</Label>
                            <Input
                                type="date"
                                value={filters.startDate}
                                onChange={(e) => setFilters(f => ({ ...f, startDate: e.target.value }))}
                                className="h-9"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs uppercase font-bold text-muted-foreground">End Date</Label>
                            <Input
                                type="date"
                                value={filters.endDate}
                                onChange={(e) => setFilters(f => ({ ...f, endDate: e.target.value }))}
                                className="h-9"
                            />
                        </div>
                        {user.role !== 'user' && (
                            <div className="space-y-2">
                                <Label className="text-xs uppercase font-bold text-muted-foreground">Team Member</Label>
                                <Select
                                    value={filters.userId}
                                    onValueChange={(v) => setFilters(f => ({ ...f, userId: v }))}
                                >
                                    <SelectTrigger className="h-9">
                                        <SelectValue placeholder="All Users" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Users</SelectItem>
                                        {users.map(u => (
                                            <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        <Button variant="secondary" className="h-9" onClick={fetchReport}>
                            <Filter className="w-4 h-4 mr-2" />
                            Apply Filters
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Tabs */}
            <div className="flex border-b">
                <button
                    onClick={() => setActiveTab('summary')}
                    className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'summary' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                >
                    <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Daily Summary
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab('breaks')}
                    className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'breaks' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                >
                    <div className="flex items-center gap-2">
                        <Coffee className="w-4 h-4" />
                        Break Usage
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab('screenshots')}
                    className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'screenshots' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
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
                                        <TableHead>Work Hours</TableHead>
                                        <TableHead>Idle Hours</TableHead>
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
                                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground italic">No data found for the selected range.</TableCell>
                                    </TableRow>
                                ) : (
                                    data.map((row, i) => (
                                        <TableRow key={i}>
                                            {activeTab === 'summary' && (
                                                <>
                                                    <TableCell className="font-medium">{new Date(row.work_date).toLocaleDateString()}</TableCell>
                                                    <TableCell>{row.user_name}</TableCell>
                                                    <TableCell>{parseFloat(row.work_hours).toFixed(1)}h</TableCell>
                                                    <TableCell>{parseFloat(row.idle_hours).toFixed(1)}h</TableCell>
                                                    <TableCell className="text-right">
                                                        <span className="text-xs font-bold">
                                                            {((row.work_hours / (parseFloat(row.work_hours) + parseFloat(row.idle_hours) || 1)) * 100).toFixed(0)}%
                                                        </span>
                                                    </TableCell>
                                                </>
                                            )}
                                            {activeTab === 'breaks' && (
                                                <>
                                                    <TableCell className="font-medium">{utcToLocal(row.start_time, user.timezone, 'MMM dd, HH:mm')}</TableCell>
                                                    <TableCell>{row.user_name}</TableCell>
                                                    <TableCell><Badge variant="outline">{row.break_type}</Badge></TableCell>
                                                    <TableCell className="text-right">{parseFloat(row.duration_minutes).toFixed(0)} min</TableCell>
                                                </>
                                            )}
                                            {activeTab === 'screenshots' && (
                                                <>
                                                    <TableCell className="font-medium">{utcToLocal(row.captured_at, user.timezone, 'MMM dd, HH:mm:ss')}</TableCell>
                                                    <TableCell>{row.user_name}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="ghost" size="sm" className="text-primary hover:text-primary hover:bg-primary/10">View Image</Button>
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
        </div>
    );
}
