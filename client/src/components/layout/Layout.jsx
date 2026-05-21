import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import useAuthStore from '@/lib/useAuthStore';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
    LayoutDashboard,
    Users,
    User,
    GitCompare,
    Menu,
    LogOut,
    Building2,
    Settings,
    Coffee,
    FileText,
    Layers,
    FileInput,
    Activity,
    CalendarDays,
    ClipboardList,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    Megaphone,
} from 'lucide-react';
import NotificationBell from './NotificationBell';
import HeaderClocks from './HeaderClocks';
import ThemeToggle from '../ThemeToggle';
import useThemeStore from '@/lib/useThemeStore';
import { hexToHSL } from '@/lib/colorUtils';

const Sidebar = ({ className, onLinkClick }) => {
    const location = useLocation();
    const { user } = useAuthStore();
    const [collapsed, setCollapsed] = useState(false);
    const [openSubmenus, setOpenSubmenus] = useState({});

    const toggleSubmenu = (label) => {
        setOpenSubmenus(prev => ({
            ...prev,
            [label]: !prev[label]
        }));
    };

    const menuGroups = [
        {
            label: 'MAIN',
            links: [
                { href: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['orgadmin', 'manager', 'user'] },
            ]
        },
        {
            label: 'WORKFORCE',
            links: [
                { href: '/users', label: 'Users', icon: User, roles: ['orgadmin', 'manager'] },
                { href: '/teams', label: 'Teams', icon: Users, roles: ['orgadmin'] },
                { href: '/team-comparison', label: 'Team Comparison', icon: GitCompare, roles: ['orgadmin', 'manager'] },
            ]
        },
        {
            label: 'OPERATIONS',
            links: [
                {
                    label: 'App Usage Analytics',
                    icon: Activity,
                    roles: ['orgadmin', 'manager', 'user'],
                    sublinks: [
                        { href: '/app-usage', label: 'App Usage Dashboard' },
                        { href: '/app-categories', label: 'App Categories', roles: ['orgadmin'] },
                        { href: '/app-mapping', label: 'App Mapping', roles: ['orgadmin'] }
                    ]
                },
                ...(user?.features?.is_breaks_enabled !== false ? [{
                    label: 'Break Management',
                    icon: Coffee,
                    roles: ['orgadmin'],
                    sublinks: [
                        { href: '/break-groups', label: 'Break Groups' },
                        { href: '/breaks', label: 'Break Policies' }
                    ]
                }] : []),
                ...(user?.features?.is_campaigns_enabled ? [
                    { href: '/campaigns', label: 'Campaigns', icon: Megaphone, roles: ['orgadmin', 'manager'] },
                ] : []),
                { href: '/activity-logs', label: 'Activity Logs', icon: ClipboardList, roles: ['orgadmin', 'manager'] },
                { href: '/reports', label: user?.role === 'user' ? 'My Reports' : 'Reports', icon: FileText, roles: ['orgadmin', 'manager', 'user'] },
            ]
        },
        {
            label: 'SYSTEM',
            links: [
                { href: '/settings', label: 'Organization Settings', icon: Settings, roles: ['orgadmin'] },
            ]
        }
    ];

    return (
        <div className={`${collapsed ? 'w-20' : 'w-64'} bg-background border-r h-full flex flex-col transition-all duration-300 ${className}`}>
            <div className="h-16 flex items-center justify-between px-4 border-b shrink-0">
                <div className={`flex items-center overflow-hidden transition-all duration-300 ${collapsed ? 'w-0 opacity-0' : 'w-full opacity-100'}`}>
                    <div className="flex bg-primary/10 p-2 rounded-lg mr-3">
                        <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="font-bold text-sm truncate leading-tight">{user?.org_name || 'Organization'}</span>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Organization</span>
                    </div>
                </div>
                {collapsed && (
                    <div className="mx-auto flex bg-primary/10 p-2 rounded-lg" title={user?.org_name || 'Organization'}>
                        <Building2 className="w-5 h-5 text-primary" />
                    </div>
                )}
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-6 space-y-8">
                {menuGroups.map((group, groupIdx) => {
                    const filteredLinks = group.links.filter(link => link.roles.includes(user?.role));
                    if (filteredLinks.length === 0) return null;

                    return (
                        <div key={groupIdx} className="space-y-2">
                            {/* Section Label */}
                            {!collapsed && (
                                <div className="px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                    {group.label}
                                </div>
                            )}
                            {collapsed && (
                                <div className="px-3 border-b border-border/50 mx-2 mb-2" />
                            )}

                            <div className="space-y-1">
                                {filteredLinks.map((link) => {
                                    const Icon = link.icon;
                                    const isActiveChild = link.sublinks?.some(sub => location.pathname === sub.href);
                                    const active = location.pathname === link.href || isActiveChild;

                                    if (link.sublinks) {
                                        return (
                                            <div key={link.label} className="space-y-1">
                                                <div
                                                    onClick={() => !collapsed && toggleSubmenu(link.label)}
                                                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md transition-all duration-200 ${!collapsed ? 'cursor-pointer' : ''}
                                                        ${active ? 'bg-primary/5 text-primary font-semibold' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}
                                                    `}
                                                    title={collapsed ? link.label : ""}
                                                >
                                                    <div className="flex items-center">
                                                        {active && (
                                                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-3/4 bg-primary rounded-r-md" />
                                                        )}
                                                        <Icon className={`w-4 h-4 flex-shrink-0 ${collapsed ? 'mx-auto' : 'mr-3'} ${active ? 'text-primary' : ''}`} />
                                                        {!collapsed && <span className="truncate text-sm">{link.label}</span>}
                                                    </div>
                                                    {!collapsed && (
                                                        openSubmenus[link.label] || isActiveChild ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
                                                    )}
                                                </div>
                                                {(openSubmenus[link.label] || isActiveChild) && !collapsed && (
                                                    <div className="ml-7 space-y-1 mt-1">
                                                        {link.sublinks.filter(sub => !sub.roles || sub.roles.includes(user?.role)).map(sublink => {
                                                            const subActive = location.pathname === sublink.href;
                                                            return (
                                                                <Link to={sublink.href} key={sublink.href} onClick={onLinkClick}>
                                                                    <div className={`px-3 py-2 rounded-md text-sm transition-colors ${subActive ? 'text-primary font-medium bg-primary/5' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
                                                                        {sublink.label}
                                                                    </div>
                                                                </Link>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    }

                                    return (
                                        <Link to={link.href} key={link.href} onClick={onLinkClick} title={collapsed ? link.label : ""}>
                                            <div
                                                className={`flex items-center relative group px-3 py-2.5 rounded-md transition-all duration-200
                                                    ${active
                                                        ? 'bg-primary/5 text-primary font-semibold'
                                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                                    }
                                                `}
                                            >
                                                {/* Left Indicator for Active State */}
                                                {active && (
                                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-3/4 bg-primary rounded-r-md" />
                                                )}

                                                <Icon className={`w-4 h-4 flex-shrink-0 ${collapsed ? 'mx-auto' : 'mr-3'} ${active ? 'text-primary' : ''}`} />

                                                {!collapsed && (
                                                    <span className="truncate text-sm">{link.label}</span>
                                                )}
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </nav>

            <div className="p-4 border-t shrink-0">
                <Button
                    variant="ghost"
                    size="sm"
                    className={`w-full text-muted-foreground hover:bg-muted ${collapsed ? 'justify-center px-0' : 'justify-start'}`}
                    onClick={() => setCollapsed(!collapsed)}
                    title={collapsed ? "Expand Sidebar" : ""}
                >
                    {collapsed ? <ChevronRight className="w-4 h-4" /> : (
                        <>
                            <ChevronLeft className="w-4 h-4 mr-2" />
                            Collapse Sidebar
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
};

export default function Layout({ children }) {
    const { user, logout } = useAuthStore();
    const { theme } = useThemeStore();
    const [mobileOpen, setMobileOpen] = useState(false);

    // Dynamic primary color injection
    const orgPrimaryLight = user?.org_primary_color_light || '#0f172a'; // Default slate-900
    const orgPrimaryDark = user?.org_primary_color_dark || '#f8fafc'; // Default slate-50

    const activeHexColor = theme === 'dark' ? orgPrimaryDark : orgPrimaryLight;
    const activeHslColor = hexToHSL(activeHexColor);

    useEffect(() => {
        document.documentElement.style.setProperty('--primary', activeHslColor);
    }, [activeHslColor]);

    return (
        <div className="h-screen flex bg-muted/20">
            {/* Desktop Sidebar */}
            <div className="hidden lg:block h-full">
                <Sidebar />
            </div>

            <div className="flex-1 flex flex-col h-full overflow-hidden">
                <header className="h-16 bg-background border-b flex items-center justify-between px-6">
                    <div className="flex items-center lg:hidden">
                        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="icon" className="-ml-2"><Menu className="w-6 h-6" /></Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="p-0 w-64">
                                <Sidebar onLinkClick={() => setMobileOpen(false)} />
                            </SheetContent>
                        </Sheet>
                        <div className="ml-4 flex items-center lg:hidden">
                            <Building2 className="w-5 h-5 mr-2 text-primary" />
                            <span className="font-bold">{user?.org_name}</span>
                        </div>
                    </div>

                    <div className="flex-1 flex items-center justify-start min-w-0 min-h-0 overflow-hidden">
                        <HeaderClocks className="hidden lg:flex" />
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex flex-col items-end hidden sm:flex text-right">
                            <span className="text-sm font-semibold">{user?.name}</span>
                            <span className="text-xs text-muted-foreground capitalize">{user?.role}</span>
                        </div>
                        <ThemeToggle />
                        <NotificationBell />
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="relative h-10 w-10 rounded-full border">
                                    <Avatar className="h-full w-full">
                                        <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.name}`} alt={user?.name} />
                                        <AvatarFallback className="bg-primary text-primary-foreground">{user?.name?.[0]}</AvatarFallback>
                                    </Avatar>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56 mt-2" align="end" forceMount>
                                <DropdownMenuLabel className="font-normal">
                                    <div className="flex flex-col space-y-2">
                                        <p className="text-sm font-medium leading-none">{user?.name}</p>
                                        <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild className="cursor-pointer">
                                    <Link to="/profile">
                                        <Users className="mr-3 h-4 w-4" />
                                        My Profile
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={logout} className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer">
                                    <LogOut className="mr-3 h-4 w-4" />
                                    Log out
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </header>
                <main className="flex-1 overflow-auto p-6">
                    <div className="max-w-7xl mx-auto">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
