import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, ArrowRight } from 'lucide-react';
import { formatTime, formatSeconds } from './utils';

export default function SessionLogTable({ sessions, breaks, formatTimeLocal }) {
    // Combine and sort events
    const events = [
        ...sessions.map(s => ({
            type: 'work',
            start: s.start_time,
            end: s.end_time,
            duration: s.work_seconds,
            label: 'Work Session',
            status: s.status
        })),
        ...breaks.map(b => ({
            type: 'break',
            start: b.start_time,
            end: b.end_time,
            duration: b.duration_seconds,
            label: b.break_name || 'Break',
            is_paid: b.is_paid
        }))
    ].sort((a, b) => new Date(a.start) - new Date(b.start));

    if (events.length === 0) return null;

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Session & Break Log
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border max-h-[300px] overflow-y-auto relative">
                    <Table>
                        <TableHeader className="sticky top-0 z-10 bg-background shadow-sm">
                            <TableRow>
                                <TableHead className="bg-background">Type</TableHead>
                                <TableHead className="bg-background">Start Time</TableHead>
                                <TableHead className="bg-background">End Time</TableHead>
                                <TableHead className="bg-background">Duration</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {events.map((event, i) => (
                                <TableRow key={i}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${event.type === 'work' ? 'bg-green-500' : 'bg-orange-500'}`} />
                                            {event.label}
                                        </div>
                                    </TableCell>
                                    <TableCell>{formatTimeLocal(event.start)}</TableCell>
                                    <TableCell>
                                        {event.end ? formatTimeLocal(event.end) : <span className="text-muted-foreground italic">Ongoing</span>}
                                    </TableCell>
                                    <TableCell>{formatSeconds(event.duration)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
