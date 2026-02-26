import { useState, useMemo } from 'react';
import { Calendar } from 'lucide-react';

function fmt(date) {
    return date.toISOString().split('T')[0];
}

function getMonday(d) {
    const date = new Date(d);
    const day = date.getDay();
    date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
    return date;
}

const PRESETS = [
    {
        label: 'Today',
        getRange: () => {
            const t = fmt(new Date());
            return { start: t, end: t };
        }
    },
    {
        label: 'Yesterday',
        getRange: () => {
            const d = new Date();
            d.setDate(d.getDate() - 1);
            const y = fmt(d);
            return { start: y, end: y };
        }
    },
    {
        label: 'This Week',
        getRange: () => ({
            start: fmt(getMonday(new Date())),
            end: fmt(new Date())
        })
    },
    {
        label: 'Last Week',
        getRange: () => {
            const mon = getMonday(new Date());
            mon.setDate(mon.getDate() - 7);
            const sun = new Date(mon);
            sun.setDate(mon.getDate() + 6);
            return { start: fmt(mon), end: fmt(sun) };
        }
    },
    {
        label: 'Last 7 Days',
        getRange: () => {
            const now = new Date();
            const past = new Date();
            past.setDate(now.getDate() - 6);
            return { start: fmt(past), end: fmt(now) };
        }
    },
    {
        label: 'This Month',
        getRange: () => {
            const now = new Date();
            return {
                start: fmt(new Date(now.getFullYear(), now.getMonth(), 1)),
                end: fmt(now)
            };
        }
    },
    {
        label: 'Last Month',
        getRange: () => {
            const now = new Date();
            const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const last = new Date(now.getFullYear(), now.getMonth(), 0);
            return { start: fmt(first), end: fmt(last) };
        }
    },
    {
        label: 'Last 30 Days',
        getRange: () => {
            const now = new Date();
            const past = new Date();
            past.setDate(now.getDate() - 29);
            return { start: fmt(past), end: fmt(now) };
        }
    },
];

/**
 * @param {Object} props
 * @param {string} props.startDate
 * @param {string} props.endDate
 * @param {(start: string, end: string) => void} props.onChange
 */
export default function DateRangeFilter({ startDate, endDate, onChange }) {
    const [showCustom, setShowCustom] = useState(false);

    const activePreset = useMemo(() => {
        if (showCustom) return null;
        for (const preset of PRESETS) {
            const { start, end } = preset.getRange();
            if (start === startDate && end === endDate) return preset.label;
        }
        return null;
    }, [startDate, endDate, showCustom]);

    const handlePreset = (preset) => {
        const { start, end } = preset.getRange();
        setShowCustom(false);
        onChange(start, end);
    };

    return (
        <div className="flex flex-wrap items-center gap-1.5">
            {PRESETS.map(preset => (
                <button
                    key={preset.label}
                    onClick={() => handlePreset(preset)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${activePreset === preset.label
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                >
                    {preset.label}
                </button>
            ))}
            <button
                onClick={() => setShowCustom(true)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${showCustom || (!activePreset && (startDate || endDate))
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
            >
                Custom
            </button>
            {(showCustom || (!activePreset && (startDate || endDate))) && (
                <div className="flex items-center gap-1.5 ml-1">
                    <Calendar size={14} className="text-gray-400" />
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => { setShowCustom(true); onChange(e.target.value, endDate); }}
                        className="px-2 py-1 border border-gray-300 rounded-md text-xs"
                    />
                    <span className="text-gray-400 text-xs">to</span>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => { setShowCustom(true); onChange(startDate, e.target.value); }}
                        className="px-2 py-1 border border-gray-300 rounded-md text-xs"
                    />
                </div>
            )}
        </div>
    );
}
