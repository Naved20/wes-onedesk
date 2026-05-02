import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { UserCheck, Plus, Pencil, Trash2, Search, History, Users } from "lucide-react";
import { format } from "date-fns";

interface Employee {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface IndividualPeerReviewer {
  id: string;
  user_id: string;
  reviewer_id: string;
  assigned_by: string | null;
  assigned_at: string;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface IndividualPeerReviewerWithDetails extends IndividualPeerReviewer {
  user: Employee;
  reviewer: Employee;
  assigned_by_user?: Employee;
}

interface PreviousAssignment {
  reviewer_id: string;
  reviewer_name: string;
  assigned_users: Array<{
    user_id: string;
    user_name: string;
    assigned_at: string;
  }>;
  total_assignments: number;
}

export default function IndividualPeerReviewers() {
  const { user, role } = useAuth();
  const canManage = role === "admin" || role === "manager";

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assignments, setAssignments] = useState<IndividualPeerReviewerWithDetails[]>([]);
  const [previousAssignments, setPreviousAssignments] = useState<PreviousAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [open, setOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<IndividualPeerReviewerWithDetails | null>(null);
  const [formData, setFormData] = useState({
    user_id: "",
    reviewer_id: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (canManage) {
      fetchAll();
    }
  }, [canManage]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchEmployees(),
        fetchAssignments(),
        fetchPreviousAssignments(),
      ]);
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to load data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    const { data, error } = await supabase
      .from("employee_profiles")
      .select("user_id, first_name, last_name, email")
      .eq("is_active", true)
      .order("first_name");

    if (error) throw error;
    setEmployees(data || []);
  };

  const fetchAssignments = async () => {
    const { data, error } = await supabase
      .from("individual_peer_reviewers" as any)
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const assignmentData = data || [];
    const userIds = Array.from(new Set([
      ...assignmentData.map((a: any) => a.user_id),
      ...assignmentData.map((a: any) => a.reviewer_id),
      ...assignmentData.map((a: any) => a.assigned_by).filter(Boolean),
    ]));

    if (userIds.length === 0) {
      setAssignments([]);
      return;
    }

    const { data: profiles } = await supabase
      .from("employee_profiles")
      .select("user_id, first_name, last_name, email")
      .in("user_id", userIds);

    const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

    const enriched: IndividualPeerReviewerWithDetails[] = assignmentData.map((assignment: any) => ({
      ...assignment,
      user: profileMap.get(assignment.user_id)!,
      reviewer: profileMap.get(assignment.reviewer_id)!,
      assigned_by_user: assignment.assigned_by ? profileMap.get(assignment.assigned_by) : undefined,
    }));

    setAssignments(enriched);
  };

  const fetchPreviousAssignments = async () => {
    const { data, error } = await supabase
      .from("individual_peer_reviewers" as any)
      .select(`
        reviewer_id,
        user_id,
        assigned_at
      `)
      .order("assigned_at", { ascending: false });

    if (error) throw error;

    const assignmentData = data || [];
    const reviewerIds = Array.from(new Set(assignmentData.map((a: any) => a.reviewer_id)));
    const userIds = Array.from(new Set(assignmentData.map((a: any) => a.user_id)));

    if (reviewerIds.length === 0) {
      setPreviousAssignments([]);
      return;
    }

    const { data: profiles } = await supabase
      .from("employee_profiles")
      .select("user_id, first_name, last_name")
      .in("user_id", [...reviewerIds, ...userIds]);

    const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

    // Group assignments by reviewer
    const reviewerAssignments = new Map<string, Array<{
      user_id: string;
      user_name: string;
      assigned_at: string;
    }>>();

    assignmentData.forEach((assignment: any) => {
      const reviewerId = assignment.reviewer_id;
      const user = profileMap.get(assignment.user_id);
      
      if (!reviewerAssignments.has(reviewerId)) {
        reviewerAssignments.set(reviewerId, []);
      }
      
      reviewerAssignments.get(reviewerId)!.push({
        user_id: assignment.user_id,
        user_name: user ? `${user.first_name} ${user.last_name}` : "Unknown User",
        assigned_at: assignment.assigned_at,
      });
    });

    const previous: PreviousAssignment[] = Array.from(reviewerAssignments.entries()).map(([reviewerId, assignments]) => {
      const reviewer = profileMap.get(reviewerId);
      return {
        reviewer_id: reviewerId,
        reviewer_name: reviewer ? `${reviewer.first_name} ${reviewer.last_name}` : "Unknown Reviewer",
        assigned_users: assignments,
        total_assignments: assignments.length,
      };
    });

    setPreviousAssignments(previous.sort((a, b) => b.total_assignments - a.total_assignments));
  };

