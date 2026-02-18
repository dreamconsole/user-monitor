import { useState } from 'react';
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
} from 'lucide-react';
import NotificationBell from './NotificationBell';
import ThemeToggle from '../ThemeToggle';

const Sidebar = ({ className, onLinkClick }) => {
    const location = useLocation();
    const { user } = useAuthStore();

    const links = [
        { href: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['orgadmin', 'manager', 'user'] },
        { href: '/users', label: 'Users', icon: Users, roles: ['orgadmin', 'manager'] },
        { href: '/team-comparison', label: 'Team Comparison', icon: Users, roles: ['orgadmin', 'manager'] },
        // Timeline removed as requested
        // { href: '/timeline', label: 'Timeline', icon: CalendarDays, roles: ['orgadmin', 'manager', 'user'] },
        { href: '/app-management', label: 'App Management', icon: Activity, roles: ['orgadmin', 'manager', 'user'] },
        { href: '/settings', label: 'Organization Settings', icon: Settings, roles: ['orgadmin'] },
        { href: '/breaks', label: 'Break Management', icon: Coffee, roles: ['orgadmin'] },
        // App Categories & Mapping moved to App Management
        { href: '/activity-logs', label: 'Activity Logs', icon: ClipboardList, roles: ['orgadmin', 'manager'] },
        { href: '/reports', label: user?.role === 'user' ? 'My Reports' : 'Reports', icon: FileText, roles: ['orgadmin', 'manager', 'user'] },
    ];

    const filteredLinks = links.filter(link => link.roles.includes(user?.role));

    return (
        <div className={`w-64 bg-background border-r h-full flex flex-col ${className}`}>
            <div className="h-16 flex items-center px-6 border-b">
                <Building2 className="w-6 h-6 mr-3 text-primary" />
                <span className="font-bold text-lg truncate">{user?.org_name || 'User Monitor'}</span>
            </div>
            <nav className="flex-1 p-4 space-y-2">
                {filteredLinks.map((link) => {
                    const Icon = link.icon;
                    const active = location.pathname === link.href;
                    return (
                        <Link to={link.href} key={link.href} onClick={onLinkClick}>
                            <Button
                                variant={active ? "secondary" : "ghost"}
                                className={`w-full justify-start transition-all ${active ? 'bg-secondary font-medium' : ''}`}
                            >
                                <Icon className={`w-5 h-5 mr-3 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                                {link.label}
                            </Button>
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
};

export default function Layout({ children }) {
    const { user, logout } = useAuthStore();
    const [mobileOpen, setMobileOpen] = useState(false);

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

                    <div className="flex-1" />

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
