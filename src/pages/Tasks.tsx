import { useEffect, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { CheckSquare, Plus, FileText, Download, File, Image as ImageIcon, Trash2, MessageSquare, Send, Users, Edit, GripVertical, ArrowUpDown, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

// Sortable Task Item Component for Reorder Dialog
function SortableTaskItem({ task }: { task: Task }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 bg-card border rounded-lg hover:bg-accent/50 transition-colors"
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="flex-1">
        <p className="font-medium">{task.title}</p>
        {task.due_date && (
          <p className="text-xs text-muted-foreground">
            Due: {format(new Date(task.due_date), "MMM dd, yyyy")}
          </p>
        )}
      </div>
    </div>
  );
}

// Skeleton Loading Component
function TaskSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-3">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/4" />
          </div>
          <div className="flex gap-2">
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
        <Skeleton className="h-32 w-full rounded-lg" />
        <div className="pt-4 border-t">
          <Skeleton className="h-10 w-32" />
        </div>
      </CardContent>
    </Card>
  );
}

interface Task {
  id: string;
  title: string;
  description: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  due_date: string | null;
  is_active: boolean;
  file_url: string | null;
  file_name: string | null;
  display_order: number | null;
}

interface TaskResponse {
  id: string;
  task_id: string;
  user_id: string;
  response_text: string;
  link: string | null;
  file_url: string | null;
  file_name: string | null;
  created_at: string;
  employee_profiles: {
    first_name: string;
    last_name: string;
  };
}

interface TaskRemark {
  id: string;
  response_id: string;
  remarked_by: string;
  remark_text: string;
  rating?: number;
  created_at: string;
  employee_profiles: {
    first_name: string;
    last_name: string;
  };
}