  const openCreate = () => {
    setEditingAssignment(null);
    setFormData({ user_id: "", reviewer_id: "", notes: "" });
    setOpen(true);
  };

  const openEdit = (assignment: IndividualPeerReviewerWithDetails) => {
    setEditingAssignment(assignment);
    setFormData({
      user_id: assignment.user_id,
      reviewer_id: assignment.reviewer_id,
      notes: assignment.notes || "",
    });
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.user_id || !formData.reviewer_id) {
      toast({ title: "Error", description: "Please select both user and reviewer", variant: "destructive" });
      return;
    }

    if (formData.user_id === formData.reviewer_id) {
      toast({ title: "Error", description: "User cannot be their own reviewer", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      if (editingAssignment) {
        // Update existing assignment
        const { error } = await supabase
          .from("individual_peer_reviewers" as any)
          .update({
            user_id: formData.user_id,
            reviewer_id: formData.reviewer_id,
            notes: formData.notes || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingAssignment.id);

        if (error) throw error;
        toast({ title: "Success", description: "Assignment updated successfully" });
      } else {
        // Check if user already has an active assignment
        const { data: existing } = await supabase
          .from("individual_peer_reviewers" as any)
          .select("id")
          .eq("user_id", formData.user_id)
          .eq("is_active", true)
          .single();

        if (existing) {
          toast({ 
            title: "Error", 
            description: "This user already has an active peer reviewer assignment", 
            variant: "destructive" 
          });
          return;
        }

        // Create new assignment
        const { error } = await supabase
          .from("individual_peer_reviewers" as any)
          .insert({
            user_id: formData.user_id,
            reviewer_id: formData.reviewer_id,
            assigned_by: user?.id,
            notes: formData.notes || null,
          });

        if (error) throw error;
        toast({ title: "Success", description: "Assignment created successfully" });
      }

      setOpen(false);
      fetchAll();
    } catch (error: any) {
      console.error("Error saving assignment:", error);
      toast({ 
        title: "Error", 
        description: error.message || "Failed to save assignment", 
        variant: "destructive" 
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (assignment: IndividualPeerReviewerWithDetails) => {
    try {
      const { error } = await supabase
        .from("individual_peer_reviewers" as any)
        .update({ is_active: false })
        .eq("id", assignment.id);

      if (error) throw error;
      toast({ title: "Success", description: "Assignment deactivated successfully" });
      fetchAll();
    } catch (error: any) {
      console.error("Error deleting assignment:", error);
      toast({ 
        title: "Error", 
        description: error.message || "Failed to delete assignment", 
        variant: "destructive" 
      });
    }
  };

  const filteredAssignments = assignments.filter(assignment =>
    assignment.user.first_name.toLowerCase().includes(search.toLowerCase()) ||
    assignment.user.last_name.toLowerCase().includes(search.toLowerCase()) ||
    assignment.reviewer.first_name.toLowerCase().includes(search.toLowerCase()) ||
    assignment.reviewer.last_name.toLowerCase().includes(search.toLowerCase()) ||
    assignment.user.email.toLowerCase().includes(search.toLowerCase())
  );

  const availableUsers = employees.filter(emp => 
    !assignments.some(assignment => assignment.user_id === emp.user_id)
  );

  if (!canManage) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">You don't have permission to access this page.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Individual Peer Reviewers</h1>
            <p className="text-muted-foreground">
              Manage 1:1 peer reviewer assignments for employees
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setHistoryOpen(true)}
            >
              <History className="h-4 w-4 mr-2" />
              View History
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Assign Reviewer
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {editingAssignment ? "Edit Assignment" : "Assign Individual Peer Reviewer"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingAssignment 
                      ? "Update the peer reviewer assignment" 
                      : "Assign a specific peer reviewer to an employee"
                    }
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="user_id">Employee</Label>
                    <Select
                      value={formData.user_id}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, user_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select employee" />
                      </SelectTrigger>
                      <SelectContent>
                        {(editingAssignment ? employees : availableUsers).map(emp => (
                          <SelectItem key={emp.user_id} value={emp.user_id}>
                            {emp.first_name} {emp.last_name} ({emp.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reviewer_id">Peer Reviewer</Label>
                    <Select
                      value={formData.reviewer_id}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, reviewer_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select peer reviewer" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees
                          .filter(emp => emp.user_id !== formData.user_id)
                          .map(emp => (
                            <SelectItem key={emp.user_id} value={emp.user_id}>
                              {emp.first_name} {emp.last_name} ({emp.email})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes (Optional)</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Add any notes about this assignment..."
                      rows={3}
                    />
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting ? "Saving..." : editingAssignment ? "Update" : "Assign"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search assignments..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Badge variant="secondary">
            {filteredAssignments.length} assignment{filteredAssignments.length !== 1 ? 's' : ''}
          </Badge>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="animate-pulse">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </CardHeader>
                <CardContent className="animate-pulse">
                  <div className="space-y-2">
                    <div className="h-3 bg-muted rounded"></div>
                    <div className="h-3 bg-muted rounded w-2/3"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredAssignments.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <UserCheck className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No assignments found</h3>
              <p className="text-muted-foreground text-center mb-4">
                {search ? "No assignments match your search criteria." : "No individual peer reviewer assignments have been created yet."}
              </p>
              {!search && (
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Assignment
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredAssignments.map((assignment) => (
              <Card key={assignment.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="text-base">
                      {assignment.user.first_name} {assignment.user.last_name}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(assignment)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Deactivate Assignment</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to deactivate this peer reviewer assignment? 
                              This action can be undone by creating a new assignment.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(assignment)}>
                              Deactivate
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardTitle>
                  <CardDescription>{assignment.user.email}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Peer Reviewer</p>
                      <p className="text-sm">
                        {assignment.reviewer.first_name} {assignment.reviewer.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">{assignment.reviewer.email}</p>
                    </div>
                    
                    {assignment.notes && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Notes</p>
                        <p className="text-sm">{assignment.notes}</p>
                      </div>
                    )}
                    
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Assigned: {format(new Date(assignment.assigned_at), "MMM dd, yyyy")}</span>
                      {assignment.assigned_by_user && (
                        <span>By: {assignment.assigned_by_user.first_name} {assignment.assigned_by_user.last_name}</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Previous Assignments History Dialog */}
        <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Previous Assignment History</DialogTitle>
              <DialogDescription>
                View all previous peer reviewer assignments to help make better decisions
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {previousAssignments.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No previous assignments found</p>
              ) : (
                previousAssignments.map((reviewer) => (
                  <Card key={reviewer.reviewer_id}>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>{reviewer.reviewer_name}</span>
                        <Badge variant="secondary">
                          {reviewer.total_assignments} assignment{reviewer.total_assignments !== 1 ? 's' : ''}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">Previously assigned users:</p>
                        <div className="grid gap-2 md:grid-cols-2">
                          {reviewer.assigned_users.map((user) => (
                            <div key={user.user_id} className="flex justify-between items-center p-2 bg-muted/50 rounded">
                              <span className="text-sm">{user.user_name}</span>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(user.assigned_at), "MMM dd, yyyy")}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}