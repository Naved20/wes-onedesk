import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { UserPlus, Clock, Users } from "lucide-react";
import { format } from "date-fns";

interface Employee {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  employee_id: string | null;
}

interface Shift {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
}

interface EmployeeShift {
  id: string;
  user_id: string;
  shift_id: string;
  effective_from: string;
  effective_to: string | null;
  employee_profiles: {
    first_name: string;
    last_name: string;
    email: string;
  };
  shifts: {
    name: string;
    start_time: string;
    end_time: string;
  };
}

export default function EmployeeShiftAssignment() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [assignments, setAssignments] = useState<EmployeeShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    user_id: "",
    shift_id: "",
    effective_from: format(new Date(), "yyyy-MM-dd"),
    effective_to: "",
    notes: "",
  });
  const [bulkFormData, setBulkFormData] = useState({
    shift_id: "",
    effective_from: format(new Date(), "yyyy-MM-dd"),
    effective_to: "",
    notes: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [employeesRes, shiftsRes, assignmentsRes] = await Promise.all([
        supabase.from("employee_profiles").select("id, user_id, first_name, last_name, email, employee_id"),
        supabase.from("shifts").select("id, name, start_time, end_time").eq("is_active", true),
        supabase.from("employee_shifts").select("*").order("effective_from", { ascending: false }),
      ]);

      if (employeesRes.error) throw employeesRes.error;
      if (shiftsRes.error) throw shiftsRes.error;
      if (assignmentsRes.error) throw assignmentsRes.error;

      // Manually join employee and shift data
      const enrichedAssignments = await Promise.all(
        (assignmentsRes.data || []).map(async (assignment) => {
          const employee = employeesRes.data?.find(e => e.user_id === assignment.user_id);
          const shift = shiftsRes.data?.find(s => s.id === assignment.shift_id);
          
          return {
            ...assignment,
            employee_profiles: employee ? {
              first_name: employee.first_name,
              last_name: employee.last_name,
              email: employee.email,
            } : null,
            shifts: shift ? {
              name: shift.name,
              start_time: shift.start_time,
              end_time: shift.end_time,
            } : null,
          };
        })
      );

      setEmployees(employeesRes.data || []);
      setShifts(shiftsRes.data || []);
      setAssignments(enrichedAssignments as any);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // End previous assignment if exists
      const today = format(new Date(), "yyyy-MM-dd");
      await supabase
        .from("employee_shifts")
        .update({ effective_to: today })
        .eq("user_id", formData.user_id)
        .is("effective_to", null);

      // Create new assignment
      const { error } = await supabase.from("employee_shifts").insert([{
        ...formData,
        effective_to: formData.effective_to || null,
        assigned_by: user?.id,
      }]);

      if (error) throw error;

      toast({ title: "Success", description: "Shift assigned successfully" });
      setOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error("Error assigning shift:", error);
      toast({
        title: "Error",
        description: "Failed to assign shift",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      user_id: "",
      shift_id: "",
      effective_from: format(new Date(), "yyyy-MM-dd"),
      effective_to: "",
      notes: "",
    });
  };

  const resetBulkForm = () => {
    setBulkFormData({
      shift_id: "",
      effective_from: format(new Date(), "yyyy-MM-dd"),
      effective_to: "",
      notes: "",
    });
    setSelectedEmployees([]);
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedEmployees.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one employee",
        variant: "destructive",
      });
      return;
    }

    try {
      const today = format(new Date(), "yyyy-MM-dd");
      
      // End previous assignments for all selected employees
      await supabase
        .from("employee_shifts")
        .update({ effective_to: today })
        .in("user_id", selectedEmployees)
        .is("effective_to", null);

      // Create new assignments for all selected employees
      const newAssignments = selectedEmployees.map(userId => ({
        user_id: userId,
        shift_id: bulkFormData.shift_id,
        effective_from: bulkFormData.effective_from,
        effective_to: bulkFormData.effective_to || null,
        notes: bulkFormData.notes,
        assigned_by: user?.id,
      }));

      const { error } = await supabase.from("employee_shifts").insert(newAssignments);

      if (error) throw error;

      toast({ 
        title: "Success", 
        description: `Shift assigned to ${selectedEmployees.length} employee(s) successfully` 
      });
      setBulkOpen(false);
      resetBulkForm();
      fetchData();
    } catch (error) {
      console.error("Error assigning shifts:", error);
      toast({
        title: "Error",
        description: "Failed to assign shifts",
        variant: "destructive",
      });
    }
  };

  const toggleEmployeeSelection = (userId: string) => {
    setSelectedEmployees(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedEmployees.length === employees.length) {
      setSelectedEmployees([]);
    } else {
      setSelectedEmployees(employees.map(emp => emp.user_id));
    }
  };

  const getCurrentShift = (userId: string) => {
    const today = format(new Date(), "yyyy-MM-dd");
    return assignments.find(
      (a) =>
        a.user_id === userId &&
        a.effective_from <= today &&
        (!a.effective_to || a.effective_to >= today)
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Employee Shift Assignment</h1>
            <p className="text-muted-foreground">Assign and manage employee shifts</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={bulkOpen} onOpenChange={(isOpen) => {
              setBulkOpen(isOpen);
              if (!isOpen) resetBulkForm();
            }}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Users className="mr-2 h-4 w-4" />
                  Bulk Assign ({selectedEmployees.length})
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Bulk Assign Shift</DialogTitle>
                  <DialogDescription>
                    Assign shift to {selectedEmployees.length} selected employee(s)
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleBulkSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Selected Employees</Label>
                    <div className="p-3 border rounded-lg max-h-32 overflow-y-auto">
                      {selectedEmployees.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No employees selected</p>
                      ) : (
                        <div className="space-y-1">
                          {employees
                            .filter(emp => selectedEmployees.includes(emp.user_id))
                            .map(emp => (
                              <p key={emp.user_id} className="text-sm">
                                {emp.first_name} {emp.last_name}
                              </p>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bulk-shift">Shift</Label>
                    <Select
                      value={bulkFormData.shift_id}
                      onValueChange={(value) => setBulkFormData({ ...bulkFormData, shift_id: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select shift" />
                      </SelectTrigger>
                      <SelectContent>
                        {shifts.map((shift) => (
                          <SelectItem key={shift.id} value={shift.id}>
                            {shift.name} ({shift.start_time.substring(0, 5)} - {shift.end_time.substring(0, 5)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="bulk-effective_from">Effective From</Label>
                      <Input
                        id="bulk-effective_from"
                        type="date"
                        value={bulkFormData.effective_from}
                        onChange={(e) => setBulkFormData({ ...bulkFormData, effective_from: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bulk-effective_to">Effective To (Optional)</Label>
                      <Input
                        id="bulk-effective_to"
                        type="date"
                        value={bulkFormData.effective_to}
                        onChange={(e) => setBulkFormData({ ...bulkFormData, effective_to: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bulk-notes">Notes (Optional)</Label>
                    <Input
                      id="bulk-notes"
                      value={bulkFormData.notes}
                      onChange={(e) => setBulkFormData({ ...bulkFormData, notes: e.target.value })}
                      placeholder="Any additional notes"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setBulkOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={selectedEmployees.length === 0}>
                      Assign to {selectedEmployees.length} Employee(s)
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={open} onOpenChange={(isOpen) => {
              setOpen(isOpen);
              if (!isOpen) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Assign Shift
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Assign Shift to Employee</DialogTitle>
                  <DialogDescription>
                    Select an employee and shift to create a new assignment
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="employee">Employee</Label>
                    <Select
                      value={formData.user_id}
                      onValueChange={(value) => setFormData({ ...formData, user_id: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select employee" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map((emp) => (
                          <SelectItem key={emp.user_id} value={emp.user_id}>
                            {emp.first_name} {emp.last_name} ({emp.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="shift">Shift</Label>
                    <Select
                      value={formData.shift_id}
                      onValueChange={(value) => setFormData({ ...formData, shift_id: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select shift" />
                      </SelectTrigger>
                      <SelectContent>
                        {shifts.map((shift) => (
                          <SelectItem key={shift.id} value={shift.id}>
                            {shift.name} ({shift.start_time.substring(0, 5)} - {shift.end_time.substring(0, 5)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="effective_from">Effective From</Label>
                      <Input
                        id="effective_from"
                        type="date"
                        value={formData.effective_from}
                        onChange={(e) => setFormData({ ...formData, effective_from: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="effective_to">Effective To (Optional)</Label>
                      <Input
                        id="effective_to"
                        type="date"
                        value={formData.effective_to}
                        onChange={(e) => setFormData({ ...formData, effective_to: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes (Optional)</Label>
                    <Input
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Any additional notes"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">Assign Shift</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Current Assignments</span>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={toggleSelectAll}
                >
                  {selectedEmployees.length === employees.length ? "Deselect All" : "Select All"}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  {employees.map((emp) => {
                    const currentShift = getCurrentShift(emp.user_id);
                    const isSelected = selectedEmployees.includes(emp.user_id);
                    return (
                      <div 
                        key={emp.user_id} 
                        className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                          isSelected ? "bg-primary/5 border-primary" : "hover:bg-muted/50"
                        }`}
                        onClick={() => toggleEmployeeSelection(emp.user_id)}
                      >
                        <Checkbox 
                          checked={isSelected}
                          onCheckedChange={() => toggleEmployeeSelection(emp.user_id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex-1">
                          <p className="font-medium">{emp.first_name} {emp.last_name}</p>
                          <p className="text-sm text-muted-foreground">{emp.email}</p>
                        </div>
                        {currentShift && currentShift.shifts ? (
                          <Badge variant="default" className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {currentShift.shifts.name}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">No Shift</Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Assignments</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  {assignments.slice(0, 10).map((assignment) => (
                    <div key={assignment.id} className="p-3 border rounded-lg space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">
                          {assignment.employee_profiles 
                            ? `${assignment.employee_profiles.first_name} ${assignment.employee_profiles.last_name}`
                            : "Unknown Employee"}
                        </p>
                        <Badge>
                          {assignment.shifts?.name || "Unknown Shift"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        From: {format(new Date(assignment.effective_from), "MMM dd, yyyy")}
                        {assignment.effective_to && ` - To: ${format(new Date(assignment.effective_to), "MMM dd, yyyy")}`}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
