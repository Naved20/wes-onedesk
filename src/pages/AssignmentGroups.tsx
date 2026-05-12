import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { supabase } from "@/integrations/supabase/client";
import { Plus, Users, Edit, Trash2, UserPlus, X } from "lucide-react";

interface AssignmentGroup {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  member_count?: number;
}

interface Employee {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  designation: string | null;
  institution_assignment: string | null;
}

interface GroupMember extends Employee {
  added_at: string;
}

export default function AssignmentGroups() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<AssignmentGroup[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formSelectedMembers, setFormSelectedMembers] = useState<string[]>([]);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<AssignmentGroup | null>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);

  useEffect(() => {
    if (role !== "admin" && role !== "manager") {
      navigate("/dashboard");
      return;
    }
    fetchGroups();
    fetchEmployees();
  }, [role, navigate]);

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("assignment_groups")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;

      // Get member counts for each group
      const groupsWithCounts = await Promise.all(
        (data || []).map(async (group) => {
          const { count } = await supabase
            .from("assignment_group_members")
            .select("*", { count: "exact", head: true })
            .eq("group_id", group.id);

          return { ...group, member_count: count || 0 };
        })
      );

      setGroups(groupsWithCounts);
    } catch (error) {
      console.error("Error fetching groups:", error);
      toast({
        title: "Error",
        description: "Failed to load assignment groups",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from("employee_profiles")
        .select("user_id, first_name, last_name, email, designation, institution_assignment")
        .eq("is_active", true)
        .order("first_name");

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  const fetchGroupMembers = async (groupId: string) => {
    try {
      const { data, error } = await supabase.rpc("get_assignment_group_members", {
        p_group_id: groupId,
      });

      if (error) throw error;
      setGroupMembers(data || []);
    } catch (error) {
      console.error("Error fetching group members:", error);
      toast({
        title: "Error",
        description: "Failed to load group members",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormName("");
    setFormDescription("");
    setFormSelectedMembers([]);
    setMemberSearchQuery("");
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast({
        title: "Validation Error",
        description: "Group name is required",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data: groupData, error: groupError } = await supabase
        .from("assignment_groups")
        .insert({
          name: formName.trim(),
          description: formDescription.trim() || null,
          is_active: true,
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // Add members if any selected
      if (formSelectedMembers.length > 0 && groupData) {
        const members = formSelectedMembers.map(userId => ({
          group_id: groupData.id,
          user_id: userId,
        }));

        const { error: membersError } = await supabase
          .from("assignment_group_members")
          .insert(members);

        if (membersError) throw membersError;
      }

      toast({
        title: "Success",
        description: `Assignment group created with ${formSelectedMembers.length} member(s)`,
      });

      setDialogOpen(false);
      resetForm();
      fetchGroups();
    } catch (error: any) {
      console.error("Error creating group:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create group",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const openEditDialog = (group: AssignmentGroup) => {
    setSelectedGroup(group);
    setFormName(group.name);
    setFormDescription(group.description || "");
    setEditDialogOpen(true);
  };

  const handleEditGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("assignment_groups")
        .update({
          name: formName.trim(),
          description: formDescription.trim() || null,
        })
        .eq("id", selectedGroup.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Group updated successfully",
      });

      setEditDialogOpen(false);
      setSelectedGroup(null);
      resetForm();
      fetchGroups();
    } catch (error: any) {
      console.error("Error updating group:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update group",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const openMembersDialog = async (group: AssignmentGroup) => {
    setSelectedGroup(group);
    await fetchGroupMembers(group.id);
    
    // Get current member IDs
    const { data } = await supabase
      .from("assignment_group_members")
      .select("user_id")
      .eq("group_id", group.id);
    
    setSelectedEmployees(data?.map(m => m.user_id) || []);
    setMembersDialogOpen(true);
  };

  const handleToggleEmployee = (userId: string) => {
    setSelectedEmployees(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSaveMembers = async () => {
    if (!selectedGroup) return;

    setSubmitting(true);
    try {
      // Get current members
      const { data: currentMembers } = await supabase
        .from("assignment_group_members")
        .select("user_id")
        .eq("group_id", selectedGroup.id);

      const currentIds = currentMembers?.map(m => m.user_id) || [];
      
      // Find members to add and remove
      const toAdd = selectedEmployees.filter(id => !currentIds.includes(id));
      const toRemove = currentIds.filter(id => !selectedEmployees.includes(id));

      // Remove members
      if (toRemove.length > 0) {
        const { error: removeError } = await supabase
          .from("assignment_group_members")
          .delete()
          .eq("group_id", selectedGroup.id)
          .in("user_id", toRemove);

        if (removeError) throw removeError;
      }

      // Add members
      if (toAdd.length > 0) {
        const { error: addError } = await supabase
          .from("assignment_group_members")
          .insert(
            toAdd.map(userId => ({
              group_id: selectedGroup.id,
              user_id: userId,
            }))
          );

        if (addError) throw addError;
      }

      toast({
        title: "Success",
        description: "Group members updated successfully",
      });

      setMembersDialogOpen(false);
      setSelectedGroup(null);
      setSelectedEmployees([]);
      fetchGroups();
    } catch (error: any) {
      console.error("Error updating members:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update members",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const openDeleteDialog = (group: AssignmentGroup) => {
    setSelectedGroup(group);
    setDeleteDialogOpen(true);
  };

  const handleDeleteGroup = async () => {
    if (!selectedGroup) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("assignment_groups")
        .update({ is_active: false })
        .eq("id", selectedGroup.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Group deleted successfully",
      });

      setDeleteDialogOpen(false);
      setSelectedGroup(null);
      fetchGroups();
    } catch (error: any) {
      console.error("Error deleting group:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete group",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (role !== "admin" && role !== "manager") {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Assignment Groups</h1>
            <p className="text-muted-foreground">
              Organize employees into groups for task assignments and team management
            </p>
          </div>
          {role === "admin" && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Group
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Assignment Group</DialogTitle>
                  <DialogDescription>
                    Create a new group to organize employees for assignments
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateGroup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Group Name *</Label>
                    <Input
                      id="name"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g., Development Team, Marketing Team"
                      required
                      maxLength={100}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Brief description of the group"
                      rows={3}
                      maxLength={500}
                    />
                  </div>
                  
                  {/* Members Selection */}
                  <div className="space-y-2">
                    <Label className="text-base font-semibold">
                      Members * ({formSelectedMembers.length} selected)
                    </Label>
                    <Input
                      placeholder="Search employees..."
                      value={memberSearchQuery}
                      onChange={(e) => setMemberSearchQuery(e.target.value)}
                      className="mb-2"
                    />
                    <div className="space-y-2 max-h-[300px] overflow-y-auto border rounded-lg p-3">
                      {employees
                        .filter(emp => 
                          `${emp.first_name} ${emp.last_name} ${emp.email}`
                            .toLowerCase()
                            .includes(memberSearchQuery.toLowerCase())
                        )
                        .map((employee) => (
                          <div
                            key={employee.user_id}
                            className="flex items-center space-x-3 p-2 hover:bg-muted/50 rounded"
                          >
                            <Checkbox
                              checked={formSelectedMembers.includes(employee.user_id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setFormSelectedMembers([...formSelectedMembers, employee.user_id]);
                                } else {
                                  setFormSelectedMembers(formSelectedMembers.filter(id => id !== employee.user_id));
                                }
                              }}
                            />
                            <div className="flex-1">
                              <p className="font-medium text-sm">
                                {employee.first_name} {employee.last_name}
                              </p>
                              <p className="text-xs text-muted-foreground">{employee.email}</p>
                              <div className="flex gap-1 mt-1">
                                {employee.designation && (
                                  <Badge variant="outline" className="text-xs">
                                    {employee.designation}
                                  </Badge>
                                )}
                                {employee.institution_assignment && (
                                  <Badge variant="outline" className="text-xs">
                                    {employee.institution_assignment}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                  
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? "Creating..." : "Create Group"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-full flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : groups.length === 0 ? (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              No assignment groups found. Create one to get started.
            </div>
          ) : (
            groups.map((group) => (
              <Card key={group.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{group.name}</CardTitle>
                      {group.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {group.description}
                        </p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {group.member_count || 0} member{group.member_count !== 1 ? "s" : ""}
                      </span>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => openMembersDialog(group)}
                      >
                        <UserPlus className="h-4 w-4 mr-1" />
                        Manage Members
                      </Button>
                      {role === "admin" && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(group)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDeleteDialog(group)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Assignment Group</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditGroup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Group Name *</Label>
              <Input
                id="edit-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={3}
                maxLength={500}
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Members Dialog */}
      <Dialog open={membersDialogOpen} onOpenChange={setMembersDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Members: {selectedGroup?.name}</DialogTitle>
            <DialogDescription>
              Select employees to add to this group
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              {selectedEmployees.length} of {employees.length} employees selected
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {employees.map((employee) => (
                <div
                  key={employee.user_id}
                  className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50"
                >
                  <Checkbox
                    checked={selectedEmployees.includes(employee.user_id)}
                    onCheckedChange={() => handleToggleEmployee(employee.user_id)}
                  />
                  <div className="flex-1">
                    <p className="font-medium">
                      {employee.first_name} {employee.last_name}
                    </p>
                    <p className="text-sm text-muted-foreground">{employee.email}</p>
                    <div className="flex gap-2 mt-1">
                      {employee.designation && (
                        <Badge variant="outline" className="text-xs">
                          {employee.designation}
                        </Badge>
                      )}
                      {employee.institution_assignment && (
                        <Badge variant="outline" className="text-xs">
                          {employee.institution_assignment}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Button onClick={handleSaveMembers} className="w-full" disabled={submitting}>
              {submitting ? "Saving..." : "Save Members"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Assignment Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedGroup?.name}"? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteGroup}
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
