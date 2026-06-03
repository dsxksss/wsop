import { useState, useEffect } from "react";
import { Popover } from "radix-ui";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { fmtDate } from "../../lib/format";

interface DatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "选择日期",
  className = "",
}: DatePickerProps) {
  const [open, setOpen] = useState(false);

  // Parse current value or default to today
  const parseDate = (val: string) => {
    if (!val) return new Date();
    const parts = val.split("-").map(Number);
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    return new Date();
  };

  const selectedDate = value ? parseDate(value) : null;

  // Track the month/year we are viewing in the calendar grid
  const [viewDate, setViewDate] = useState(() => selectedDate || new Date());

  useEffect(() => {
    if (open && selectedDate) {
      setViewDate(selectedDate);
    }
  }, [open, value]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  // Navigation
  const prevMonth = () => {
    setViewDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setViewDate(new Date(year, month + 1, 1));
  };

  // Generate calendar days
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sunday, 1 = Monday...
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const days: { day: number; isCurrentMonth: boolean; dateString: string }[] = [];

  // Previous month filler days
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const prevMonthDate = new Date(year, month - 1, d);
    const dateStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    days.push({ day: d, isCurrentMonth: false, dateString: dateStr });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    days.push({ day: d, isCurrentMonth: true, dateString: dateStr });
  }

  // Next month filler days to complete 6 rows (42 days)
  const totalSlots = 42;
  const nextMonthFillerCount = totalSlots - days.length;
  for (let d = 1; d <= nextMonthFillerCount; d++) {
    const nextMonthDate = new Date(year, month + 1, d);
    const dateStr = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    days.push({ day: d, isCurrentMonth: false, dateString: dateStr });
  }

  const handleSelectDay = (dateStr: string) => {
    onChange(dateStr);
    setOpen(false);
  };

  const formattedValue = value ? fmtDate(value) : placeholder;
  const now = new Date();
  // 用本地年月日拼“今天”，与 dateString 口径一致（避免临近午夜时区错位）
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const monthNames = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"];

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={`w-full h-10 px-3.5 rounded-xl bg-zinc-950/40 border border-zinc-800/60 text-sm text-left flex items-center justify-between transition-colors focus:border-emerald-500/50 outline-none cursor-pointer ${
            value ? "text-zinc-200" : "text-zinc-500"
          } ${className}`}
        >
          <span>{formattedValue}</span>
          <CalendarIcon size={14} className="text-zinc-500 shrink-0" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={5}
          className="z-[60] w-72 p-4 rounded-2xl border border-zinc-800/70 bg-[#0c0f15] shadow-2xl outline-none"
        >
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-white tracking-tight">
              {year}年 {monthNames[month]}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={prevMonth}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 cursor-pointer outline-none"
              >
                <ChevronLeft size={15} />
              </button>
              <button
                type="button"
                onClick={nextMonth}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 cursor-pointer outline-none"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>

          {/* Day of week labels */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {["日", "一", "二", "三", "四", "五", "六"].map((w, idx) => (
              <span key={idx} className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                {w}
              </span>
            ))}
          </div>

          {/* Grid of days */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((item, idx) => {
              const isSelected = value === item.dateString;
              const isToday = todayStr === item.dateString;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectDay(item.dateString)}
                  className={`h-8 w-8 rounded-lg text-xs font-semibold flex items-center justify-center transition-all cursor-pointer outline-none ${
                    isSelected
                      ? "bg-emerald-500 text-white font-bold"
                      : isToday
                      ? "border border-emerald-500/50 text-emerald-400"
                      : item.isCurrentMonth
                      ? "text-zinc-300 hover:bg-zinc-800/60 hover:text-white"
                      : "text-zinc-600 hover:bg-zinc-800/30 hover:text-zinc-400"
                  }`}
                >
                  {item.day}
                </button>
              );
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
