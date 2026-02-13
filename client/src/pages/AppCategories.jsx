import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Edit2, Trash2, Save, X } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function AppCategories() {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        productivity_type: 'neutral',
        description: ''
    });
    const [showCreateForm, setShowCreateForm] = useState(false);

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_URL}/app-tracking/categories`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCategories(response.data);
        } catch (error) {
            console.error('Failed to fetch categories:', error);
            alert('Failed to load categories');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_URL}/app-tracking/categories`, formData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setFormData({ name: '', productivity_type: 'neutral', description: '' });
            setShowCreateForm(false);
            fetchCategories();
        } catch (error) {
            console.error('Failed to create category:', error);
            alert(error.response?.data?.error || 'Failed to create category');
        }
    };

    const handleUpdate = async (id) => {
        try {
            const token = localStorage.getItem('token');
            const category = categories.find(c => c.id === id);
            await axios.patch(`${API_URL}/app-tracking/categories/${id}`, category, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setEditingId(null);
            fetchCategories();
        } catch (error) {
            console.error('Failed to update category:', error);
            alert('Failed to update category');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this category?')) return;

        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_URL}/app-tracking/categories/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchCategories();
        } catch (error) {
            console.error('Failed to delete category:', error);
            alert(error.response?.data?.error || 'Failed to delete category');
        }
    };

    const updateCategory = (id, field, value) => {
        setCategories(categories.map(cat =>
            cat.id === id ? { ...cat, [field]: value } : cat
        ));
    };

    const getProductivityBadge = (type) => {
        const styles = {
            productive: 'bg-green-100 text-green-800',
            non_productive: 'bg-red-100 text-red-800',
            neutral: 'bg-gray-100 text-gray-800'
        };
        const labels = {
            productive: 'Productive',
            non_productive: 'Non-Productive',
            neutral: 'Neutral'
        };
        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[type]}`}>
                {labels[type]}
            </span>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-500">Loading categories...</div>
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">App Categories</h1>
                    <p className="text-gray-600 mt-1">Manage application categories for productivity tracking</p>
                </div>
                <button
                    onClick={() => setShowCreateForm(!showCreateForm)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                    <Plus size={20} />
                    New Category
                </button>
            </div>

            {showCreateForm && (
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <h2 className="text-lg font-semibold mb-4">Create New Category</h2>
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Category Name *
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Productivity Type *
                            </label>
                            <select
                                value={formData.productivity_type}
                                onChange={(e) => setFormData({ ...formData, productivity_type: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="productive">Productive</option>
                                <option value="non_productive">Non-Productive</option>
                                <option value="neutral">Neutral</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Description
                            </label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                rows="3"
                            />
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="submit"
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                                Create Category
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowCreateForm(false)}
                                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Category Name
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Productivity Type
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Description
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {categories.map((category) => (
                            <tr key={category.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {editingId === category.id ? (
                                        <input
                                            type="text"
                                            value={category.name}
                                            onChange={(e) => updateCategory(category.id, 'name', e.target.value)}
                                            className="px-2 py-1 border border-gray-300 rounded"
                                        />
                                    ) : (
                                        <div className="text-sm font-medium text-gray-900">{category.name}</div>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {editingId === category.id ? (
                                        <select
                                            value={category.productivity_type}
                                            onChange={(e) => updateCategory(category.id, 'productivity_type', e.target.value)}
                                            className="px-2 py-1 border border-gray-300 rounded"
                                        >
                                            <option value="productive">Productive</option>
                                            <option value="non_productive">Non-Productive</option>
                                            <option value="neutral">Neutral</option>
                                        </select>
                                    ) : (
                                        getProductivityBadge(category.productivity_type)
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    {editingId === category.id ? (
                                        <input
                                            type="text"
                                            value={category.description || ''}
                                            onChange={(e) => updateCategory(category.id, 'description', e.target.value)}
                                            className="w-full px-2 py-1 border border-gray-300 rounded"
                                        />
                                    ) : (
                                        <div className="text-sm text-gray-500">{category.description || '-'}</div>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    {editingId === category.id ? (
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => handleUpdate(category.id)}
                                                className="text-green-600 hover:text-green-900"
                                            >
                                                <Save size={18} />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setEditingId(null);
                                                    fetchCategories();
                                                }}
                                                className="text-gray-600 hover:text-gray-900"
                                            >
                                                <X size={18} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => setEditingId(category.id)}
                                                className="text-blue-600 hover:text-blue-900"
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(category.id)}
                                                className="text-red-600 hover:text-red-900"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {categories.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                        No categories found. Create your first category to get started.
                    </div>
                )}
            </div>
        </div>
    );
}
