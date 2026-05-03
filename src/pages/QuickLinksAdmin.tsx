import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { getGroupedRoutes } from "@/lib/routeUtils";

interface QuickLink {
  id: string;
  label: string;
  url: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
}

export default function QuickLinksAdmin() {
  const { role, loading: authLoading } = useAuth();
  const [links, setLinks] = useState<QuickLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<QuickLink | null>(null);
  const [form, setForm] = useState({ label: "", url: "", description: "", sort_order: 0, is_active: true });

  // Get available routes dynamically
  const groupedRoutes = getGroupedRoutes();

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("quick_links")
      .select("*")
      .order("sort_order", { ascending: true });
    setLinks(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  if (!authLoading && role !== "admin") return <Navigate to="/dashboard" replace />;

  const openNew = () => {
    setEditing(null);
    setForm({ label: "", url: "", description: "", sort_order: links.length, is_active: true });
    setOpen(true);
  };

  const openEdit = (l: QuickLink) => {
    setEditing(l);
    setForm({
      label: l.label,
      url: l.url,
      description: l.description || "",
      sort_order: l.sort_order,
      is_active: l.is_active,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.label.trim() || !form.url.trim()) {
      toast.error("Label and URL required");
      return;
    }
    const payload = { ...form, description: form.description || null };
    const res = editing
      ? await (supabase as any).from("quick_links").update(payload).eq("id", editing.id)
      : await (supabase as any).from("quick_links").insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success("Saved");
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this quick link?")) return;
    const { error } = await (supabase as any).from("quick_links").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Quick Links</h1>
            <p className="text-muted-foreground">Manage dashboard shortcuts visible to all users</p>
          </div>
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" /> Add Link
          </Button>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : (
          <div className="grid gap-3">
            {links.map((l) => (
              <Card key={l.id}>
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{l.label}</h3>
                      {!l.is_active && (
                        <span className="text-xs bg-muted px-2 py-0.5 rounded">Inactive</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{l.url}</p>
                    {l.description && (
                      <p className="text-xs text-muted-foreground mt-1">{l.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={() => openEdit(l)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => remove(l.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {links.length === 0 && <p className="text-muted-foreground">No quick links yet.</p>}
          </div>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit" : "Add"} Quick Link</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Label *</Label>
                <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>URL * (https://... or /path)</Label>
                <div className="flex gap-2">
                  <Select
                    value={form.url.startsWith('/') ? form.url : ''}
                    onValueChange={(value) => setForm({ ...form, url: value })}
                  >
                    <SelectTrigger className="w-[240px]">
                      <SelectValue placeholder="Select path..." />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(groupedRoutes).map(([category, routes]) => (
                        <SelectGroup key={category}>
                          <SelectLabel>{category}</SelectLabel>
                          {routes.map((route) => (
                            <SelectItem key={route.value} value={route.value}>
                              {route.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input 
                    className="flex-1"
                    placeholder="Or enter custom URL/path"
                    value={form.url} 
                    onChange={(e) => setForm({ ...form, url: e.target.value })} 
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Select a path from dropdown or enter a custom URL/path
                </p>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div>
                <Label>Sort order</Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(c) => setForm({ ...form, is_active: c })}
                />
                <Label>Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={save}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
