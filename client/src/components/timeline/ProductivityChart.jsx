import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart as PieChartIcon } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { formatSeconds, PRODUCTIVITY_COLORS } from './utils';

export default function ProductivityChart({ apps }) {
    if (!apps || apps.length === 0) {
        return (
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <PieChartIcon className="w-4 h-4" />
                        Productivity Breakdown
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-sm text-muted-foreground flex h-[150px] items-center justify-center">No app usage data</div>
                </CardContent>
            </Card>
        );
    }

    const data = [
        { name: 'Productive', value: 0, color: PRODUCTIVITY_COLORS.productive },
        { name: 'Non-Productive', value: 0, color: PRODUCTIVITY_COLORS.non_productive },
        { name: 'Neutral', value: 0, color: PRODUCTIVITY_COLORS.neutral },
    ];

    apps.forEach(app => {
        const type = app.productivity_type || 'neutral';
        if (type === 'productive') data[0].value += app.duration_seconds;
        else if (type === 'non_productive') data[1].value += app.duration_seconds;
        else data[2].value += app.duration_seconds;
    });

    const activeData = data.filter(d => d.value > 0);

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <PieChartIcon className="w-4 h-4" />
                    Productivity Breakdown
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[150px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={activeData}
                                cx="50%"
                                cy="50%"
                                innerRadius={40}
                                outerRadius={60}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {activeData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <RechartsTooltip
                                formatter={(value) => formatSeconds(value)}
                                contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                            />
                            <Legend
                                layout="vertical"
                                verticalAlign="middle"
                                align="right"
                                iconSize={8}
                                wrapperStyle={{ fontSize: '10px' }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
