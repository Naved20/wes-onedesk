import { useEffect, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Megaphone, Plus, FileText, Download, File, Image as ImageIcon, Trash2, Edit } from "lucide-react";
import { Database } from "@/integrations/supabase/types";
import { ReactQuillWrapper } from "@/components/ui/react-quill-wrapper";
import { sendNotification, broadcastAnnouncement } from "@/lib/notificationService";

// Custom styles for Quill editor
const editorStyle = `
  .ql-container {
    min-height: 150px;
    font-size: 14px;
  }
  .ql-editor {
    min-height: 150px;
  }
  .ql-toolbar {
    border-top-left-radius: 0.375rem;
    border-top-right-radius: 0.375rem;
  }
  .ql-container {
    border-bottom-left-radius: 0.375rem;
    border-bottom-right-radius: 0.375rem;
  }
`;

type Announcement = Database["public"]["Tables"]["announcements"]["Row"];

// Skeleton Loading Component
function AnnouncementSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <Skeleton className="h-6 w-3/4" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-8 w-8 rounded" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
        </div>
        <Skeleton className="h-48 w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}

export default function Announcements() {
  const { role } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  
  const ANNOUNCEMENTS_PER_PAGE = 4;
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    file: null as File | null,
  });
  const [editFormData, setEditFormData] = useState({
    title: "",
    content: "",
    file: null as File | null,
    keepExistingFile: true,
  });

  // Add custom styles
  useEffect(() => {
    const styleTag = document.createElement("style");
    styleTag.innerHTML = editorStyle;
    document.head.appendChild(styleTag);
    return () => {
      document.head.removeChild(styleTag);
    };
  }, []);

  useEffect(() => {
    fetchAnnouncements(true); // Initial load
  }, []);

  // Infinite scroll observer
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = document.documentElement.clientHeight;
      
      // When user scrolls to 66% of the page
      const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;
      
      if (scrollPercentage > 0.66 && !loadingMore && hasMore) {
        fetchAnnouncements(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadingMore, hasMore, page]);

  const fetchAnnouncements = async (reset: boolean = false) => {
    try {
      if (reset) {
        setLoading(true);
        setPage(0);
        setHasMore(true);
      } else {
        setLoadingMore(true);
      }

      const currentPage = reset ? 0 : page;
      const from = currentPage * ANNOUNCEMENTS_PER_PAGE;
      const to = from + ANNOUNCEMENTS_PER_PAGE - 1;

      const { data, error, count } = await supabase
        .from("announcements")
        .select("*", { count: 'exact' })
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;
      
      const newAnnouncements = data || [];
      
      if (reset) {
        setAnnouncements(newAnnouncements);
      } else {
        setAnnouncements(prev => [...prev, ...newAnnouncements]);
      }
      
      // Check if there are more announcements to load
      const totalLoaded = reset ? newAnnouncements.length : announcements.length + newAnnouncements.length;
      setHasMore(count ? totalLoaded < count : newAnnouncements.length === ANNOUNCEMENTS_PER_PAGE);
      
      if (!reset) {
        setPage(currentPage + 1);
      } else {
        setPage(1);
      }
    } catch (error) {
      console.error("Error fetching announcements:", error);
      toast({
        title: "Error",
        description: "Failed to load announcements",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim()) {
      toast({
        title: "Error",
        description: "Title and description are required",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      let fileUrl = null;
      let fileName = null;

      // Upload file if provided
      if (formData.file) {
        const fileExt = formData.file.name.split('.').pop();
        const filePath = `${crypto.randomUUID()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('announcements')
          .upload(filePath, formData.file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('announcements')
          .getPublicUrl(filePath);

        fileUrl = publicUrl;
        fileName = formData.file.name;
      }

      // Create announcement
      const { error } = await supabase
        .from("announcements")
        .insert({
          title: formData.title,
          content: formData.content,
          file_url: fileUrl,
          file_name: fileName,
          is_active: true,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Announcement posted successfully",
      });

      // Send notification to all employees
      try {
        // Get all employee IDs to broadcast the announcement
        const { data: employees } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "employee");
        
        if (employees && employees.length > 0) {
          const employeeIds = employees.map(emp => emp.user_id);
          await broadcastAnnouncement(
            formData.title,
            formData.content.replace(/<[^>]*>/g, '').substring(0, 100), // Strip HTML and truncate
            employeeIds
          );
        }
      } catch (err) {
        console.error("Error sending announcement notification:", err);
      }

      setFormData({ title: "", content: "", file: null });
      setOpen(false);
      fetchAnnouncements(true); // Reset and reload
    } catch (error) {
      console.error("Error creating announcement:", error);
      toast({
        title: "Error",
        description: "Failed to post announcement",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (announcementId: string, fileUrl: string | null) => {
    try {
      // Delete file from storage if exists
      if (fileUrl) {
        const filePath = fileUrl.split('/').pop();
        if (filePath) {
          await supabase.storage.from('announcements').remove([filePath]);
        }
      }

      // Delete announcement from database
      const { error } = await supabase
        .from("announcements")
        .delete()
        .eq("id", announcementId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Announcement deleted successfully",
      });

      // Send notification about deleted announcement
      try {
        const { data: employees } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "employee");
        
        if (employees && employees.length > 0) {
          const employeeIds = employees.map(emp => emp.user_id);
          await broadcastAnnouncement(
            "Announcement Removed",
            "An announcement has been removed by admin",
            employeeIds
          );
        }
      } catch (err) {
        console.error("Error sending delete announcement notification:", err);
      }

      fetchAnnouncements(true); // Reset and reload
    } catch (error) {
      console.error("Error deleting announcement:", error);
      toast({
        title: "Error",
        description: "Failed to delete announcement",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    setEditFormData({
      title: announcement.title,
      content: announcement.content,
      file: null,
      keepExistingFile: true,
    });
    setEditOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAnnouncement) return;
    
    if (!editFormData.title.trim() || !editFormData.content.trim()) {
      toast({
        title: "Error",
        description: "Title and description are required",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      let fileUrl = editingAnnouncement.file_url;
      let fileName = editingAnnouncement.file_name;

      // Handle file update
      if (editFormData.file) {
        // Delete old file if exists
        if (editingAnnouncement.file_url) {
          const oldFilePath = editingAnnouncement.file_url.split('/').pop();
          if (oldFilePath) {
            await supabase.storage.from('announcements').remove([oldFilePath]);
          }
        }

        // Upload new file
        const fileExt = editFormData.file.name.split('.').pop();
        const filePath = `${crypto.randomUUID()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('announcements')
          .upload(filePath, editFormData.file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('announcements')
          .getPublicUrl(filePath);

        fileUrl = publicUrl;
        fileName = editFormData.file.name;
      } else if (!editFormData.keepExistingFile && editingAnnouncement.file_url) {
        // Remove existing file if user chose to remove it
        const oldFilePath = editingAnnouncement.file_url.split('/').pop();
        if (oldFilePath) {
          await supabase.storage.from('announcements').remove([oldFilePath]);
        }
        fileUrl = null;
        fileName = null;
      }

      // Update announcement
      const { error } = await supabase
        .from("announcements")
        .update({
          title: editFormData.title,
          content: editFormData.content,
          file_url: fileUrl,
          file_name: fileName,
        })
        .eq("id", editingAnnouncement.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Announcement updated successfully",
      });

      // Send notification about updated announcement
      try {
        const { data: employees } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "employee");
        
        if (employees && employees.length > 0) {
          const employeeIds = employees.map(emp => emp.user_id);
          await broadcastAnnouncement(
            `Announcement Updated: ${editFormData.title}`,
            editFormData.content.replace(/<[^>]*>/g, '').substring(0, 100),
            employeeIds
          );
        }
      } catch (err) {
        console.error("Error sending update announcement notification:", err);
      }

      setEditOpen(false);
      setEditingAnnouncement(null);
      fetchAnnouncements(true); // Reset and reload
    } catch (error) {
      console.error("Error updating announcement:", error);
      toast({
        title: "Error",
        description: "Failed to update announcement",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const canCreateAnnouncement = role === "admin" || role === "manager";
  const canEditAnnouncement = role === "admin" || role === "manager";
  const canDeleteAnnouncement = role === "admin" || role === "manager";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Announcements</h1>
            <p className="text-muted-foreground">Stay updated with company news</p>
          </div>
          {canCreateAnnouncement && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Announcement
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Create New Announcement</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      placeholder="Enter announcement title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="content">Description</Label>
                    <div className="border rounded-md">
                      <ReactQuillWrapper
                        theme="snow"
                        value={formData.content}
                        onChange={(value) => setFormData({ ...formData, content: value })}
                        className="bg-white dark:bg-gray-950"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="file">Attachment (Optional)</Label>
                    <Input
                      id="file"
                      type="file"
                      onChange={(e) => setFormData({ ...formData, file: e.target.files?.[0] || null })}
                    />
                    {formData.file && (
                      <p className="text-sm text-muted-foreground">
                        Selected: {formData.file.name}
                      </p>
                    )}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting ? "Posting..." : "Post Announcement"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, index) => (
              <AnnouncementSkeleton key={index} />
            ))}
          </div>
        ) : announcements.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Megaphone className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                No announcements at this time.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {announcements.map((announcement) => (
              <Card key={announcement.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-xl">{announcement.title}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(announcement.created_at), "MMM dd, yyyy")}
                      </span>
                      {canEditAnnouncement && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => openEditDialog(announcement)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      {canDeleteAnnouncement && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Announcement</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this announcement? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(announcement.id, announcement.file_url)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div 
                    className="text-muted-foreground prose prose-sm dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: announcement.content }}
                  />
                  {announcement.file_url && announcement.file_name && (
                    <div className="pt-4 border-t space-y-2">
                      {(() => {
                        const fileExt = announcement.file_name.split('.').pop()?.toLowerCase();
                        const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(fileExt || '');
                        const isPdf = fileExt === 'pdf';

                        if (isImage) {
                          return (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <ImageIcon className="h-4 w-4" />
                                <span>{announcement.file_name}</span>
                              </div>
                              <a
                                href={announcement.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block"
                              >
                                <img
                                  src={announcement.file_url}
                                  alt={announcement.file_name}
                                  className="max-w-full h-auto rounded-lg border max-h-96 object-contain hover:opacity-90 transition-opacity"
                                  crossOrigin="anonymous"
                                />
                              </a>
                              <a
                                href={announcement.file_url}
                                download={announcement.file_name}
                                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                              >
                                <Download className="h-3 w-3" />
                                Download
                              </a>
                            </div>
                          );
                        } else if (isPdf) {
                          return (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <FileText className="h-4 w-4" />
                                <span>{announcement.file_name}</span>
                              </div>
                              <div className="border rounded-lg overflow-hidden">
                                <iframe
                                  src={announcement.file_url}
                                  className="w-full h-96"
                                  title={announcement.file_name}
                                />
                              </div>
                              <a
                                href={announcement.file_url}
                                download={announcement.file_name}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                              >
                                <Download className="h-3 w-3" />
                                Download PDF
                              </a>
                            </div>
                          );
                        } else {
                          return (
                            <div className="flex items-center gap-2">
                              <File className="h-4 w-4 text-muted-foreground" />
                              <a
                                href={announcement.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                download={announcement.file_name}
                                className="text-sm text-primary hover:underline flex items-center gap-1"
                              >
                                {announcement.file_name}
                                <Download className="h-3 w-3" />
                              </a>
                            </div>
                          );
                        }
                      })()}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Loading more indicator */}
        {loadingMore && (
          <div className="space-y-4">
            {[...Array(2)].map((_, index) => (
              <AnnouncementSkeleton key={`loading-${index}`} />
            ))}
          </div>
        )}

        {/* No more announcements indicator */}
        {!loading && !loadingMore && !hasMore && announcements.length > 0 && (
          <div className="text-center py-4 text-muted-foreground">
            <p>No more announcements to load</p>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Announcement</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                placeholder="Enter announcement title"
                value={editFormData.title}
                onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-content">Description</Label>
              <div className="border rounded-md">
                <ReactQuillWrapper
                  theme="snow"
                  value={editFormData.content}
                  onChange={(value) => setEditFormData({ ...editFormData, content: value })}
                  className="bg-white dark:bg-gray-950"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Attachment</Label>
              {editingAnnouncement?.file_url && editFormData.keepExistingFile && !editFormData.file && (
                <div className="flex items-center gap-2 p-2 border rounded-md bg-muted">
                  <File className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm flex-1">{editingAnnouncement.file_name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditFormData({ ...editFormData, keepExistingFile: false })}
                  >
                    Remove
                  </Button>
                </div>
              )}
              {(!editingAnnouncement?.file_url || !editFormData.keepExistingFile) && (
                <>
                  <Input
                    id="edit-file"
                    type="file"
                    onChange={(e) => setEditFormData({ ...editFormData, file: e.target.files?.[0] || null, keepExistingFile: false })}
                  />
                  {editFormData.file && (
                    <p className="text-sm text-muted-foreground">
                      Selected: {editFormData.file.name}
                    </p>
                  )}
                </>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Updating..." : "Update Announcement"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
