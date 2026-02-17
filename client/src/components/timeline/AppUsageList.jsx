import { Badge } from '@/components/ui/badge';
import { formatSeconds } from './utils';
import { useMemo } from 'react';

export default function AppUsageList({ apps }) {
    // Aggregate by app name
    const { sorted, grandTotal } = useMemo(() => {
        const appMap = {};
        apps.forEach(a => {
            const key = a.app_name || a.executable_name || 'Unknown';
            if (!appMap[key]) {
                appMap[key] = {
                    app_name: key,
                    productivity_type: a.productivity_type,
                    category_name: a.category_name,
                    total_seconds: 0,
                };
            }
            appMap[key].total_seconds += a.duration_seconds;
        });

        const sorted = Object.values(appMap).sort((a, b) => b.total_seconds - a.total_seconds);
        const grandTotal = sorted.reduce((s, a) => s + a.total_seconds, 0) || 1;
        return { sorted, grandTotal };
    }, [apps]);

    const badgeVariant = (type) => {
        if (type === 'productive') return 'default';
        if (type === 'non_productive') return 'destructive';
        return 'secondary';
    };

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b text-left text-muted-foreground">
                        <th className="py-2 font-medium">Application</th>
                        <th className="py-2 font-medium">Category</th>
                        <th className="py-2 font-medium">Type</th>
                        <th className="py-2 font-medium text-right">Duration</th>
                        <th className="py-2 font-medium text-right">%</th>
                    </tr>
                </thead>
                <tbody>
                    {sorted.map((app, i) => (
                        <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                            <td className="py-2 font-medium">{app.app_name}</td>
                            <td className="py-2 text-muted-foreground">{app.category_name || '--'}</td>
                            <td className="py-2">
                                <Badge variant={badgeVariant(app.productivity_type)} className="text-[10px]">
                                    {(app.productivity_type || 'neutral').replace('_', '-')}
                                </Badge>
                            </td>
                            <td className="py-2 text-right">{formatSeconds(app.total_seconds)}</td>
                            <td className="py-2 text-right">{((app.total_seconds / grandTotal) * 100).toFixed(1)}%</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
