import { useEffect, useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { 
  CalendarDays, 
  Plus, 
  Trash2, 
  Edit2, 
  CalendarIcon, 
  Building2, 
  Globe, 
  Sparkles, 
  Filter, 
  X, 
  Palmtree, 
  Gift,
  CheckCircle2,
  Calendar as CalendarSimple
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Holiday {
  id: string;
  date: string;
  name: string;
  description: string | null;
  is_national: boolean | null;
  institution_name: string | null;
}

interface Institution {
  id: string;
  institution_name: string;
}

interface HolidayManagerProps {
  selectedYear?: number;
  selectedMonth?: number; // 1 - 12
  selectedInstitution?: string;
  searchQuery?: string;
  onInstitutionChange?: (institution: string) => void;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export function HolidayManager({
  selectedYear = new Date().getFullYear(),
  selectedMonth = new Date().getMonth() + 1,
  selectedInstitution = "all",
  searchQuery = "",
  onInstitutionChange,
}: HolidayManagerProps) {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [holidayToDelete, setHolidayToDelete] = useState<Holiday | null>(null);
  
  // Filter mode inside holiday tab: 'all_year' or 'selected_month'
  const [monthFilterMode, setMonthFilterMode] = useState<"all_year" | "selected_month">("all_year");

  // Form state
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isNational, setIsNational] = useState(true);
  const [formInstitution, setFormInstitution] = useState<string>("all");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchHolidays();
    fetchInstitutions();
  }, []);

  const fetchInstitutions = async () => {
    try {
      const { data, error } = await supabase
        .from("manager_institutions")
        .select("id, institution_name")
        .order("institution_name");

      if (error) throw error;
      
      const uniqueInstitutions = Array.from(
        new Map(data?.map(item => [item.institution_name, item])).values()
      );
      
      setInstitutions(uniqueInstitutions || []);
    } catch (error) {
      console.error("Error fetching institutions:", error);
    }
  };

  const fetchHolidays = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("holidays_view")
        .select("*")
        .order("date", { ascending: true });

      if (error) throw error;
      setHolidays((data || []) as unknown as Holiday[]);
    } catch (error) {
      console.error("Error fetching holidays:", error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedDate(undefined);
    setName("");
    setDescription("");
    setIsNational(true);
    setFormInstitution("all");
    setEditingHoliday(null);
  };

  const openDialog = (holiday?: Holiday) => {
    if (holiday) {
      setEditingHoliday(holiday);
      setSelectedDate(parseISO(holiday.date));
      setName(holiday.name);
      setDescription(holiday.description || "");
      setIsNational(holiday.is_national ?? true);
      setFormInstitution(holiday.institution_name || "all");
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!selectedDate || !name.trim()) {
      toast({
        title: "Missing Fields",
        description: "Please fill in date and holiday name",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const newDate = format(selectedDate, "yyyy-MM-dd");
      const newInstitution = formInstitution === "all" ? null : formInstitution;

      if (editingHoliday) {
        const { error } = await supabase.rpc("update_holiday", {
          p_old_date: editingHoliday.date,
          p_old_institution: editingHoliday.institution_name,
          p_new_date: newDate,
          p_new_name: name.trim(),
          p_new_description: description.trim() || null,
          p_new_is_national: isNational,
          p_new_institution: newInstitution,
        });
        if (error) throw error;
        toast({ title: "Updated", description: "Holiday updated successfully" });
      } else {
        const { error } = await supabase.rpc("add_holiday", {
          p_date: newDate,
          p_name: name.trim(),
          p_description: description.trim() || null,
          p_is_national: isNational,
          p_institution: newInstitution,
        });
        if (error) throw error;
        toast({ title: "Added", description: "Holiday added successfully" });
      }

      setDialogOpen(false);
      resetForm();
      fetchHolidays();
    } catch (error) {
      console.error("Error saving holiday:", error);
      toast({
        title: "Error",
        description: "Failed to save holiday",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = (holiday: Holiday) => {
    setHolidayToDelete(holiday);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!holidayToDelete) return;
    try {
      const { error } = await supabase.rpc("delete_holiday", {
        p_date: holidayToDelete.date,
        p_institution: holidayToDelete.institution_name,
      });

      if (error) throw error;
      toast({ title: "Deleted", description: "Holiday removed successfully" });
      setDeleteDialogOpen(false);
      setHolidayToDelete(null);
      fetchHolidays();
    } catch (error) {
      console.error("Error deleting holiday:", error);
      toast({
        title: "Error",
        description: "Failed to delete holiday",
        variant: "destructive",
      });
    }
  };

  // Filter logic based on props & tab state
  const filteredHolidays = useMemo(() => {
    return holidays.filter((holiday) => {
      const hDate = parseISO(holiday.date);
      const year = hDate.getFullYear();
      const month = hDate.getMonth() + 1;

      // 1. Year filter
      if (selectedYear && year !== selectedYear) {
        return false;
      }

      // 2. Month filter (if mode is selected_month)
      if (monthFilterMode === "selected_month" && selectedMonth && month !== selectedMonth) {
        return false;
      }

      // 3. Institution filter
      if (selectedInstitution !== "all") {
        const inst = holiday.institution_name?.toLowerCase();
        // If holiday is national or institution_name is null/"all", it applies to ALL institutions
        const isForAll = !holiday.institution_name || inst === "all" || holiday.is_national;
        const isMatch = inst === selectedInstitution.toLowerCase();
        if (!isForAll && !isMatch) {
          return false;
        }
      }

      // 4. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = holiday.name?.toLowerCase().includes(q);
        const descMatch = holiday.description?.toLowerCase().includes(q);
        const instMatch = holiday.institution_name?.toLowerCase().includes(q);
        if (!nameMatch && !descMatch && !instMatch) {
          return false;
        }
      }

      return true;
    });
  }, [holidays, selectedYear, selectedMonth, monthFilterMode, selectedInstitution, searchQuery]);

  // Statistics calculation for filtered set
  const stats = useMemo(() => {
    const total = filteredHolidays.length;
    const nationalCount = filteredHolidays.filter(h => h.is_national).length;
    const orgCount = total - nationalCount;
    
    // Find next upcoming holiday from today
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const upcoming = holidays
      .filter(h => h.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date))[0];

    return { total, nationalCount, orgCount, upcoming };
  }, [filteredHolidays, holidays]);

  // Group filtered holidays by Year (or Month if single year)
  const groupedHolidays = useMemo(() => {
    const groups: Record<string, Holiday[]> = {};
    filteredHolidays.forEach((holiday) => {
      const year = parseISO(holiday.date).getFullYear();
      if (!groups[year]) groups[year] = [];
      groups[year].push(holiday);
    });
    return groups;
  }, [filteredHolidays]);

  const activeMonthName = MONTH_NAMES[selectedMonth - 1] || "";
  const isFiltered = selectedInstitution !== "all" || searchQuery.trim() !== "" || monthFilterMode === "selected_month";

  return (
    <Card className="border-border/50 shadow-sm bg-card">
      <CardHeader className="border-b border-border/40 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <CalendarDays className="h-5 w-5" />
              </div>
              Holiday Calendar & Schedules
            </CardTitle>
            <CardDescription className="text-sm">
              Manage organization and national holidays for attendance and leave calculation
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={() => openDialog()} className="gap-2 shadow-sm font-medium">
                  <Plus className="h-4 w-4" />
                  Add Holiday
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                  <DialogTitle className="text-lg font-bold flex items-center gap-2">
                    {editingHoliday ? <Edit2 className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-primary" />}
                    {editingHoliday ? "Edit Holiday" : "Add New Holiday"}
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 pt-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Holiday Date *
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal h-10",
                            !selectedDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                          {selectedDate ? format(selectedDate, "PPP (EEEE)") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={setSelectedDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Holiday Title *
                    </Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Independence Day / Diwali"
                      className="h-10"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Description (Optional)
                    </Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Brief note or celebration details..."
                      rows={2}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="institution" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Applicable Institution
                    </Label>
                    <Select
                      value={formInstitution}
                      onValueChange={setFormInstitution}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Select institution" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span>All Institutions (Global)</span>
                          </div>
                        </SelectItem>
                        {institutions.map((inst) => (
                          <SelectItem key={inst.id} value={inst.institution_name}>
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <span>{inst.institution_name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/40">
                    <div className="space-y-0.5">
                      <Label htmlFor="is-national" className="text-sm font-semibold cursor-pointer">
                        National / Public Holiday
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Applies standard national holiday policy
                      </p>
                    </div>
                    <Switch
                      id="is-national"
                      checked={isNational}
                      onCheckedChange={setIsNational}
                    />
                  </div>
                </div>

                <DialogFooter className="pt-4 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="gap-2"
                  >
                    {submitting ? "Saving..." : editingHoliday ? "Save Changes" : "Create Holiday"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Holiday Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
          <div className="p-3 rounded-xl border border-border/60 bg-muted/30 flex flex-col">
            <span className="text-xs font-medium text-muted-foreground">Total Holidays ({selectedYear})</span>
            <span className="text-2xl font-bold text-foreground mt-0.5">{stats.total}</span>
          </div>

          <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 dark:bg-amber-500/10 flex flex-col">
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1">
              <Globe className="h-3.5 w-3.5" /> National
            </span>
            <span className="text-2xl font-bold text-amber-900 dark:text-amber-200 mt-0.5">{stats.nationalCount}</span>
          </div>

          <div className="p-3 rounded-xl border border-blue-500/20 bg-blue-500/5 dark:bg-blue-500/10 flex flex-col">
            <span className="text-xs font-medium text-blue-700 dark:text-blue-400 flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5" /> Institution Specific
            </span>
            <span className="text-2xl font-bold text-blue-900 dark:text-blue-200 mt-0.5">{stats.orgCount}</span>
          </div>

          <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10 flex flex-col">
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5" /> Next Holiday
            </span>
            <span className="text-sm font-semibold text-emerald-900 dark:text-emerald-200 mt-1 truncate">
              {stats.upcoming ? (
                `${format(parseISO(stats.upcoming.date), "MMM dd")} - ${stats.upcoming.name}`
              ) : (
                "None scheduled"
              )}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        {/* Controls & Active Filters Pill Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/40 p-3 rounded-xl border border-border/40">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-1 flex items-center gap-1">
              <Filter className="h-3.5 w-3.5" /> Period:
            </span>
            <div className="inline-flex p-0.5 rounded-lg bg-background border border-border">
              <button
                onClick={() => setMonthFilterMode("all_year")}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-md transition-all",
                  monthFilterMode === "all_year"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                All {selectedYear} ({holidays.filter(h => parseISO(h.date).getFullYear() === selectedYear).length})
              </button>
              <button
                onClick={() => setMonthFilterMode("selected_month")}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-md transition-all",
                  monthFilterMode === "selected_month"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {activeMonthName} {selectedYear}
              </button>
            </div>

            {selectedInstitution !== "all" && (
              <Badge variant="secondary" className="gap-1.5 py-1 px-2.5 bg-primary/10 text-primary border border-primary/20">
                <Building2 className="h-3 w-3" />
                {selectedInstitution}
                {onInstitutionChange && (
                  <X
                    className="h-3 w-3 ml-0.5 cursor-pointer hover:opacity-75"
                    onClick={() => onInstitutionChange("all")}
                  />
                )}
              </Badge>
            )}

            {searchQuery && (
              <Badge variant="outline" className="gap-1 py-1 px-2.5 bg-background">
                Query: "{searchQuery}"
              </Badge>
            )}
          </div>

          <div className="text-xs text-muted-foreground font-medium">
            Showing {filteredHolidays.length} {filteredHolidays.length === 1 ? "holiday" : "holidays"}
          </div>
        </div>

        {/* Main Content List / Table */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="text-sm text-muted-foreground">Loading holiday calendar...</p>
          </div>
        ) : filteredHolidays.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center border-2 border-dashed border-border/60 rounded-xl bg-muted/20">
            <div className="p-3 rounded-full bg-muted text-muted-foreground mb-3">
              <CalendarSimple className="h-8 w-8 opacity-60" />
            </div>
            <h3 className="text-base font-semibold text-foreground">No holidays found</h3>
            <p className="text-sm text-muted-foreground max-w-md mt-1 mb-4">
              {isFiltered 
                ? "No holidays match your active filter settings. Try resetting institution/search or changing month selection."
                : "No holidays have been configured for this year yet."}
            </p>
            {isFiltered && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setMonthFilterMode("all_year");
                  if (onInstitutionChange) onInstitutionChange("all");
                }}
              >
                Clear Active Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedHolidays)
              .sort(([a], [b]) => Number(b) - Number(a))
              .map(([year, yearHolidays]) => (
                <div key={year} className="space-y-3">
                  <div className="flex items-center gap-2 border-b border-border pb-2">
                    <h3 className="text-base font-bold text-foreground">
                      {year} Holiday Calendar
                    </h3>
                    <Badge variant="outline" className="font-mono text-xs">
                      {yearHolidays.length} {yearHolidays.length === 1 ? "holiday" : "holidays"}
                    </Badge>
                  </div>

                  <div className="rounded-xl border border-border overflow-hidden bg-card shadow-xs">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead className="w-[140px]">Date</TableHead>
                          <TableHead>Holiday Title & Info</TableHead>
                          <TableHead className="w-[200px]">Institution</TableHead>
                          <TableHead className="w-[140px]">Category</TableHead>
                          <TableHead className="w-[100px] text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {yearHolidays.map((holiday) => {
                          const hDate = parseISO(holiday.date);
                          const dayOfWeek = format(hDate, "EEE");
                          const monthAbbr = format(hDate, "MMM");
                          const dayNum = format(hDate, "dd");

                          return (
                            <TableRow 
                              key={holiday.id}
                              className="hover:bg-muted/40 transition-colors group"
                            >
                              <TableCell className="align-middle">
                                <div className="flex items-center gap-3">
                                  <div className="flex flex-col items-center justify-center w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 font-sans text-center">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary leading-tight">
                                      {monthAbbr}
                                    </span>
                                    <span className="text-lg font-extrabold text-primary leading-none mt-0.5">
                                      {dayNum}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-xs font-semibold text-muted-foreground block">
                                      {dayOfWeek}
                                    </span>
                                    <span className="text-[11px] text-muted-foreground font-mono">
                                      {holiday.date}
                                    </span>
                                  </div>
                                </div>
                              </TableCell>

                              <TableCell className="align-middle">
                                <div className="space-y-0.5">
                                  <p className="font-semibold text-foreground text-sm flex items-center gap-2">
                                    {holiday.name}
                                  </p>
                                  {holiday.description && (
                                    <p className="text-xs text-muted-foreground line-clamp-1">
                                      {holiday.description}
                                    </p>
                                  )}
                                </div>
                              </TableCell>

                              <TableCell className="align-middle">
                                <Badge 
                                  variant="outline" 
                                  className={cn(
                                    "gap-1.5 py-1 px-2.5 font-normal",
                                    !holiday.institution_name || holiday.institution_name.toLowerCase() === "all"
                                      ? "bg-slate-100 dark:bg-slate-800/60 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                                      : "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
                                  )}
                                >
                                  <Building2 className="h-3 w-3 opacity-70" />
                                  <span className="truncate max-w-[140px]">
                                    {holiday.institution_name || "All Institutions"}
                                  </span>
                                </Badge>
                              </TableCell>

                              <TableCell className="align-middle">
                                {holiday.is_national ? (
                                  <Badge className="gap-1 bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/25 shadow-none font-medium">
                                    <Globe className="h-3 w-3" />
                                    National
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="gap-1 font-medium">
                                    <Building2 className="h-3 w-3" />
                                    Org Holiday
                                  </Badge>
                                )}
                              </TableCell>

                              <TableCell className="align-middle text-right">
                                <div className="flex items-center justify-end gap-1 opacity-90 group-hover:opacity-100">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => openDialog(holiday)}
                                    className="h-8 w-8 hover:bg-muted text-muted-foreground hover:text-foreground"
                                    title="Edit Holiday"
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => confirmDelete(holiday)}
                                    className="h-8 w-8 hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                                    title="Delete Holiday"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}
          </div>
        )}
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Delete Holiday
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete <strong className="text-foreground">{holidayToDelete?.name}</strong> on{" "}
              <span className="font-mono font-semibold text-foreground">{holidayToDelete?.date}</span>?
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              This action will recalculate workdays for affected employees.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

