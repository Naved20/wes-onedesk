import * as React from "react";
import { useState, useEffect } from "react";
import {
  Calendar as CalendarIcon,
  X,
  Check,
  ChevronRight,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import {
  format,
  subDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  differenceInDays,
  parseISO,
  isValid,
} from "date-fns";
import { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface MaterialDateRangePickerProps {
  startDate?: string;
  endDate?: string;
  onRangeChange: (startDate: string, endDate: string) => void;
  className?: string;
  placeholder?: string;
}

export function MaterialDateRangePicker({
  startDate,
  endDate,
  onRangeChange,
  className,
  placeholder = "Select Date Range",
}: MaterialDateRangePickerProps) {
  const [open, setOpen] = useState(false);

  // Convert string YYYY-MM-DD to Date object safely
  const parseStringToDate = (dateStr?: string): Date | undefined => {
    if (!dateStr) return undefined;
    const parsed = parseISO(dateStr);
    return isValid(parsed) ? parsed : undefined;
  };

  const [tempRange, setTempRange] = useState<DateRange | undefined>(() => ({
    from: parseStringToDate(startDate),
    to: parseStringToDate(endDate),
  }));

  // Sync internal tempRange when props change
  useEffect(() => {
    setTempRange({
      from: parseStringToDate(startDate),
      to: parseStringToDate(endDate),
    });
  }, [startDate, endDate]);

  const handleApply = () => {
    const formattedFrom = tempRange?.from ? format(tempRange.from, "yyyy-MM-dd") : "";
    const formattedTo = tempRange?.to
      ? format(tempRange.to, "yyyy-MM-dd")
      : formattedFrom; // fallback to single day range if 'to' is not selected

    onRangeChange(formattedFrom, formattedTo);
    setOpen(false);
  };

  const handleClear = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setTempRange(undefined);
    onRangeChange("", "");
    setOpen(false);
  };

  const setPreset = (preset: "today" | "yesterday" | "thisWeek" | "thisMonth" | "last30" | "thisYear") => {
    const today = new Date();
    let from: Date;
    let to: Date = today;

    switch (preset) {
      case "today":
        from = today;
        to = today;
        break;
      case "yesterday":
        from = subDays(today, 1);
        to = subDays(today, 1);
        break;
      case "thisWeek":
        from = startOfWeek(today, { weekStartsOn: 1 });
        to = endOfWeek(today, { weekStartsOn: 1 });
        break;
      case "thisMonth":
        from = startOfMonth(today);
        to = endOfMonth(today);
        break;
      case "last30":
        from = subDays(today, 29);
        to = today;
        break;
      case "thisYear":
        from = startOfYear(today);
        to = endOfYear(today);
        break;
    }

    setTempRange({ from, to });
  };

  const fromDate = parseStringToDate(startDate);
  const toDate = parseStringToDate(endDate);
  const hasSelection = !!fromDate;

  const totalDays = tempRange?.from && tempRange?.to
    ? differenceInDays(tempRange.to, tempRange.from) + 1
    : tempRange?.from
    ? 1
    : 0;

  return (
    <>
      {/* Trigger Button */}
      <div className={cn("relative w-full", className)}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "flex items-center gap-2 px-3.5 h-10 rounded-full border text-xs transition-all duration-200 shadow-sm w-full justify-between font-normal",
            hasSelection
              ? "bg-primary/5 border-primary/40 text-primary font-medium hover:bg-primary/10"
              : "bg-background border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          )}
        >
          <div className="flex items-center gap-2 truncate">
            <CalendarIcon className={cn("h-3.5 w-3.5 shrink-0", hasSelection ? "text-primary" : "text-muted-foreground")} />
            <span className="truncate">
              {hasSelection ? (
                <>
                  {format(fromDate!, "MMM dd, yyyy")}
                  {toDate ? ` — ${format(toDate, "MMM dd, yyyy")}` : ""}
                </>
              ) : (
                placeholder
              )}
            </span>
          </div>

          {hasSelection ? (
            <div
              role="button"
              tabIndex={0}
              onClick={handleClear}
              className="p-0.5 rounded-full hover:bg-primary/20 transition-colors ml-1.5"
              title="Clear date range"
            >
              <X className="h-3.5 w-3.5 text-primary" />
            </div>
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 opacity-60" />
          )}
        </button>
      </div>

      {/* Material Range Picker Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[560px] p-0 overflow-hidden rounded-3xl border-0 shadow-2xl bg-card">
          {/* Material Header (Amber Gradient matching screenshot) */}
          <div className="bg-gradient-to-r from-amber-500 via-amber-500 to-amber-600 text-white p-6 space-y-4 relative">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider font-bold opacity-90 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4" /> SELECT DATE RANGE
              </span>
              <div className="flex items-center gap-2">
                {totalDays > 0 && (
                  <Badge variant="secondary" className="bg-white/20 text-white backdrop-blur-md border-0 text-xs font-semibold px-3 py-1 rounded-full">
                    {totalDays} {totalDays === 1 ? "Day" : "Days"} Selected
                  </Badge>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-6 w-6 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Display active start and end dates */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="bg-white/20 backdrop-blur-md rounded-2xl p-4 border border-white/25 shadow-inner">
                <span className="text-[10px] uppercase tracking-wider font-bold text-white/80 block">START DATE</span>
                <span className="text-base sm:text-lg font-bold block mt-1 text-white truncate">
                  {tempRange?.from ? format(tempRange.from, "EEE, MMM dd, yyyy") : "Pick Start Date"}
                </span>
              </div>
              <div className="bg-white/20 backdrop-blur-md rounded-2xl p-4 border border-white/25 shadow-inner">
                <span className="text-[10px] uppercase tracking-wider font-bold text-white/80 block">END DATE</span>
                <span className="text-base sm:text-lg font-bold block mt-1 text-white truncate">
                  {tempRange?.to
                    ? format(tempRange.to, "EEE, MMM dd, yyyy")
                    : tempRange?.from
                    ? format(tempRange.from, "EEE, MMM dd, yyyy")
                    : "Pick End Date"}
                </span>
              </div>
            </div>
          </div>

          {/* Modal Body with DayPicker Calendar */}
          <div className="p-4 flex flex-col items-center justify-center bg-background">
            <Calendar
              mode="range"
              selected={tempRange}
              onSelect={setTempRange}
              numberOfMonths={1}
              className="rounded-xl border-0 p-2"
            />
          </div>

          {/* Modal Footer */}
          <div className="border-t p-4 bg-muted/20 flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setTempRange(undefined)}
              className="text-xs text-muted-foreground hover:text-foreground gap-1.5 rounded-full"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
                className="text-xs h-9 px-4 rounded-full border-border"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleApply}
                disabled={!tempRange?.from}
                className="text-xs h-9 px-5 gap-1.5 rounded-full bg-amber-500 hover:bg-amber-600 text-white font-semibold shadow-md disabled:opacity-50"
              >
                <Check className="h-4 w-4" /> Apply Range
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
