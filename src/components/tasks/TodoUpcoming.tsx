import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight,
  ListTodo 
} from 'lucide-react';
import { format, isToday, isTomorrow, addDays, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'review' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date: string | null;
  assigned_to: string | null;
}

interface GroupedTasks {
  today: Task[];
  tomorrow: Task[];
  day3: Task[];
  upcomingNext3Days: Task[];
}

const priorityColors = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

const priorityIcons = {
  low: '○',
  medium: '◐',
  high: '◑',
  urgent: '●',
};

function getDateLabel(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  return format(date, 'EEE, MMM d');
}

export const TodoUpcoming = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [groupedTasks, setGroupedTasks] = useState<GroupedTasks>({
    today: [],
    tomorrow: [],
    day3: [],
    upcomingNext3Days: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUpcomingTasks();
  }, [user?.id]);

  const fetchUpcomingTasks = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      // Get today's date and next 3 days
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const tomorrow = addDays(today, 1);
      const day3 = addDays(today, 2);
      const day4 = addDays(today, 3);
      const endOfDay4 = addDays(today, 4);

      // First, get all task assignments for this user
      const { data: assignedTasks, error: assignError } = await supabase
        .from('task_assignments' as any)
        .select('task_id')
        .eq('user_id', user.id);

      if (assignError) throw assignError;

      const taskIds = (assignedTasks || []).map((a: any) => a.task_id);

      if (taskIds.length === 0) {
        setTasks([]);
        setGroupedTasks({ today: [], tomorrow: [], day3: [], upcomingNext3Days: [] });
        setLoading(false);
        return;
      }

      // Fetch tasks assigned to this user with due dates
      const { data: allTasks, error: taskError } = await supabase
        .from('tasks' as any)
        .select('*')
        .in('id', taskIds)
        .eq('is_active', true)
        .not('due_date', 'is', null)
        .gte('due_date', today.toISOString())
        .lt('due_date', endOfDay4.toISOString())
        .order('due_date', { ascending: true });

      if (taskError) throw taskError;

      const fetchedTasks = (allTasks || []) as unknown as Task[];
      setTasks(fetchedTasks);

      // Group tasks by date
      const grouped: GroupedTasks = {
        today: [],
        tomorrow: [],
        day3: [],
        upcomingNext3Days: [],
      };

      fetchedTasks.forEach(task => {
        if (!task.due_date) return;

        const taskDate = new Date(task.due_date);
        taskDate.setHours(0, 0, 0, 0);

        if (taskDate.getTime() === today.getTime()) {
          if (grouped.today.length < 3) {
            grouped.today.push(task);
          }
        } else if (taskDate.getTime() === tomorrow.getTime()) {
          if (grouped.tomorrow.length < 3) {
            grouped.tomorrow.push(task);
          }
        } else if (taskDate.getTime() === day3.getTime()) {
          if (grouped.day3.length < 3) {
            grouped.day3.push(task);
          }
        } else if (taskDate.getTime() === day4.getTime() || 
                   (taskDate > day3 && taskDate < endOfDay4)) {
          if (grouped.upcomingNext3Days.length < 3) {
            grouped.upcomingNext3Days.push(task);
          }
        }
      });

      setGroupedTasks(grouped);
    } catch (error) {
      console.error('Error fetching upcoming tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderTaskItem = (task: Task) => {
    const isCompleted = task.status === 'completed';
    const isHighPriority = task.priority === 'urgent' || task.priority === 'high';

    return (
      <div
        key={task.id}
        className={`flex items-start gap-3 p-3 rounded-lg border transition-all hover:shadow-md cursor-pointer ${
          isCompleted
            ? 'bg-muted/50 border-muted'
            : isHighPriority
            ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
            : 'bg-white dark:bg-slate-900 border-border'
        }`}
        onClick={() => navigate('/tasks')}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {isCompleted ? (
              <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
            ) : (
              <span className="text-lg font-bold text-muted-foreground flex-shrink-0">
                {priorityIcons[task.priority]}
              </span>
            )}
            <h4 className={`text-sm font-medium line-clamp-1 ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
              {task.title}
            </h4>
          </div>
          {task.description && (
            <p className="text-xs text-muted-foreground line-clamp-1 ml-6">
              {task.description}
            </p>
          )}
          <div className="flex items-center gap-2 mt-2 ml-6">
            <Badge variant="secondary" className={`text-xs ${priorityColors[task.priority]}`}>
              {task.priority}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {(task.status || 'unknown').replace('_', ' ')}
            </Badge>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
      </div>
    );
  };

  const renderDateSection = (date: Date, dayTasks: Task[]) => {
    const dateLabel = getDateLabel(date);
    const completedCount = dayTasks.filter(t => t.status === 'completed').length;
    const totalCount = dayTasks.length;

    if (totalCount === 0) return null;

    return (
      <div key={dateLabel} className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <h4 className="font-semibold text-sm">
              {dateLabel}
            </h4>
            <Badge variant="secondary" className="text-xs">
              {completedCount}/{totalCount}
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground">
            {format(date, 'MMM d, yyyy')}
          </span>
        </div>
        <div className="space-y-2">
          {dayTasks.map(task => renderTaskItem(task))}
        </div>
      </div>
    );
  };

  const totalTasks = groupedTasks.today.length + 
                     groupedTasks.tomorrow.length + 
                     groupedTasks.day3.length + 
                     groupedTasks.upcomingNext3Days.length;

  const completedTasks = tasks.filter(t => t.status === 'completed').length;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListTodo className="h-5 w-5" />
            My Tasks (Today + 3 Days)
          </CardTitle>
          <CardDescription>Top 3 tasks per day organized by date</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (totalTasks === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListTodo className="h-5 w-5" />
            My Tasks (Today + 3 Days)
          </CardTitle>
          <CardDescription>
            No tasks scheduled for the next 3 days
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You're all caught up! No tasks are due in the next 3 days.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              <ListTodo className="h-5 w-5" />
              My Tasks (Today + 3 Days)
            </CardTitle>
            <CardDescription className="mt-1">
              Top 3 tasks per day · {totalTasks} task{totalTasks !== 1 ? 's' : ''} pending · {completedTasks} completed
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigate('/tasks')}
            className="gap-2"
          >
            View All
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Today */}
        {groupedTasks.today.length > 0 && renderDateSection(today, groupedTasks.today)}

        {/* Tomorrow */}
        {groupedTasks.tomorrow.length > 0 && renderDateSection(addDays(today, 1), groupedTasks.tomorrow)}

        {/* Day 3 */}
        {groupedTasks.day3.length > 0 && renderDateSection(addDays(today, 2), groupedTasks.day3)}

        {/* Next 3 Days */}
        {groupedTasks.upcomingNext3Days.length > 0 && renderDateSection(addDays(today, 3), groupedTasks.upcomingNext3Days)}
      </CardContent>
    </Card>
  );
};
