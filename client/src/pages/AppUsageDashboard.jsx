import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar, TrendingUp, Clock, PieChart as PieChartIcon } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const COLORS = {
    productive: '#10b981',
    non_productive: '#ef4444',
    neutral: '#6b7280'
};

export default function AppUsageDashboard() {
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState({
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0]
    });
    const [dashboardData, setDashboardData] = useState(null);
    const [productivityData, setProductivityData] = useState([]);
    const [user, setUser] = useState(null);

    useEffect(() => {
        const userData = JSON.parse(localStorage.getItem('user'));
        setUser(userData);
        if (userData) {
            fetchDashboardData(userData.id);
        }
    }, [dateRange]);

    const fetchDashboardData = async (userId) => {
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            const [dashboardRes, productivityRes] = await Promise.all([
                axios.get(
                    `${API_URL}/app-tracking/reports/user/${userId}?start_date=${dateRange.start_date}&end_date=${dateRange.end_date}`,
                    { headers }
                ),
                axios.get(
                    `${API_URL}/app-tracking/reports/productivity/${userId}?start_date=${dateRange.start_date}&end_date=${dateRange.end_date}`,
                    { headers }
                )
            ]);

            setDashboardData(dashboardRes.data);
            setProductivityData(productivityRes.data);
        } catch (error) {
            console.error('Failed to fetch dashboard data:', error);
            alert('Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (seconds) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${minutes}m`;
    };

    const getTotalSeconds = () => {
        if (!dashboardData?.summary?.length) return 0;
        return dashboardData.summary.reduce((sum, day) => sum + (day.total_working_seconds || 0), 0);
    };

    const getProductivityPieData = () => {
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

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-500">Loading dashboard...</div>
            </div>
        );
    }

    const pieData = getProductivityPieData();
    const barData = getCategoryBarData();

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">App Usage Dashboard</h1>
                    <p className="text-gray-600 mt-1">Track your application usage and productivity</p>
                </div>
                <div className="flex gap-2 items-center">
                    <Calendar size={20} className="text-gray-400" />
                    <input
                        type="date"
                        value={dateRange.start_date}
                        onChange={(e) => setDateRange({ ...dateRange, start_date: e.target.value })}
                        className="px-3 py-2 border border-gray-300 rounded-lg"
                    />
                    <span className="text-gray-500">to</span>
                    <input
                        type="date"
                        value={dateRange.end_date}
                        onChange={(e) => setDateRange({ ...dateRange, end_date: e.target.value })}
                        className="px-3 py-2 border border-gray-300 rounded-lg"
                    />
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-white rounded-lg shadow-md p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Total Time</p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">
                                {formatTime(getTotalSeconds())}
                            </p>
                        </div>
                        <Clock className="text-blue-500" size={40} />
                    </div>
                </div>
                <div className="bg-white rounded-lg shadow-md p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Top App</p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">
                                {dashboardData?.top_apps?.[0]?.display_name || 'N/A'}
                            </p>
                        </div>
                        <TrendingUp className="text-green-500" size={40} />
                    </div>
                </div>
                <div className="bg-white rounded-lg shadow-md p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Categories</p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">
                                {productivityData.length}
                            </p>
                        </div>
                        <PieChartIcon className="text-purple-500" size={40} />
                    </div>
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Productivity Pie Chart */}
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-lg font-semibold mb-4">Productivity Breakdown</h2>
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
                        <div className="text-center text-gray-500 py-12">No data available</div>
                    )}
                </div>

                {/* Category Bar Chart */}
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-lg font-semibold mb-4">Time by Category</h2>
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
                        <div className="text-center text-gray-500 py-12">No data available</div>
                    )}
                </div>
            </div>

            {/* Top Apps Table */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold">Top Applications</h2>
                </div>
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Application
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Category
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Type
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Time Spent
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {dashboardData?.top_apps?.map((app, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900">{app.display_name}</div>
                                    <div className="text-xs text-gray-500">{app.executable_name}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                                    {formatTime(app.total_seconds)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {(!dashboardData?.top_apps || dashboardData.top_apps.length === 0) && (
                    <div className="text-center py-12 text-gray-500">
                        No application usage data for the selected date range
                    </div>
                )}
            </div>
        </div>
    );
}
