import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Clock, AlertCircle, ListTodo } from 'lucide-react';
import { Task } from './TaskBoard';

export const TaskStats = () => {
  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('is_deleted', false);

      if (error) throw error;
      return data as Task[];
    },
  });

  const stats = {
    total: tasks.length,
    todo: tasks.filter(t => t.status === 'todo').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    overdue: tasks.filter(t => 
      t.due_date && 
      new Date(t.due_date) < new Date() && 
      t.status !== 'completed'
    ).length,
  };

  const statCards = [
    {
      title: 'Total Tasks',
      value: stats.total,
      icon: ListTodo,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: 'To Do',
      value: stats.todo,
      icon: Clock,
      color: 'text-slate-600',
      bgColor: 'bg-slate-100',
    },
    {
      title: 'In Progress',
      value: stats.inProgress,
      icon: AlertCircle,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
    {
      title: 'Completed',
      value: stats.completed,
      icon: CheckCircle2,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {statCards.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-full ${stat.bgColor}`}>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              {stat.title === 'Total Tasks' && stats.overdue > 0 && (
                <p className="text-xs text-red-600 mt-1">
                  {stats.overdue} overdue
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
