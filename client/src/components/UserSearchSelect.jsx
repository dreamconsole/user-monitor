import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Search, ChevronDown, X, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/**
 * Searchable user select dropdown. Replaces plain Select/dropdown for user picking.
 * 
 * @param {Array} users - Array of user objects with { id, name, email, role }
 * @param {string} value - Currently selected user ID
 * @param {function} onChange - Called with user ID when selection changes
 * @param {string} [placeholder] - Placeholder text
 * @param {string} [className] - Additional container classes
 * @param {boolean} [showAllOption] - Whether to show an "All Users" option
 * @param {string} [allOptionLabel] - Label for the "All" option
 * @param {string} [allOptionValue] - Value for the "All" option (default: 'all')
 */
export default function UserSearchSelect({
    users = [],
    value,
    onChange,
    placeholder = 'Select user...',
    className = '',
    showAllOption = false,
    allOptionLabel = 'All Users',
    allOptionValue = 'all',
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef(null);
    const inputRef = useRef(null);

    const selectedUser = users.find(u => u.id === value);
    const displayText = value === allOptionValue
        ? allOptionLabel
        : selectedUser
            ? selectedUser.name
            : placeholder;

    const filtered = users.filter(u => {
        if (!search) return true;
        const q = search.toLowerCase();
        return u.name?.toLowerCase().includes(q)
            || u.email?.toLowerCase().includes(q)
            || u.emp_id?.toLowerCase().includes(q);
    });

    useEffect(() => {
        function handleClickOutside(e) {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false);
                setSearch('');
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (open && inputRef.current) {
            inputRef.current.focus();
        }
    }, [open]);

    const handleSelect = (id) => {
        onChange(id);
        setOpen(false);
        setSearch('');
    };

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="flex items-center justify-between w-full h-9 px-3 py-2 text-sm border rounded-md bg-background hover:bg-accent/50 transition-colors"
            >
                <span className={`truncate ${!selectedUser && value !== 'all' ? 'text-muted-foreground' : ''}`}>
                    {displayText}
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground ml-2" />
            </button>

            {open && (
                <div className="absolute z-50 mt-1 w-full min-w-[250px] bg-popover border rounded-md shadow-lg">
                    <div className="p-2 border-b">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                                ref={inputRef}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search by name or email..."
                                className="h-8 pl-8 text-sm"
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => setSearch('')}
                                    className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="max-h-[250px] overflow-y-auto p-1">
                        {showAllOption && (
                            <button
                                type="button"
                                onClick={() => handleSelect(allOptionValue)}
                                className={`flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-sm hover:bg-accent transition-colors ${value === allOptionValue ? 'bg-accent font-medium' : ''}`}
                            >
                                <User className="h-3.5 w-3.5 text-muted-foreground" />
                                <span>{allOptionLabel}</span>
                            </button>
                        )}
                        {filtered.length === 0 ? (
                            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                                No users found
                            </div>
                        ) : (
                            filtered.map(u => (
                                <button
                                    type="button"
                                    key={u.id}
                                    onClick={() => handleSelect(u.id)}
                                    className={`flex items-center justify-between w-full px-2 py-1.5 text-sm rounded-sm hover:bg-accent transition-colors ${value === u.id ? 'bg-accent font-medium' : ''}`}
                                >
                                    <div className="flex flex-col items-start min-w-0">
                                        <span className="truncate">{u.name}</span>
                                        <span className="text-[11px] text-muted-foreground truncate">{u.email}</span>
                                    </div>
                                    {u.role && (
                                        <Badge variant="outline" className="text-[10px] shrink-0 ml-2">
                                            {u.role === 'orgadmin' ? 'Admin' : u.role === 'manager' ? 'Mgr' : 'User'}
                                        </Badge>
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
