import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const COLORS = ['#22c55e', '#e2e8f0'];

export default function SubscriptionDaysChart({ daysRemaining, periodTotalDays, label }) {
    const total = Math.max(periodTotalDays || 30, 1);
    const remaining = Math.min(Math.max(daysRemaining ?? 0, 0), total);
    const used = total - remaining;

    const data = [
        { name: 'Remaining', value: remaining },
        { name: 'Elapsed', value: used > 0 ? used : 0.001 },
    ];

    return (
        <div className="flex flex-col items-center">
            <div className="w-[140px] h-[140px]">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={42}
                            outerRadius={58}
                            paddingAngle={2}
                            dataKey="value"
                            startAngle={90}
                            endAngle={-270}
                        >
                            {data.map((_, index) => (
                                <Cell key={index} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <p className="text-2xl font-bold mt-1">{remaining}</p>
            <p className="text-xs text-muted-foreground text-center">{label || 'days left in period'}</p>
        </div>
    );
}
