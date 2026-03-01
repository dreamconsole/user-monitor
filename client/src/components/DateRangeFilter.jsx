import { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

/* ─── helpers ─────────────────────────────────────────────── */
function fmt(date) {
    return date.toISOString().split('T')[0];
}
function getMonday(d) {
    const date = new Date(d);
    const day = date.getDay();
    date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
    return date;
}
function parseDate(str) {
    if (!str) return null;
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
}
function sameDay(a, b) {
    return a && b && a.getFullYear() === b.getFullYear()
        && a.getMonth() === b.getMonth()
        && a.getDate() === b.getDate();
}
function clamp(date, min, max) {
    if (min && date < min) return new Date(min);
    if (max && date > max) return new Date(max);
    return date;
}
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

/* ─── presets ──────────────────────────────────────────────── */
const PRESETS = [
    {
        label: 'Today',
        getRange: () => { const t = fmt(new Date()); return { start: t, end: t }; }
    },
    {
        label: 'Yesterday',
        getRange: () => {
            const d = new Date(); d.setDate(d.getDate() - 1);
            const y = fmt(d); return { start: y, end: y };
        }
    },
    {
        label: 'Last Week',
        getRange: () => {
            const mon = getMonday(new Date()); mon.setDate(mon.getDate() - 7);
            const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
            return { start: fmt(mon), end: fmt(sun) };
        }
    },
    {
        label: 'This Month',
        getRange: () => {
            const now = new Date();
            return { start: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), end: fmt(now) };
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
    { label: 'Custom Range', getRange: () => null },
];

/* ─── mini calendar ────────────────────────────────────────── */
function MiniCalendar({ year, month, startSel, endSel, hovered, onDayClick, onDayHover, onPrev, onNext, showPrev = true, showNext = true }) {
    const firstDay = new Date(year, month, 1);
    const startDow = (firstDay.getDay() + 6) % 7; // Mon=0
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

    const start = parseDate(startSel);
    const end = parseDate(endSel);
    const hover = hovered;

    function inRange(d) {
        if (!d || !start) return false;
        const rangeEnd = end || hover;
        if (!rangeEnd) return false;
        const lo = start < rangeEnd ? start : rangeEnd;
        const hi = start < rangeEnd ? rangeEnd : start;
        return d > lo && d < hi;
    }

    return (
        <div className="select-none">
            {/* header */}
            <div className="flex items-center justify-between mb-3">
                {showPrev
                    ? <button onClick={onPrev} className="p-1 rounded hover:bg-muted transition-colors"><ChevronLeft size={14} /></button>
                    : <span className="w-6" />}
                <span className="text-xs font-semibold">{MONTH_NAMES[month]} {year}</span>
                {showNext
                    ? <button onClick={onNext} className="p-1 rounded hover:bg-muted transition-colors"><ChevronRight size={14} /></button>
                    : <span className="w-6" />}
            </div>
            {/* day labels */}
            <div className="grid grid-cols-7 mb-1">
                {DAY_LABELS.map(l => (
                    <div key={l} className="text-center text-[10px] font-medium text-muted-foreground py-0.5">{l}</div>
                ))}
            </div>
            {/* days */}
            <div className="grid grid-cols-7 gap-y-0.5">
                {cells.map((d, i) => {
                    if (!d) return <div key={`e${i}`} />;
                    const isStart = sameDay(d, start);
                    const isEnd = sameDay(d, end);
                    const isHover = sameDay(d, hover);
                    const inRng = inRange(d);
                    const today = sameDay(d, new Date());

                    let cls = 'relative flex items-center justify-center text-[11px] h-7 w-full cursor-pointer transition-colors rounded-sm ';
                    if (isStart || isEnd) {
                        cls += 'bg-primary text-primary-foreground font-semibold z-10 rounded-full ';
                    } else if (inRng) {
                        cls += 'bg-primary/15 text-foreground rounded-none ';
                    } else if (isHover && start && !end) {
                        cls += 'bg-primary/10 rounded-full ';
                    } else {
                        cls += 'hover:bg-muted text-foreground ';
                    }
                    if (today && !isStart && !isEnd) cls += 'font-bold underline underline-offset-2 ';

                    return (
                        <div
                            key={d.toISOString()}
                            className={cls}
                            onClick={() => onDayClick(d)}
                            onMouseEnter={() => onDayHover(d)}
                            onMouseLeave={() => onDayHover(null)}
                        >
                            {d.getDate()}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/* ─── main component ───────────────────────────────────────── */
/**
 * @param {{ startDate: string, endDate: string, onChange: (start:string,end:string)=>void }} props
 */
export default function DateRangeFilter({ startDate, endDate, onChange }) {
    const [open, setOpen] = useState(false);
    const [activePreset, setActivePreset] = useState('Today');
    const [customMode, setCustomMode] = useState(false);
    const [selStart, setSelStart] = useState(startDate || '');
    const [selEnd, setSelEnd] = useState(endDate || '');
    const [hovered, setHovered] = useState(null);

    const now = new Date();
    const [leftYear, setLeftYear] = useState(now.getFullYear());
    const [leftMonth, setLeftMonth] = useState(now.getMonth());

    const rightYear = leftMonth === 11 ? leftYear + 1 : leftYear;
    const rightMonth = leftMonth === 11 ? 0 : leftMonth + 1;

    const ref = useRef(null);

    /* close on outside click */
    useEffect(() => {
        function handle(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
        document.addEventListener('mousedown', handle);
        return () => document.removeEventListener('mousedown', handle);
    }, []);

    /* sync external changes */
    useEffect(() => { setSelStart(startDate || ''); }, [startDate]);
    useEffect(() => { setSelEnd(endDate || ''); }, [endDate]);

    /* label shown on the trigger button */
    const triggerLabel = useMemo(() => {
        if (activePreset && activePreset !== 'Custom Range') return activePreset;
        if (selStart && selEnd) return `${selStart} → ${selEnd}`;
        if (selStart) return `From ${selStart}`;
        return 'Select Range';
    }, [activePreset, selStart, selEnd]);

    /* ── preset click ── */
    function handlePreset(preset) {
        setActivePreset(preset.label);
        if (preset.label === 'Custom Range') {
            setCustomMode(true);
            setSelStart('');
            setSelEnd('');
            return;
        }
        setCustomMode(false);
        const range = preset.getRange();
        setSelStart(range.start);
        setSelEnd(range.end);
        onChange(range.start, range.end);
        setOpen(false);
    }

    /* ── calendar day click ── */
    function handleDayClick(date) {
        const d = fmt(date);
        if (!selStart || (selStart && selEnd)) {
            setSelStart(d);
            setSelEnd('');
        } else {
            const start = parseDate(selStart);
            if (date < start) {
                setSelEnd(selStart);
                setSelStart(d);
                onChange(d, selStart);
            } else {
                setSelEnd(d);
                onChange(selStart, d);
            }
        }
    }

    /* ── apply custom ── */
    function applyCustom() {
        if (selStart && selEnd) {
            onChange(selStart, selEnd);
            setOpen(false);
        }
    }

    function prevMonth() {
        if (leftMonth === 0) { setLeftMonth(11); setLeftYear(y => y - 1); }
        else setLeftMonth(m => m - 1);
    }
    function nextMonth() {
        if (leftMonth === 11) { setLeftMonth(0); setLeftYear(y => y + 1); }
        else setLeftMonth(m => m + 1);
    }

    return (
        <div className="relative" ref={ref}>
            {/* ── trigger ── */}
            <button
                onClick={() => setOpen(o => !o)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-background text-xs font-medium hover:bg-muted transition-colors shadow-sm"
            >
                <Calendar size={13} className="text-muted-foreground" />
                <span>{triggerLabel}</span>
                <ChevronRight size={12} className={`text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`} />
            </button>

            {/* ── dropdown panel ── */}
            {open && (
                <div className="absolute z-50 top-full mt-1 right-0 flex rounded-lg shadow-xl border border-border bg-background overflow-hidden"
                    style={{ minWidth: 510 }}>

                    {/* LEFT — presets */}
                    <div className="flex flex-col gap-0.5 p-3 border-r border-border bg-muted/30" style={{ width: 148 }}>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 px-1">Quick Select</p>
                        {PRESETS.map(preset => (
                            <button
                                key={preset.label}
                                onClick={() => handlePreset(preset)}
                                className={`text-left px-3 py-1.5 rounded-md text-xs font-medium transition-colors w-full ${activePreset === preset.label
                                    ? 'bg-primary text-primary-foreground'
                                    : 'text-foreground hover:bg-muted'
                                    }`}
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>

                    {/* RIGHT — calendars */}
                    <div className="flex flex-col p-4 gap-3">
                        <div className="flex gap-6">
                            {/* left calendar */}
                            <MiniCalendar
                                year={leftYear} month={leftMonth}
                                startSel={selStart} endSel={selEnd} hovered={hovered}
                                onDayClick={handleDayClick}
                                onDayHover={setHovered}
                                onPrev={prevMonth} onNext={nextMonth}
                                showPrev={true} showNext={false}
                            />
                            {/* divider */}
                            <div className="w-px bg-border" />
                            {/* right calendar */}
                            <MiniCalendar
                                year={rightYear} month={rightMonth}
                                startSel={selStart} endSel={selEnd} hovered={hovered}
                                onDayClick={handleDayClick}
                                onDayHover={setHovered}
                                onPrev={prevMonth} onNext={nextMonth}
                                showPrev={false} showNext={true}
                            />
                        </div>

                        {/* selected range display */}
                        {(selStart || selEnd) && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground border-t border-border pt-3">
                                <span className="font-medium text-foreground">{selStart || '—'}</span>
                                <span>→</span>
                                <span className="font-medium text-foreground">{selEnd || '—'}</span>
                            </div>
                        )}

                        {/* footer actions (custom only) */}
                        {customMode && (
                            <div className="flex justify-end gap-2 border-t border-border pt-3">
                                <button
                                    onClick={() => { setOpen(false); }}
                                    className="px-3 py-1 text-xs rounded-md bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                                >Cancel</button>
                                <button
                                    onClick={applyCustom}
                                    disabled={!selStart || !selEnd}
                                    className="px-3 py-1 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40"
                                >Apply</button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
