import { useState, useEffect } from 'react';
import useAuthStore from '@/lib/useAuthStore';
import { formatInTimeZone } from 'date-fns-tz';
import { Building2, User } from 'lucide-react';
import { cn } from '@/lib/utils';

function safeFormat(time, tz, pattern) {
    try {
        return formatInTimeZone(time, tz || 'UTC', pattern);
    } catch {
        return formatInTimeZone(time, 'UTC', pattern);
    }
}

function ClockBlock({ icon: Icon, label, tz, time }) {
    const abbr = safeFormat(time, tz, 'zzz');
    return (
        <div className="flex items-start gap-2 min-w-0">
            <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0 leading-tight">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground block">{label}</span>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
                    <span className="font-mono tabular-nums text-sm font-semibold text-foreground tracking-tight">
                        {safeFormat(time, tz, 'HH:mm:ss')}
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate max-w-[140px] sm:max-w-[180px]" title={tz}>
                        {abbr} · {tz || 'UTC'}
                    </span>
                </div>
            </div>
        </div>
    );
}

export default function HeaderClocks({ className }) {
    const user = useAuthStore((s) => s.user);
    const [now, setNow] = useState(() => new Date());

    const orgTz = user?.org_timezone || 'UTC';
    const userTz = user?.timezone || user?.org_timezone || 'UTC';

    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(id);
    }, []);

    if (!user) return null;

    return (
        <div
            className={cn(
                'flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-8 py-1 text-left border-l pl-4 md:pl-6 ml-0 md:ml-1 border-border/60',
                className
            )}
        >
            <ClockBlock icon={Building2} label="Organization" tz={orgTz} time={now} />
            <ClockBlock icon={User} label="Your profile" tz={userTz} time={now} />
        </div>
    );
}
