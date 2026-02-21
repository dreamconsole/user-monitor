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
    Menu,
    LogOut,
    ShieldAlert,
    Building2,
    Settings,
    Server
} from 'lucide-react';
import NotificationBell from './NotificationBell';
import ThemeToggle from '../ThemeToggle';

const SuperAdminSidebar = ({ className, onLinkClick }) => {
    const location = useLocation();

    const links = [
        { href: '/superadmin', label: 'Overview', icon: ShieldAlert },
        { href: '/superadmin/orgs', label: 'Organizations', icon: Building2 },
        { href: '/superadmin/settings', label: 'Global Settings', icon: Settings },
    ];

    return (
        <div className={`w-64 bg-slate-950 text-slate-50 border-r border-slate-800 h-full flex flex-col ${className}`}>
            <div className="h-16 flex items-center px-6 border-b border-slate-800 bg-slate-900">
                <ShieldAlert className="w-6 h-6 mr-3 text-red-500" />
                <span className="font-bold text-lg tracking-tight">SuperAdmin</span>
            </div>
            <nav className="flex-1 p-4 space-y-2">
                {links.map((link) => {
                    const Icon = link.icon;
                    const active = location.pathname === link.href;
                    return (
                        <Link to={link.href} key={link.href} onClick={onLinkClick}>
                            <Button
                                variant={active ? "secondary" : "ghost"}
                                className={`w-full justify-start transition-all hover:bg-slate-800 hover:text-white ${active ? 'bg-slate-800 text-white font-medium' : 'text-slate-400'}`}
                            >
                                <Icon className={`w-5 h-5 mr-3 ${active ? 'text-red-400' : 'text-slate-500'}`} />
                                {link.label}
                            </Button>
                        </Link>
                    );
                })}
            </nav>
            <div className="p-4 border-t border-slate-800 text-xs text-slate-500 flex items-center justify-center">
                <Server className="w-3 h-3 mr-2" /> System Monitor v1.0
            </div>
        </div>
    );
};

export default function SuperAdminLayout({ children }) {
    const { user, logout } = useAuthStore();
    const [mobileOpen, setMobileOpen] = useState(false);

    return (
        <div className="h-screen flex bg-muted/20">
            {/* Desktop Sidebar */}
            <div className="hidden lg:block h-full shadow-2xl z-10">
                <SuperAdminSidebar />
            </div>

            <div className="flex-1 flex flex-col h-full overflow-hidden">
                <header className="h-16 bg-background border-b flex items-center justify-between px-6 shadow-sm z-0">
                    <div className="flex items-center lg:hidden">
                        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="icon" className="-ml-2"><Menu className="w-6 h-6" /></Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="p-0 w-64 border-none">
                                <SuperAdminSidebar onLinkClick={() => setMobileOpen(false)} />
                            </SheetContent>
                        </Sheet>
                        <div className="ml-4 flex items-center lg:hidden">
                            <ShieldAlert className="w-5 h-5 mr-2 text-red-500" />
                            <span className="font-bold">SuperAdmin</span>
                        </div>
                    </div>

                    <div className="flex-1" />

                    <div className="flex items-center gap-3">
                        <div className="flex flex-col items-end hidden sm:flex text-right">
                            <span className="text-sm font-semibold text-red-600">{user?.name}</span>
                            <span className="text-xs text-muted-foreground capitalize font-mono">{user?.role}</span>
                        </div>
                        <ThemeToggle />
                        <NotificationBell />
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="relative h-10 w-10 rounded-full border border-red-200 hover:border-red-400 transition-colors">
                                    <Avatar className="h-full w-full">
                                        <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.name}&backgroundColor=ffdfdf`} alt={user?.name} />
                                        <AvatarFallback className="bg-red-100 text-red-700 font-bold">{user?.name?.[0]}</AvatarFallback>
                                    </Avatar>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56 mt-2" align="end" forceMount>
                                <DropdownMenuLabel className="font-normal border-b pb-2 mb-2">
                                    <div className="flex flex-col space-y-2">
                                        <p className="text-sm font-bold leading-none">{user?.name}</p>
                                        <p className="text-xs font-mono text-muted-foreground">{user?.email}</p>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuItem onClick={logout} className="text-red-600 focus:bg-red-50 focus:text-red-700 cursor-pointer font-medium font-medium">
                                    <LogOut className="mr-3 h-4 w-4" />
                                    Sign out Security Context
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </header>
                <main className="flex-1 overflow-auto bg-slate-50/50 dark:bg-background">
                    {children}
                </main>
            </div>
        </div>
    );
}
