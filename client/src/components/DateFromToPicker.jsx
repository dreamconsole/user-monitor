import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Calendar } from 'lucide-react';

/**
 * Simple from / to date range using two native date inputs.
 * @param {{ startDate: string, endDate: string, onChange: (start: string, end: string) => void, maxDate?: string, className?: string }} props
 */
export default function DateFromToPicker({ startDate, endDate, onChange, maxDate, className = '' }) {
    const max = maxDate || new Date().toISOString().split('T')[0];

    const handleStart = (e) => {
        const start = e.target.value;
        let end = endDate;
        if (start && end && start > end) end = start;
        onChange(start, end);
    };

    const handleEnd = (e) => {
        const end = e.target.value;
        let start = startDate;
        if (start && end && end < start) start = end;
        onChange(start, end);
    };

    return (
        <div className={`flex flex-wrap items-end gap-4 ${className}`}>
            <div className="space-y-1.5">
                <Label htmlFor="date-from" className="text-xs uppercase font-bold text-muted-foreground">
                    From date
                </Label>
                <div className="relative">
                    <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                        id="date-from"
                        type="date"
                        value={startDate || ''}
                        max={endDate && endDate < max ? endDate : max}
                        onChange={handleStart}
                        className="pl-9 w-[168px] bg-background"
                    />
                </div>
            </div>
            <div className="space-y-1.5">
                <Label htmlFor="date-to" className="text-xs uppercase font-bold text-muted-foreground">
                    To date
                </Label>
                <div className="relative">
                    <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                        id="date-to"
                        type="date"
                        value={endDate || ''}
                        min={startDate || undefined}
                        max={max}
                        onChange={handleEnd}
                        className="pl-9 w-[168px] bg-background"
                    />
                </div>
            </div>
        </div>
    );
}
