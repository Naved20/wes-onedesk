import { useEffect, useState, useRef, Fragment } from "react";
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
import { CheckSquare, Plus, FileText, Download, File, Image as ImageIcon, Trash2, MessageSquare, Send, Users, Edit, GripVertical, ArrowUpDown, ExternalLink, UserCheck, Eye, Search, Filter, Coins } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronRight } from "lucide-react";
import { ReactQuillWrapper } from "@/components/ui/react-quill-wrapper";
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
  type: string | null;
  category: string | null;
  reward_amount: number | null;
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
  
  const [totalEarnings, setTotalEarnings] = useState<number>(0);
  const [loadingEarnings, setLoadingEarnings] = useState(false);
  
  const TASKS_PER_PAGE = 4;
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "",
    category: "",
    reward_amount: "",
    due_date: "",
    file: null as File | null,
    assign_to: "all" as "all" | "specific" | "groups",
    assigned_user_ids: [] as string[],
    assignment_group_ids: [] as string[],
    peer_reviewer_ids: [] as string[],
    peer_reviewer_group_ids: [] as string[],
    review_assignment_type: "group" as "group" | "individual" | "mixed",
    individual_reviewer_assignments: [] as Array<{ user_id: string; reviewer_id: string }>,
  });

  const [employees, setEmployees] = useState<Array<{ user_id: string; first_name: string; last_name: string; email: string }>>([]);
  const [reviewerGroups, setReviewerGroups] = useState<Array<{ id: string; name: string; member_ids: string[] }>>([]);
  const [assignmentGroups, setAssignmentGroups] = useState<Array<{ id: string; name: string; member_ids: string[] }>>([]);

  const [responseFormData, setResponseFormData] = useState({
    response_text: "",
    link: "",
    article_file: null as File | null,
    additional_file: null as File | null,
    file: null as File | null,
  });
  const [responseMode, setResponseMode] = useState<"link" | "file">("link");

  const [remarkFormData, setRemarkFormData] = useState({
    remark_text: "",
    rating: 5,
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [sortField, setSortField] = useState<string>("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const [editFormData, setEditFormData] = useState({
    title: "",
    description: "",
    type: "",
    category: "",
    reward_amount: "",
    due_date: "",
    file: null as File | null,
    keepExistingFile: true,
    assign_to: "all" as "all" | "specific" | "groups",
    assigned_user_ids: [] as string[],
    assignment_group_ids: [] as string[],
    peer_reviewer_ids: [] as string[],
    peer_reviewer_group_ids: [] as string[],
    review_assignment_type: "group" as "group" | "individual" | "mixed",
    individual_reviewer_assignments: [] as Array<{ user_id: string; reviewer_id: string }>,
  });

  // Ref for infinite scroll
  const loaderRef = useRef<HTMLDivElement>(null);


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
      fetchAssignmentGroups();
    }
    // Fetch total earnings for employees
    if (role === "employee" && user?.id) {
      fetchTotalEarnings();
    }
  }, [role, user?.id]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target.isIntersecting && !loadingMore && hasMore && !loading) {
          fetchTasks(false); // Load more tasks
        }
      },
      {
        root: null,
        rootMargin: "100px", // Start loading 100px before reaching the bottom
        threshold: 0.1,
      }
    );

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => {
      if (loaderRef.current) {
        observer.unobserve(loaderRef.current);
      }
    };
  }, [loadingMore, hasMore, loading]);


  const fetchTotalEarnings = async () => {
    if (!user?.id) return;
    
    setLoadingEarnings(true);
    try {
      const { data, error } = await supabase
        .from("task_earnings" as any)
        .select("amount, status")
        .eq("user_id", user.id);

      if (error) {
        console.error("Error fetching earnings:", error);
        return;
      }

      // Calculate total approved and paid earnings
      const total = (data || [])
        .filter((earning: any) => earning.status === "approved" || earning.status === "paid")
        .reduce((sum: number, earning: any) => sum + (parseFloat(earning.amount) || 0), 0);

      setTotalEarnings(total);
    } catch (error) {
      console.error("Error fetching total earnings:", error);
    } finally {
      setLoadingEarnings(false);
    }
  };

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

  const fetchReviewerGroups = async () => {
    try {
      const [{ data: groups }, { data: members }] = await Promise.all([
        (supabase as any).from("peer_reviewer_groups").select("id, name").order("name"),
        (supabase as any).from("peer_reviewer_group_members").select("group_id, user_id"),
      ]);
      const memberRows = (members || []) as Array<{ group_id: string; user_id: string }>;
      const enriched = (groups || []).map((g: any) => ({
        id: g.id,
        name: g.name,
        member_ids: memberRows.filter(m => m.group_id === g.id).map(m => m.user_id),
      }));
      setReviewerGroups(enriched);
    } catch (e) {
      console.error("Error fetching reviewer groups:", e);
    }
  };

  const fetchAssignmentGroups = async () => {
    try {
      const [{ data: groups }, { data: members }] = await Promise.all([
        (supabase as any).from("assignment_groups").select("id, name").eq("is_active", true).order("name"),
        (supabase as any).from("assignment_group_members").select("group_id, user_id"),
      ]);
      const memberRows = (members || []) as Array<{ group_id: string; user_id: string }>;
      const enriched = (groups || []).map((g: any) => ({
        id: g.id,
        name: g.name,
        member_ids: memberRows.filter(m => m.group_id === g.id).map(m => m.user_id),
      }));
      setAssignmentGroups(enriched);
    } catch (e) {
      console.error("Error fetching assignment groups:", e);
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

    if (formData.assign_to === "groups" && formData.assignment_group_ids.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one assignment group",
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
          type: formData.type || null,
          category: formData.category || null,
          reward_amount: formData.reward_amount ? parseFloat(formData.reward_amount) : null,
          due_date: formData.due_date || null,
          file_url: fileUrl,
          file_name: fileName,
          created_by: user.id,
          is_active: true,
          review_assignment_type: formData.review_assignment_type,
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
      } else if (formData.assign_to === "groups") {
        // Assign to all members of selected groups (union, dedup)
        const groupMemberIds = formData.assignment_group_ids
          .flatMap(gid => assignmentGroups.find(g => g.id === gid)?.member_ids || []);
        const uniqueMemberIds = Array.from(new Set(groupMemberIds));

        if (uniqueMemberIds.length > 0) {
          const assignments = uniqueMemberIds.map(uid => ({
            task_id: (taskData as any).id,
            user_id: uid,
          }));
          const { error: assignError } = await supabase
            .from("task_assignments" as any)
            .insert(assignments);
          if (assignError) throw assignError;
        }

        // Record which groups were assigned
        const groupRefs = formData.assignment_group_ids.map(gid => ({
          task_id: (taskData as any).id,
          group_id: gid,
        }));
        const { error: grpError } = await (supabase as any)
          .from("task_assignment_groups")
          .insert(groupRefs);
        if (grpError) throw grpError;
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

      // Handle peer reviewer assignments based on type
      if (formData.review_assignment_type === "group" || formData.review_assignment_type === "mixed") {
        // Snapshot peer reviewers from selected groups + individuals (union, dedup)
        const groupMemberIds = formData.peer_reviewer_group_ids
          .flatMap(gid => reviewerGroups.find(g => g.id === gid)?.member_ids || []);
        const allReviewerIds = Array.from(new Set([...groupMemberIds, ...formData.peer_reviewer_ids]));

        if (allReviewerIds.length > 0) {
          const reviewers = allReviewerIds.map(uid => ({
            task_id: (taskData as any).id,
            user_id: uid,
          }));
          const { error: revError } = await supabase
            .from("task_peer_reviewers" as any)
            .insert(reviewers);
          if (revError) throw revError;
        }

        // Record which groups were assigned (for UI display & edit pre-select)
        if (formData.peer_reviewer_group_ids.length > 0) {
          const groupRefs = formData.peer_reviewer_group_ids.map(gid => ({
            task_id: (taskData as any).id,
            group_id: gid,
          }));
          const { error: grpError } = await (supabase as any)
            .from("task_peer_reviewer_groups")
            .insert(groupRefs);
          if (grpError) throw grpError;
        }
      }

      if (formData.review_assignment_type === "individual" || formData.review_assignment_type === "mixed") {
        // Handle individual reviewer assignments for this specific task
        if (formData.individual_reviewer_assignments.length > 0) {
          // Add individual reviewers to task_peer_reviewers (deduplicate)
          const reviewerIds = Array.from(new Set(formData.individual_reviewer_assignments.map(a => a.reviewer_id)));
          const reviewers = reviewerIds.map(uid => ({
            task_id: (taskData as any).id,
            user_id: uid,
          }));
          
          const { error: revError } = await supabase
            .from("task_peer_reviewers" as any)
            .insert(reviewers);
          if (revError) throw revError;

          // Store the user-to-reviewer mapping for this task
          const mappings = formData.individual_reviewer_assignments.map(assignment => ({
            task_id: (taskData as any).id,
            user_id: assignment.user_id,
            reviewer_id: assignment.reviewer_id,
            assigned_by: user.id,
          }));

          const { error: mapError } = await supabase
            .from("individual_peer_reviewers" as any)
            .insert(mappings);
          if (mapError) throw mapError;
        }
      }

      toast({
        title: "Success",
        description: `Task created and assigned to ${formData.assign_to === "all" ? "all employees" : `${formData.assigned_user_ids.length} employee(s)`}`,
      });

      setFormData({ 
        title: "", 
        description: "",
        type: "",
        category: "",
        reward_amount: "",
        due_date: "", 
        file: null, 
        assign_to: "all", 
        assigned_user_ids: [], 
        assignment_group_ids: [],
        peer_reviewer_ids: [], 
        peer_reviewer_group_ids: [],
        review_assignment_type: "group",
        individual_reviewer_assignments: [],
      });
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
      let articleFileUrl = null;
      let articleFileName = null;
      let additionalFileUrl = null;
      let additionalFileName = null;

      // Upload main file to Supabase Storage if exists
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

      // Upload article file to Supabase Storage if exists
      if (responseFormData.article_file) {
        const fileExt = responseFormData.article_file.name.split('.').pop();
        const filePath = `articles/${crypto.randomUUID()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('task-responses')
          .upload(filePath, responseFormData.article_file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('task-responses')
          .getPublicUrl(filePath);

        articleFileUrl = publicUrl;
        articleFileName = responseFormData.article_file.name;
      }

      // Upload additional file to Supabase Storage if exists
      if (responseFormData.additional_file) {
        const fileExt = responseFormData.additional_file.name.split('.').pop();
        const filePath = `additional/${crypto.randomUUID()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('task-responses')
          .upload(filePath, responseFormData.additional_file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('task-responses')
          .getPublicUrl(filePath);

        additionalFileUrl = publicUrl;
        additionalFileName = responseFormData.additional_file.name;
      }

      // Find existing response for this user/task to decide insert vs update
      const existing = (responses[selectedTask.id] || []).find(r => r.user_id === user?.id);

      // Build payload — when editing, only overwrite files if a new one was chosen,
      // otherwise keep the previously uploaded URLs/names.
      const payload: any = {
        task_id: selectedTask.id,
        user_id: user?.id,
        response_text: responseFormData.response_text,
        link: responseFormData.link.trim() || null,
        file_url: responseFormData.file ? fileUrl : (existing?.file_url ?? fileUrl),
        file_name: responseFormData.file ? fileName : (existing?.file_name ?? fileName),
        article_file_url: responseFormData.article_file ? articleFileUrl : ((existing as any)?.article_file_url ?? articleFileUrl),
        article_file_name: responseFormData.article_file ? articleFileName : ((existing as any)?.article_file_name ?? articleFileName),
        additional_file_url: responseFormData.additional_file ? additionalFileUrl : ((existing as any)?.additional_file_url ?? additionalFileUrl),
        additional_file_name: responseFormData.additional_file ? additionalFileName : ((existing as any)?.additional_file_name ?? additionalFileName),
      };

      if (existing) {
        const { error } = await (supabase as any)
          .from("task_responses")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("task_responses" as any)
          .insert(payload);
        if (error) throw error;
      }

      toast({
        title: "Success",
        description: existing ? "Response updated successfully" : "Response submitted successfully",
      });

      setResponseFormData({ response_text: "", link: "", file: null, article_file: null, additional_file: null });
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
      // Insert remark
      const { data: remarkData, error: remarkError } = await supabase
        .from("task_remarks" as any)
        .insert({
          response_id: selectedResponse.id,
          remarked_by: user?.id,
          remark_text: remarkFormData.remark_text,
          rating: remarkFormData.rating,
        })
        .select()
        .single();

      if (remarkError) throw remarkError;

      // Check if task has reward and create earning
      const task = tasks.find(t => {
        const taskResponses = responses[t.id] || [];
        return taskResponses.some(r => r.id === selectedResponse.id);
      });

      if (task && task.reward_amount && task.reward_amount > 0 && remarkData) {
        // Create earning record
        const { error: earningError } = await supabase
          .from("task_earnings" as any)
          .insert({
            task_id: task.id,
            response_id: selectedResponse.id,
            user_id: selectedResponse.user_id,
            amount: task.reward_amount,
            remark_id: (remarkData as any).id,
            remarked_by: user?.id,
            status: "approved",
          });

        if (earningError) {
          console.error("Error creating earning:", earningError);
          // Don't throw error, just log it - remark was still added successfully
        } else {
          // Refresh earnings if current user is the one who earned
          if (selectedResponse.user_id === user?.id) {
            fetchTotalEarnings();
          }
        }
      }

      toast({
        title: "Success",
        description: task?.reward_amount 
          ? `Remark added and ₹${task.reward_amount} earning created!` 
          : "Remark added successfully",
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

      // Just remove the deleted task from state, don't reload all tasks
      setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
      
      // Also clean up related data
      setResponses(prev => {
        const newResponses = { ...prev };
        delete newResponses[taskId];
        return newResponses;
      });
      
      setRemarks(prev => {
        const newRemarks = { ...prev };
        // Remove remarks for responses of this task
        Object.keys(newRemarks).forEach(responseId => {
          const response = Object.values(responses).flat().find(r => r.id === responseId);
          if (response?.task_id === taskId) {
            delete newRemarks[responseId];
          }
        });
        return newRemarks;
      });
      
      setAssignments(prev => {
        const newAssignments = { ...prev };
        delete newAssignments[taskId];
        return newAssignments;
      });
      
      setPeerReviewers(prev => {
        const newReviewers = { ...prev };
        delete newReviewers[taskId];
        return newReviewers;
      });
      
    } catch (error) {
      console.error("Error deleting task:", error);
      toast({
        title: "Error",
        description: "Failed to delete task",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = async (task: Task) => {
    setEditingTask(task);
    
    // Fetch current assignments for this task
    const currentAssignments = assignments[task.id] || [];
    const assignedUserIds = currentAssignments.map(a => a.user_id);
    
    const currentReviewers = peerReviewers[task.id] || [];

    // Fetch which groups were assigned to this task
    let groupIds: string[] = [];
    try {
      const { data } = await (supabase as any)
        .from("task_peer_reviewer_groups")
        .select("group_id")
        .eq("task_id", task.id);
      groupIds = (data || []).map((r: any) => r.group_id);
    } catch (e) {
      console.error("Error fetching task groups:", e);
    }

    // Fetch which assignment groups were assigned to this task
    let assignedGroupIds: string[] = [];
    try {
      const { data } = await (supabase as any)
        .from("task_assignment_groups")
        .select("group_id")
        .eq("task_id", task.id);
      assignedGroupIds = (data || []).map((r: any) => r.group_id);
    } catch (e) {
      console.error("Error fetching task assignment groups:", e);
    }

    // Fetch individual reviewer assignments
    let individualAssignments: Array<{ user_id: string; reviewer_id: string }> = [];
    try {
      const { data } = await supabase
        .from("individual_peer_reviewers" as any)
        .select("user_id, reviewer_id")
        .eq("task_id", task.id);
      individualAssignments = (data || []).map((r: any) => ({ user_id: r.user_id, reviewer_id: r.reviewer_id }));
    } catch (e) {
      console.error("Error fetching individual reviewers:", e);
    }

    setEditFormData({
      title: task.title,
      description: task.description,
      type: task.type || "",
      category: task.category || "",
      reward_amount: task.reward_amount ? task.reward_amount.toString() : "",
      due_date: task.due_date ? task.due_date.split('T')[0] : "",
      file: null,
      keepExistingFile: true,
      assign_to: assignedGroupIds.length > 0 ? "groups" : (assignedUserIds.length === employees.length ? "all" : "specific"),
      assigned_user_ids: assignedUserIds,
      assignment_group_ids: assignedGroupIds,
      peer_reviewer_ids: currentReviewers.map(r => r.user_id),
      peer_reviewer_group_ids: groupIds,
      review_assignment_type: (task as any).review_assignment_type || "group",
      individual_reviewer_assignments: individualAssignments,
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
          type: editFormData.type || null,
          category: editFormData.category || null,
          reward_amount: editFormData.reward_amount ? parseFloat(editFormData.reward_amount) : null,
          due_date: editFormData.due_date || null,
          file_url: fileUrl,
          file_name: fileName,
          review_assignment_type: editFormData.review_assignment_type,
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

      // Delete existing assignment group references
      await (supabase as any)
        .from("task_assignment_groups")
        .delete()
        .eq("task_id", editingTask.id);

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
      } else if (editFormData.assign_to === "groups") {
        const groupMemberIds = editFormData.assignment_group_ids
          .flatMap(gid => assignmentGroups.find(g => g.id === gid)?.member_ids || []);
        const uniqueMemberIds = Array.from(new Set(groupMemberIds));

        if (uniqueMemberIds.length > 0) {
          const assignments = uniqueMemberIds.map(uid => ({
            task_id: editingTask.id,
            user_id: uid,
          }));
          const { error: assignError } = await supabase
            .from("task_assignments" as any)
            .insert(assignments);
          if (assignError) throw assignError;
        }

        const groupRefs = editFormData.assignment_group_ids.map(gid => ({
          task_id: editingTask.id,
          group_id: gid,
        }));
        const { error: grpError } = await (supabase as any)
          .from("task_assignment_groups")
          .insert(groupRefs);
        if (grpError) throw grpError;
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

      // Update peer reviewers: delete then re-snapshot from groups + individuals (union)
      await supabase
        .from("task_peer_reviewers" as any)
        .delete()
        .eq("task_id", editingTask.id);
      await (supabase as any)
        .from("task_peer_reviewer_groups")
        .delete()
        .eq("task_id", editingTask.id);
      await supabase
        .from("individual_peer_reviewers" as any)
        .delete()
        .eq("task_id", editingTask.id);

      // Handle peer reviewer assignments based on type
      if (editFormData.review_assignment_type === "group" || editFormData.review_assignment_type === "mixed") {
        const editGroupMemberIds = editFormData.peer_reviewer_group_ids
          .flatMap(gid => reviewerGroups.find(g => g.id === gid)?.member_ids || []);
        const editAllReviewerIds = Array.from(new Set([...editGroupMemberIds, ...editFormData.peer_reviewer_ids]));

        if (editAllReviewerIds.length > 0) {
          const reviewers = editAllReviewerIds.map(uid => ({
            task_id: editingTask.id,
            user_id: uid,
          }));
          const { error: revError } = await supabase
            .from("task_peer_reviewers" as any)
            .insert(reviewers);
          if (revError) throw revError;
        }

        if (editFormData.peer_reviewer_group_ids.length > 0) {
          const groupRefs = editFormData.peer_reviewer_group_ids.map(gid => ({
            task_id: editingTask.id,
            group_id: gid,
          }));
          const { error: grpError } = await (supabase as any)
            .from("task_peer_reviewer_groups")
            .insert(groupRefs);
          if (grpError) throw grpError;
        }
      }

      if (editFormData.review_assignment_type === "individual" || editFormData.review_assignment_type === "mixed") {
        // Handle individual reviewer assignments
        if (editFormData.individual_reviewer_assignments.length > 0) {
          // Add individual reviewers to task_peer_reviewers (deduplicate)
          const reviewerIds = Array.from(new Set(editFormData.individual_reviewer_assignments.map(a => a.reviewer_id)));
          const reviewers = reviewerIds.map(uid => ({
            task_id: editingTask.id,
            user_id: uid,
          }));
          
          const { error: revError } = await supabase
            .from("task_peer_reviewers" as any)
            .insert(reviewers);
          if (revError) throw revError;

          // Store the user-to-reviewer mapping
          const mappings = editFormData.individual_reviewer_assignments.map(assignment => ({
            task_id: editingTask.id,
            user_id: assignment.user_id,
            reviewer_id: assignment.reviewer_id,
            assigned_by: user?.id,
          }));

          const { error: mapError } = await supabase
            .from("individual_peer_reviewers" as any)
            .insert(mappings);
          if (mapError) throw mapError;
        }
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
              <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col">
                <DialogHeader className="flex-shrink-0">
                  <DialogTitle>Create New Task</DialogTitle>
                  <DialogDescription>
                    Create a new task and assign it to all employees or a specific employee
                  </DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto pr-2">
                  <form onSubmit={handleSubmit} className="space-y-4" id="create-task-form">
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
                    <Label htmlFor="type">Type *</Label>
                    <Select 
                      value={formData.type} 
                      onValueChange={(value) => setFormData({ ...formData, type: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="English Reading, listening & speaking Task">English Reading, listening & speaking Task</SelectItem>
                        <SelectItem value="Lesson Plan & Delivery">Lesson Plan & Delivery</SelectItem>
                        <SelectItem value="Soft & Digital Skills">Soft & Digital Skills</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select 
                      value={formData.category} 
                      onValueChange={(value) => setFormData({ ...formData, category: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Soft Skills">Soft Skills</SelectItem>
                        <SelectItem value="Hindi">Hindi</SelectItem>
                        <SelectItem value="English">English</SelectItem>
                        <SelectItem value="Mathematics">Mathematics</SelectItem>
                        <SelectItem value="Science">Science</SelectItem>
                        <SelectItem value="Social Studies">Social Studies</SelectItem>
                        <SelectItem value="Computer Science">Computer Science</SelectItem>
                        <SelectItem value="Arts & Crafts">Arts & Crafts</SelectItem>
                        <SelectItem value="Physical Education">Physical Education</SelectItem>
                        <SelectItem value="General">General</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reward_amount">Reward Amount (₹) - Optional</Label>
                    <Input
                      id="reward_amount"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Enter reward amount in rupees"
                      value={formData.reward_amount}
                      onChange={(e) => setFormData({ ...formData, reward_amount: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      💰 Employees will earn this amount when their task response is reviewed and approved
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <div className="border rounded-md">
                      <ReactQuillWrapper
                        theme="snow"
                        value={formData.description}
                        onChange={(value) => setFormData({ ...formData, description: value })}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="assign_to">Assign To</Label>
                    <Select 
                      value={formData.assign_to} 
                      onValueChange={(value: "all" | "specific" | "groups") => 
                        setFormData({ ...formData, assign_to: value, assigned_user_ids: value === "all" ? [] : formData.assigned_user_ids })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select assignment type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Employees</SelectItem>
                        <SelectItem value="specific">Specific Employee</SelectItem>
                        <SelectItem value="groups">Assignment Groups</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.assign_to === "specific" && (
                    <div className="space-y-2 bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border-2 border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-5 w-5 text-blue-600" />
                        <Label className="text-base font-semibold text-blue-900 dark:text-blue-100">
                          1️⃣ Task Assignment - Select Employees
                        </Label>
                      </div>
                      <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                        👉 These employees will receive and complete this task
                      </p>
                      <div className="border rounded-lg p-4 max-h-60 overflow-y-auto space-y-3 bg-white dark:bg-gray-900">
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
                        <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                          ✅ {formData.assigned_user_ids.length} employee(s) selected
                        </p>
                      )}
                    </div>
                  )}

                  {formData.assign_to === "groups" && (
                    <div className="space-y-2 bg-purple-50 dark:bg-purple-950/20 p-4 rounded-lg border-2 border-purple-200 dark:border-purple-800">
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-5 w-5 text-purple-600" />
                        <Label className="text-base font-semibold text-purple-900 dark:text-purple-100">
                          1️⃣ Select Assignment Groups
                        </Label>
                      </div>
                      <p className="text-sm text-purple-700 dark:text-purple-300 font-medium">
                        👉 All members of selected groups will receive this task
                      </p>
                      <div className="border rounded-lg p-4 max-h-60 overflow-y-auto space-y-2 bg-white dark:bg-gray-900">
                        {assignmentGroups.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No assignment groups available. Create one in Assignment Groups page.</p>
                        ) : (
                          assignmentGroups.map((g) => (
                            <div key={g.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`assign-grp-${g.id}`}
                                checked={formData.assignment_group_ids.includes(g.id)}
                                onCheckedChange={(checked) => {
                                  setFormData(prev => ({
                                    ...prev,
                                    assignment_group_ids: checked
                                      ? [...prev.assignment_group_ids, g.id]
                                      : prev.assignment_group_ids.filter(id => id !== g.id),
                                  }));
                                }}
                              />
                              <Label htmlFor={`assign-grp-${g.id}`} className="text-sm font-normal cursor-pointer flex-1">
                                {g.name} <span className="text-muted-foreground">({g.member_ids.length} members)</span>
                              </Label>
                            </div>
                          ))
                        )}
                      </div>
                      {formData.assignment_group_ids.length > 0 && (
                        <p className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                          ✅ {formData.assignment_group_ids.length} group(s) selected · {Array.from(new Set(formData.assignment_group_ids.flatMap(gid => assignmentGroups.find(g => g.id === gid)?.member_ids || []))).length} unique member(s)
                        </p>
                      )}
                    </div>
                  )}

                  {/* Review Assignment Type Selection */}
                  <div className="space-y-4 bg-orange-50 dark:bg-orange-950/20 p-4 rounded-lg border-2 border-orange-200 dark:border-orange-800">
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-5 w-5 text-orange-600" />
                      <Label className="text-base font-semibold text-orange-900 dark:text-orange-100">
                        2️⃣ Peer Review Assignment Type
                      </Label>
                    </div>
                    <p className="text-sm text-orange-700 dark:text-orange-300 font-medium">
                      Choose how peer reviewers should be assigned for this task
                    </p>
                    
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="review-type-group"
                          name="review_assignment_type"
                          value="group"
                          checked={formData.review_assignment_type === "group"}
                          onChange={(e) => setFormData(prev => ({ ...prev, review_assignment_type: e.target.value as any }))}
                          className="text-orange-600"
                        />
                        <Label htmlFor="review-type-group" className="text-sm cursor-pointer">
                          <strong>Group-based:</strong> Use reviewer groups and individual selections (existing system)
                        </Label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="review-type-individual"
                          name="review_assignment_type"
                          value="individual"
                          checked={formData.review_assignment_type === "individual"}
                          onChange={(e) => setFormData(prev => ({ ...prev, review_assignment_type: e.target.value as any }))}
                          className="text-orange-600"
                        />
                        <Label htmlFor="review-type-individual" className="text-sm cursor-pointer">
                          <strong>Individual 1:1:</strong> Manually assign specific reviewer for each user
                        </Label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="review-type-mixed"
                          name="review_assignment_type"
                          value="mixed"
                          checked={formData.review_assignment_type === "mixed"}
                          onChange={(e) => setFormData(prev => ({ ...prev, review_assignment_type: e.target.value as any }))}
                          className="text-orange-600"
                        />
                        <Label htmlFor="review-type-mixed" className="text-sm cursor-pointer">
                          <strong>Mixed:</strong> Use both group-based and individual assignments
                        </Label>
                      </div>
                    </div>
                  </div>

                  {/* Individual 1:1 Reviewer Assignment - Show when individual or mixed is selected */}
                  {(formData.review_assignment_type === "individual" || formData.review_assignment_type === "mixed") && (
                    <div className="space-y-4 bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border-2 border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-5 w-5 text-blue-600" />
                        <Label className="text-base font-semibold text-blue-900 dark:text-blue-100">
                          3️⃣ Assign Individual Reviewers (1:1 Mapping)
                        </Label>
                      </div>
                      <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                        👥 For each assigned user, select their specific peer reviewer
                      </p>
                      
                      {formData.assign_to === "all" ? (
                        <div className="space-y-3 max-h-96 overflow-y-auto border rounded-lg p-4 bg-white dark:bg-gray-900">
                          {employees.map((emp) => (
                            <div key={`reviewer-map-${emp.user_id}`} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                              <div className="flex-1">
                                <p className="text-sm font-medium">{emp.first_name} {emp.last_name}</p>
                                <p className="text-xs text-muted-foreground">{emp.email}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">→</span>
                                <Select
                                  value={formData.individual_reviewer_assignments.find(a => a.user_id === emp.user_id)?.reviewer_id || "no-reviewer"}
                                  onValueChange={(reviewerId) => {
                                    setFormData(prev => {
                                      const existing = prev.individual_reviewer_assignments.filter(a => a.user_id !== emp.user_id);
                                      if (reviewerId && reviewerId !== "no-reviewer") {
                                        return {
                                          ...prev,
                                          individual_reviewer_assignments: [...existing, { user_id: emp.user_id, reviewer_id: reviewerId }]
                                        };
                                      }
                                      return { ...prev, individual_reviewer_assignments: existing };
                                    });
                                  }}
                                >
                                  <SelectTrigger className="w-[200px]">
                                    <SelectValue placeholder="Select reviewer" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="no-reviewer">No reviewer</SelectItem>
                                    {employees.filter(e => e.user_id !== emp.user_id).map(reviewer => (
                                      <SelectItem key={reviewer.user_id} value={reviewer.user_id}>
                                        {reviewer.first_name} {reviewer.last_name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : formData.assigned_user_ids.length > 0 ? (
                        <div className="space-y-3 max-h-96 overflow-y-auto border rounded-lg p-4 bg-white dark:bg-gray-900">
                          {formData.assigned_user_ids.map((userId) => {
                            const emp = employees.find(e => e.user_id === userId);
                            if (!emp) return null;
                            return (
                              <div key={`reviewer-map-${userId}`} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                                <div className="flex-1">
                                  <p className="text-sm font-medium">{emp.first_name} {emp.last_name}</p>
                                  <p className="text-xs text-muted-foreground">{emp.email}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">→</span>
                                  <Select
                                    value={formData.individual_reviewer_assignments.find(a => a.user_id === userId)?.reviewer_id || "no-reviewer"}
                                    onValueChange={(reviewerId) => {
                                      setFormData(prev => {
                                        const existing = prev.individual_reviewer_assignments.filter(a => a.user_id !== userId);
                                        if (reviewerId && reviewerId !== "no-reviewer") {
                                          return {
                                            ...prev,
                                            individual_reviewer_assignments: [...existing, { user_id: userId, reviewer_id: reviewerId }]
                                          };
                                        }
                                        return { ...prev, individual_reviewer_assignments: existing };
                                      });
                                    }}
                                  >
                                    <SelectTrigger className="w-[200px]">
                                      <SelectValue placeholder="Select reviewer" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="no-reviewer">No reviewer</SelectItem>
                                      {employees.filter(e => e.user_id !== userId).map(reviewer => (
                                        <SelectItem key={reviewer.user_id} value={reviewer.user_id}>
                                          {reviewer.first_name} {reviewer.last_name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Please select employees in step 1 first
                        </p>
                      )}
                      
                      {formData.individual_reviewer_assignments.length > 0 && (
                        <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                          ✅ {formData.individual_reviewer_assignments.length} reviewer(s) assigned
                        </p>
                      )}
                    </div>
                  )}

                  {/* Peer Reviewer Groups (Optional) - Only show for group or mixed */}
                  {(formData.review_assignment_type === "group" || formData.review_assignment_type === "mixed") && (
                    <>
                    <div className="space-y-2 bg-purple-50 dark:bg-purple-950/20 p-4 rounded-lg border-2 border-purple-200 dark:border-purple-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-purple-600" />
                        <Label className="text-base font-semibold text-purple-900 dark:text-purple-100">
                          3️⃣ Peer Reviewer Groups (Optional)
                        </Label>
                      </div>
                      <Link to="/peer-reviewer-groups" target="_blank" className="text-xs text-purple-600 hover:underline inline-flex items-center gap-1 font-medium">
                        Manage groups <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                    <p className="text-sm text-purple-700 dark:text-purple-300 font-medium">
                      👥 Select pre-made groups - all members will become reviewers
                    </p>
                    <p className="text-xs text-purple-600 dark:text-purple-400">
                      Updating groups here re-snapshots reviewers for this task.
                    </p>
                    <div className="border rounded-lg p-4 max-h-48 overflow-y-auto space-y-3 bg-white dark:bg-gray-900">
                      {reviewerGroups.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No groups created yet. <Link to="/peer-reviewer-groups" target="_blank" className="text-primary hover:underline">Create one</Link>.</p>
                      ) : (
                        reviewerGroups.map(g => (
                          <div key={`grp-${g.id}`} className="flex items-center space-x-2">
                            <Checkbox
                              id={`grp-${g.id}`}
                              checked={formData.peer_reviewer_group_ids.includes(g.id)}
                              onCheckedChange={(checked) => {
                                setFormData(prev => ({
                                  ...prev,
                                  peer_reviewer_group_ids: checked
                                    ? [...prev.peer_reviewer_group_ids, g.id]
                                    : prev.peer_reviewer_group_ids.filter(id => id !== g.id),
                                }));
                              }}
                            />
                            <Label htmlFor={`grp-${g.id}`} className="text-sm font-normal cursor-pointer">
                              {g.name} <span className="text-muted-foreground">({g.member_ids.length} members)</span>
                            </Label>
                          </div>
                        ))
                      )}
                    </div>
                    {formData.peer_reviewer_group_ids.length > 0 && (
                      <p className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                        ✅ {formData.peer_reviewer_group_ids.length} group(s) selected
                      </p>
                    )}
                  </div>

                  {/* Individual Peer Reviewers (Optional) - Only show for group or mixed */}
                  <div className="space-y-2 bg-green-50 dark:bg-green-950/20 p-4 rounded-lg border-2 border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2">
                      <Eye className="h-5 w-5 text-green-600" />
                      <Label className="text-base font-semibold text-green-900 dark:text-green-100">
                        4️⃣ Additional Individual Peer Reviewers (Optional)
                      </Label>
                    </div>
                    <p className="text-sm text-green-700 dark:text-green-300 font-medium">
                      👤 Add individual reviewers (in addition to groups above)
                    </p>
                    <p className="text-xs text-green-600 dark:text-green-400">
                      These reviewers can view and comment on task responses from assigned employees.
                    </p>
                    <div className="border rounded-lg p-4 max-h-60 overflow-y-auto space-y-3 bg-white dark:bg-gray-900">
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
                      <p className="text-sm font-semibold text-green-700 dark:text-green-300">
                        ✅ {formData.peer_reviewer_ids.length} peer reviewer(s) selected
                      </p>
                    )}
                  </div>
                  </>
                  )}
                  
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
                  </form>
                </div>
                <div className="flex justify-end gap-2 pt-4 border-t flex-shrink-0">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" form="create-task-form" disabled={submitting}>
                    {submitting ? "Creating..." : "Create Task"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
              </>
            )}
          </div>
        </div>

        {/* Total Earnings Card - Only for Employees */}
        {role === "employee" && (
          <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-green-700 dark:text-green-300">Total Earnings</p>
                    {loadingEarnings ? (
                      <div className="flex items-center gap-2 mt-1">
                        <div className="h-8 w-32 bg-green-200 dark:bg-green-800 animate-pulse rounded"></div>
                      </div>
                    ) : (
                      <p className="text-3xl font-bold text-green-900 dark:text-green-100">
                        ₹{totalEarnings.toFixed(2)}
                      </p>
                    )}
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                      From completed and reviewed tasks
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchTotalEarnings}
                  disabled={loadingEarnings}
                  className="border-green-300 hover:bg-green-100 dark:border-green-700 dark:hover:bg-green-900/30"
                >
                  {loadingEarnings ? "Refreshing..." : "Refresh"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search and Filter Section */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search tasks by title or description..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex gap-2">
                  <Select value={selectedType} onValueChange={setSelectedType}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Filter by Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="English Reading, listening & speaking Task">English Reading</SelectItem>
                      <SelectItem value="Lesson Plan & Delivery">Lesson Plan</SelectItem>
                      <SelectItem value="Soft & Digital Skills">Soft & Digital</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-[200px]">
                      <Filter className="mr-2 h-4 w-4" />
                      <SelectValue placeholder="Filter by Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="Soft Skills">Soft Skills</SelectItem>
                      <SelectItem value="Hindi">Hindi</SelectItem>
                      <SelectItem value="English">English</SelectItem>
                      <SelectItem value="Mathematics">Mathematics</SelectItem>
                      <SelectItem value="Science">Science</SelectItem>
                      <SelectItem value="Social Studies">Social Studies</SelectItem>
                      <SelectItem value="Computer Science">Computer Science</SelectItem>
                      <SelectItem value="Arts & Crafts">Arts & Crafts</SelectItem>
                      <SelectItem value="Physical Education">Physical Education</SelectItem>
                      <SelectItem value="General">General</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={sortField} onValueChange={(value) => {
                    setSortField(value);
                    setSortDirection("desc");
                  }}>
                    <SelectTrigger className="w-[180px]">
                      <ArrowUpDown className="mr-2 h-4 w-4" />
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="created_at">Created Date</SelectItem>
                      <SelectItem value="title">Title</SelectItem>
                      <SelectItem value="due_date">Due Date</SelectItem>
                      <SelectItem value="reward_amount">Reward</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setSortDirection(sortDirection === "asc" ? "desc" : "asc")}
                    title={sortDirection === "asc" ? "Ascending" : "Descending"}
                  >
                    {sortDirection === "asc" ? "↑" : "↓"}
                  </Button>
                </div>
              </div>
              {(searchQuery || selectedCategory !== "all" || selectedType !== "all") && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedCategory("all");
                    setSelectedType("all");
                  }}
                  className="w-fit"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

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
          <>
            {(() => {
              // Filter tasks based on search query, type, and category
              let filteredTasks = tasks.filter((task) => {
                // Search filter
                const matchesSearch = searchQuery.trim() === "" || 
                  task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  task.description.toLowerCase().includes(searchQuery.toLowerCase());
                
                // Type filter
                const matchesType = selectedType === "all" || 
                  task.type === selectedType;
                
                // Category filter
                const matchesCategory = selectedCategory === "all" || 
                  task.category === selectedCategory;
                
                return matchesSearch && matchesType && matchesCategory;
              });

              // Sort tasks
              filteredTasks = [...filteredTasks].sort((a, b) => {
                let aValue: any;
                let bValue: any;

                switch (sortField) {
                  case "title":
                    aValue = a.title.toLowerCase();
                    bValue = b.title.toLowerCase();
                    break;
                  case "type":
                    aValue = (a.type || "").toLowerCase();
                    bValue = (b.type || "").toLowerCase();
                    break;
                  case "category":
                    aValue = (a.category || "").toLowerCase();
                    bValue = (b.category || "").toLowerCase();
                    break;
                  case "due_date":
                    aValue = a.due_date ? new Date(a.due_date).getTime() : 0;
                    bValue = b.due_date ? new Date(b.due_date).getTime() : 0;
                    break;
                  case "reward_amount":
                    aValue = a.reward_amount || 0;
                    bValue = b.reward_amount || 0;
                    break;
                  case "status":
                    aValue = a.is_active ? 1 : 0;
                    bValue = b.is_active ? 1 : 0;
                    break;
                  case "completion": {
                    const ca = (assignments[a.id]?.length || 0);
                    const cb = (assignments[b.id]?.length || 0);
                    aValue = ca ? ((responses[a.id]?.length || 0) / ca) : 0;
                    bValue = cb ? ((responses[b.id]?.length || 0) / cb) : 0;
                    break;
                  }
                  case "created_at":
                  default:
                    aValue = new Date(a.created_at).getTime();
                    bValue = new Date(b.created_at).getTime();
                    break;
                }

                if (sortDirection === "asc") {
                  return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
                } else {
                  return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
                }
              });

              // Show message if no results after filtering
              if (filteredTasks.length === 0) {
                return (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <Search className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground text-center font-medium">
                        No tasks found matching your filters
                      </p>
                      <p className="text-sm text-muted-foreground text-center mt-2">
                        Try adjusting your search, type, or category filter
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSearchQuery("");
                          setSelectedCategory("all");
                          setSelectedType("all");
                        }}
                        className="mt-4"
                      >
                        Clear Filters
                      </Button>
                    </CardContent>
                  </Card>
                );
              }

              return (
                <>
                  {/* Results count */}
                  {(searchQuery || selectedCategory !== "all" || selectedType !== "all") && (
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm text-muted-foreground">
                        Showing {filteredTasks.length} of {tasks.length} tasks
                      </p>
                    </div>
                  )}
                  
                  <div className="border rounded-lg bg-card overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {[
                          { key: "title", label: "Task Name", show: true },
                          { key: "created_at", label: "Created", show: true },
                          { key: "type", label: "Type", show: true },
                          { key: "category", label: "Category", show: true },
                          { key: "reward_amount", label: "Reward", show: true },
                          { key: "due_date", label: "Deadline", show: true },
                          { key: "status", label: role === "employee" ? "Your Status" : "Status", show: true },
                          { key: "completion", label: "Completion", show: role === "admin" || role === "manager" },
                        ].filter(col => col.show).map(col => (
                          <TableHead key={col.key}>
                            <button
                              type="button"
                              onClick={() => handleSort(col.key)}
                              className="flex items-center gap-1 font-medium text-primary hover:underline"
                            >
                              {col.label}
                              <ArrowUpDown className={`h-3 w-3 ${sortField === col.key ? "opacity-100" : "opacity-50"}`} />
                              {sortField === col.key && (
                                <span className="text-xs">{sortDirection === "asc" ? "↑" : "↓"}</span>
                              )}
                            </button>
                          </TableHead>
                        ))}
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                    {filteredTasks.map((task) => {
              const taskResponses = responses[task.id] || [];
              const userResponse = taskResponses.find(r => r.user_id === user?.id);
              const isExpanded = expandedTaskIds.has(task.id);
              const assignedCount = assignments[task.id]?.length || 0;
              const respondedCount = taskResponses.length;
              const completionPct = assignedCount ? Math.round((respondedCount / assignedCount) * 100) : 0;

              return (
                <Fragment key={task.id}>
                  <TableRow className="hover:bg-muted/50">
                    <TableCell className="font-medium max-w-[280px]">
                      <div className="truncate">{task.title}</div>
                      {isPeerReviewerOf(task.id) && (
                        <Badge variant="secondary" className="mt-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 text-xs">
                          Peer Reviewer
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {format(new Date(task.created_at), "MMM dd, yyyy")}
                    </TableCell>
                    <TableCell>
                      {task.type ? (
                        <Badge variant="default" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                          {task.type}
                        </Badge>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell>
                      {task.category ? (
                        <Badge variant="default" className="bg-primary/10 text-primary">
                          {task.category}
                        </Badge>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell>
                      {task.reward_amount && task.reward_amount > 0 ? (
                        <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                          ₹{task.reward_amount}
                        </Badge>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {task.due_date ? format(new Date(task.due_date), "MMM dd, yyyy") : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell>
                      {role === "employee" ? (
                        <Badge variant={userResponse ? "default" : "secondary"} className={userResponse ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" : ""}>
                          {userResponse ? "✓ Completed" : "Pending"}
                        </Badge>
                      ) : (
                        <Badge variant={task.is_active ? "default" : "secondary"} className={task.is_active ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100" : ""}>
                          {task.is_active ? "Active" : "Inactive"}
                        </Badge>
                      )}
                    </TableCell>
                    {(role === "admin" || role === "manager") && (
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-[110px]">
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${completionPct}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {respondedCount}/{assignedCount || 0}
                          </span>
                        </div>
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8">
                              <Eye className="h-3 w-3 mr-1" />
                              View More
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle className="text-2xl">{task.title}</DialogTitle>
                              <DialogDescription>
                                Created on {format(new Date(task.created_at), "MMM dd, yyyy")}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-6">
                              {/* Badges */}
                              <div className="flex flex-wrap gap-2">
                                {task.type && (
                                  <Badge variant="default" className="bg-blue-100 text-blue-800">
                                    {task.type}
                                  </Badge>
                                )}
                                {task.category && (
                                  <Badge variant="default" className="bg-primary/10 text-primary">
                                    {task.category}
                                  </Badge>
                                )}
                                {task.reward_amount && task.reward_amount > 0 && (
                                  <Badge variant="default" className="bg-green-100 text-green-800">
                                    💰 ₹{task.reward_amount}
                                  </Badge>
                                )}
                                {task.due_date && (
                                  <Badge variant="outline">
                                    Due: {format(new Date(task.due_date), "MMM dd, yyyy")}
                                  </Badge>
                                )}
                                {isPeerReviewerOf(task.id) && (
                                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                                    👁️ Peer Reviewer
                                  </Badge>
                                )}
                              </div>

                              {/* Description */}
                              <div>
                                <h3 className="font-semibold mb-2">Description</h3>
                                <div 
                                  className="prose prose-sm dark:prose-invert max-w-none"
                                  dangerouslySetInnerHTML={{ __html: task.description }}
                                />
                              </div>

                              {/* Attachment */}
                              {task.file_url && task.file_name && (
                                <div>
                                  <h3 className="font-semibold mb-2">Attachment</h3>
                                  {renderFilePreview(task.file_url, task.file_name)}
                                </div>
                              )}

                              {/* Assigned To (Admin only) */}
                              {role === "admin" && assignments[task.id] && assignments[task.id].length > 0 && (
                                <div>
                                  <h3 className="font-semibold mb-2">Assigned To ({assignments[task.id].length} employees)</h3>
                                  <div className="flex flex-wrap gap-2">
                                    {assignments[task.id].map((emp) => (
                                      <Badge key={emp.user_id} variant="secondary">
                                        {emp.first_name} {emp.last_name}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Employee Response Section */}
                              {role === "employee" && (
                                <div>
                                  {!userResponse ? (
                                    <Button
                                      onClick={() => {
                                        setSelectedTask(task);
                                        setResponseDialogOpen(true);
                                      }}
                                      className="w-full"
                                    >
                                      <Send className="mr-2 h-4 w-4" />
                                      Submit Response
                                    </Button>
                                  ) : (
                                    <div>
                                      <div className="flex items-center justify-between mb-2">
                                        <h3 className="font-semibold">Your Response</h3>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                            setSelectedTask(task);
                                            setResponseFormData({
                                              response_text: userResponse.response_text || "",
                                              link: userResponse.link || "",
                                              file: null,
                                              article_file: null,
                                              additional_file: null,
                                            });
                                            setResponseDialogOpen(true);
                                          }}
                                        >
                                          <Edit className="mr-2 h-3 w-3" />
                                          Edit Response
                                        </Button>
                                      </div>
                                      <Card className="border-primary">
                                        <CardContent className="pt-4 space-y-3">
                                          <p className="text-sm whitespace-pre-wrap">{userResponse.response_text}</p>
                                          {userResponse.link && (
                                            <a 
                                              href={userResponse.link} 
                                              target="_blank" 
                                              rel="noopener noreferrer"
                                              className="text-sm text-primary hover:underline flex items-center gap-1"
                                            >
                                              🔗 {userResponse.link}
                                            </a>
                                          )}
                                          {userResponse.file_url && userResponse.file_name && (
                                            <div className="pt-2 border-t">
                                              {renderFilePreview(userResponse.file_url, userResponse.file_name)}
                                            </div>
                                          )}
                                        </CardContent>
                                      </Card>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Admin/Reviewer: Show Responses */}
                              {(role === "admin" || role === "manager" || isPeerReviewerOf(task.id)) && taskResponses.length > 0 && (
                                <div>
                                  <h3 className="font-semibold mb-2">Responses ({taskResponses.length})</h3>
                                  <div className="space-y-3">
                                    {taskResponses.map((response) => (
                                      <Card key={response.id}>
                                        <CardContent className="pt-4 space-y-2">
                                          <div className="flex items-start justify-between">
                                            <div>
                                              <p className="font-medium text-sm">
                                                {response.employee_profiles?.first_name} {response.employee_profiles?.last_name}
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
                                          <p className="text-sm">{response.response_text}</p>
                                          {response.link && (
                                            <a 
                                              href={response.link} 
                                              target="_blank" 
                                              rel="noopener noreferrer"
                                              className="text-sm text-primary hover:underline"
                                            >
                                              🔗 {response.link}
                                            </a>
                                          )}
                                        </CardContent>
                                      </Card>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>
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
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                              >
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
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                  <TableRow className="bg-muted/20 hover:bg-muted/20">
                    <TableCell colSpan={10} className="p-6">
                      <div className="space-y-4">
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
                                size="lg"
                                onClick={() => {
                                  if (userResponse) {
                                    toast({ title: "Already Submitted", description: "You have already submitted a response to this task" });
                                    return;
                                  }
                                  setSelectedTask(task);
                                  setResponseDialogOpen(true);
                                }}
                              >
                                <Send className="h-5 w-5 mr-2" />
                                Submit Response
                              </Button>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <h3 className="font-semibold flex items-center gap-2">
                                  <MessageSquare className="h-4 w-4" />
                                  Your Response
                                </h3>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedTask(task);
                                    setResponseFormData({
                                      response_text: userResponse.response_text || "",
                                      link: userResponse.link || "",
                                      file: null,
                                      article_file: null,
                                      additional_file: null,
                                    });
                                    setResponseDialogOpen(true);
                                  }}
                                >
                                  Edit Response
                                </Button>
                              </div>
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
                      </div>
                    </TableCell>
                  </TableRow>
                  )}
                </Fragment>
              );
            })}
                    </TableBody>
                  </Table>
                  </div>

                </>
              );
            })()}
          </>
        )}

        {/* Infinite Scroll Loader */}
        {!loading && hasMore && (
          <div ref={loaderRef} className="flex justify-center py-8">
            {loadingMore && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                <span className="text-sm">Loading more tasks...</span>
              </div>
            )}
          </div>
        )}

        {/* No more tasks indicator */}
        {!loading && !hasMore && tasks.length > 0 && (
          <div className="text-center py-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted text-muted-foreground">
              <CheckSquare className="h-4 w-4" />
              <span className="text-sm font-medium">All tasks loaded</span>
            </div>
          </div>
        )}
      </div>

      {/* Response Dialog */}
      <Dialog open={responseDialogOpen} onOpenChange={setResponseDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          {(() => {
            const isEditingResponse = !!(selectedTask && (responses[selectedTask.id] || []).some(r => r.user_id === user?.id));
            return (
          <DialogHeader>
            <DialogTitle>{isEditingResponse ? "Edit Task Response" : "Submit Task Response"}</DialogTitle>
            <DialogDescription>
              {isEditingResponse
                ? "Update your response. Existing files are kept unless you upload new ones."
                : "Submit your task with a link and/or upload article/vocabulary/handwritten notes"}
            </DialogDescription>
          </DialogHeader>
            );
          })()}
          <form onSubmit={handleResponseSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="response_text">Your Response / Notes *</Label>
              <Textarea
                id="response_text"
                placeholder="Enter a short description of your submission"
                value={responseFormData.response_text}
                onChange={(e) => setResponseFormData({ ...responseFormData, response_text: e.target.value })}
                rows={4}
                required
              />
            </div>

            {/* Link Upload Field */}
            <div className="space-y-2">
              <Label htmlFor="response_link" className="flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                Link Upload (Optional)
              </Label>
              <Input
                id="response_link"
                type="url"
                placeholder="https://example.com (Google Drive, Docs, GitHub, YouTube etc.)"
                value={responseFormData.link}
                onChange={(e) => setResponseFormData({ ...responseFormData, link: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Paste a link to your Google Drive, Docs, GitHub, YouTube, or any other online resource
              </p>
            </div>

            {/* Article / Vocabulary / Handwritten Notes Upload Field */}
            <div className="space-y-2">
              <Label htmlFor="article_file" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Article / Vocabulary / Handwritten Notes (Optional)
              </Label>
              <Input
                id="article_file"
                type="file"
                accept="image/*,application/pdf,.doc,.docx,.txt"
                onChange={(e) => setResponseFormData({ ...responseFormData, article_file: e.target.files?.[0] || null })}
              />
              {responseFormData.article_file && (
                <div className="flex items-center gap-2 p-2 bg-muted rounded">
                  <File className="h-4 w-4 text-primary" />
                  <p className="text-sm text-muted-foreground flex-1">
                    {responseFormData.article_file.name}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setResponseFormData({ ...responseFormData, article_file: null })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Upload article, vocabulary list, or handwritten notes (PDF, image, doc, txt)
              </p>
            </div>

            {/* Additional File Upload Field */}
            <div className="space-y-2">
              <Label htmlFor="additional_file" className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Additional File Upload (Optional)
              </Label>
              <Input
                id="additional_file"
                type="file"
                accept="image/*,application/pdf,.doc,.docx,.txt,.ppt,.pptx,.xls,.xlsx"
                onChange={(e) => setResponseFormData({ ...responseFormData, additional_file: e.target.files?.[0] || null })}
              />
              {responseFormData.additional_file && (
                <div className="flex items-center gap-2 p-2 bg-muted rounded">
                  <File className="h-4 w-4 text-primary" />
                  <p className="text-sm text-muted-foreground flex-1">
                    {responseFormData.additional_file.name}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setResponseFormData({ ...responseFormData, additional_file: null })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Upload any additional supporting files (PDF, image, doc, ppt, xls, txt)
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setResponseDialogOpen(false)}>
                Cancel
              </Button>
              {(() => {
                const isEditingResponse = !!(selectedTask && (responses[selectedTask.id] || []).some(r => r.user_id === user?.id));
                return (
                  <Button type="submit" disabled={submitting}>
                    {submitting ? (isEditingResponse ? "Updating..." : "Submitting...") : (isEditingResponse ? "Update Response" : "Submit Response")}
                  </Button>
                );
              })()}
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
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Edit Task</DialogTitle>
            <DialogDescription>
              Update task details and assignments
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2">
            <form onSubmit={handleEdit} className="space-y-4" id="edit-task-form">
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
              <Label htmlFor="edit-type">Type *</Label>
              <Select 
                value={editFormData.type} 
                onValueChange={(value) => setEditFormData({ ...editFormData, type: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="English Reading, listening & speaking Task">English Reading, listening & speaking Task</SelectItem>
                  <SelectItem value="Lesson Plan & Delivery">Lesson Plan & Delivery</SelectItem>
                  <SelectItem value="Soft & Digital Skills">Soft & Digital Skills</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-category">Category</Label>
              <Select 
                value={editFormData.category} 
                onValueChange={(value) => setEditFormData({ ...editFormData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Soft Skills">Soft Skills</SelectItem>
                  <SelectItem value="Hindi">Hindi</SelectItem>
                  <SelectItem value="English">English</SelectItem>
                  <SelectItem value="Mathematics">Mathematics</SelectItem>
                  <SelectItem value="Science">Science</SelectItem>
                  <SelectItem value="Social Studies">Social Studies</SelectItem>
                  <SelectItem value="Computer Science">Computer Science</SelectItem>
                  <SelectItem value="Arts & Crafts">Arts & Crafts</SelectItem>
                  <SelectItem value="Physical Education">Physical Education</SelectItem>
                  <SelectItem value="General">General</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-reward_amount">Reward Amount (₹) - Optional</Label>
              <Input
                id="edit-reward_amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="Enter reward amount in rupees"
                value={editFormData.reward_amount}
                onChange={(e) => setEditFormData({ ...editFormData, reward_amount: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                💰 Employees will earn this amount when their task response is reviewed and approved
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <div className="border rounded-md">
                <ReactQuillWrapper
                  theme="snow"
                  value={editFormData.description}
                  onChange={(value) => setEditFormData({ ...editFormData, description: value })}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-assign_to">Assign To</Label>
              <Select 
                value={editFormData.assign_to} 
                onValueChange={(value: "all" | "specific" | "groups") => 
                  setEditFormData({ ...editFormData, assign_to: value, assigned_user_ids: value === "all" ? [] : editFormData.assigned_user_ids })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select assignment type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  <SelectItem value="specific">Specific Employee</SelectItem>
                  <SelectItem value="groups">Assignment Groups</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editFormData.assign_to === "specific" && (
              <div className="space-y-2 bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border-2 border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-blue-600" />
                  <Label className="text-base font-semibold text-blue-900 dark:text-blue-100">
                    Task Assignment - Select Employees
                  </Label>
                </div>
                <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                  👉 These employees will receive and complete this task
                </p>
                <div className="border rounded-lg p-4 max-h-60 overflow-y-auto space-y-3 bg-white dark:bg-gray-900">
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
                  <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                    ✅ {editFormData.assigned_user_ids.length} employee(s) selected
                  </p>
                )}
              </div>
            )}

            {/* Review Assignment Type Selection */}
            <div className="space-y-4 bg-orange-50 dark:bg-orange-950/20 p-4 rounded-lg border-2 border-orange-200 dark:border-orange-800">
              <div className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-orange-600" />
                <Label className="text-base font-semibold text-orange-900 dark:text-orange-100">
                  Peer Review Assignment Type
                </Label>
              </div>
              <p className="text-sm text-orange-700 dark:text-orange-300 font-medium">
                Choose how peer reviewers should be assigned for this task
              </p>
              
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="edit-review-type-group"
                    name="edit_review_assignment_type"
                    value="group"
                    checked={editFormData.review_assignment_type === "group"}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, review_assignment_type: e.target.value as any }))}
                    className="text-orange-600"
                  />
                  <Label htmlFor="edit-review-type-group" className="text-sm cursor-pointer">
                    <strong>Group-based:</strong> Use reviewer groups and individual selections
                  </Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="edit-review-type-individual"
                    name="edit_review_assignment_type"
                    value="individual"
                    checked={editFormData.review_assignment_type === "individual"}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, review_assignment_type: e.target.value as any }))}
                    className="text-orange-600"
                  />
                  <Label htmlFor="edit-review-type-individual" className="text-sm cursor-pointer">
                    <strong>Individual 1:1:</strong> Manually assign specific reviewer for each user
                  </Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="edit-review-type-mixed"
                    name="edit_review_assignment_type"
                    value="mixed"
                    checked={editFormData.review_assignment_type === "mixed"}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, review_assignment_type: e.target.value as any }))}
                    className="text-orange-600"
                  />
                  <Label htmlFor="edit-review-type-mixed" className="text-sm cursor-pointer">
                    <strong>Mixed:</strong> Use both group-based and individual assignments
                  </Label>
                </div>
              </div>
            </div>

            {/* Individual 1:1 Reviewer Assignment - Show when individual or mixed is selected */}
            {(editFormData.review_assignment_type === "individual" || editFormData.review_assignment_type === "mixed") && (
              <div className="space-y-4 bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border-2 border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-blue-600" />
                  <Label className="text-base font-semibold text-blue-900 dark:text-blue-100">
                    Assign Individual Reviewers (1:1 Mapping)
                  </Label>
                </div>
                <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                  👥 For each assigned user, select their specific peer reviewer
                </p>
                
                {editFormData.assign_to === "all" ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto border rounded-lg p-4 bg-white dark:bg-gray-900">
                    {employees.map((emp) => (
                      <div key={`edit-reviewer-map-${emp.user_id}`} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{emp.first_name} {emp.last_name}</p>
                          <p className="text-xs text-muted-foreground">{emp.email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">→</span>
                          <Select
                            value={editFormData.individual_reviewer_assignments.find(a => a.user_id === emp.user_id)?.reviewer_id || "no-reviewer"}
                            onValueChange={(reviewerId) => {
                              setEditFormData(prev => {
                                const existing = prev.individual_reviewer_assignments.filter(a => a.user_id !== emp.user_id);
                                if (reviewerId && reviewerId !== "no-reviewer") {
                                  return {
                                    ...prev,
                                    individual_reviewer_assignments: [...existing, { user_id: emp.user_id, reviewer_id: reviewerId }]
                                  };
                                }
                                return { ...prev, individual_reviewer_assignments: existing };
                              });
                            }}
                          >
                            <SelectTrigger className="w-[200px]">
                              <SelectValue placeholder="Select reviewer" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="no-reviewer">No reviewer</SelectItem>
                              {employees.filter(e => e.user_id !== emp.user_id).map(reviewer => (
                                <SelectItem key={reviewer.user_id} value={reviewer.user_id}>
                                  {reviewer.first_name} {reviewer.last_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : editFormData.assigned_user_ids.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto border rounded-lg p-4 bg-white dark:bg-gray-900">
                    {editFormData.assigned_user_ids.map((userId) => {
                      const emp = employees.find(e => e.user_id === userId);
                      if (!emp) return null;
                      return (
                        <div key={`edit-reviewer-map-${userId}`} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                          <div className="flex-1">
                            <p className="text-sm font-medium">{emp.first_name} {emp.last_name}</p>
                            <p className="text-xs text-muted-foreground">{emp.email}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">→</span>
                            <Select
                              value={editFormData.individual_reviewer_assignments.find(a => a.user_id === userId)?.reviewer_id || "no-reviewer"}
                              onValueChange={(reviewerId) => {
                                setEditFormData(prev => {
                                  const existing = prev.individual_reviewer_assignments.filter(a => a.user_id !== userId);
                                  if (reviewerId && reviewerId !== "no-reviewer") {
                                    return {
                                      ...prev,
                                      individual_reviewer_assignments: [...existing, { user_id: userId, reviewer_id: reviewerId }]
                                    };
                                  }
                                  return { ...prev, individual_reviewer_assignments: existing };
                                });
                              }}
                            >
                              <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="Select reviewer" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="no-reviewer">No reviewer</SelectItem>
                                {employees.filter(e => e.user_id !== userId).map(reviewer => (
                                  <SelectItem key={reviewer.user_id} value={reviewer.user_id}>
                                    {reviewer.first_name} {reviewer.last_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Please select employees first
                  </p>
                )}
                
                {editFormData.individual_reviewer_assignments.length > 0 && (
                  <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                    ✅ {editFormData.individual_reviewer_assignments.length} reviewer(s) assigned
                  </p>
                )}
              </div>
            )}

            {/* Peer Reviewer Groups (Optional) - Only show for group or mixed */}
            {(editFormData.review_assignment_type === "group" || editFormData.review_assignment_type === "mixed") && (
              <>
            <div className="space-y-2 bg-purple-50 dark:bg-purple-950/20 p-4 rounded-lg border-2 border-purple-200 dark:border-purple-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-purple-600" />
                  <Label className="text-base font-semibold text-purple-900 dark:text-purple-100">
                    Peer Reviewer Groups (Optional)
                  </Label>
                </div>
                <Link to="/peer-reviewer-groups" target="_blank" className="text-xs text-purple-600 hover:underline inline-flex items-center gap-1 font-medium">
                  Manage groups <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
              <p className="text-sm text-purple-700 dark:text-purple-300 font-medium">
                👥 Select pre-made groups - all members will become reviewers
              </p>
              <p className="text-xs text-purple-600 dark:text-purple-400">
                Updating groups here re-snapshots reviewers for this task.
              </p>
              <div className="border rounded-lg p-4 max-h-48 overflow-y-auto space-y-3 bg-white dark:bg-gray-900">
                {reviewerGroups.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No groups available</p>
                ) : (
                  reviewerGroups.map(g => (
                    <div key={`edit-grp-${g.id}`} className="flex items-center space-x-2">
                      <Checkbox
                        id={`edit-grp-${g.id}`}
                        checked={editFormData.peer_reviewer_group_ids.includes(g.id)}
                        onCheckedChange={(checked) => {
                          setEditFormData(prev => ({
                            ...prev,
                            peer_reviewer_group_ids: checked
                              ? [...prev.peer_reviewer_group_ids, g.id]
                              : prev.peer_reviewer_group_ids.filter(id => id !== g.id),
                          }));
                        }}
                      />
                      <Label htmlFor={`edit-grp-${g.id}`} className="text-sm font-normal cursor-pointer">
                        {g.name} <span className="text-muted-foreground">({g.member_ids.length} members)</span>
                      </Label>
                    </div>
                  ))
                )}
              </div>
              {editFormData.peer_reviewer_group_ids.length > 0 && (
                <p className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                  ✅ {editFormData.peer_reviewer_group_ids.length} group(s) selected
                </p>
              )}
            </div>

            {/* Additional Individual Peer Reviewers (Optional) - Only show for group or mixed */}
            <div className="space-y-2 bg-green-50 dark:bg-green-950/20 p-4 rounded-lg border-2 border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-green-600" />
                <Label className="text-base font-semibold text-green-900 dark:text-green-100">
                  Additional Individual Peer Reviewers (Optional)
                </Label>
              </div>
              <p className="text-sm text-green-700 dark:text-green-300 font-medium">
                👤 Add individual reviewers (in addition to groups above)
              </p>
              <p className="text-xs text-green-600 dark:text-green-400">
                These reviewers can view and comment on task responses from assigned employees.
              </p>
              <div className="border rounded-lg p-4 max-h-60 overflow-y-auto space-y-3 bg-white dark:bg-gray-900">
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
                <p className="text-sm font-semibold text-green-700 dark:text-green-300">
                  ✅ {editFormData.peer_reviewer_ids.length} peer reviewer(s) selected
                </p>
              )}
            </div>
            </>
            )}
            
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
            
            </form>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t flex-shrink-0">
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="edit-task-form" disabled={submitting}>
              {submitting ? "Updating..." : "Update Task"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Tasks;
