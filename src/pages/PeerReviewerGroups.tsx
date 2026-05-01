import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { Users, Plus, Pencil, Trash2, Search } from "lucide-react";

interface Employee {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface Group {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

interface GroupWithMembers extends Group {
  members: Employee[];
}

export default function PeerReviewerGroups() {
  const { user, role } = useAuth();
  const canManage = role === "admin" || role === "manager";

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [groups, setGroups] = useState<GroupWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [open, setOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupWithMembers | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    member_ids: [] as string[],
  });
  const [submitting, setSubmitting] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [{ data: empData }, { data: groupData }, { data: memberData }] = await Promise.all([
        supabase.from("employee_profiles").select("user_id, first_name, last_name, email").eq("is_active", true).order("first_name"),
        (supabase as any).from("peer_reviewer_groups").select("*").order("created_at", { ascending: false }),
        (supabase as any).from("peer_reviewer_group_members").select("group_id, user_id"),
      ]);

      const emps = (empData || []) as Employee[];
      setEmployees(emps);

      const grps: Group[] = (groupData || []) as Group[];
      const memberRows = (memberData || []) as Array<{ group_id: string; user_id: string }>;
      const empMap = new Map(emps.map(e => [e.user_id, e]));

      const enriched: GroupWithMembers[] = grps.map(g => ({
        ...g,
        members: memberRows
          .filter(m => m.group_id === g.id)
          .map(m => empMap.get(m.user_id))
          .filter(Boolean) as Employee[],
      }));

      setGroups(enriched);
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to load groups", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingGroup(null);
    setFormData({ name: "", description: "", member_ids: [] });
    setMemberSearch("");
    setOpen(true);
  };

  const openEdit = (g: GroupWithMembers) => {
    setEditingGroup(g);
    setFormData({
      name: g.name,
      description: g.description || "",
      member_ids: g.members.map(m => m.user_id),
    });
    setMemberSearch("");
    setOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ title: "Error", description: "Group name is required", variant: "destructive" });
      return;
    }
    if (formData.member_ids.length === 0) {
      toast({ title: "Error", description: "Add at least one member", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      let groupId = editingGroup?.id;

      if (editingGroup) {
        const { error } = await (supabase as any)
          .from("peer_reviewer_groups")
          .update({ name: formData.name.trim(), description: formData.description.trim() || null })
          .eq("id", editingGroup.id);
        if (error) throw error;

        // Replace members
        await (supabase as any).from("peer_reviewer_group_members").delete().eq("group_id", editingGroup.id);
      } else {
        const { data, error } = await (supabase as any)
          .from("peer_reviewer_groups")
          .insert({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            created_by: user?.id,
          })
          .select()
          .single();
        if (error) throw error;
        groupId = data.id;
      }

      const rows = formData.member_ids.map(uid => ({ group_id: groupId, user_id: uid }));
      const { error: insErr } = await (supabase as any).from("peer_reviewer_group_members").insert(rows);
      if (insErr) throw insErr;

      toast({ title: "Success", description: editingGroup ? "Group updated" : "Group created" });
      setOpen(false);
      fetchAll();
    } catch (e: any) {
      console.error(e);
      const msg = e?.message?.includes("duplicate") ? "A group with this name already exists" : "Failed to save group";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await (supabase as any).from("peer_reviewer_groups").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Success", description: "Group deleted" });
      fetchAll();
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to delete group", variant: "destructive" });
    }
  };

  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    g.description?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredEmployees = employees.filter(e =>
    `${e.first_name} ${e.last_name} ${e.email}`.toLowerCase().includes(memberSearch.toLowerCase())
  );

  if (!canManage) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">You don't have permission to manage peer reviewer groups.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Users className="h-7 w-7" /> Peer Reviewer Groups
            </h1>
            <p className="text-muted-foreground">Create reusable groups of reviewers and assign them to tasks in one click.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> New Group</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingGroup ? "Edit Group" : "Create Peer Reviewer Group"}</DialogTitle>
                <DialogDescription>
                  Group members will be snapshotted onto a task at assign-time. Later changes to a group don't affect previously-assigned tasks.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="group-name">Name *</Label>
                  <Input
                    id="group-name"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Senior English Reviewers"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="group-desc">Description</Label>
                  <Textarea
                    id="group-desc"
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Optional context about this group"
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Members * ({formData.member_ids.length} selected)</Label>
                  <div className="relative">
                    <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search employees..."
                      value={memberSearch}
                      onChange={e => setMemberSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <div className="border rounded-lg p-3 max-h-72 overflow-y-auto space-y-2">
                    {filteredEmployees.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No employees found</p>
                    ) : filteredEmployees.map(emp => (
                      <div key={emp.user_id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`mem-${emp.user_id}`}
                          checked={formData.member_ids.includes(emp.user_id)}
                          onCheckedChange={(checked) => {
                            setFormData(prev => ({
                              ...prev,
                              member_ids: checked
                                ? [...prev.member_ids, emp.user_id]
                                : prev.member_ids.filter(id => id !== emp.user_id),
                            }));
                          }}
                        />
                        <Label htmlFor={`mem-${emp.user_id}`} className="text-sm font-normal cursor-pointer flex-1">
                          {emp.first_name} {emp.last_name} <span className="text-muted-foreground">({emp.email})</span>
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>Cancel</Button>
                <Button onClick={handleSave} disabled={submitting}>
                  {submitting ? "Saving..." : editingGroup ? "Update Group" : "Create Group"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="relative max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search groups..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : filteredGroups.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium">No groups yet</p>
              <p className="text-sm text-muted-foreground">Create your first peer reviewer group to get started.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredGroups.map(g => (
              <Card key={g.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <CardTitle className="truncate">{g.name}</CardTitle>
                      {g.description && <CardDescription className="line-clamp-2">{g.description}</CardDescription>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(g)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this group?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This won't remove reviewers from tasks already assigned. The group itself will be permanently deleted.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(g.id)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground mb-2">{g.members.length} member(s)</div>
                  <div className="flex flex-wrap gap-1">
                    {g.members.slice(0, 6).map(m => (
                      <Badge key={m.user_id} variant="secondary">{m.first_name} {m.last_name}</Badge>
                    ))}
                    {g.members.length > 6 && <Badge variant="outline">+{g.members.length - 6} more</Badge>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
