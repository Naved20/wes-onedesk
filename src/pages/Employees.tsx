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
  const [filterInstitution, setFilterInstitution] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
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
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editRole, setEditRole] = useState<AppRole>("employee");
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

  const openEditDialog = async (employee: EmployeeProfile) => {
    setSelectedEmployee(employee);
    setEditFirstName(employee.first_name || "");
    setEditLastName(employee.last_name || "");
    setEditEmail(employee.email || "");
    setEditPassword(""); // Clear password field
    setEditDesignation(employee.designation || "");
    setEditInstitution(employee.institution_assignment || "");
    setEditPhone(employee.phone || "");
    setEditIsActive(employee.is_active ?? true);
    
    // Fetch user role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", employee.user_id)
      .single();
    
    setEditRole(roleData?.role || "employee");
    setEditDialogOpen(true);
  };

  const handleEditEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;

    // Validate required fields
    if (!editFirstName.trim() || !editLastName.trim() || !editEmail.trim()) {
      toast({
        title: "Validation Error",
        description: "First name, last name, and email are required",
        variant: "destructive",
      });
      return;
    }

    // Validate password if provided
    if (editPassword && editPassword.length < 6) {
      toast({
        title: "Validation Error",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      // Update employee profile
      const { error: profileError } = await supabase
        .from("employee_profiles")
        .update({
          first_name: editFirstName.trim(),
          last_name: editLastName.trim(),
          email: editEmail.trim(),
          designation: editDesignation.trim() || null,
          institution_assignment: editInstitution.trim() || null,
          phone: editPhone.trim() || null,
          is_active: editIsActive,
        })
        .eq("id", selectedEmployee.id);

      if (profileError) throw profileError;

      // Update user role
      const { error: roleError } = await supabase
        .from("user_roles")
        .update({ role: editRole })
        .eq("user_id", selectedEmployee.user_id);

      if (roleError) throw roleError;

      // Update password if provided using edge function
      if (editPassword) {
        const { data: passwordData, error: passwordError } = await supabase.functions.invoke(
          "update-user-password",
          {
            body: {
              userId: selectedEmployee.user_id,
              newPassword: editPassword,
            },
          }
        );

        if (passwordError) {
          console.error("Password update error:", passwordError);
          throw new Error("Failed to update password");
        }

        if (passwordData?.error) {
          throw new Error(passwordData.error);
        }
      }

      toast({
        title: "Updated",
        description: editPassword 
          ? "Employee and password updated successfully" 
          : "Employee updated successfully",
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

  const filteredEmployees = employees.filter((emp) => {
    // Search filter
    const matchesSearch = `${emp.first_name} ${emp.last_name} ${emp.email}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    
    // Institution filter
    const matchesInstitution = filterInstitution === "all" || 
      emp.institution_assignment === filterInstitution;
    
    // Status filter
    const matchesStatus = filterStatus === "all" || 
      (filterStatus === "active" && emp.is_active) ||
      (filterStatus === "inactive" && !emp.is_active);
    
    return matchesSearch && matchesInstitution && matchesStatus;
  });

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
            <div className="space-y-4">
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
              
              {/* Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Institution</Label>
                  <Select value={filterInstitution} onValueChange={setFilterInstitution}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Institutions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Institutions</SelectItem>
                      <SelectItem value="WES">WES</SelectItem>
                      <SelectItem value="DPS">DPS</SelectItem>
                      <SelectItem value="CLAS">CLAS</SelectItem>
                      <SelectItem value="WESA">WESA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Status</Label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Active Filters Display */}
              {(filterInstitution !== "all" || filterStatus !== "all") && (
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-sm text-muted-foreground">Active filters:</span>
                  {filterInstitution !== "all" && (
                    <Badge variant="secondary" className="gap-1">
                      Institution: {filterInstitution}
                      <button
                        onClick={() => setFilterInstitution("all")}
                        className="ml-1 hover:text-destructive"
                      >
                        ×
                      </button>
                    </Badge>
                  )}
                  {filterStatus !== "all" && (
                    <Badge variant="secondary" className="gap-1">
                      Status: {filterStatus}
                      <button
                        onClick={() => setFilterStatus("all")}
                        className="ml-1 hover:text-destructive"
                      >
                        ×
                      </button>
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFilterInstitution("all");
                      setFilterStatus("all");
                    }}
                    className="h-6 text-xs"
                  >
                    Clear all
                  </Button>
                </div>
              )}
              
              {/* Results Count */}
              <div className="text-sm text-muted-foreground">
                Showing {filteredEmployees.length} of {employees.length} employees
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
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditEmployee} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editFirstName">First Name *</Label>
                <Input
                  id="editFirstName"
                  value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)}
                  required
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editLastName">Last Name *</Label>
                <Input
                  id="editLastName"
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                  required
                  maxLength={100}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editEmail">Email *</Label>
              <Input
                id="editEmail"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                required
                maxLength={255}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editPassword">Password</Label>
              <Input
                id="editPassword"
                type="text"
                placeholder="Leave blank to keep current password"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                minLength={6}
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground">
                Only fill this if you want to change the password (min 6 characters)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editRole">Role *</Label>
              <Select value={editRole} onValueChange={(v) => setEditRole(v as AppRole)}>
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
