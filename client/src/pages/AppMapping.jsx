import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Search, Filter, MapPin } from 'lucide-react';

export default function AppMapping() {
    const [apps, setApps] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all, mapped, unmapped
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchData();
    }, [filter]);

    const fetchData = async () => {
        try {
            const appsUrl = filter === 'unmapped'
                ? '/app-tracking/apps?unmapped=true'
                : '/app-tracking/apps';

            const [appsRes, categoriesRes] = await Promise.all([
                api.get(appsUrl),
                api.get('/app-tracking/categories')
            ]);

            setApps(appsRes.data);
            setCategories(categoriesRes.data);
        } catch (error) {
            console.error('Failed to fetch data:', error);
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const handleMapApp = async (appId, categoryId) => {
        try {
            await api.patch(`/app-tracking/apps/${appId}/map`, { category_id: categoryId });
            toast.success('App mapped successfully');
            fetchData();
        } catch (error) {
            console.error('Failed to map app:', error);
            toast.error('Failed to map app to category');
        }
    };

    const filteredApps = apps.filter(app => {
        const matchesSearch = app.executable_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (app.display_name && app.display_name.toLowerCase().includes(searchTerm.toLowerCase()));

        if (filter === 'mapped') return matchesSearch && app.category_id;
        if (filter === 'unmapped') return matchesSearch && !app.category_id;
        return matchesSearch;
    });

    const getProductivityBadge = (type) => {
        if (!type) return null;
        const styles = {
            productive: 'bg-green-100 text-green-800',
            non_productive: 'bg-red-100 text-red-800',
            neutral: 'bg-gray-100 text-gray-800'
        };
        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[type]}`}>
                {type.replace('_', ' ')}
            </span>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-500">Loading apps...</div>
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">App Mapping</h1>
                <p className="text-gray-600 mt-1">Assign detected applications to categories</p>
            </div>

            <div className="bg-white rounded-lg shadow-md p-4 mb-6">
                <div className="flex gap-4 items-center">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="Search apps..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-4 py-2 rounded-lg ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                        >
                            All ({apps.length})
                        </button>
                        <button
                            onClick={() => setFilter('mapped')}
                            className={`px-4 py-2 rounded-lg ${filter === 'mapped' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                        >
                            Mapped
                        </button>
                        <button
                            onClick={() => setFilter('unmapped')}
                            className={`px-4 py-2 rounded-lg ${filter === 'unmapped' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                        >
                            Unmapped
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Application
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Executable Name
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Current Category
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Assign Category
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredApps.map((app) => (
                            <tr key={app.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900">
                                        {app.display_name || app.executable_name}
                                    </div>
                                    {app.is_auto_detected && (
                                        <div className="text-xs text-gray-500">Auto-detected</div>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-gray-500 font-mono">{app.executable_name}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {app.category_name ? (
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-gray-900">{app.category_name}</span>
                                            {getProductivityBadge(app.productivity_type)}
                                        </div>
                                    ) : (
                                        <span className="text-sm text-gray-400">Not assigned</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <select
                                        value={app.category_id || ''}
                                        onChange={(e) => handleMapApp(app.id, e.target.value)}
                                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    >
                                        <option value="">Select category...</option>
                                        {categories.map((cat) => (
                                            <option key={cat.id} value={cat.id}>
                                                {cat.name} ({cat.productivity_type})
                                            </option>
                                        ))}
                                    </select>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filteredApps.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                        {searchTerm ? 'No apps match your search' : 'No apps found'}
                    </div>
                )}
            </div>
        </div>
    );
}
