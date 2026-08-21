import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, HelpCircle, Plus, Clock, CheckCircle, XCircle, AlertCircle, MessageSquare, Send, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supportNotifications } from "@/lib/notificationService";

interface SupportRequest {
  id: string;
  user_id: string;
  subject: string;
  description: string;
  status: "pending" | "in_progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  category: string | null;
  assigned_to: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  employee_profiles?: {
    first_name: string;
    last_name: string;
  };
}

interface SupportReply {
  id: string;
  request_id: string;
  user_id: string;
  message: string;
  is_internal: boolean;
  created_at: string;
  employee_profiles?: {
    first_name: string;
    last_name: string;
  };
}

const statusConfig = {
  pending: { label: "Pending", icon: Clock, color: "bg-yellow-100 text-yellow-700" },
  in_progress: { label: "In Progress", icon: AlertCircle, color: "bg-blue-100 text-blue-700" },
  resolved: { label: "Resolved", icon: CheckCircle, color: "bg-green-100 text-green-700" },
  closed: { label: "Closed", icon: XCircle, color: "bg-gray-100 text-gray-700" },
};

const priorityConfig = {
  low: { label: "Low", color: "bg-gray-100 text-gray-700" },
  medium: { label: "Medium", color: "bg-blue-100 text-blue-700" },
  high: { label: "High", color: "bg-orange-100 text-orange-700" },
  urgent: { label: "Urgent", color: "bg-red-100 text-red-700" },
};

