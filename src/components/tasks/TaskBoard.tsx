import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Clock, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { TaskDialog } from './TaskDialog';
import { TaskCard } from './TaskCard';

type TaskStatus = 'todo' | 'in_progress' | 'review' | 'completed' | 'cancelled';
type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  created_by: string;
  assigned_to: string | null;
  due_date: string | null;
  start_date: string | null;
  completed_at: string | null;
  tags: string[] | null;
  category: string | null;
  institution: string | null;
  progress_percentage: number;
  estimated_hours: number | null;
  actual_hours: number | null;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
}

const statusConfig = {
  todo: { label: 'To Do', icon: Clock, color: 'bg-slate-100 text-slate-700' },
  in_progress: { label: 'In Progress', icon: AlertCircle, color: 'bg-blue-100 text-blue-700' },
  review: { label: 'Review', icon: AlertCircle, color: 'bg-yellow-100 text-yellow-700' },
  completed: { label: 'Completed', icon: CheckCircle2, color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled', icon: XCircle, color: 'bg-red-100 text-red-700' },
};

export const TaskBoard = () => {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      return session;
    },
  });

  const { data: userRole } = useQuery({
    queryKey: ['userRole', session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return null;
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .maybeSingle();
      return data?.role ?? null;
    },
    enabled: !!session?.user?.id,
  });

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', session?.user?.id, userRole],
    queryFn: async () => {
      if (!session?.user?.id) return [];
      
      if (userRole === 'admin') {
        // Admin sees all tasks
        const { data, error } = await (supabase as any)
          .from('tasks')
          .select('*')
          .eq('is_deleted', false)
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (error) throw error;
        return (data as unknown) as Task[];
      } else {
        // Employees and managers only see assigned tasks
        const { data: assignedTasks, error: assignError } = await supabase
          .from('task_assignments' as any)
          .select('task_id')
          .eq('user_id', session.user.id);

        if (assignError) throw assignError;

        const taskIds = (assignedTasks || []).map((a: any) => a.task_id);
        if (taskIds.length === 0) return [];

        const { data, error } = await (supabase as any)
          .from('tasks')
          .select('*')
          .in('id', taskIds)
          .eq('is_deleted', false)
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (error) throw error;
        return (data as unknown) as Task[];
      }
    },
    enabled: !!session?.user?.id && !!userRole,
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Task> }) => {
      const { error } = await supabase
        .from('tasks')
        .update(updates as any)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task updated successfully');
    },
    onError: () => {
      toast.error('Failed to update task');
    },
  });

  const handleStatusChange = (taskId: string, newStatus: TaskStatus) => {
    updateTaskMutation.mutate({ id: taskId, updates: { status: newStatus } });
  };

  const handleCreateTask = () => {
    setSelectedTask(null);
    setIsDialogOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setSelectedTask(task);
    setIsDialogOpen(true);
  };

  const tasksByStatus = {
    todo: tasks.filter(t => t.status === 'todo'),
    in_progress: tasks.filter(t => t.status === 'in_progress'),
    review: tasks.filter(t => t.status === 'review'),
    completed: tasks.filter(t => t.status === 'completed'),
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading tasks...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Task Board</h2>
          <p className="text-muted-foreground">Manage and track your tasks</p>
        </div>
        <Button onClick={handleCreateTask}>
          <Plus className="h-4 w-4 mr-2" />
          New Task
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {(Object.keys(statusConfig) as TaskStatus[])
          .filter(status => status !== 'cancelled')
          .map((status) => {
            const config = statusConfig[status];
            const Icon = config.icon;
            const statusTasks = tasksByStatus[status as keyof typeof tasksByStatus] || [];

            return (
              <Card key={status} className="flex flex-col">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <span>{config.label}</span>
                    </div>
                    <Badge variant="secondary">{statusTasks.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 pt-0">
                  <ScrollArea className="h-[600px] pr-4">
                    <div className="space-y-3">
                      {statusTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onEdit={handleEditTask}
                          onStatusChange={handleStatusChange}
                        />
                      ))}
                      {statusTasks.length === 0 && (
                        <div className="text-center text-muted-foreground text-sm py-8">
                          No tasks
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            );
          })}
      </div>

      <TaskDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        task={selectedTask}
      />
    </div>
  );
};
