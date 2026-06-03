import { useEffect, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { CalendarDays, Plus, Trash2, Edit2, CalendarIcon, Building2 } from "lucide-react";
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

export function HolidayManager() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  
  // Form state
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isNational, setIsNational] = useState(true);
  const [selectedInstitution, setSelectedInstitution] = useState<string>("all");
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
      
      // Remove duplicates
      const uniqueInstitutions = Array.from(
        new Map(data?.map(item => [item.institution_name, item])).values()
      );
      
      setInstitutions(uniqueInstitutions || []);
    } catch (error) {
      console.error("Error fetching institutions:", error);
    }
  };

  const fetchHolidays = async () => {
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
    setSelectedInstitution("all");
    setEditingHoliday(null);
  };

  const openDialog = (holiday?: Holiday) => {
    if (holiday) {
      setEditingHoliday(holiday);
      setSelectedDate(new Date(holiday.date));
      setName(holiday.name);
      setDescription(holiday.description || "");
      setIsNational(holiday.is_national ?? true);
      setSelectedInstitution(holiday.institution_name || "all");
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
      const newInstitution = selectedInstitution === "all" ? null : selectedInstitution;

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

  const handleDelete = async (holiday: Holiday) => {
    try {
      const { error } = await supabase.rpc("delete_holiday", {
        p_date: holiday.date,
        p_institution: holiday.institution_name,
      });

      if (error) throw error;
      toast({ title: "Deleted", description: "Holiday removed successfully" });
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

  // Group holidays by year
  const holidaysByYear = holidays.reduce((acc, holiday) => {
    const year = new Date(holiday.date).getFullYear();
    if (!acc[year]) acc[year] = [];
    acc[year].push(holiday);
    return acc;
  }, {} as Record<number, Holiday[]>);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          Holiday Calendar
        </CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => openDialog()}>
              <Plus className="h-4 w-4 mr-1" />
              Add Holiday
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingHoliday ? "Edit Holiday" : "Add New Holiday"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !selectedDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
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
                <Label htmlFor="name">Holiday Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Republic Day"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Additional details..."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="institution">Institution</Label>
                <Select
                  value={selectedInstitution}
                  onValueChange={setSelectedInstitution}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select institution" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        All Institutions
                      </div>
                    </SelectItem>
                    {institutions.map((inst) => (
                      <SelectItem key={inst.id} value={inst.institution_name}>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          {inst.institution_name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Select "All Institutions" for holidays applicable to everyone
                </p>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="is-national">National Holiday</Label>
                <Switch
                  id="is-national"
                  checked={isNational}
                  onCheckedChange={setIsNational}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? "Saving..." : editingHoliday ? "Update" : "Add"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : holidays.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No holidays configured. Add holidays to exclude them from working day calculations.
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(holidaysByYear)
              .sort(([a], [b]) => Number(b) - Number(a))
              .map(([year, yearHolidays]) => (
                <div key={year}>
                  <h4 className="text-sm font-semibold text-muted-foreground mb-2">
                    {year} ({yearHolidays.length} holidays)
                  </h4>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Holiday</TableHead>
                          <TableHead>Institution</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {yearHolidays.map((holiday) => (
                          <TableRow key={holiday.id}>
                            <TableCell className="font-medium">
                              {format(new Date(holiday.date), "MMM dd")}
                            </TableCell>
                            <TableCell>
                              <div>
                                <p>{holiday.name}</p>
                                {holiday.description && (
                                  <p className="text-xs text-muted-foreground">
                                    {holiday.description}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="gap-1">
                                <Building2 className="h-3 w-3" />
                                {holiday.institution_name || "All"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={holiday.is_national ? "default" : "secondary"}>
                                {holiday.is_national ? "National" : "Org"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => openDialog(holiday)}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleDelete(holiday.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
