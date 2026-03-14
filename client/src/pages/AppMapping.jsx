import React, { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Search, Globe, Monitor, Trash2, Plus, X } from 'lucide-react';

// ─── Shared helpers ────────────────────────────────────────────────────────────

const PRODUCTIVITY_LABELS = {
    productive: 'Productive',
    non_productive: 'Non-Productive',
    neutral: 'Neutral',
};

const PRODUCTIVITY_BADGE = {
    productive: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    non_productive: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    neutral: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
};

function ProductivityBadge({ type }) {
    if (!type) return <span className="text-sm text-muted-foreground">Not assigned</span>;
    return (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${PRODUCTIVITY_BADGE[type] || PRODUCTIVITY_BADGE.neutral}`}>
            {PRODUCTIVITY_LABELS[type] || type}
        </span>
    );
}

function TabButton({ active, onClick, icon: Icon, label, count }) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                active
                    ? 'border-primary text-primary bg-card'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/40'
            }`}
        >
            <Icon size={16} />
            {label}
            {count !== undefined && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    {count}
                </span>
            )}
        </button>
    );
}

// ─── Apps Tab ─────────────────────────────────────────────────────────────────

function AppsTab() {
    const [apps, setApps] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    const fetchData = useCallback(async () => {
        try {
            const appsUrl = filter === 'unmapped' ? '/app-tracking/apps?unmapped=true' : '/app-tracking/apps';
            const [appsRes, categoriesRes] = await Promise.all([
                api.get(appsUrl),
                api.get('/app-tracking/categories'),
            ]);
            setApps(appsRes.data);
            setCategories(categoriesRes.data);
        } catch (error) {
            console.error('Failed to fetch data:', error);
            toast.error('Failed to load apps');
        } finally {
            setLoading(false);
        }
    }, [filter]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleMapApp = async (appId, categoryId) => {
        try {
            await api.patch(`/app-tracking/apps/${appId}/map`, { category_id: categoryId });
            toast.success('App mapped successfully');
            fetchData();
        } catch (error) {
            toast.error('Failed to map app to category');
        }
    };

    const filteredApps = apps.filter(app => {
        const matchesSearch =
            app.executable_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (app.display_name && app.display_name.toLowerCase().includes(searchTerm.toLowerCase()));
        if (filter === 'mapped') return matchesSearch && app.category_id;
        if (filter === 'unmapped') return matchesSearch && !app.category_id;
        return matchesSearch;
    });

    if (loading) return <div className="flex items-center justify-center h-48 text-muted-foreground">Loading apps...</div>;

    return (
        <div>
            {/* Filters */}
            <div className="bg-card border rounded-lg p-4 mb-4 flex gap-4 items-center">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                    <input
                        type="text"
                        placeholder="Search apps..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                </div>
                <div className="flex gap-2">
                    {['all', 'mapped', 'unmapped'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-lg text-sm capitalize ${filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                        >
                            {f === 'all' ? `All (${apps.length})` : f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="bg-card border rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-border">
                    <thead className="bg-muted/50">
                        <tr>
                            {['Application', 'Executable', 'Current Category', 'Assign Category'].map(h => (
                                <th key={h} className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {filteredApps.map(app => (
                            <tr key={app.id} className="hover:bg-muted/30">
                                <td className="px-6 py-4">
                                    <div className="text-sm font-medium text-foreground">{app.display_name || app.executable_name}</div>
                                    {app.is_auto_detected && <div className="text-xs text-muted-foreground">Auto-detected</div>}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="text-sm text-muted-foreground font-mono">{app.executable_name}</div>
                                </td>
                                <td className="px-6 py-4">
                                    {app.category_name ? (
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-foreground">{app.category_name}</span>
                                            <ProductivityBadge type={app.productivity_type} />
                                        </div>
                                    ) : (
                                        <span className="text-sm text-muted-foreground">Not assigned</span>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    <select
                                        value={app.category_id || ''}
                                        onChange={e => handleMapApp(app.id, e.target.value)}
                                        className="px-3 py-2 border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                                    >
                                        <option value="">Select category...</option>
                                        {categories.map(cat => (
                                            <option key={cat.id} value={cat.id}>
                                                {cat.name} ({PRODUCTIVITY_LABELS[cat.productivity_type] || cat.productivity_type})
                                            </option>
                                        ))}
                                    </select>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filteredApps.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                        {searchTerm ? 'No apps match your search' : 'No apps found'}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Websites Tab ─────────────────────────────────────────────────────────────

function WebsitesTab() {
    const [rules, setRules] = useState([]);       // already classified
    const [seen, setSeen] = useState([]);         // seen in browser logs, unclassified
    const [categories, setCategories] = useState([]); // from /app-tracking/categories
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [newDomain, setNewDomain] = useState('');
    const [newCategory, setNewCategory] = useState('');
    const [saving, setSaving] = useState({});

    const fetchData = useCallback(async () => {
        try {
            const [domainsRes, categoriesRes] = await Promise.all([
                api.get('/app-tracking/domains'),
                api.get('/app-tracking/categories')
            ]);
            setRules(domainsRes.data.rules || []);
            setSeen(domainsRes.data.seen || []);
            setCategories(categoriesRes.data || []);
            
            // Set default category for "Add Rule" form to the first available category
            if (categoriesRes.data?.length > 0 && !newCategory) {
                setNewCategory(categoriesRes.data[0].id);
            }
        } catch (error) {
            console.error('Failed to fetch data:', error);
            toast.error('Failed to load website mappings');
        } finally {
            setLoading(false);
        }
    }, [newCategory]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleClassify = async (domain, categoryId) => {
        if (!categoryId) {
            // "Not Set" → delete the rule if it exists
            const existing = rules.find(r => r.domain === domain);
            if (existing) await handleDelete(domain);
            return;
        }
        setSaving(s => ({ ...s, [domain]: true }));
        try {
            await api.post('/app-tracking/domains', { domain, category_id: categoryId });
            toast.success(`${domain} mapped successfully`);
            fetchData();
        } catch (error) {
            toast.error('Failed to save domain mapping');
        } finally {
            setSaving(s => ({ ...s, [domain]: false }));
        }
    };

    const handleDelete = async (domain) => {
        setSaving(s => ({ ...s, [domain]: true }));
        try {
            await api.delete(`/app-tracking/domains/${encodeURIComponent(domain)}`);
            toast.success(`Mapping removed for ${domain}`);
            fetchData();
        } catch (error) {
            toast.error('Failed to remove domain mapping');
        } finally {
            setSaving(s => ({ ...s, [domain]: false }));
        }
    };

    const handleAddManual = async (e) => {
        e.preventDefault();
        if (!newDomain.trim() || !newCategory) return;
        await handleClassify(newDomain.trim(), newCategory);
        setNewDomain('');
        setShowAddForm(false);
    };

    const ruleRows = rules.map(r => ({
        domain: r.domain,
        classified: true,
        categoryId: r.category_id,
        categoryName: r.category_name,
        productivityType: r.productivity_type,
    }));

    const seenRows = seen.map(s => ({
        domain: s.domain,
        classified: false,
        categoryId: null,
        categoryName: null,
        productivityType: null,
    }));

    const allFilteredRows = [...ruleRows, ...seenRows].filter(row =>
        row.domain.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return <div className="flex items-center justify-center h-48 text-muted-foreground">Loading websites...</div>;

    return (
        <div>
            {/* Header bar */}
            <div className="bg-card border rounded-lg p-4 mb-4 flex gap-4 items-center">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                    <input
                        type="text"
                        placeholder="Search domains..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                </div>
                <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm"
                >
                    <Plus size={16} />
                    Add Website
                </button>
            </div>

            {/* Add manual domain form */}
            {showAddForm && (
                <div className="bg-card border rounded-lg p-5 mb-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-foreground">Add Website Mapping</h3>
                        <button onClick={() => setShowAddForm(false)} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
                    </div>
                    <form onSubmit={handleAddManual} className="flex gap-3 items-end flex-wrap">
                        <div className="flex-1 min-w-48">
                            <label className="block text-xs font-medium text-muted-foreground mb-1">Domain (e.g. youtube.com)</label>
                            <input
                                type="text"
                                placeholder="youtube.com"
                                value={newDomain}
                                onChange={e => setNewDomain(e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">Category</label>
                            <select
                                value={newCategory}
                                onChange={e => setNewCategory(e.target.value)}
                                className="px-3 py-2 border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                                required
                            >
                                <option value="" disabled>Select category...</option>
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.id}>
                                        {cat.name} ({PRODUCTIVITY_LABELS[cat.productivity_type] || cat.productivity_type})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90">Save</button>
                        <button type="button" onClick={() => setShowAddForm(false)} className="px-4 py-2 bg-muted text-muted-foreground rounded-lg text-sm hover:bg-muted/80">Cancel</button>
                    </form>
                </div>
            )}

            {/* Info note */}
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3 mb-4 text-sm text-blue-700 dark:text-blue-300">
                <strong>How this works:</strong> Domains detected during browser sessions appear here automatically. Assign categories to them to include them in productivity scoring. Domains left as "Not Set" have no effect on scores.
            </div>

            {/* Unified table */}
            <div className="bg-card border rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-border">
                    <thead className="bg-muted/50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Website / Domain</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Current Category</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Assign Category</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {allFilteredRows.map(row => (
                            <tr key={row.domain} className="hover:bg-muted/30">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <Globe size={14} className="text-muted-foreground shrink-0" />
                                        <span className="text-sm font-medium text-foreground font-mono">{row.domain}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    {row.categoryName ? (
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-foreground">{row.categoryName}</span>
                                            <ProductivityBadge type={row.productivityType} />
                                        </div>
                                    ) : (
                                        <span className="text-sm text-muted-foreground">Not assigned</span>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    <select
                                        value={row.categoryId || ''}
                                        disabled={saving[row.domain]}
                                        onChange={e => handleClassify(row.domain, e.target.value)}
                                        className="px-3 py-1.5 border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent text-sm disabled:opacity-50"
                                    >
                                        <option value="">Not Set</option>
                                        {categories.map(cat => (
                                            <option key={cat.id} value={cat.id}>
                                                {cat.name} ({PRODUCTIVITY_LABELS[cat.productivity_type] || cat.productivity_type})
                                            </option>
                                        ))}
                                    </select>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    {row.classified && (
                                        <button
                                            onClick={() => handleDelete(row.domain)}
                                            disabled={saving[row.domain]}
                                            title="Remove mapping"
                                            className="text-destructive hover:text-destructive/80 disabled:opacity-50"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {allFilteredRows.length === 0 && (
                    <div className="text-center py-16 text-muted-foreground">
                        <Globe size={32} className="mx-auto mb-3 opacity-30" />
                        <p className="font-medium">No websites found</p>
                        <p className="text-sm mt-1">
                            {searchTerm
                                ? 'No domains match your search'
                                : 'Browse the web with the agent running — domains will appear here automatically'}
                        </p>
                    </div>
                )}
            </div>

            {/* Legend */}
            <div className="mt-4 flex gap-4 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Classified domains affect productivity score</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400 inline-block" /> "Not Set" domains are ignored in score calculation</span>
            </div>
        </div>
    );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function AppMapping() {
    const [activeTab, setActiveTab] = useState('apps');

    return (
        <div className="p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-foreground">App & Website Mapping</h1>
                <p className="text-muted-foreground mt-1">
                    Classify applications and websites as productive, non-productive, or neutral
                </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b mb-6">
                <TabButton
                    active={activeTab === 'apps'}
                    onClick={() => setActiveTab('apps')}
                    icon={Monitor}
                    label="Applications"
                />
                <TabButton
                    active={activeTab === 'websites'}
                    onClick={() => setActiveTab('websites')}
                    icon={Globe}
                    label="Websites"
                />
            </div>

            {activeTab === 'apps' ? <AppsTab /> : <WebsitesTab />}
        </div>
    );
}
