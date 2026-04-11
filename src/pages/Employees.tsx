import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { Search, Plus, Eye, Edit, Trash2 } from "lucide-react";
import { Database } from "@/integrations/supabase/types";
import { z } from "zod";

type EmployeeProfile = Database["public"]["Tables"]["employee_profiles"]["Row"];
type AppRole = Database["public"]["Enums"]["app_role"];

interface EmployeeWithRole extends EmployeeProfile {
  role?: AppRole;
}

const createUserSchema = z.object({
  email: z.string().trim().email("Please enter a valid email").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(100),
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  role: z.enum(["admin", "manager", "employee"]),
});

export default function Employees() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<EmployeeWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeProfile | null>(null);

  // Create form state
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formFirstName, setFormFirstName] = useState("");
  const [formLastName, setFormLastName] = useState("");
  const [formRole, setFormRole] = useState<AppRole>("employee");
  const [formDesignation, setFormDesignation] = useState("");
  const [formInstitution, setFormInstitution] = useState("");
  const [formPhone, setFormPhone] = useState("");

  // Edit form state
  const [editDesignation, setEditDesignation] = useState("");
  const [editInstitution, setEditInstitution] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from("employee_profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      if (profilesData && profilesData.length > 0) {
        // Fetch roles for all employees
        const userIds = profilesData.map(p => p.user_id);
        const { data: rolesData } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", userIds);

        const roleMap = new Map(rolesData?.map(r => [r.user_id, r.role]) || []);
        
        const employeesWithRoles: EmployeeWithRole[] = profilesData.map(profile => ({
          ...profile,
          role: roleMap.get(profile.user_id),
        }));
        
        setEmployees(employeesWithRoles);
      } else {
        setEmployees([]);
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
      toast({
        title: "Error",
        description: "Failed to load employees",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormEmail("");
    setFormPassword("");
    setFormFirstName("");
    setFormLastName("");
    setFormRole("employee");
    setFormDesignation("");
    setFormInstitution("");
    setFormPhone("");
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = createUserSchema.safeParse({
      email: formEmail,
      password: formPassword,
      firstName: formFirstName,
      lastName: formLastName,
      role: formRole,
    });

    if (!validation.success) {
      toast({
        title: "Validation Error",
        description: validation.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await supabase.functions.invoke("create-user", {
        body: {
          email: formEmail.trim(),
          password: formPassword,
          firstName: formFirstName.trim(),
          lastName: formLastName.trim(),
          role: formRole,
          designation: formDesignation.trim() || undefined,
          institutionAssignment: formInstitution.trim() || undefined,
          phone: formPhone.trim() || undefined,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast({
        title: "User Created",
        description: `Successfully created account for ${formFirstName} ${formLastName}`,
      });

      setDialogOpen(false);
      resetForm();
      fetchEmployees();
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create user",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const openEditDialog = (employee: EmployeeProfile) => {
    setSelectedEmployee(employee);
    setEditDesignation(employee.designation || "");
    setEditInstitution(employee.institution_assignment || "");
    setEditPhone(employee.phone || "");
    setEditIsActive(employee.is_active ?? true);
    setEditDialogOpen(true);
  };

  const handleEditEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("employee_profiles")
        .update({
          designation: editDesignation.trim() || null,
          institution_assignment: editInstitution.trim() || null,
          phone: editPhone.trim() || null,
          is_active: editIsActive,
        })
        .eq("id", selectedEmployee.id);

      if (error) throw error;

      toast({
        title: "Updated",
        description: "Employee updated successfully",
      });

      setEditDialogOpen(false);
      setSelectedEmployee(null);
      fetchEmployees();
    } catch (error) {
      console.error("Error updating employee:", error);
      toast({
        title: "Error",
        description: "Failed to update employee",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const openDeleteDialog = (employee: EmployeeProfile) => {
    setSelectedEmployee(employee);
    setDeleteDialogOpen(true);
  };

  const handleDeleteEmployee = async () => {
    if (!selectedEmployee) return;

    setSubmitting(true);
    try {
      // Delete from employee_profiles (user will remain in auth but profile is removed)
      const { error } = await supabase
        .from("employee_profiles")
        .delete()
        .eq("id", selectedEmployee.id);

      if (error) throw error;

      // Also delete user_roles
      await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", selectedEmployee.user_id);

      toast({
        title: "Deleted",
        description: `${selectedEmployee.first_name} ${selectedEmployee.last_name} has been removed`,
      });

      setDeleteDialogOpen(false);
      setSelectedEmployee(null);
      fetchEmployees();
    } catch (error) {
      console.error("Error deleting employee:", error);
      toast({
        title: "Error",
        description: "Failed to delete employee",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredEmployees = employees.filter((emp) =>
    `${emp.first_name} ${emp.last_name} ${emp.email}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Employees</h1>
            <p className="text-muted-foreground">Manage employee profiles and information</p>
          </div>
          {role === "admin" && (
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-base px-4 py-2">
                Total: {employees.length}
              </Badge>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Employee
                  </Button>
                </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Create New Employee</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name *</Label>
                      <Input
                        id="firstName"
                        value={formFirstName}
                        onChange={(e) => setFormFirstName(e.target.value)}
                        required
                        maxLength={100}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name *</Label>
                      <Input
                        id="lastName"
                        value={formLastName}
                        onChange={(e) => setFormLastName(e.target.value)}
                        required
                        maxLength={100}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      required
                      maxLength={255}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password *</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      required
                      minLength={6}
                      maxLength={100}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role *</Label>
                    <Select value={formRole} onValueChange={(v) => setFormRole(v as AppRole)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="employee">Employee</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="designation">Designation</Label>
                    <Input
                      id="designation"
                      value={formDesignation}
                      onChange={(e) => setFormDesignation(e.target.value)}
                      maxLength={100}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="institution">Institution</Label>
                    <Select value={formInstitution} onValueChange={setFormInstitution}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select institution" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="WES">WES</SelectItem>
                        <SelectItem value="DPS">DPS</SelectItem>
                        <SelectItem value="CLAS">CLAS</SelectItem>
                        <SelectItem value="WESA">WESA</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      maxLength={20}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? "Creating..." : "Create Employee"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
            </div>
          )}
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <CardTitle>Employee Directory</CardTitle>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search employees..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? "No employees match your search" : "No employees found"}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">S.No.</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Designation</TableHead>
                      <TableHead>Institution</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEmployees.map((employee, index) => (
                      <TableRow key={employee.id}>
                        <TableCell className="font-medium text-muted-foreground">
                          {index + 1}
                        </TableCell>
                        <TableCell className="font-medium">
                          {employee.first_name} {employee.last_name}
                        </TableCell>
                        <TableCell>{employee.email}</TableCell>
                        <TableCell>{employee.designation || "-"}</TableCell>
                        <TableCell>{employee.institution_assignment || "-"}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={
                              employee.role === "admin" 
                                ? "destructive" 
                                : employee.role === "manager" 
                                  ? "default" 
                                  : "secondary"
                            }
                          >
                            {employee.role ? employee.role.charAt(0).toUpperCase() + employee.role.slice(1) : "-"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={employee.is_active ? "default" : "secondary"}>
                            {employee.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {(role === "admin" || role === "manager") && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigate(`/employee/${employee.id}`)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
                            {role === "admin" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEditDialog(employee)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openDeleteDialog(employee)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditEmployee} className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={`${selectedEmployee?.first_name} ${selectedEmployee?.last_name}`}
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editDesignation">Designation</Label>
              <Input
                id="editDesignation"
                value={editDesignation}
                onChange={(e) => setEditDesignation(e.target.value)}
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editInstitution">Institution</Label>
              <Select value={editInstitution} onValueChange={setEditInstitution}>
                <SelectTrigger>
                  <SelectValue placeholder="Select institution" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WES">WES</SelectItem>
                  <SelectItem value="DPS">DPS</SelectItem>
                  <SelectItem value="CLAS">CLAS</SelectItem>
                  <SelectItem value="WESA">WESA</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editPhone">Phone</Label>
              <Input
                id="editPhone"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                maxLength={20}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editStatus">Status</Label>
              <Select
                value={editIsActive ? "active" : "inactive"}
                onValueChange={(v) => setEditIsActive(v === "active")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Employee</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedEmployee?.first_name} {selectedEmployee?.last_name}?
              This action cannot be undone and will remove all their profile data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEmployee}
              disabled={submitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {submitting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
