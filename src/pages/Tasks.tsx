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
import { CheckSquare, Plus, FileText, Download, File, Image as ImageIcon, Trash2, MessageSquare, Send, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

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
}

interface TaskResponse {
  id: string;
  task_id: string;
  user_id: string;
  response_text: string;
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
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [responses, setResponses] = useState<Record<string, TaskResponse[]>>({});
  const [remarks, setRemarks] = useState<Record<string, TaskRemark[]>>({});
  const [assignments, setAssignments] = useState<Record<string, Array<{ user_id: string; first_name: string; last_name: string }>>>({});
  const [responseDialogOpen, setResponseDialogOpen] = useState(false);
  const [remarkDialogOpen, setRemarkDialogOpen] = useState(false);
  const [selectedResponse, setSelectedResponse] = useState<TaskResponse | null>(null);
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    due_date: "",
    file: null as File | null,
    assign_to: "all" as "all" | "specific",
    assigned_user_ids: [] as string[],
  });

  const [employees, setEmployees] = useState<Array<{ user_id: string; first_name: string; last_name: string; email: string }>>([]);

  const [responseFormData, setResponseFormData] = useState({
    response_text: "",
    file: null as File | null,
  });

  const [remarkFormData, setRemarkFormData] = useState({
    remark_text: "",
    rating: 5,
  });

  useEffect(() => {
    fetchTasks();
    if (role === "admin") {
      fetchEmployees();
    }
  }, [role]);

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

  const fetchTasks = async () => {
    try {
      let query;
      
      if (role === "admin") {
        // Admin sees all tasks
        query = supabase
          .from("tasks" as any)
          .select("*")
          .eq("is_active", true)
          .order("created_at", { ascending: false });
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
          setLoading(false);
          return;
        }

        query = supabase
          .from("tasks" as any)
          .select("*")
          .in("id", taskIds)
          .eq("is_active", true)
          .order("created_at", { ascending: false });
      }

      const { data, error } = await query;

      if (error) throw error;
      setTasks((data || []) as any);
      
      // Fetch responses for all tasks
      if (data && data.length > 0) {
        for (const task of data as any[]) {
          await fetchResponses(task.id);
          await fetchAssignments(task.id);
        }
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
    }
  };

  const fetchResponses = async (taskId: string) => {
    try {
      const { data, error } = await supabase
        .from("task_responses" as any)
        .select(`
          *,
          employee_profiles(first_name, last_name)
        `)
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching responses with join:", error);
        // If the join fails, try fetching without the join
        const { data: responsesData, error: responsesError } = await supabase
          .from("task_responses" as any)
          .select("*")
          .eq("task_id", taskId)
          .order("created_at", { ascending: false });
        
        if (responsesError) throw responsesError;
        
        console.log("Fetched responses without join:", responsesData);
        
        // Manually fetch employee profiles
        if (responsesData && responsesData.length > 0) {
          const enrichedData = await Promise.all(
            responsesData.map(async (response: any) => {
              console.log("Fetching profile for user_id:", response.user_id);
              
              const { data: profile, error: profileError } = await supabase
                .from("employee_profiles")
                .select("first_name, last_name")
                .eq("user_id", response.user_id)
                .single();
              
              if (profileError) {
                console.error("Error fetching profile for user_id:", response.user_id, profileError);
              }
              
              console.log("Profile data:", profile);
              
              return {
                ...response,
                employee_profiles: profile || { first_name: "Unknown", last_name: "User" }
              };
            })
          );
          
          console.log("Enriched responses:", enrichedData);
          setResponses(prev => ({ ...prev, [taskId]: enrichedData as any }));
          
          // Fetch remarks for each response
          for (const response of enrichedData) {
            await fetchRemarks(response.id);
          }
        }
        return;
      }
      
      console.log("Fetched responses with join:", data);
      
      // Check if any response has null employee_profiles and fetch manually
      const enrichedData = await Promise.all(
        (data || []).map(async (response: any) => {
          if (!response.employee_profiles || !response.employee_profiles.first_name) {
            console.log("Missing profile in join result, fetching manually for user_id:", response.user_id);
            
            const { data: profile, error: profileError } = await supabase
              .from("employee_profiles")
              .select("first_name, last_name")
              .eq("user_id", response.user_id)
              .single();
            
            if (profileError) {
              console.error("Error fetching profile:", profileError);
            }
            
            return {
              ...response,
              employee_profiles: profile || { first_name: "Unknown", last_name: "User" }
            };
          }
          return response;
        })
      );
      
      console.log("Final enriched responses:", enrichedData);
      setResponses(prev => ({ ...prev, [taskId]: enrichedData as any }));
      
      // Fetch remarks for each response
      if (enrichedData && enrichedData.length > 0) {
        for (const response of enrichedData) {
          await fetchRemarks(response.id);
        }
      }
    } catch (error) {
      console.error("Error fetching responses:", error);
    }
  };

  const fetchRemarks = async (responseId: string) => {
    try {
      const { data, error } = await supabase
        .from("task_remarks" as any)
        .select(`
          *,
          employee_profiles(first_name, last_name)
        `)
        .eq("response_id", responseId)
        .order("created_at", { ascending: false});

      if (error) {
        console.error("Error fetching remarks:", error);
        // If the join fails, try fetching without the join
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
      const { data, error } = await supabase
        .from("task_assignments" as any)
        .select(`
          user_id,
          employee_profiles(first_name, last_name)
        `)
        .eq("task_id", taskId);

      if (error) {
        console.error("Error fetching assignments:", error);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.description.trim()) {
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

      toast({
        title: "Success",
        description: `Task created and assigned to ${formData.assign_to === "all" ? "all employees" : `${formData.assigned_user_ids.length} employee(s)`}`,
      });

      setFormData({ title: "", description: "", due_date: "", file: null, assign_to: "all", assigned_user_ids: [] });
      setOpen(false);
      fetchTasks();
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
          file_url: fileUrl,
          file_name: fileName,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Response submitted successfully",
      });

      setResponseFormData({ response_text: "", file: null });
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

      fetchTasks();
    } catch (error) {
      console.error("Error deleting task:", error);
      toast({
        title: "Error",
        description: "Failed to delete task",
        variant: "destructive",
      });
    }
  };

  const canCreateTask = role === "admin";
  const canDeleteTask = role === "admin";
  const canAddRemark = role === "admin";

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
          {canCreateTask && (
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
                    <Textarea
                      id="description"
                      placeholder="Enter task description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={5}
                      required
                    />
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
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
                        {task.due_date && (
                          <Badge variant="outline" className="mt-2">
                            Due: {format(new Date(task.due_date), "MMM dd, yyyy")}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(task.created_at), "MMM dd, yyyy")}
                        </span>
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
                    <div className="text-muted-foreground whitespace-pre-wrap">
                      {task.description}
                    </div>
                    
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
                      {/* Admin/Manager: Show all responses */}
                      {(role === "admin" || role === "manager") && (
                        <>
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold flex items-center gap-2">
                              <MessageSquare className="h-4 w-4" />
                              Responses ({taskResponses.length})
                            </h3>
                          </div>

                          {taskResponses.length > 0 && (
                            <div className="space-y-4">
                              {taskResponses.map((response) => {
                                const responseRemarks = remarks[response.id] || [];
                                
                                return (
                                  <Card key={response.id}>
                                    <CardContent className="pt-4 space-y-3">
                                      <div className="flex items-start justify-between">
                                        <div>
                                          <p className="font-medium">
                                            {response.employee_profiles?.first_name} {response.employee_profiles?.last_name}
                                          </p>
                                          <p className="text-xs text-muted-foreground">
                                            {format(new Date(response.created_at), "MMM dd, yyyy HH:mm")}
                                          </p>
                                        </div>
                                        {canAddRemark && (
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
                                  {userResponse.file_url && userResponse.file_name && (
                                    <div className="pt-2 border-t">
                                      {renderFilePreview(userResponse.file_url, userResponse.file_name)}
                                    </div>
                                  )}

                                  {/* Remarks on employee's response */}
                                  {remarks[userResponse.id] && remarks[userResponse.id].length > 0 && (
                                    <div className="mt-4 space-y-2 pl-4 border-l-2 border-primary">
                                      <p className="text-sm font-medium text-primary">Remarks from Admin/Manager:</p>
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
    </DashboardLayout>
  );
};

export default Tasks;