const Tasks = () => {
  const { role, user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [reorderOpen, setReorderOpen] = useState(false);
  const [allTasksForReorder, setAllTasksForReorder] = useState<Task[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [responses, setResponses] = useState<Record<string, TaskResponse[]>>({});
  const [remarks, setRemarks] = useState<Record<string, TaskRemark[]>>({});
  const [assignments, setAssignments] = useState<Record<string, Array<{ user_id: string; first_name: string; last_name: string }>>>({});
  const [peerReviewers, setPeerReviewers] = useState<Record<string, Array<{ user_id: string; first_name: string; last_name: string }>>>({});
  const [responseDialogOpen, setResponseDialogOpen] = useState(false);
  const [remarkDialogOpen, setRemarkDialogOpen] = useState(false);
  const [selectedResponse, setSelectedResponse] = useState<TaskResponse | null>(null);
  
  const TASKS_PER_PAGE = 4;
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    due_date: "",
    file: null as File | null,
    assign_to: "all" as "all" | "specific",
    assigned_user_ids: [] as string[],
    peer_reviewer_ids: [] as string[],
    peer_reviewer_group_ids: [] as string[],
  });

  const [employees, setEmployees] = useState<Array<{ user_id: string; first_name: string; last_name: string; email: string }>>([]);
  const [reviewerGroups, setReviewerGroups] = useState<Array<{ id: string; name: string; member_ids: string[] }>>([]);

  const [responseFormData, setResponseFormData] = useState({
    response_text: "",
    link: "",
    file: null as File | null,
  });

  const [remarkFormData, setRemarkFormData] = useState({
    remark_text: "",
    rating: 5,
  });

  const [editFormData, setEditFormData] = useState({
    title: "",
    description: "",
    due_date: "",
    file: null as File | null,
    keepExistingFile: true,
    assign_to: "all" as "all" | "specific",
    assigned_user_ids: [] as string[],
    peer_reviewer_ids: [] as string[],
    peer_reviewer_group_ids: [] as string[],
  });

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
    fetchTasks(true); // Initial load
    if (role === "admin") {
      fetchEmployees();
      fetchReviewerGroups();
    }
  }, [role]);

  // Infinite scroll observer
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = document.documentElement.clientHeight;
      
      // When user scrolls to 80% of the page (8th task out of 12)
      const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;
      
      if (scrollPercentage > 0.66 && !loadingMore && hasMore) {
        fetchTasks(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadingMore, hasMore, page]);

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from("employee_profiles")
        .select("user_id, first_name, last_name, email")
        .order("first_name");

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  const fetchTasks = async (reset: boolean = false) => {
    try {
      if (reset) {
        setLoading(true);
        setPage(0);
        setHasMore(true);
      } else {
        setLoadingMore(true);
      }

      const currentPage = reset ? 0 : page;
      const from = currentPage * TASKS_PER_PAGE;
      const to = from + TASKS_PER_PAGE - 1;

      let query;
      
      if (role === "admin") {
        // Admin sees all tasks
        query = supabase
          .from("tasks" as any)
          .select("*", { count: 'exact' })
          .eq("is_active", true)
          .order("display_order", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: false })
          .range(from, to);
      } else {
        // Employees and managers only see tasks assigned to them
        const { data: assignedTasks, error: assignError } = await supabase
          .from("task_assignments" as any)
          .select("task_id")
          .eq("user_id", user?.id);

        if (assignError) throw assignError;

        const taskIds = (assignedTasks || []).map((a: any) => a.task_id);

        if (taskIds.length === 0) {
          setTasks([]);
          setHasMore(false);
          setLoading(false);
          setLoadingMore(false);
          return;
        }

        query = supabase
          .from("tasks" as any)
          .select("*", { count: 'exact' })
          .in("id", taskIds)
          .eq("is_active", true)
          .order("display_order", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: false })
          .range(from, to);
      }

      const { data, error, count } = await query;

      if (error) throw error;
      
      const newTasks = (data || []) as Task[];
      
      if (reset) {
        setTasks(newTasks);
      } else {
        setTasks(prev => [...prev, ...newTasks]);
      }
      
      // Check if there are more tasks to load
      const totalLoaded = reset ? newTasks.length : tasks.length + newTasks.length;
      setHasMore(count ? totalLoaded < count : newTasks.length === TASKS_PER_PAGE);
      
      if (!reset) {
        setPage(currentPage + 1);
      } else {
        setPage(1);
      }
      
      // Fetch responses and assignments in parallel for better performance
      if (newTasks && newTasks.length > 0) {
        const taskIds = newTasks.map(task => task.id);
        
        // Fetch all responses in one query
        Promise.all(taskIds.map(id => fetchResponses(id))).catch(console.error);
        
        // Fetch all assignments in one query
        Promise.all(taskIds.map(id => fetchAssignments(id))).catch(console.error);

        // Fetch peer reviewers
        Promise.all(taskIds.map(id => fetchPeerReviewers(id))).catch(console.error);
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
      toast({
        title: "Error",
        description: "Failed to load tasks",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const fetchResponses = async (taskId: string) => {
    try {
      // Fetch responses without join first
      const { data: responsesData, error: responsesError } = await supabase
        .from("task_responses" as any)
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });
      
      if (responsesError) {
        console.error("Error fetching responses:", responsesError);
        throw responsesError;
      }
      
      console.log("📝 Raw responses:", responsesData);
      
      // Manually fetch employee profiles for all responses
      if (responsesData && responsesData.length > 0) {
        const userIds = [...new Set(responsesData.map((r: any) => r.user_id))];
        console.log("👥 User IDs to fetch:", userIds);
        
        const { data: profiles, error: profilesError } = await supabase
          .from("employee_profiles")
          .select("user_id, first_name, last_name")
          .in("user_id", userIds);
        
        console.log("👤 Profiles fetched:", profiles);
        if (profilesError) console.error("❌ Profiles error:", profilesError);
        
        // For missing profiles, create placeholder from response data
        const missingUserIds = userIds.filter(uid => 
          !(profiles || []).some((p: any) => p.user_id === uid)
        );
        
        console.log("⚠️ Missing profiles for user_ids:", missingUserIds);
        
        // Create placeholder profiles for missing users
        const placeholderProfiles = missingUserIds.map((userId, index) => ({
          user_id: userId,
          first_name: `Employee`,
          last_name: `#${userId.substring(0, 4)}`
        }));
        
        console.log("📝 Placeholder profiles created:", placeholderProfiles);
        
        // Combine employee_profiles and placeholder profiles
        const allProfiles = [...(profiles || []), ...placeholderProfiles];
        
        // Map profiles to responses
        const enrichedData = responsesData.map((response: any) => {
          const profile = allProfiles.find((p: any) => p.user_id === response.user_id);
          console.log(`🔗 Mapping user_id ${response.user_id}:`, profile);
          
          return {
            ...response,
            employee_profiles: profile || { first_name: "Unknown", last_name: "User" }
          };
        });
        
        console.log("✅ Final enriched responses:", enrichedData);
        setResponses(prev => ({ ...prev, [taskId]: enrichedData as any }));
        
        // Fetch remarks for each response
        for (const response of enrichedData) {
          await fetchRemarks(response.id);
        }
      }
    } catch (error) {
      console.error("Error in fetchResponses:", error);
    }
  };

  const fetchRemarks = async (responseId: string) => {
    try {
      // First try with join
      let { data, error } = await supabase
        .from("task_remarks" as any)
        .select(`
          *,
          employee_profiles:remarked_by(first_name, last_name)
        `)
        .eq("response_id", responseId)
        .order("created_at", { ascending: false });

      // If join fails or returns null profiles, fetch manually
      if (error || !data || data.some((r: any) => !r.employee_profiles)) {
        const { data: remarksData, error: remarksError } = await supabase
          .from("task_remarks" as any)
          .select("*")
          .eq("response_id", responseId)
          .order("created_at", { ascending: false });
        
        if (remarksError) throw remarksError;
        
        // Manually fetch employee profiles
        if (remarksData && remarksData.length > 0) {
          const enrichedData = await Promise.all(
            remarksData.map(async (remark: any) => {
              const { data: profile } = await supabase
                .from("employee_profiles")
                .select("first_name, last_name")
                .eq("user_id", remark.remarked_by)
                .single();
              
              return {
                ...remark,
                employee_profiles: profile || { first_name: "Unknown", last_name: "User" }
              };
            })
          );
          
          setRemarks(prev => ({ ...prev, [responseId]: enrichedData as any }));
        }
        return;
      }
      
      setRemarks(prev => ({ ...prev, [responseId]: data as any || [] }));
    } catch (error) {
      console.error("Error fetching remarks:", error);
    }
  };

  const fetchAssignments = async (taskId: string) => {
    try {
      // First try with join
      let { data, error } = await supabase
        .from("task_assignments" as any)
        .select(`
          user_id,
          employee_profiles:user_id(first_name, last_name)
        `)
        .eq("task_id", taskId);

      // If join fails or returns null profiles, fetch manually
      if (error || !data || data.some((a: any) => !a.employee_profiles)) {
        const { data: assignmentsData, error: assignError } = await supabase
          .from("task_assignments" as any)
          .select("user_id")
          .eq("task_id", taskId);

        if (assignError) {
          console.error("Error fetching assignments:", assignError);
          return;
        }

        // Manually fetch employee profiles
        if (assignmentsData && assignmentsData.length > 0) {
          const userIds = assignmentsData.map((a: any) => a.user_id);
          const { data: profiles } = await supabase
            .from("employee_profiles")
            .select("user_id, first_name, last_name")
            .in("user_id", userIds);

          const assignedEmployees = userIds.map(userId => {
            const profile = (profiles || []).find((p: any) => p.user_id === userId);
            return {
              user_id: userId,
              first_name: profile?.first_name || "Unknown",
              last_name: profile?.last_name || "User",
            };
          });

          setAssignments(prev => ({ ...prev, [taskId]: assignedEmployees }));
        }
        return;
      }

      // Transform data to flat structure
      const assignedEmployees = (data || []).map((assignment: any) => ({
        user_id: assignment.user_id,
        first_name: assignment.employee_profiles?.first_name || "Unknown",
        last_name: assignment.employee_profiles?.last_name || "User",
      }));

      setAssignments(prev => ({ ...prev, [taskId]: assignedEmployees }));
    } catch (error) {
      console.error("Error fetching assignments:", error);
    }
  };

  const fetchPeerReviewers = async (taskId: string) => {
    try {
      const { data, error } = await supabase
        .from("task_peer_reviewers" as any)
        .select("user_id")
        .eq("task_id", taskId);
      if (error) {
        console.error("Error fetching peer reviewers:", error);
        return;
      }
      const userIds = (data || []).map((r: any) => r.user_id);
      if (userIds.length === 0) {
        setPeerReviewers(prev => ({ ...prev, [taskId]: [] }));
        return;
      }
      const { data: profiles } = await supabase
        .from("employee_profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", userIds);
      const reviewers = userIds.map(uid => {
        const p = (profiles || []).find((x: any) => x.user_id === uid);
        return {
          user_id: uid,
          first_name: p?.first_name || "Unknown",
          last_name: p?.last_name || "User",
        };
      });
      setPeerReviewers(prev => ({ ...prev, [taskId]: reviewers }));
    } catch (error) {
      console.error("Error fetching peer reviewers:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Strip HTML tags for validation
    const descriptionText = formData.description.replace(/<[^>]*>/g, '').trim();
    if (!formData.title.trim() || !descriptionText) {
      toast({
        title: "Error",
        description: "Title and description are required",
        variant: "destructive",
      });
      return;
    }

    if (formData.assign_to === "specific" && formData.assigned_user_ids.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one employee",
        variant: "destructive",
      });
      return;
    }

    if (!user?.id) {
      toast({
        title: "Error",
        description: "User not authenticated",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      let fileUrl = null;
      let fileName = null;

      // Upload to Supabase Storage if file exists
      if (formData.file) {
        const fileExt = formData.file.name.split('.').pop();
        const filePath = `${crypto.randomUUID()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('tasks')
          .upload(filePath, formData.file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('tasks')
          .getPublicUrl(filePath);

        fileUrl = publicUrl;
        fileName = formData.file.name;
      }

      // Create the task
      const { data: taskData, error: taskError } = await supabase
        .from("tasks" as any)
        .insert({
          title: formData.title,
          description: formData.description,
          due_date: formData.due_date || null,
          file_url: fileUrl,
          file_name: fileName,
          created_by: user.id,
          is_active: true,
        })
        .select()
        .single();

      if (taskError) throw taskError;

      // Create task assignments
      if (formData.assign_to === "all") {
        // Assign to all employees
        const assignments = employees.map(emp => ({
          task_id: (taskData as any).id,
          user_id: emp.user_id,
        }));

        const { error: assignError } = await supabase
          .from("task_assignments" as any)
          .insert(assignments);

        if (assignError) throw assignError;
      } else {
        // Assign to selected employees
        const assignments = formData.assigned_user_ids.map(userId => ({
          task_id: (taskData as any).id,
          user_id: userId,
        }));

        const { error: assignError } = await supabase
          .from("task_assignments" as any)
          .insert(assignments);

        if (assignError) throw assignError;
      }

      // Insert peer reviewers (optional)
      if (formData.peer_reviewer_ids.length > 0) {
        const reviewers = formData.peer_reviewer_ids.map(uid => ({
          task_id: (taskData as any).id,
          user_id: uid,
        }));
        const { error: revError } = await supabase
          .from("task_peer_reviewers" as any)
          .insert(reviewers);
        if (revError) throw revError;
      }

      toast({
        title: "Success",
        description: `Task created and assigned to ${formData.assign_to === "all" ? "all employees" : `${formData.assigned_user_ids.length} employee(s)`}`,
      });

      setFormData({ title: "", description: "", due_date: "", file: null, assign_to: "all", assigned_user_ids: [], peer_reviewer_ids: [], peer_reviewer_group_ids: [] });
      setOpen(false);
      fetchTasks(true); // Reset and reload from beginning
    } catch (error) {
      console.error("Error creating task:", error);
      toast({
        title: "Error",
        description: "Failed to create task",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResponseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !responseFormData.response_text.trim()) {
      toast({
        title: "Error",
        description: "Response text is required",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      let fileUrl = null;
      let fileName = null;

      // Upload to Supabase Storage if file exists
      if (responseFormData.file) {
        const fileExt = responseFormData.file.name.split('.').pop();
        const filePath = `${crypto.randomUUID()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('task-responses')
          .upload(filePath, responseFormData.file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('task-responses')
          .getPublicUrl(filePath);

        fileUrl = publicUrl;
        fileName = responseFormData.file.name;
      }

      const { error } = await supabase
        .from("task_responses" as any)
        .insert({
          task_id: selectedTask.id,
          user_id: user?.id,
          response_text: responseFormData.response_text,
          link: responseFormData.link.trim() || null,
          file_url: fileUrl,
          file_name: fileName,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Response submitted successfully",
      });

      setResponseFormData({ response_text: "", link: "", file: null });
      setResponseDialogOpen(false);
      setSelectedTask(null);
      
      // Refresh responses and wait for it to complete
      await fetchResponses(selectedTask.id);
    } catch (error: any) {
      console.error("Error submitting response:", error);
      
      // Check if it's a duplicate key error
      if (error?.code === '23505') {
        toast({
          title: "Already Submitted",
          description: "You have already submitted a response to this task",
          variant: "destructive",
        });
        setResponseDialogOpen(false);
        setSelectedTask(null);
        // Refresh to show the existing response
        await fetchResponses(selectedTask.id);
      } else {
        toast({
          title: "Error",
          description: "Failed to submit response",
          variant: "destructive",
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemarkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResponse || !remarkFormData.remark_text.trim()) {
      toast({
        title: "Error",
        description: "Remark text is required",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("task_remarks" as any)
        .insert({
          response_id: selectedResponse.id,
          remarked_by: user?.id,
          remark_text: remarkFormData.remark_text,
          rating: remarkFormData.rating,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Remark added successfully",
      });

      setRemarkFormData({ remark_text: "", rating: 5 });
      setRemarkDialogOpen(false);
      fetchRemarks(selectedResponse.id);
    } catch (error) {
      console.error("Error adding remark:", error);
      toast({
        title: "Error",
        description: "Failed to add remark",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (taskId: string, fileUrl: string | null) => {
    try {
      if (fileUrl) {
        const filePath = fileUrl.split('/').pop();
        if (filePath) {
          await supabase.storage.from('tasks').remove([filePath]);
        }
      }

      const { error } = await supabase
        .from("tasks" as any)
        .delete()
        .eq("id", taskId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Task deleted successfully",
      });

      fetchTasks(true); // Reset and reload
    } catch (error) {
      console.error("Error deleting task:", error);
      toast({
        title: "Error",
        description: "Failed to delete task",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (task: Task) => {
    setEditingTask(task);
    
    // Fetch current assignments for this task
    const currentAssignments = assignments[task.id] || [];
    const assignedUserIds = currentAssignments.map(a => a.user_id);
    
    const currentReviewers = peerReviewers[task.id] || [];
    setEditFormData({
      title: task.title,
      description: task.description,
      due_date: task.due_date ? task.due_date.split('T')[0] : "",
      file: null,
      keepExistingFile: true,
      assign_to: assignedUserIds.length === employees.length ? "all" : "specific",
      assigned_user_ids: assignedUserIds,
      peer_reviewer_ids: currentReviewers.map(r => r.user_id),
    });
    setEditOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;
    
    // Strip HTML tags for validation
    const descriptionText = editFormData.description.replace(/<[^>]*>/g, '').trim();
    if (!editFormData.title.trim() || !descriptionText) {
      toast({
        title: "Error",
        description: "Title and description are required",
        variant: "destructive",
      });
      return;
    }

    if (editFormData.assign_to === "specific" && editFormData.assigned_user_ids.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one employee",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      let fileUrl = editingTask.file_url;
      let fileName = editingTask.file_name;

      // Handle file update
      if (editFormData.file) {
        // Delete old file if exists
        if (editingTask.file_url) {
          const oldFilePath = editingTask.file_url.split('/').pop();
          if (oldFilePath) {
            await supabase.storage.from('tasks').remove([oldFilePath]);
          }
        }

        // Upload new file
        const fileExt = editFormData.file.name.split('.').pop();
        const filePath = `${crypto.randomUUID()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('tasks')
          .upload(filePath, editFormData.file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('tasks')
          .getPublicUrl(filePath);

        fileUrl = publicUrl;
        fileName = editFormData.file.name;
      } else if (!editFormData.keepExistingFile && editingTask.file_url) {
        // Remove existing file if user chose to remove it
        const oldFilePath = editingTask.file_url.split('/').pop();
        if (oldFilePath) {
          await supabase.storage.from('tasks').remove([oldFilePath]);
        }
        fileUrl = null;
        fileName = null;
      }

      // Update the task
      const { error: taskError } = await supabase
        .from("tasks" as any)
        .update({
          title: editFormData.title,
          description: editFormData.description,
          due_date: editFormData.due_date || null,
          file_url: fileUrl,
          file_name: fileName,
        })
        .eq("id", editingTask.id);

      if (taskError) throw taskError;

      // Update task assignments
      // First, delete existing assignments
      const { error: deleteError } = await supabase
        .from("task_assignments" as any)
        .delete()
        .eq("task_id", editingTask.id);

      if (deleteError) throw deleteError;

      // Then, create new assignments
      if (editFormData.assign_to === "all") {
        const assignments = employees.map(emp => ({
          task_id: editingTask.id,
          user_id: emp.user_id,
        }));

        const { error: assignError } = await supabase
          .from("task_assignments" as any)
          .insert(assignments);

        if (assignError) throw assignError;
      } else {
        const assignments = editFormData.assigned_user_ids.map(userId => ({
          task_id: editingTask.id,
          user_id: userId,
        }));

        const { error: assignError } = await supabase
          .from("task_assignments" as any)
          .insert(assignments);

        if (assignError) throw assignError;
      }

      // Update peer reviewers: delete then re-insert
      await supabase
        .from("task_peer_reviewers" as any)
        .delete()
        .eq("task_id", editingTask.id);

      if (editFormData.peer_reviewer_ids.length > 0) {
        const reviewers = editFormData.peer_reviewer_ids.map(uid => ({
          task_id: editingTask.id,
          user_id: uid,
        }));
        const { error: revError } = await supabase
          .from("task_peer_reviewers" as any)
          .insert(reviewers);
        if (revError) throw revError;
      }

      toast({
        title: "Success",
        description: "Task updated successfully",
      });

      setEditOpen(false);
      setEditingTask(null);
      fetchTasks(true); // Reset and reload
    } catch (error) {
      console.error("Error updating task:", error);
      toast({
        title: "Error",
        description: "Failed to update task",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const canCreateTask = role === "admin";
  const canEditTask = role === "admin";
  const canDeleteTask = role === "admin";
  const canAddRemark = role === "admin";

  // Helper: can current user remark on this specific response?
  const canRemarkOnResponse = (taskId: string, responseUserId: string) => {
    if (role === "admin" || role === "manager") return true;
    const reviewers = peerReviewers[taskId] || [];
    const isReviewer = reviewers.some(r => r.user_id === user?.id);
    return isReviewer && responseUserId !== user?.id;
  };

  // Helper: is current user a peer reviewer for this task (so we render the "Responses to review" section even for employees)?
  const isPeerReviewerOf = (taskId: string) => {
    const reviewers = peerReviewers[taskId] || [];
    return reviewers.some(r => r.user_id === user?.id);
  };

  const handleReorderSave = async () => {
    setReorderOpen(false);
    toast({
      title: "Success",
      description: "Task order saved successfully",
    });
    fetchTasks(true); // Reload with new order
  };

  const fetchAllTasksForReorder = async () => {
    try {
      const { data, error } = await supabase
        .from("tasks" as any)
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAllTasksForReorder((data || []) as any);
    } catch (error) {
      console.error("Error fetching all tasks:", error);
    }
  };

  const handleReorderDialogOpen = (open: boolean) => {
    setReorderOpen(open);
    if (open) {
      fetchAllTasksForReorder();
    }
  };

  const handleDragEndReorder = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = allTasksForReorder.findIndex((task) => task.id === active.id);
    const newIndex = allTasksForReorder.findIndex((task) => task.id === over.id);

    const newTasks = arrayMove(allTasksForReorder, oldIndex, newIndex);
    setAllTasksForReorder(newTasks);

    // Update display_order in database
    try {
      const updates = newTasks.map((task, index) => ({
        id: task.id,
        display_order: index,
      }));

      for (const update of updates) {
        await supabase
          .from("tasks" as any)
          .update({ display_order: update.display_order })
          .eq("id", update.id);
      }

      toast({
        title: "Success",
        description: "Task order updated successfully",
      });
      
      // Refresh main task list
      fetchTasks(true);
    } catch (error) {
      console.error("Error updating task order:", error);
      toast({
        title: "Error",
        description: "Failed to update task order",
        variant: "destructive",
      });
      // Revert on error
      fetchAllTasksForReorder();
    }
  };

  const renderFilePreview = (fileUrl: string | null, fileName: string | null) => {
    if (!fileUrl || !fileName) return null;

    const fileExt = fileName.split('.').pop()?.toLowerCase();
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(fileExt || '');
    const isPdf = fileExt === 'pdf';

    if (isImage) {
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ImageIcon className="h-4 w-4" />
            <span>{fileName}</span>
          </div>
          <a href={fileUrl} target="_blank" rel="noopener noreferrer">
            <img
              src={fileUrl}
              alt={fileName}
              className="max-w-full h-auto rounded-lg border max-h-96 object-contain hover:opacity-90 transition-opacity"
            />
          </a>
          <a
            href={fileUrl}
            download={fileName}
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
            <span>{fileName}</span>
          </div>
          <div className="border rounded-lg overflow-hidden">
            <iframe src={fileUrl} className="w-full h-96" title={fileName} />
          </div>
          <a
            href={fileUrl}
            download={fileName}
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
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            download={fileName}
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            {fileName}
            <Download className="h-3 w-3" />
          </a>
        </div>
      );
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
            <p className="text-muted-foreground">View and respond to assigned tasks</p>
          </div>
          <div className="flex gap-2">
            {canCreateTask && (
              <>
                <Dialog open={reorderOpen} onOpenChange={handleReorderDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <ArrowUpDown className="mr-2 h-4 w-4" />
                      Reorder Tasks
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[500px] max-h-[80vh]">
                    <DialogHeader>
                      <DialogTitle>Reorder Tasks</DialogTitle>
                      <DialogDescription>
                        Drag and drop tasks to change their order
                      </DialogDescription>
                    </DialogHeader>
                    <div className="overflow-y-auto max-h-[60vh] pr-2">
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEndReorder}
                      >
                        <SortableContext
                          items={allTasksForReorder.map(t => t.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="space-y-2">
                            {allTasksForReorder.map((task) => (
                              <SortableTaskItem key={task.id} task={task} />
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    </div>
                    <div className="flex justify-end gap-2 pt-4 border-t">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setReorderOpen(false)}
                      >
                        Close
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <Dialog open={open} onOpenChange={setOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Task
                    </Button>
                  </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Create New Task</DialogTitle>
                  <DialogDescription>
                    Create a new task and assign it to all employees or a specific employee
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      placeholder="Enter task title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <div className="border rounded-md">
                      <ReactQuill
                        theme="snow"
                        value={formData.description}
                        onChange={(value) => setFormData({ ...formData, description: value })}
                        modules={{
                          toolbar: [
                            [{ header: [1, 2, 3, false] }],
                            ["bold", "italic", "underline", "strike"],
                            [{ list: "ordered" }, { list: "bullet" }],
                            [{ color: [] }, { background: [] }],
                            ["link"],
                            ["clean"],
                          ],
                        }}
                        className="bg-white dark:bg-gray-950"
                        style={{ minHeight: "150px" }}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="assign_to">Assign To</Label>
                    <Select 
                      value={formData.assign_to} 
                      onValueChange={(value: "all" | "specific") => 
                        setFormData({ ...formData, assign_to: value, assigned_user_ids: value === "all" ? [] : formData.assigned_user_ids })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select assignment type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Employees</SelectItem>
                        <SelectItem value="specific">Specific Employee</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.assign_to === "specific" && (
                    <div className="space-y-2">
                      <Label>Select Employees (Multiple)</Label>
                      <div className="border rounded-lg p-4 max-h-60 overflow-y-auto space-y-3">
                        {employees.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No employees found</p>
                        ) : (
                          employees.map((emp) => (
                            <div key={emp.user_id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`emp-${emp.user_id}`}
                                checked={formData.assigned_user_ids.includes(emp.user_id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setFormData({
                                      ...formData,
                                      assigned_user_ids: [...formData.assigned_user_ids, emp.user_id]
                                    });
                                  } else {
                                    setFormData({
                                      ...formData,
                                      assigned_user_ids: formData.assigned_user_ids.filter(id => id !== emp.user_id)
                                    });
                                  }
                                }}
                              />
                              <Label
                                htmlFor={`emp-${emp.user_id}`}
                                className="text-sm font-normal cursor-pointer"
                              >
                                {emp.first_name} {emp.last_name} ({emp.email})
                              </Label>
                            </div>
                          ))
                        )}
                      </div>
                      {formData.assigned_user_ids.length > 0 && (
                        <p className="text-sm text-muted-foreground">
                          {formData.assigned_user_ids.length} employee(s) selected
                        </p>
                      )}
                    </div>
                  )}

                  {/* Peer Reviewers (Optional) */}
                  <div className="space-y-2">
                    <Label>Peer Reviewers (Optional)</Label>
                    <p className="text-xs text-muted-foreground">
                      Select employees who can review and add remarks on others' responses for this task.
                    </p>
                    <div className="border rounded-lg p-4 max-h-60 overflow-y-auto space-y-3">
                      {employees.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No employees found</p>
                      ) : (
                        employees.map((emp) => (
                          <div key={`rev-${emp.user_id}`} className="flex items-center space-x-2">
                            <Checkbox
                              id={`rev-${emp.user_id}`}
                              checked={formData.peer_reviewer_ids.includes(emp.user_id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setFormData({
                                    ...formData,
                                    peer_reviewer_ids: [...formData.peer_reviewer_ids, emp.user_id],
                                  });
                                } else {
                                  setFormData({
                                    ...formData,
                                    peer_reviewer_ids: formData.peer_reviewer_ids.filter(id => id !== emp.user_id),
                                  });
                                }
                              }}
                            />
                            <Label htmlFor={`rev-${emp.user_id}`} className="text-sm font-normal cursor-pointer">
                              {emp.first_name} {emp.last_name}
                            </Label>
                          </div>
                        ))
                      )}
                    </div>
                    {formData.peer_reviewer_ids.length > 0 && (
                      <p className="text-sm text-muted-foreground">
                        {formData.peer_reviewer_ids.length} peer reviewer(s) selected
                      </p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="due_date">Due Date (Optional)</Label>
                    <Input
                      id="due_date"
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    />
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
                      {submitting ? "Creating..." : "Create Task"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
              </>
            )}
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, index) => (
              <TaskSkeleton key={index} />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CheckSquare className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                No tasks at this time.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => {
              const taskResponses = responses[task.id] || [];
              const userResponse = taskResponses.find(r => r.user_id === user?.id);
              
              return (
                <Card key={task.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-xl">{task.title}</CardTitle>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {task.due_date && (
                            <Badge variant="outline">
                              Due: {format(new Date(task.due_date), "MMM dd, yyyy")}
                            </Badge>
                          )}
                          {isPeerReviewerOf(task.id) && (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                               Peer Reviewer
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(task.created_at), "MMM dd, yyyy")}
                        </span>
                        {canEditTask && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => openEditDialog(task)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {canDeleteTask && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Task</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this task? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(task.id, task.file_url)}
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
                      className="text-muted-foreground prose prose-sm dark:prose-invert max-w-none [&>p]:mb-2 [&>ul]:list-disc [&>ul]:ml-4 [&>ol]:list-decimal [&>ol]:ml-4"
                      dangerouslySetInnerHTML={{ __html: task.description }}
                    />
                    
                    {/* Assigned To Section - Only show for admin */}
                    {role === "admin" && assignments[task.id] && assignments[task.id].length > 0 && (
                      <div className="pt-4 border-t">
                        <div className="flex items-start gap-2">
                          <Users className="h-4 w-4 mt-1 text-muted-foreground" />
                          <div className="flex-1">
                            <p className="text-sm font-medium mb-2">Assigned To:</p>
                            <div className="flex flex-wrap gap-2">
                              {assignments[task.id].map((emp) => (
                                <Badge key={emp.user_id} variant="secondary" className="text-xs">
                                  {emp.first_name} {emp.last_name}
                                </Badge>
                              ))}
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                              {assignments[task.id].length} employee(s) assigned
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {task.file_url && task.file_name && (
                      <div className="pt-4 border-t">
                        {renderFilePreview(task.file_url, task.file_name)}
                      </div>
                    )}

                    <Separator />

                    {/* Response Section */}
                    <div className="space-y-4">
                      {/* Admin/Manager OR peer reviewer: Show responses */}
                      {(role === "admin" || role === "manager" || isPeerReviewerOf(task.id)) && (
                        <>
                          {(() => {
                            const isAdminOrMgr = role === "admin" || role === "manager";
                            // Peer reviewers see only OTHERS' responses (not their own)
                            const visibleResponses = isAdminOrMgr
                              ? taskResponses
                              : taskResponses.filter(r => r.user_id !== user?.id);
                            return (
                              <>
                                <div className="flex items-center justify-between">
                                  <h3 className="font-semibold flex items-center gap-2">
                                    <MessageSquare className="h-4 w-4" />
                                    {isAdminOrMgr ? "Responses" : "Responses to Review"} ({visibleResponses.length})
                                  </h3>
                                </div>

                                {visibleResponses.length > 0 && (
                                  <div className="space-y-4">
                                    {visibleResponses.map((response) => {
                                const responseRemarks = remarks[response.id] || [];
                                
                                return (
                                  <Card key={response.id}>
                                    <CardContent className="pt-4 space-y-3">
                                      <div className="flex items-start justify-between">
                                        <div>
                                          <p className="font-medium">
                                            {response.employee_profiles?.first_name && response.employee_profiles?.last_name
                                              ? `${response.employee_profiles.first_name} ${response.employee_profiles.last_name}`
                                              : "Unknown User"}
                                          </p>
                                          <p className="text-xs text-muted-foreground">
                                            {format(new Date(response.created_at), "MMM dd, yyyy HH:mm")}
                                          </p>
                                        </div>
                                        {canRemarkOnResponse(task.id, response.user_id) && (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                              setSelectedResponse(response);
                                              setRemarkDialogOpen(true);
                                            }}
                                          >
                                            Add Remark
                                          </Button>
                                        )}
                                      </div>
                                      <p className="text-sm whitespace-pre-wrap">{response.response_text}</p>
                                      {response.link && (
                                        <div className="pt-2">
                                          <a 
                                            href={response.link} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-sm text-primary hover:underline flex items-center gap-1"
                                          >
                                            🔗 {response.link}
                                          </a>
                                        </div>
                                      )}
                                      {response.file_url && response.file_name && (
                                        <div className="pt-2 border-t">
                                          {renderFilePreview(response.file_url, response.file_name)}
                                        </div>
                                      )}

                                      {/* Remarks */}
                                      {responseRemarks.length > 0 && (
                                        <div className="mt-4 space-y-2 pl-4 border-l-2 border-primary">
                                          <p className="text-sm font-medium text-primary">Remarks:</p>
                                          {responseRemarks.map((remark) => (
                                            <div key={remark.id} className="bg-muted p-3 rounded-md">
                                              <div className="flex items-center justify-between mb-2">
                                                <div>
                                                  <p className="text-xs font-medium">
                                                    {remark.employee_profiles?.first_name} {remark.employee_profiles?.last_name}
                                                  </p>
                                                  <p className="text-xs text-muted-foreground">
                                                    {format(new Date(remark.created_at), "MMM dd, HH:mm")}
                                                  </p>
                                                </div>
                                                {remark.rating && (
                                                  <div className="flex items-center gap-1">
                                                    <span className="text-yellow-400">
                                                      {"★".repeat(remark.rating)}{"☆".repeat(5 - remark.rating)}
                                                    </span>
                                                    <span className="text-xs font-semibold">{remark.rating}/5</span>
                                                  </div>
                                                )}
                                              </div>
                                              <p className="text-sm">{remark.remark_text}</p>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </CardContent>
                                  </Card>
                                );
                              })}
                            </div>
                                )}
                              </>
                            );
                          })()}
                        </>
                      )}

                      {/* Employee: Show only submit button or their own response */}
                      {role === "employee" && (
                        <>
                          {!userResponse ? (
                            <div className="text-center py-6">
                              <Button
                                onClick={() => {
                                  // Double check user hasn't already responded
                                  if (userResponse) {
                                    toast({
                                      title: "Already Submitted",
                                      description: "You have already submitted a response to this task",
                                    });
                                    return;
                                  }
                                  setSelectedTask(task);
                                  setResponseDialogOpen(true);
                                }}
                              >
                                <Send className="h-4 w-4 mr-2" />
                                Submit Response
                              </Button>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <h3 className="font-semibold flex items-center gap-2">
                                <MessageSquare className="h-4 w-4" />
                                Your Response
                              </h3>
                              <Card className="border-primary">
                                <CardContent className="pt-4 space-y-3">
                                  <div>
                                    <p className="font-medium">
                                      {userResponse.employee_profiles?.first_name} {userResponse.employee_profiles?.last_name}
                                      <Badge variant="secondary" className="ml-2">You</Badge>
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {format(new Date(userResponse.created_at), "MMM dd, yyyy HH:mm")}
                                    </p>
                                  </div>
                                  <p className="text-sm whitespace-pre-wrap">{userResponse.response_text}</p>
                                  {userResponse.link && (
                                    <div className="pt-2">
                                      <a 
                                        href={userResponse.link} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-sm text-primary hover:underline flex items-center gap-1"
                                      >
                                        🔗 {userResponse.link}
                                      </a>
                                    </div>
                                  )}
                                  {userResponse.file_url && userResponse.file_name && (
                                    <div className="pt-2 border-t">
                                      {renderFilePreview(userResponse.file_url, userResponse.file_name)}
                                    </div>
                                  )}

                                  {/* Remarks on employee's response */}
                                  {remarks[userResponse.id] && remarks[userResponse.id].length > 0 && (
                                    <div className="mt-4 space-y-2 pl-4 border-l-2 border-primary">
                                      <p className="text-sm font-medium text-primary">Remarks:</p>
                                      {remarks[userResponse.id].map((remark) => (
                                        <div key={remark.id} className="bg-muted p-3 rounded-md">
                                          <div className="flex items-center justify-between mb-2">
                                            <div>
                                              <p className="text-xs font-medium">
                                                {remark.employee_profiles?.first_name} {remark.employee_profiles?.last_name}
                                              </p>
                                              <p className="text-xs text-muted-foreground">
                                                {format(new Date(remark.created_at), "MMM dd, HH:mm")}
                                              </p>
                                            </div>
                                            {remark.rating && (
                                              <div className="flex items-center gap-1">
                                                <span className="text-yellow-400">
                                                  {"★".repeat(remark.rating)}{"☆".repeat(5 - remark.rating)}
                                                </span>
                                                <span className="text-xs font-semibold">{remark.rating}/5</span>
                                              </div>
                                            )}
                                          </div>
                                          <p className="text-sm">{remark.remark_text}</p>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Loading more indicator */}
        {loadingMore && (
          <div className="space-y-4">
            {[...Array(2)].map((_, index) => (
              <TaskSkeleton key={`loading-${index}`} />
            ))}
          </div>
        )}

        {/* No more tasks indicator */}
        {!loading && !loadingMore && !hasMore && tasks.length > 0 && (
          <div className="text-center py-4 text-muted-foreground">
            <p>No more tasks to load</p>
          </div>
        )}
      </div>

      {/* Response Dialog */}
      <Dialog open={responseDialogOpen} onOpenChange={setResponseDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Submit Response</DialogTitle>
            <DialogDescription>
              Submit your response to this task with optional file attachment
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResponseSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="response_text">Your Response</Label>
              <Textarea
                id="response_text"
                placeholder="Enter your response"
                value={responseFormData.response_text}
                onChange={(e) => setResponseFormData({ ...responseFormData, response_text: e.target.value })}
                rows={5}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="response_link">Link (Optional)</Label>
              <Input
                id="response_link"
                type="url"
                placeholder="https://example.com"
                value={responseFormData.link}
                onChange={(e) => setResponseFormData({ ...responseFormData, link: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Add a link related to your response (e.g., Google Drive, GitHub, etc.)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="response_file">Attachment (Optional)</Label>
              <Input
                id="response_file"
                type="file"
                onChange={(e) => setResponseFormData({ ...responseFormData, file: e.target.files?.[0] || null })}
              />
              {responseFormData.file && (
                <p className="text-sm text-muted-foreground">
                  Selected: {responseFormData.file.name}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setResponseDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Submitting..." : "Submit Response"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Remark Dialog */}
      <Dialog open={remarkDialogOpen} onOpenChange={setRemarkDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Add Remark</DialogTitle>
            <DialogDescription>
              Add your remark or feedback on this response
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRemarkSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="remark_text">Your Remark</Label>
              <Textarea
                id="remark_text"
                placeholder="Enter your remark"
                value={remarkFormData.remark_text}
                onChange={(e) => setRemarkFormData({ ...remarkFormData, remark_text: e.target.value })}
                rows={4}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rating">Rating (1-5)</Label>
              <div className="flex items-center gap-4">
                <input
                  id="rating"
                  type="range"
                  min="1"
                  max="5"
                  value={remarkFormData.rating}
                  onChange={(e) => setRemarkFormData({ ...remarkFormData, rating: parseInt(e.target.value) })}
                  className="flex-1"
                />
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRemarkFormData({ ...remarkFormData, rating: star })}
                      className={`text-2xl transition-colors ${
                        star <= remarkFormData.rating ? "text-yellow-400" : "text-gray-300"
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <span className="font-semibold text-lg w-8 text-center">{remarkFormData.rating}</span>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setRemarkDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Adding..." : "Add Remark"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Task Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
            <DialogDescription>
              Update task details and assignments
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                placeholder="Enter task title"
                value={editFormData.title}
                onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <div className="border rounded-md">
                <ReactQuill
                  theme="snow"
                  value={editFormData.description}
                  onChange={(value) => setEditFormData({ ...editFormData, description: value })}
                  modules={{
                    toolbar: [
                      [{ header: [1, 2, 3, false] }],
                      ["bold", "italic", "underline", "strike"],
                      [{ list: "ordered" }, { list: "bullet" }],
                      [{ color: [] }, { background: [] }],
                      ["link"],
                      ["clean"],
                    ],
                  }}
                  className="bg-white dark:bg-gray-950"
                  style={{ minHeight: "150px" }}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-assign_to">Assign To</Label>
              <Select 
                value={editFormData.assign_to} 
                onValueChange={(value: "all" | "specific") => 
                  setEditFormData({ ...editFormData, assign_to: value, assigned_user_ids: value === "all" ? [] : editFormData.assigned_user_ids })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select assignment type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  <SelectItem value="specific">Specific Employee</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editFormData.assign_to === "specific" && (
              <div className="space-y-2">
                <Label>Select Employees (Multiple)</Label>
                <div className="border rounded-lg p-4 max-h-60 overflow-y-auto space-y-3">
                  {employees.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No employees found</p>
                  ) : (
                    employees.map((emp) => (
                      <div key={emp.user_id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`edit-emp-${emp.user_id}`}
                          checked={editFormData.assigned_user_ids.includes(emp.user_id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setEditFormData({
                                ...editFormData,
                                assigned_user_ids: [...editFormData.assigned_user_ids, emp.user_id]
                              });
                            } else {
                              setEditFormData({
                                ...editFormData,
                                assigned_user_ids: editFormData.assigned_user_ids.filter(id => id !== emp.user_id)
                              });
                            }
                          }}
                        />
                        <Label
                          htmlFor={`edit-emp-${emp.user_id}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {emp.first_name} {emp.last_name} ({emp.email})
                        </Label>
                      </div>
                    ))
                  )}
                </div>
                {editFormData.assigned_user_ids.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {editFormData.assigned_user_ids.length} employee(s) selected
                  </p>
                )}
              </div>
            )}

            {/* Peer Reviewers (Optional) */}
            <div className="space-y-2">
              <Label>Peer Reviewers (Optional)</Label>
              <p className="text-xs text-muted-foreground">
                Select employees who can review and add remarks on others' responses for this task.
              </p>
              <div className="border rounded-lg p-4 max-h-60 overflow-y-auto space-y-3">
                {employees.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No employees found</p>
                ) : (
                  employees.map((emp) => (
                    <div key={`edit-rev-${emp.user_id}`} className="flex items-center space-x-2">
                      <Checkbox
                        id={`edit-rev-${emp.user_id}`}
                        checked={editFormData.peer_reviewer_ids.includes(emp.user_id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setEditFormData({
                              ...editFormData,
                              peer_reviewer_ids: [...editFormData.peer_reviewer_ids, emp.user_id],
                            });
                          } else {
                            setEditFormData({
                              ...editFormData,
                              peer_reviewer_ids: editFormData.peer_reviewer_ids.filter(id => id !== emp.user_id),
                            });
                          }
                        }}
                      />
                      <Label htmlFor={`edit-rev-${emp.user_id}`} className="text-sm font-normal cursor-pointer">
                        {emp.first_name} {emp.last_name}
                      </Label>
                    </div>
                  ))
                )}
              </div>
              {editFormData.peer_reviewer_ids.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {editFormData.peer_reviewer_ids.length} peer reviewer(s) selected
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-due_date">Due Date (Optional)</Label>
              <Input
                id="edit-due_date"
                type="date"
                value={editFormData.due_date}
                onChange={(e) => setEditFormData({ ...editFormData, due_date: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Attachment</Label>
              {editingTask?.file_url && editFormData.keepExistingFile && !editFormData.file && (
                <div className="flex items-center gap-2 p-2 border rounded-md bg-muted">
                  <File className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm flex-1">{editingTask.file_name}</span>
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
              {(!editingTask?.file_url || !editFormData.keepExistingFile) && (
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
                {submitting ? "Updating..." : "Update Task"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Tasks;