export default function SupportRequests() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [replies, setReplies] = useState<Record<string, SupportReply[]>>({});
  const [selectedRequest, setSelectedRequest] = useState<SupportRequest | null>(null);
  const [chatDialogOpen, setChatDialogOpen] = useState(false);
  const [replyMessage, setReplyMessage] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    subject: "",
    description: "",
    priority: "medium" as "low" | "medium" | "high" | "urgent",
    category: "",
  });

  const isAdminOrManager = role === "admin" || role === "manager";
  const isAdmin = role === "admin";

  useEffect(() => {
    fetchRequests();
  }, [user?.id, role]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      
      // Fetch requests
      let query = supabase
        .from("support_requests" as any)
        .select("*")
        .order("created_at", { ascending: false });

      // If not admin/manager, only show own requests
      if (!isAdminOrManager) {
        query = query.eq("user_id", user?.id);
      }

      const { data: requestsData, error } = await query;

      if (error) throw error;

      // Manually fetch employee profiles for each request
      if (requestsData && requestsData.length > 0) {
        const userIds = [...new Set(requestsData.map((r: any) => r.user_id))];
        
        const { data: profiles } = await supabase
          .from("employee_profiles")
          .select("user_id, first_name, last_name")
          .in("user_id", userIds);

        // Map profiles to requests
        const enrichedRequests = requestsData.map((request: any) => {
          const profile = (profiles || []).find((p: any) => p.user_id === request.user_id);
          return {
            ...request,
            employee_profiles: profile || null
          };
        });

        setRequests(enrichedRequests);
      } else {
        setRequests([]);
      }
    } catch (error) {
      console.error("Error fetching requests:", error);
      toast({
        title: "Error",
        description: "Failed to load support requests",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchReplies = async (requestId: string) => {
    try {
      const { data: repliesData, error } = await supabase
        .from("support_request_replies" as any)
        .select("*")
        .eq("request_id", requestId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Fetch employee profiles for replies
      if (repliesData && repliesData.length > 0) {
        const userIds = [...new Set(repliesData.map((r: any) => r.user_id))];
        
        const { data: profiles } = await supabase
          .from("employee_profiles")
          .select("user_id, first_name, last_name")
          .in("user_id", userIds);

        const enrichedReplies = repliesData.map((reply: any) => {
          const profile = (profiles || []).find((p: any) => p.user_id === reply.user_id);
          return {
            ...reply,
            employee_profiles: profile || null
          };
        });

        setReplies(prev => ({ ...prev, [requestId]: enrichedReplies }));
      }
    } catch (error) {
      console.error("Error fetching replies:", error);
    }
  };

  const handleSendReply = async () => {
    if (!selectedRequest || !replyMessage.trim()) {
      toast({
        title: "Error",
        description: "Please enter a message",
        variant: "destructive",
      });
      return;
    }

    setSendingReply(true);
    try {
      const { error } = await supabase
        .from("support_request_replies" as any)
        .insert({
          request_id: selectedRequest.id,
          user_id: user?.id,
          message: replyMessage,
          is_internal: false,
        });

      if (error) throw error;

      // Trigger notification for reply
      const recipientId = user?.id === selectedRequest.user_id ? selectedRequest.assigned_to : selectedRequest.user_id;
      if (recipientId) {
        await supportNotifications.replyMade(
          recipientId,
          selectedRequest.id,
          user?.email || "Support",
          replyMessage.slice(0, 50)
        );
      }

      toast({
        title: "Success",
        description: "Reply sent successfully",
      });

      setReplyMessage("");
      await fetchReplies(selectedRequest.id);
    } catch (error) {
      console.error("Error sending reply:", error);
      toast({
        title: "Error",
        description: "Failed to send reply",
        variant: "destructive",
      });
    } finally {
      setSendingReply(false);
    }
  };

  const openChatDialog = async (request: SupportRequest) => {
    setSelectedRequest(request);
    setChatDialogOpen(true);
    await fetchReplies(request.id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.subject.trim() || !formData.description.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data: inserted, error } = await supabase
        .from("support_requests" as any)
        .insert({
          user_id: user?.id,
          subject: formData.subject,
          description: formData.description,
          priority: formData.priority,
          category: formData.category || null,
          status: "pending",
        })
        .select("id")
        .maybeSingle();

      if (error) throw error;

      if (user?.id) {
        await supportNotifications.ticketCreated(
          user.id,
          inserted?.id || "N/A",
          formData.subject,
          user.email || "Employee"
        );
      }

      toast({
        title: "Success",
        description: "Your request has been submitted successfully",
      });

      setFormData({
        subject: "",
        description: "",
        priority: "medium",
        category: "",
      });
      setDialogOpen(false);
      fetchRequests();
    } catch (error) {
      console.error("Error submitting request:", error);
      toast({
        title: "Error",
        description: "Failed to submit request",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusUpdate = async (requestId: string, newStatus: string) => {
    try {
      const updates: any = { status: newStatus };
      
      if (newStatus === "resolved" || newStatus === "closed") {
        updates.resolved_at = new Date().toISOString();
        updates.resolved_by = user?.id;
      }

      const { error } = await supabase
        .from("support_requests" as any)
        .update(updates)
        .eq("id", requestId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Request status updated",
      });

      fetchRequests();
    } catch (error) {
      console.error("Error updating status:", error);
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive",
      });
    }
  };

  const handleDeleteRequest = async (requestId: string) => {
    try {
      // Delete the request (replies will be deleted automatically due to CASCADE)
      const { error } = await supabase
        .from("support_requests" as any)
        .delete()
        .eq("id", requestId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Request and all replies deleted successfully",
      });

      // Close chat dialog if open
      if (selectedRequest?.id === requestId) {
        setChatDialogOpen(false);
        setSelectedRequest(null);
      }

      fetchRequests();
    } catch (error) {
      console.error("Error deleting request:", error);
      toast({
        title: "Error",
        description: "Failed to delete request",
        variant: "destructive",
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/settings")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                <HelpCircle className="h-8 w-8" />
                Support & Requests
              </h1>
              <p className="text-muted-foreground">
                {isAdminOrManager 
                  ? "Manage support requests from employees" 
                  : "Submit and track your support requests"}
              </p>
            </div>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Request
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Submit Support Request</DialogTitle>
                <DialogDescription>
                  Describe your issue or request in detail
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject *</Label>
                  <Input
                    id="subject"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="Brief description of your request"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="e.g., Technical, HR, Payroll, Leave"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">Priority *</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value: any) => setFormData({ ...formData, priority: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Provide detailed information about your request..."
                    rows={6}
                    required
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Submitting..." : "Submit Request"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading requests...</p>
          </div>
        ) : requests.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <HelpCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No requests yet</h3>
              <p className="text-muted-foreground mb-4">
                {isAdminOrManager 
                  ? "No support requests have been submitted yet" 
                  : "You haven't submitted any support requests yet"}
              </p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Submit Your First Request
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => {
              const StatusIcon = statusConfig[request.status].icon;
              return (
                <Card key={request.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1">
                        <CardTitle className="text-lg">{request.subject}</CardTitle>
                        <div className="flex items-center gap-2 flex-wrap">
                          {isAdminOrManager && request.employee_profiles && (
                            <span className="text-sm text-muted-foreground">
                              By: {request.employee_profiles.first_name} {request.employee_profiles.last_name}
                            </span>
                          )}
                          <Badge className={statusConfig[request.status].color}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusConfig[request.status].label}
                          </Badge>
                          <Badge className={priorityConfig[request.priority].color}>
                            {priorityConfig[request.priority].label}
                          </Badge>
                          {request.category && (
                            <Badge variant="outline">{request.category}</Badge>
                          )}
                        </div>
                      </div>
                      {isAdminOrManager && (
                        <div className="flex gap-2">
                          <Select
                            value={request.status}
                            onValueChange={(value) => handleStatusUpdate(request.id, value)}
                          >
                            <SelectTrigger className="w-[150px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="resolved">Resolved</SelectItem>
                              <SelectItem value="closed">Closed</SelectItem>
                            </SelectContent>
                          </Select>
                          
                          {isAdmin && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="icon">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Request?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete this support request and all its replies. 
                                    This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteRequest(request.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm whitespace-pre-wrap">{request.description}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">
                        Submitted on {format(new Date(request.created_at), "MMM dd, yyyy 'at' HH:mm")}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openChatDialog(request)}
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        View Conversation
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Chat Dialog */}
      <Dialog open={chatDialogOpen} onOpenChange={setChatDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <DialogTitle>{selectedRequest?.subject}</DialogTitle>
                <DialogDescription>
                  Conversation with {selectedRequest?.employee_profiles 
                    ? `${selectedRequest.employee_profiles.first_name} ${selectedRequest.employee_profiles.last_name}`
                    : "Employee"}
                </DialogDescription>
              </div>
              {isAdmin && selectedRequest && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Entire Conversation?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete this support request and all {replies[selectedRequest.id]?.length || 0} replies. 
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDeleteRequest(selectedRequest.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete Conversation
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </DialogHeader>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            {/* Original Request */}
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-medium text-primary">
                  {selectedRequest?.employee_profiles?.first_name?.charAt(0) || "U"}
                </span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">
                    {selectedRequest?.employee_profiles 
                      ? `${selectedRequest.employee_profiles.first_name} ${selectedRequest.employee_profiles.last_name}`
                      : "Employee"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {selectedRequest && format(new Date(selectedRequest.created_at), "MMM dd, HH:mm")}
                  </span>
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-sm whitespace-pre-wrap">{selectedRequest?.description}</p>
                </div>
              </div>
            </div>

            {/* Replies */}
            {selectedRequest && replies[selectedRequest.id]?.map((reply) => {
              const isCurrentUser = reply.user_id === user?.id;
              return (
                <div key={reply.id} className={`flex gap-3 ${isCurrentUser ? 'flex-row-reverse' : ''}`}>
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-medium text-primary">
                      {reply.employee_profiles?.first_name?.charAt(0) || "U"}
                    </span>
                  </div>
                  <div className="flex-1 max-w-[70%]">
                    <div className={`flex items-center gap-2 mb-1 ${isCurrentUser ? 'flex-row-reverse' : ''}`}>
                      <span className="text-sm font-medium">
                        {reply.employee_profiles 
                          ? `${reply.employee_profiles.first_name} ${reply.employee_profiles.last_name}`
                          : "User"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(reply.created_at), "MMM dd, HH:mm")}
                      </span>
                    </div>
                    <div className={`rounded-lg p-3 ${
                      isCurrentUser 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap">{reply.message}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Reply Input */}
          <div className="border-t pt-4">
            <div className="flex gap-2">
              <Textarea
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                placeholder="Type your reply..."
                rows={3}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendReply();
                  }
                }}
              />
              <Button
                onClick={handleSendReply}
                disabled={sendingReply || !replyMessage.trim()}
                size="icon"
                className="h-auto"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
