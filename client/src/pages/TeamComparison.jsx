import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';
import useAuthStore from '@/lib/useAuthStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { Users, TrendingUp, TrendingDown, Minus } from 'lucide-react';
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

    useEffect(() => {
        fetchTeamData();
    }, [dateRange]);

    const fetchTeamData = async () => {
        setLoading(true);
        try {
            const res = await api.get('/stats/team-productivity', {
                params: { startDate: dateRange.startDate, endDate: dateRange.endDate }
            });
            setTeamData(res.data);
        } catch (error) {
            toast.error('Failed to load team productivity data');
        } finally {
            setLoading(false);
        }
    };

    const barChartData = teamData.map(member => ({
        name: member.userName?.split(' ')[0] || 'Unknown',
        Score: Math.round(member.score),
        Attendance: Math.round(member.breakdown?.attendance || 0),
        Activity: Math.round(member.breakdown?.activity || 0),
    }));

    const radarData = teamData.length > 0 ? [
        { metric: 'Attendance', ...Object.fromEntries(teamData.map(m => [m.userName?.split(' ')[0], Math.round(m.breakdown?.attendance || 0)])) },
        { metric: 'Activity', ...Object.fromEntries(teamData.map(m => [m.userName?.split(' ')[0], Math.round(m.breakdown?.activity || 0)])) },
        { metric: 'Breaks', ...Object.fromEntries(teamData.map(m => [m.userName?.split(' ')[0], Math.round(m.breakdown?.breaks || 0)])) },
        { metric: 'App Usage', ...Object.fromEntries(teamData.map(m => [m.userName?.split(' ')[0], Math.round(m.breakdown?.appProductivity || 0)])) },
    ] : [];

    const teamAverage = teamData.length > 0
        ? Math.round(teamData.reduce((sum, m) => sum + m.score, 0) / teamData.length)
        : 0;

    const sortedTeam = [...teamData].sort((a, b) => b.score - a.score);

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
                    <h1 className="text-3xl font-bold tracking-tight">Team Comparison</h1>
                    <p className="text-muted-foreground">Compare productivity across your team members.</p>
                </div>
                <DateRangeFilter
                    startDate={dateRange.startDate}
                    endDate={dateRange.endDate}
                    onChange={(start, end) => setDateRange({ startDate: start, endDate: end })}
                />
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Team Average</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold">{teamAverage}</span>
                            <span className="text-sm text-muted-foreground">/100</span>
                        </div>
                        <Badge className={`mt-2 ${getScoreLevel(teamAverage).bg} ${getScoreLevel(teamAverage).text} border-0`}>
                            {getScoreLevel(teamAverage).label}
                        </Badge>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Top Performer</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {sortedTeam[0] ? (
                            <>
                                <p className="text-xl font-bold">{sortedTeam[0].userName}</p>
                                <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                                    <TrendingUp className="w-4 h-4" /> Score: {Math.round(sortedTeam[0].score)}
                                </p>
                            </>
                        ) : <p className="text-muted-foreground">No data</p>}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Team Size</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            <Users className="w-6 h-6 text-muted-foreground" />
                            <span className="text-3xl font-bold">{teamData.length}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">members tracked</p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Productivity Scores</CardTitle>
                        <CardDescription>Score comparison across team members</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {barChartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={barChartData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis domain={[0, 100]} />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="Score" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="Attendance" fill="#10b981" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="Activity" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-64 text-muted-foreground">
                                No productivity data available for this period
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Skills Radar</CardTitle>
                        <CardDescription>Multi-dimensional productivity comparison</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {radarData.length > 0 && teamData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300}>
                                <RadarChart data={radarData}>
                                    <PolarGrid />
                                    <PolarAngleAxis dataKey="metric" />
                                    <PolarRadiusAxis angle={30} domain={[0, 100]} />
                                    {teamData.slice(0, 5).map((member, idx) => (
                                        <Radar
                                            key={member.userId}
                                            name={member.userName?.split(' ')[0]}
                                            dataKey={member.userName?.split(' ')[0]}
                                            stroke={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][idx]}
                                            fill={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][idx]}
                                            fillOpacity={0.15}
                                        />
                                    ))}
                                    <Legend />
                                </RadarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-64 text-muted-foreground">
                                No data available for radar chart
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Team Leaderboard */}
            <Card>
                <CardHeader>
                    <CardTitle>Team Leaderboard</CardTitle>
                    <CardDescription>Ranked by overall productivity score</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {sortedTeam.map((member, index) => {
                            const level = getScoreLevel(member.score);
                            return (
                                <div key={member.userId} className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-bold text-sm">
                                        {index + 1}
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-medium">{member.userName}</p>
                                        <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                                            <span>Attendance: {Math.round(member.breakdown?.attendance || 0)}%</span>
                                            <span>Activity: {Math.round(member.breakdown?.activity || 0)}%</span>
                                            <span>Breaks: {Math.round(member.breakdown?.breaks || 0)}%</span>
                                            <span>Apps: {Math.round(member.breakdown?.appProductivity || 0)}%</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-lg font-bold">{Math.round(member.score)}</span>
                                        <Badge className={`ml-2 ${level.bg} ${level.text} border-0`}>{level.label}</Badge>
                                    </div>
                                    <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all"
                                            style={{
                                                width: `${Math.min(member.score, 100)}%`,
                                                backgroundColor: member.score >= 80 ? '#10b981' : member.score >= 60 ? '#3b82f6' : member.score >= 40 ? '#f59e0b' : '#ef4444',
                                            }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                        {sortedTeam.length === 0 && (
                            <div className="text-center py-8 text-muted-foreground">
                                <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                                No team productivity data available for this period.
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
