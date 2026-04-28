import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Calendar, MoreVertical, User, Tag } from 'lucide-react';
import { format } from 'date-fns';
import { Task } from './TaskBoard';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onStatusChange: (taskId: string, status: Task['status']) => void;
}

const priorityColors = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

export const TaskCard = ({ task, onEdit, onStatusChange }: TaskCardProps) => {
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';

  const { data: assignedEmployee } = useQuery({
    queryKey: ['employee', task.assigned_to],
    queryFn: async () => {
      if (!task.assigned_to) return null;
      const { data, error } = await supabase
        .from('employee_profiles')
        .select('first_name, last_name')
        .eq('user_id', task.assigned_to)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!task.assigned_to,
  });

  return (
    <Card className={`p-3 cursor-pointer hover:shadow-md transition-shadow ${isOverdue ? 'border-red-300' : ''}`}>
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-medium text-sm line-clamp-2 flex-1" onClick={() => onEdit(task)}>
            {task.title}
          </h4>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(task)}>
                Edit Task
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange(task.id, 'todo')}>
                Move to To Do
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange(task.id, 'in_progress')}>
                Move to In Progress
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange(task.id, 'review')}>
                Move to Review
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange(task.id, 'completed')}>
                Mark as Completed
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {task.description}
          </p>
        )}

        <div className="flex flex-wrap gap-1">
          <Badge variant="outline" className={priorityColors[task.priority]}>
            {task.priority}
          </Badge>
          {task.category && (
            <Badge variant="outline" className="text-xs">
              {task.category}
            </Badge>
          )}
        </div>

        {task.tags && task.tags.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            <Tag className="h-3 w-3 text-muted-foreground" />
            {task.tags.slice(0, 3).map((tag, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            {task.tags.length > 3 && (
              <span className="text-xs text-muted-foreground">+{task.tags.length - 3}</span>
            )}
          </div>
        )}

        {task.due_date && (
          <div className={`flex items-center gap-1 text-xs ${isOverdue ? 'text-red-600' : 'text-muted-foreground'}`}>
            <Calendar className="h-3 w-3" />
            <span>{format(new Date(task.due_date), 'MMM dd, yyyy')}</span>
            {isOverdue && <span className="font-medium">(Overdue)</span>}
          </div>
        )}

        {task.assigned_to && assignedEmployee && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <User className="h-3 w-3" />
            <span>{assignedEmployee.first_name} {assignedEmployee.last_name}</span>
          </div>
        )}

        {task.progress_percentage > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{task.progress_percentage}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div
                className="bg-blue-600 h-1.5 rounded-full transition-all"
                style={{ width: `${task.progress_percentage}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
