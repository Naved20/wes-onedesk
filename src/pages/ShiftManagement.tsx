import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Clock, Plus, Edit, Trash2, Settings } from "lucide-react";

interface Shift {
  id: string;
  name: string;
  description: string | null;
  start_time: string;
  end_time: string;
  late_threshold_minutes: number;
  half_day_threshold_hours: number;
  last_checkin_hours_before_end: number;
  is_active: boolean;
}

export default function ShiftManagement() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    start_time: "09:00",
    end_time: "18:00",
    late_threshold_minutes: 15,
    half_day_threshold_hours: 2.5,
    last_checkin_hours_before_end: 3.5,
  });

  useEffect(() => {
    fetchShifts();
  }, []);

  const fetchShifts = async () => {
    try {
      const { data, error } = await supabase
        .from("shifts")
        .select("*")
        .order("name");

      if (error) throw error;
      setShifts(data || []);
    } catch (error) {
      console.error("Error fetching shifts:", error);
      toast({
        title: "Error",
        description: "Failed to load shifts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingShift) {
        const { error } = await supabase
          .from("shifts")
          .update(formData)
          .eq("id", editingShift.id);

        if (error) throw error;
        toast({ title: "Success", description: "Shift updated successfully" });
      } else {
        const { error } = await supabase
          .from("shifts")
          .insert([formData]);

        if (error) throw error;
        toast({ title: "Success", description: "Shift created successfully" });
      }

      setOpen(false);
      setEditingShift(null);
      resetForm();
      fetchShifts();
    } catch (error) {
      console.error("Error saving shift:", error);
      toast({
        title: "Error",
        description: "Failed to save shift",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (shift: Shift) => {
    setEditingShift(shift);
    setFormData({
      name: shift.name,
      description: shift.description || "",
      start_time: shift.start_time.substring(0, 5),
      end_time: shift.end_time.substring(0, 5),
      late_threshold_minutes: shift.late_threshold_minutes,
      half_day_threshold_hours: shift.half_day_threshold_hours,
      last_checkin_hours_before_end: shift.last_checkin_hours_before_end,
    });
    setOpen(true);
  };

  const handleDelete = async (shiftId: string) => {
    try {
      const { error } = await supabase
        .from("shifts")
        .delete()
        .eq("id", shiftId);

      if (error) throw error;
      toast({ title: "Success", description: "Shift deleted successfully" });
      fetchShifts();
    } catch (error) {
      console.error("Error deleting shift:", error);
      toast({
        title: "Error",
        description: "Failed to delete shift",
        variant: "destructive",
      });
    }
  };

  const toggleActive = async (shift: Shift) => {
    try {
      const { error } = await supabase
        .from("shifts")
        .update({ is_active: !shift.is_active })
        .eq("id", shift.id);

      if (error) throw error;
      toast({ title: "Success", description: `Shift ${!shift.is_active ? 'activated' : 'deactivated'}` });
      fetchShifts();
    } catch (error) {
      console.error("Error toggling shift:", error);
      toast({
        title: "Error",
        description: "Failed to update shift status",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      start_time: "09:00",
      end_time: "18:00",
      late_threshold_minutes: 15,
      half_day_threshold_hours: 2.5,
      last_checkin_hours_before_end: 3.5,
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Shift Management</h1>
            <p className="text-muted-foreground">Configure and manage employee shifts</p>
          </div>
          <Dialog open={open} onOpenChange={(isOpen) => {
            setOpen(isOpen);
            if (!isOpen) {
              setEditingShift(null);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Shift
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>{editingShift ? "Edit Shift" : "Create New Shift"}</DialogTitle>
                <DialogDescription>
                  {editingShift ? "Update shift details and thresholds" : "Configure a new shift with timings and attendance rules"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Shift Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start_time">Start Time</Label>
                    <Input
                      id="start_time"
                      type="time"
                      value={formData.start_time}
                      onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end_time">End Time</Label>
                    <Input
                      id="end_time"
                      type="time"
                      value={formData.end_time}
                      onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="late_threshold">Late Threshold (minutes after start)</Label>
                  <Input
                    id="late_threshold"
                    type="number"
                    min="0"
                    value={formData.late_threshold_minutes}
                    onChange={(e) => setFormData({ ...formData, late_threshold_minutes: parseInt(e.target.value) })}
                    required
                  />
                  <p className="text-xs text-muted-foreground">Check-in after this many minutes marks as late</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="half_day_threshold">Half Day Threshold (hours from start)</Label>
                  <Input
                    id="half_day_threshold"
                    type="number"
                    step="0.1"
                    min="0"
                    value={formData.half_day_threshold_hours}
                    onChange={(e) => setFormData({ ...formData, half_day_threshold_hours: parseFloat(e.target.value) })}
                    required
                  />
                  <p className="text-xs text-muted-foreground">Check-in after this many hours marks as half day</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="last_checkin">Last Check-in Limit (hours before end)</Label>
                  <Input
                    id="last_checkin"
                    type="number"
                    step="0.1"
                    min="0"
                    value={formData.last_checkin_hours_before_end}
                    onChange={(e) => setFormData({ ...formData, last_checkin_hours_before_end: parseFloat(e.target.value) })}
                    required
                  />
                  <p className="text-xs text-muted-foreground">Check-in after this limit marks as absent</p>
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingShift ? "Update" : "Create"} Shift
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Shifts</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : shifts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No shifts configured yet
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Timings</TableHead>
                    <TableHead>Late Threshold</TableHead>
                    <TableHead>Half Day</TableHead>
                    <TableHead>Last Check-in</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shifts.map((shift) => (
                    <TableRow key={shift.id}>
                      <TableCell className="font-medium">{shift.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {shift.start_time.substring(0, 5)} - {shift.end_time.substring(0, 5)}
                        </div>
                      </TableCell>
                      <TableCell>{shift.late_threshold_minutes} min</TableCell>
                      <TableCell>{shift.half_day_threshold_hours} hrs</TableCell>
                      <TableCell>{shift.last_checkin_hours_before_end} hrs before end</TableCell>
                      <TableCell>
                        <Badge variant={shift.is_active ? "default" : "secondary"}>
                          {shift.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleActive(shift)}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(shift)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Shift</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure? This will affect all employees assigned to this shift.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(shift.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
