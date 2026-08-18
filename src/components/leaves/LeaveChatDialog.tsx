import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Send,
  Paperclip,
  FileText,
  ExternalLink,
  Loader2,
  Calendar,
  User,
  X,
  MessageSquare,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { uploadLeaveDocumentToDrive } from "@/lib/leaveDriveService";

export interface LeaveConversationMessage {
  id: string;
  leave_id: string;
  sender_id: string;
  message: string;
  attachment_url?: string | null;
  attachment_name?: string | null;
  created_at: string;
  sender_name?: string;
  sender_role?: string;
}

interface LeaveChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leave: {
    id: string;
    user_id: string;
    employee_name?: string;
    start_date: string;
    end_date: string;
    leave_type?: string | null;
    reason: string;
    status?: string | null;
    document_url?: string | null;
    document_name?: string | null;
  } | null;
  currentUserId: string;
}

export function LeaveChatDialog({
  open,
  onOpenChange,
  leave,
  currentUserId,
}: LeaveChatDialogProps) {
  const [messages, setMessages] = useState<LeaveConversationMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (open && leave?.id) {
      fetchMessages();
      const channel = subscribeToMessages();
      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      setMessages([]);
    }
  }, [open, leave?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    if (!leave?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("leave_conversations")
        .select("*")
        .eq("leave_id", leave.id)
        .order("created_at", { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        // Fetch sender profiles for names
        const senderIds = [...new Set(data.map((m) => m.sender_id))];
        const { data: profiles } = await supabase
          .from("employee_profiles")
          .select("user_id, first_name, last_name")
          .in("user_id", senderIds);

        const { data: roles } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", senderIds);

        const profileMap = new Map(
          profiles?.map((p) => [p.user_id, `${p.first_name} ${p.last_name}`]) || []
        );
        const roleMap = new Map(roles?.map((r) => [r.user_id, r.role]) || []);

        const enriched = data.map((msg) => ({
          ...msg,
          sender_name: profileMap.get(msg.sender_id) || (msg.sender_id === currentUserId ? "You" : "User"),
          sender_role: roleMap.get(msg.sender_id) || "employee",
        }));

        setMessages(enriched);
      } else {
        setMessages([]);
      }
    } catch (err) {
      console.error("Error fetching leave messages:", err);
      toast({
        title: "Error",
        description: "Failed to load chat history",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const subscribeToMessages = () => {
    return supabase
      .channel(`leave-chat-${leave?.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "leave_conversations",
          filter: `leave_id=eq.${leave?.id}`,
        },
        async (payload) => {
          const newMsg = payload.new as LeaveConversationMessage;

          // Fetch sender details
          const { data: profile } = await supabase
            .from("employee_profiles")
            .select("first_name, last_name")
            .eq("user_id", newMsg.sender_id)
            .maybeSingle();

          const { data: roleData } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", newMsg.sender_id)
            .maybeSingle();

          const enriched: LeaveConversationMessage = {
            ...newMsg,
            sender_name: profile
              ? `${profile.first_name} ${profile.last_name}`
              : newMsg.sender_id === currentUserId
              ? "You"
              : "User",
            sender_role: roleData?.role || "employee",
          };

          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, enriched];
          });
        }
      )
      .subscribe();
  };

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && !selectedFile) || !leave?.id || sending) return;

    setSending(true);
    let attachmentUrl: string | null = null;
    let attachmentName: string | null = null;

    try {
      if (selectedFile) {
        setUploadingFile(true);
        toast({
          title: "Uploading",
          description: "Uploading attachment to Google Drive...",
        });

        const driveResult = await uploadLeaveDocumentToDrive(
          selectedFile,
          leave.employee_name || "Employee",
          leave.leave_type || "Leave"
        );

        attachmentUrl = driveResult.webViewLink;
        attachmentName = selectedFile.name;
      }

      const { error } = await supabase.from("leave_conversations").insert({
        leave_id: leave.id,
        sender_id: currentUserId,
        message: newMessage.trim() || (selectedFile ? `Uploaded attachment: ${selectedFile.name}` : ""),
        attachment_url: attachmentUrl,
        attachment_name: attachmentName,
      });

      if (error) throw error;

      setNewMessage("");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      console.error("Error sending message:", err);
      toast({
        title: "Failed to Send",
        description: err.message || "Could not send message",
        variant: "destructive",
      });
    } finally {
      setSending(false);
      setUploadingFile(false);
    }
  };

  if (!leave) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] h-[85vh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-4 border-b bg-muted/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              <DialogTitle className="text-lg">Leave Request Clarification Chat</DialogTitle>
            </div>
            <Badge
              variant={
                leave.status === "approved"
                  ? "default"
                  : leave.status === "rejected"
                  ? "destructive"
                  : "secondary"
              }
            >
              {leave.status ? leave.status.toUpperCase() : "PENDING"}
            </Badge>
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1 font-medium text-foreground">
              <User className="h-3.5 w-3.5" />
              {leave.employee_name || "Employee"}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {format(new Date(leave.start_date), "MMM dd")} - {format(new Date(leave.end_date), "MMM dd, yyyy")}
            </span>
            {leave.leave_type && (
              <Badge variant="outline" className="text-[10px]">
                {leave.leave_type.toUpperCase()}
              </Badge>
            )}
          </DialogDescription>

          {/* Initial Leave Reason & Submitted Document */}
          <div className="mt-2 bg-background p-2.5 rounded-md border text-xs space-y-1">
            <p className="text-muted-foreground">
              <strong className="text-foreground">Initial Reason:</strong> {leave.reason}
            </p>
            {leave.document_url && (
              <div className="flex items-center gap-2 pt-1 border-t mt-1">
                <FileText className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                <span className="truncate text-blue-700 font-medium">
                  {leave.document_name || "Submitted Attachment"}
                </span>
                <a
                  href={leave.document_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto text-blue-600 hover:underline flex items-center gap-1 text-[11px]"
                >
                  View in Drive <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>
        </DialogHeader>

        {/* Chat Messages */}
        <ScrollArea className="flex-1 p-4 bg-slate-50/50">
          {loading ? (
            <div className="flex justify-center items-center h-48">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm space-y-2">
              <MessageSquare className="h-8 w-8 mx-auto opacity-40" />
              <p>No messages yet in this clarification thread.</p>
              <p className="text-xs">Ask questions or send updates regarding this leave request.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => {
                const isMe = msg.sender_id === currentUserId;
                const isAdminOrManager = msg.sender_role === "admin" || msg.sender_role === "manager";

                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-2.5 ${isMe ? "flex-row-reverse" : "flex-row"}`}
                  >
                    <Avatar className="h-7 w-7 text-xs font-semibold shrink-0">
                      <AvatarFallback className={isMe ? "bg-primary text-primary-foreground" : "bg-muted"}>
                        {msg.sender_name?.substring(0, 2).toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>

                    <div
                      className={`max-w-[78%] rounded-xl p-3 text-sm shadow-sm space-y-1.5 ${
                        isMe
                          ? "bg-primary text-primary-foreground rounded-tr-none"
                          : "bg-white border text-foreground rounded-tl-none"
                      }`}
                    >
                      <div className={`flex items-center justify-between gap-3 text-[11px] font-medium ${isMe ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                        <span>
                          {msg.sender_name} {isAdminOrManager && <span className="opacity-75">({msg.sender_role})</span>}
                        </span>
                        <span className="text-[10px] opacity-70">
                          {format(new Date(msg.created_at), "h:mm a, MMM dd")}
                        </span>
                      </div>

                      <p className="whitespace-pre-wrap leading-relaxed">{msg.message}</p>

                      {msg.attachment_url && (
                        <div
                          className={`mt-2 p-2 rounded flex items-center justify-between gap-2 text-xs ${
                            isMe ? "bg-primary-foreground/15 border border-primary-foreground/20 text-white" : "bg-slate-100 border text-blue-700"
                          }`}
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <FileText className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate font-medium">{msg.attachment_name || "Attachment"}</span>
                          </div>
                          <a
                            href={msg.attachment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`shrink-0 hover:underline flex items-center gap-1 ${isMe ? "text-white" : "text-blue-600"}`}
                          >
                            Drive <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* Attachment preview if selected */}
        {selectedFile && (
          <div className="px-4 py-2 bg-muted/60 border-t flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-blue-700 font-medium truncate">
              <Paperclip className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)</span>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-5 w-5 rounded-full p-0"
              onClick={() => {
                setSelectedFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* Input Box */}
        <div className="p-3 border-t bg-background flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
            }}
          />
          <Button
            type="button"
            size="icon"
            variant="outline"
            title="Attach file (Upload to Google Drive)"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending || uploadingFile}
          >
            <Paperclip className="h-4 w-4" />
          </Button>

          <Input
            placeholder="Type clarification message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            disabled={sending || uploadingFile}
            className="flex-1 text-sm"
          />

          <Button
            onClick={handleSendMessage}
            disabled={(!newMessage.trim() && !selectedFile) || sending || uploadingFile}
          >
            {sending || uploadingFile ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
