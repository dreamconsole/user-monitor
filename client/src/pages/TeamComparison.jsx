import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';
import useAuthStore from '@/lib/useAuthStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { Search, Users, TrendingUp, X, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import DateRangeFilter from '@/components/DateRangeFilter';

const SCORE_COLORS = {
    excellent: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', label: 'Excellent' },
    good: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', label: 'Good' },
    average: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', label: 'Average' },
    poor: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', label: 'Needs Improvement' },
};

function getScoreLevel(score) {
    if (score >= 80) return SCORE_COLORS.excellent;
    if (score >= 60) return SCORE_COLORS.good;
    if (score >= 40) return SCORE_COLORS.average;
    return SCORE_COLORS.poor;
}

export default function TeamComparison() {
    const { user } = useAuthStore();
    const [teamData, setTeamData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState({
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [viewType, setViewType] = useState('members'); // 'members' or 'teams'
    const [compareMode, setCompareMode] = useState('head'); // 'head' or 'multi'
    const [selectedIds, setSelectedIds] = useState([]);
    const [entityAId, setEntityAId] = useState('');
    const [entityBId, setEntityBId] = useState('');
    const [pickerSearch, setPickerSearch] = useState('');
    const [memberTeamFilterIds, setMemberTeamFilterIds] = useState([]);

    useEffect(() => {
        fetchTeamData();
    }, [dateRange, viewType]);

    useEffect(() => {
        setPickerSearch('');
        setMemberTeamFilterIds([]);
        setCompareMode('head');
        setEntityAId('');
        setEntityBId('');
    }, [viewType]);

    const getItemId = (item) => (viewType === 'teams' ? item.teamId : item.userId);
    const getItemName = (item) => (viewType === 'teams' ? item.teamName : item.userName);
    const getSeriesLabel = (item) => {
        const name = getItemName(item) || 'Unknown';
        if (viewType === 'teams') return name;
        return `${name} (${String(getItemId(item)).slice(0, 4)})`;
    };

    const fetchTeamData = async () => {
        setLoading(true);
        try {
            const endpoint = viewType === 'teams' ? '/stats/teams-productivity' : '/stats/team-productivity';
            const res = await api.get(endpoint, {
                params: { startDate: dateRange.startDate, endDate: dateRange.endDate }
            });
            const data = Array.isArray(res.data) ? res.data : [];
            setTeamData(data);
            setSelectedIds((prev) => {
                const validExisting = prev.filter((id) => data.some((item) => getItemId(item) === id));
                if (validExisting.length >= 2) return validExisting;
                return data.slice(0, Math.min(2, data.length)).map((item) => getItemId(item));
            });
            if (data.length > 0) {
                const first = getItemId(data[0]);
                const second = getItemId(data[1] || data[0]);
                setEntityAId((prev) => prev && data.some((item) => getItemId(item) === prev) ? prev : first);
                setEntityBId((prev) => prev && data.some((item) => getItemId(item) === prev) ? prev : second);
            } else {
                setEntityAId('');
                setEntityBId('');
            }
        } catch (error) {
            toast.error(`Failed to load ${viewType} productivity data`);
            setTeamData([]);
            setSelectedIds([]);
            setEntityAId('');
            setEntityBId('');
        } finally {
            setLoading(false);
        }
    };

    const sortedTeam = [...teamData].sort((a, b) => b.score - a.score);
    const teamFilterOptions = viewType === 'members'
        ? Array.from(
            new Map(
                sortedTeam
                    .filter((item) => item.teamId)
                    .map((item) => [item.teamId, { teamId: item.teamId, teamName: item.teamName || 'Unassigned' }])
            ).values()
        ).sort((a, b) => (a.teamName || '').localeCompare(b.teamName || ''))
        : [];
    const teamFilteredItems = viewType === 'members' && memberTeamFilterIds.length > 0
        ? sortedTeam.filter((item) => memberTeamFilterIds.includes(item.teamId))
        : sortedTeam;
    const pickerOptions = teamFilteredItems.filter((item) => {
        const name = getItemName(item);
        return name?.toLowerCase().includes(pickerSearch.toLowerCase());
    });
    const filteredTeam = sortedTeam.filter(item => {
        const name = getItemName(item);
        return name?.toLowerCase().includes(searchTerm.toLowerCase());
    });
    useEffect(() => {
        if (compareMode !== 'head') return;
        const next = [entityAId, entityBId].filter(Boolean);
        setSelectedIds(Array.from(new Set(next)));
    }, [compareMode, entityAId, entityBId]);

    const comparisonIds = compareMode === 'head'
        ? Array.from(new Set([entityAId, entityBId].filter(Boolean)))
        : selectedIds;
    const comparisonData = teamData.filter((item) => comparisonIds.includes(getItemId(item)));
    const selectedItems = sortedTeam.filter((item) => selectedIds.includes(getItemId(item)));
    const hasMinimumSelection = comparisonData.length >= 2;
    const chartSource = hasMinimumSelection ? comparisonData : [];

    const teamAverage = teamData.length > 0
        ? Math.round(teamData.reduce((sum, m) => sum + m.score, 0) / teamData.length)
        : 0;
    const comparisonAverage = comparisonData.length > 0
        ? Math.round(comparisonData.reduce((sum, m) => sum + m.score, 0) / comparisonData.length)
        : 0;

    const barChartData = chartSource.map(item => ({
        name: getItemName(item) || 'Unknown',
        Score: Math.round(item.score),
        Attendance: Math.round(item.breakdown?.attendance || 0),
        Activity: Math.round(item.breakdown?.activity || 0),
    }));

    const radarData = chartSource.length > 0 ? [
        { metric: 'Attendance', ...Object.fromEntries(chartSource.map(m => [getSeriesLabel(m), Math.round(m.breakdown?.attendance || 0)])) },
        { metric: 'Activity', ...Object.fromEntries(chartSource.map(m => [getSeriesLabel(m), Math.round(m.breakdown?.activity || 0)])) },
        { metric: 'Breaks', ...Object.fromEntries(chartSource.map(m => [getSeriesLabel(m), Math.round(m.breakdown?.breaks || 0)])) },
        { metric: 'App Usage', ...Object.fromEntries(chartSource.map(m => [getSeriesLabel(m), Math.round(m.breakdown?.appProductivity || 0)])) },
    ] : [];

    const topComparison = [...comparisonData].sort((a, b) => b.score - a.score)[0];

    const selectTopTwo = () => {
        const topTwo = sortedTeam.slice(0, Math.min(2, sortedTeam.length)).map((item) => getItemId(item));
        setSelectedIds(topTwo);
        if (compareMode === 'head') {
            setEntityAId(topTwo[0] || '');
            setEntityBId(topTwo[1] || '');
        }
    };

    const selectFiltered = () => {
        const nextIds = pickerOptions.slice(0, 5).map((item) => getItemId(item));
        setSelectedIds(nextIds);
    };

    const clearSelection = () => {
        setSelectedIds([]);
        if (compareMode === 'head') {
            setEntityAId('');
            setEntityBId('');
        }
    };
    const removeSelected = (id) => setSelectedIds((prev) => prev.filter((itemId) => itemId !== id));
    const toggleSelectById = (id) => {
        setSelectedIds((prev) => (
            prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]
        ));
    };
    const toggleMemberTeamFilter = (teamId) => {
        setMemberTeamFilterIds((prev) => (
            prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId]
        ));
    };
    const selectedLabel = comparisonIds.length === 0
        ? `Select ${viewType}`
        : `${comparisonIds.length} ${viewType} selected`;

    if (loading) {
        return (
            <div className="space-y-6">
                <div>
                    <div className="h-8 w-56 bg-muted animate-pulse rounded mb-2" />
                    <div className="h-4 w-80 bg-muted animate-pulse rounded" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="bg-card border rounded-lg p-6">
                            <div className="h-4 w-24 bg-muted animate-pulse rounded mb-3" />
                            <div className="h-8 w-16 bg-muted animate-pulse rounded" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Comparison</h1>
                    <p className="text-muted-foreground">Compare productivity across {viewType} in your organization.</p>
                </div>
                <div className="flex items-center gap-4">
                    {user?.role === 'orgadmin' && (
                        <Tabs defaultValue={viewType} className="w-[300px]">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="members" onClick={() => setViewType('members')}>Members</TabsTrigger>
                                <TabsTrigger value="teams" onClick={() => setViewType('teams')}>Teams</TabsTrigger>
                            </TabsList>
                        </Tabs>
                    )}
                    <DateRangeFilter
                        startDate={dateRange.startDate}
                        endDate={dateRange.endDate}
                        onChange={(start, end) => setDateRange({ startDate: start, endDate: end })}
                    />
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            {hasMinimumSelection ? 'Selection Average' : `${viewType === 'teams' ? 'Organization' : 'Team'} Average`}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold">{hasMinimumSelection ? comparisonAverage : teamAverage}</span>
                            <span className="text-sm text-muted-foreground">/100</span>
                        </div>
                        <Badge className={`mt-2 ${getScoreLevel(hasMinimumSelection ? comparisonAverage : teamAverage).bg} ${getScoreLevel(hasMinimumSelection ? comparisonAverage : teamAverage).text} border-0`}>
                            {getScoreLevel(hasMinimumSelection ? comparisonAverage : teamAverage).label}
                        </Badge>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            {hasMinimumSelection ? 'Top Performer (Selection)' : `Top Performer (${viewType})`}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {(hasMinimumSelection ? topComparison : sortedTeam[0]) ? (
                            <>
                                <p className="text-xl font-bold">{getItemName(hasMinimumSelection ? topComparison : sortedTeam[0])}</p>
                                <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                                    <TrendingUp className="w-4 h-4" /> Score: {Math.round((hasMinimumSelection ? topComparison : sortedTeam[0]).score)}
                                </p>
                            </>
                        ) : <p className="text-muted-foreground">No data</p>}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            {hasMinimumSelection ? `Selected ${viewType}` : (viewType === 'teams' ? 'Total Teams' : 'Team Size')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            <Users className="w-6 h-6 text-muted-foreground" />
                            <span className="text-3xl font-bold">{hasMinimumSelection ? comparisonData.length : teamData.length}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{hasMinimumSelection ? `${viewType} compared` : `${viewType} tracked`}</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Comparison Selection</CardTitle>
                    <CardDescription>
                        Build a head-to-head comparison or choose multiple entities.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{comparisonData.length} selected</Badge>
                        <div className="inline-flex rounded-md border overflow-hidden">
                            <button
                                type="button"
                                className={`px-3 py-1.5 text-sm ${compareMode === 'head' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
                                onClick={() => setCompareMode('head')}
                            >
                                Head-to-Head
                            </button>
                            <button
                                type="button"
                                className={`px-3 py-1.5 text-sm border-l ${compareMode === 'multi' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
                                onClick={() => setCompareMode('multi')}
                            >
                                Multi Compare
                            </button>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={selectTopTwo}>
                            Select Top 2
                        </Button>
                        {compareMode === 'multi' && (
                            <Button type="button" variant="outline" size="sm" onClick={selectFiltered}>
                                Select Filtered (max 5)
                            </Button>
                        )}
                        <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
                            Clear Selection
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                        <div className="space-y-2 lg:col-span-1">
                            <label className="text-sm font-medium">
                                Search {viewType}
                            </label>
                            <Input
                                placeholder={`Type to filter ${viewType}...`}
                                value={pickerSearch}
                                onChange={(e) => setPickerSearch(e.target.value)}
                            />
                        </div>

                        {viewType === 'members' && (
                            <div className="space-y-2 lg:col-span-1">
                                <label className="text-sm font-medium">Filter Members by Team</label>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button type="button" variant="outline" className="w-full justify-between">
                                            <span className="truncate">
                                                {memberTeamFilterIds.length === 0 ? 'All teams' : `${memberTeamFilterIds.length} teams selected`}
                                            </span>
                                            <ChevronDown className="h-4 w-4 opacity-60" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="w-72 max-h-72 overflow-y-auto">
                                        <DropdownMenuLabel>Select team filters</DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        {teamFilterOptions.length === 0 ? (
                                            <div className="px-2 py-1.5 text-sm text-muted-foreground">No teams found</div>
                                        ) : (
                                            teamFilterOptions.map((team) => (
                                                <DropdownMenuCheckboxItem
                                                    key={team.teamId}
                                                    checked={memberTeamFilterIds.includes(team.teamId)}
                                                    onCheckedChange={() => toggleMemberTeamFilter(team.teamId)}
                                                    onSelect={(event) => event.preventDefault()}
                                                >
                                                    {team.teamName}
                                                </DropdownMenuCheckboxItem>
                                            ))
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        )}

                        <div className="space-y-2 lg:col-span-1">
                            {compareMode === 'head' ? (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Select A vs B</label>
                                    <div className="grid grid-cols-1 gap-2">
                                        <Select
                                            value={entityAId}
                                            onValueChange={(value) => {
                                                setEntityAId(value);
                                                if (value === entityBId) setEntityBId('');
                                            }}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder={`Select ${viewType} A`} />
                                            </SelectTrigger>
                                            <SelectContent className="max-h-72">
                                                {pickerOptions.length === 0 ? (
                                                    <SelectItem value="none-a" disabled>No options available</SelectItem>
                                                ) : (
                                                    pickerOptions.map((item) => (
                                                        <SelectItem key={`a-${getItemId(item)}`} value={getItemId(item)}>
                                                            {getItemName(item)}
                                                        </SelectItem>
                                                    ))
                                                )}
                                            </SelectContent>
                                        </Select>
                                        <Select
                                            value={entityBId}
                                            onValueChange={(value) => {
                                                setEntityBId(value);
                                                if (value === entityAId) setEntityAId('');
                                            }}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder={`Select ${viewType} B`} />
                                            </SelectTrigger>
                                            <SelectContent className="max-h-72">
                                                {pickerOptions.filter((item) => getItemId(item) !== entityAId).length === 0 ? (
                                                    <SelectItem value="none-b" disabled>No options available</SelectItem>
                                                ) : (
                                                    pickerOptions
                                                        .filter((item) => getItemId(item) !== entityAId)
                                                        .map((item) => (
                                                            <SelectItem key={`b-${getItemId(item)}`} value={getItemId(item)}>
                                                                {getItemName(item)}
                                                            </SelectItem>
                                                        ))
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Pick {viewType} to compare</label>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button type="button" variant="outline" className="w-full justify-between">
                                                <span className="truncate">{selectedLabel}</span>
                                                <ChevronDown className="h-4 w-4 opacity-60" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="start" className="w-80 max-h-80 overflow-y-auto">
                                            <DropdownMenuLabel>
                                                {viewType === 'members'
                                                    ? 'Select members (same team or different teams)'
                                                    : 'Select teams'}
                                            </DropdownMenuLabel>
                                            <DropdownMenuSeparator />
                                            {pickerOptions.length === 0 ? (
                                                <div className="px-2 py-1.5 text-sm text-muted-foreground">No options available</div>
                                            ) : (
                                                pickerOptions.map((item) => {
                                                    const id = getItemId(item);
                                                    const label = getItemName(item);
                                                    return (
                                                        <DropdownMenuCheckboxItem
                                                            key={id}
                                                            checked={selectedIds.includes(id)}
                                                            onCheckedChange={() => toggleSelectById(id)}
                                                            onSelect={(event) => event.preventDefault()}
                                                        >
                                                            <span className="flex w-full items-center justify-between gap-2">
                                                                <span className="truncate">{label}</span>
                                                                <span className="text-xs text-muted-foreground">{Math.round(item.score)}</span>
                                                            </span>
                                                        </DropdownMenuCheckboxItem>
                                                    );
                                                })
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {selectedItems.map((item) => (
                            <Badge key={getItemId(item)} variant="outline" className="flex items-center gap-1.5 py-1">
                                <span>
                                    {getItemName(item)}
                                    {viewType === 'members' && item.teamName ? ` · ${item.teamName}` : ''}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => removeSelected(getItemId(item))}
                                    className="rounded hover:bg-muted p-0.5"
                                    aria-label={`Remove ${getItemName(item)}`}
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </Badge>
                        ))}
                    </div>

                    {!hasMinimumSelection && (
                        <span className="text-sm text-muted-foreground">Select 2 or more to enable charts.</span>
                    )}
                </CardContent>
            </Card>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Productivity Scores</CardTitle>
                        <CardDescription>Score comparison across selected {viewType}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {barChartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={barChartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis
                                        dataKey="name"
                                        interval={0}
                                        angle={-45}
                                        textAnchor="end"
                                        height={60}
                                        tick={{ fontSize: 10 }}
                                    />
                                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="Score" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="Attendance" fill="#10b981" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="Activity" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-64 text-muted-foreground">
                                Select at least 2 {viewType} to compare productivity scores
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Skills Radar</CardTitle>
                        <CardDescription>Multi-dimensional comparison for selected {viewType}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {radarData.length > 0 && chartSource.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300}>
                                <RadarChart data={radarData}>
                                    <PolarGrid />
                                    <PolarAngleAxis dataKey="metric" />
                                    <PolarRadiusAxis angle={30} domain={[0, 100]} />
                                    {chartSource.slice(0, 5).map((item, idx) => {
                                        const name = getSeriesLabel(item);
                                        const id = getItemId(item);
                                        return (
                                            <Radar
                                                key={id}
                                                name={name}
                                                dataKey={name}
                                                stroke={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][idx]}
                                                fill={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][idx]}
                                                fillOpacity={0.15}
                                            />
                                        );
                                    })}
                                    <Legend />
                                </RadarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-64 text-muted-foreground">
                                Select at least 2 {viewType} to compare skill radar
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Team Leaderboard */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div>
                        <CardTitle>{viewType === 'teams' ? 'Teams' : 'Members'} Leaderboard</CardTitle>
                        <CardDescription>Use this table to review rankings while selection is managed above</CardDescription>
                    </div>
                    <div className="relative w-64">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder={`Search ${viewType}...`}
                            className="pl-8 h-9 text-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                        {filteredTeam.map((item, index) => {
                            const level = getScoreLevel(item.score);
                            const id = getItemId(item);
                            return (
                                <div key={id} className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/50 border-transparent transition-colors">
                                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-bold text-sm">
                                        {index + 1}
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-medium">{getItemName(item)}</p>
                                        <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                                            <span>Attendance: {Math.round(item.breakdown?.attendance || 0)}%</span>
                                            <span>Activity: {Math.round(item.breakdown?.activity || 0)}%</span>
                                            <span>Breaks: {Math.round(item.breakdown?.breaks || 0)}%</span>
                                            <span>Apps: {Math.round(item.breakdown?.appProductivity || 0)}%</span>
                                            {viewType === 'teams' && <span>Members: {item.memberCount}</span>}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-lg font-bold">{Math.round(item.score)}</span>
                                        <Badge className={`ml-2 ${level.bg} ${level.text} border-0`}>{level.label}</Badge>
                                    </div>
                                    <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all"
                                            style={{
                                                width: `${Math.min(item.score, 100)}%`,
                                                backgroundColor: item.score >= 80 ? '#10b981' : item.score >= 60 ? '#3b82f6' : item.score >= 40 ? '#f59e0b' : '#ef4444',
                                            }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                        {filteredTeam.length === 0 && (
                            <div className="text-center py-12 text-muted-foreground">
                                <Users className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                {searchTerm ? `No results for "${searchTerm}"` : `No ${viewType} productivity data available for this period.`}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
