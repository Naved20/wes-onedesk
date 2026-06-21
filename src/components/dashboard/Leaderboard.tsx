import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getTasksCompletedLeaderboard,
  getReviewsCompletedLeaderboard,
  getHighestEarningsLeaderboard,
  getBestAttendanceLeaderboard,
  getMostApprovedTasksLeaderboard,
  getFastestTaskCompletionLeaderboard,
  getMostWorkingHoursLeaderboard,
  LeaderboardEntry,
} from "@/lib/leaderboardUtils";
import {
  CheckCircle2,
  MessageSquare,
  Coins,
  Calendar,
  ThumbsUp,
  Zap,
  Clock,
  Trophy,
  AlertCircle,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface LeaderboardCategory {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  fetchFn: () => Promise<LeaderboardEntry[]>;
  valueFormat?: (value: number) => string;
  unit?: string;
}

const LeaderboardCard: React.FC<{
  title: string;
  description: string;
  data: LeaderboardEntry[];
  loading: boolean;
  icon: React.ReactNode;
  valueFormat?: (value: number) => string;
  unit?: string;
}> = ({ title, description, data, loading, icon, valueFormat, unit }) => {
  if (loading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <div className="flex items-center gap-2">
            {icon}
            <div className="flex-1">
              <CardTitle className="text-lg">{title}</CardTitle>
              <CardDescription className="text-xs">{description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <div className="flex items-center gap-2">
            {icon}
            <div className="flex-1">
              <CardTitle className="text-lg">{title}</CardTitle>
              <CardDescription className="text-xs">{description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>No data available yet for this leaderboard.</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <div className="flex items-center gap-2">
          {icon}
          <div className="flex-1">
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription className="text-xs">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="space-y-3">
          {data.map((entry) => (
            <div
              key={`${entry.userId}-${entry.rank}`}
              className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                entry.rank === 1
                  ? "bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800"
                  : entry.rank === 2
                  ? "bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800"
                  : entry.rank === 3
                  ? "bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800"
                  : "bg-card hover:bg-muted/50"
              }`}
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="flex items-center justify-center w-8 h-8 font-bold text-lg min-w-8">
                  {entry.medal ? (
                    <span>{entry.medal}</span>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      #{entry.rank}
                    </Badge>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate text-sm">{entry.userName}</p>
                </div>
              </div>
              <div className="text-right ml-2">
                <p className="font-bold text-primary">
                  {valueFormat ? valueFormat(entry.value) : entry.value}
                  {unit && <span className="text-xs text-muted-foreground ml-1">{unit}</span>}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export function Leaderboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [leaderboards, setLeaderboards] = useState<Record<string, LeaderboardEntry[]>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const categories: LeaderboardCategory[] = [
    {
      id: "tasks-completed",
      title: "Most Tasks Completed",
      description: "Top performers by task completion",
      icon: <CheckCircle2 className="h-5 w-5 text-blue-600" />,
      fetchFn: getTasksCompletedLeaderboard,
      valueFormat: (v) => v.toString(),
      unit: "tasks",
    },
    {
      id: "reviews-completed",
      title: "Most Reviews Completed",
      description: "Top reviewers and evaluators",
      icon: <MessageSquare className="h-5 w-5 text-purple-600" />,
      fetchFn: getReviewsCompletedLeaderboard,
      valueFormat: (v) => v.toString(),
      unit: "reviews",
    },
    {
      id: "highest-earnings",
      title: "Highest Total Earnings",
      description: "Top earners from task completion",
      icon: <Coins className="h-5 w-5 text-green-600" />,
      fetchFn: getHighestEarningsLeaderboard,
      valueFormat: (v) => `₹${v.toLocaleString("en-IN")}`,
    },
    {
      id: "best-attendance",
      title: "Best Attendance Percentage",
      description: "Highest attendance rates",
      icon: <Calendar className="h-5 w-5 text-red-600" />,
      fetchFn: getBestAttendanceLeaderboard,
      valueFormat: (v) => `${v}%`,
    },
    {
      id: "approved-tasks",
      title: "Most Approved Tasks",
      description: "Tasks passed quality review",
      icon: <ThumbsUp className="h-5 w-5 text-emerald-600" />,
      fetchFn: getMostApprovedTasksLeaderboard,
      valueFormat: (v) => v.toString(),
      unit: "approved",
    },

 
  ];

  // Fetch data for a specific category
  const fetchLeaderboardData = async (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return;

    setLoading(prev => ({ ...prev, [categoryId]: true }));
    try {
      const data = await category.fetchFn();
      setLeaderboards(prev => ({ ...prev, [categoryId]: data }));
    } catch (error) {
      console.error(`Error fetching ${categoryId} leaderboard:`, error);
      setLeaderboards(prev => ({ ...prev, [categoryId]: [] }));
    } finally {
      setLoading(prev => ({ ...prev, [categoryId]: false }));
    }
  };

  // Fetch all leaderboards on mount
  useEffect(() => {
    categories.forEach(category => {
      fetchLeaderboardData(category.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh leaderboard data every 30 seconds for real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      categories.forEach(category => {
        fetchLeaderboardData(category.id);
      });
    }, 30000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">


  
      {/* Overall Summary Grid - Top 5 for Each Category */}
      <Card className="mt-8">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
          <Trophy className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">Performance Leaderboard</h2>
        </div>
          <CardDescription>Top 5 performers across all categories</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
            {categories.map(category => {
              const categoryData = leaderboards[category.id] || [];
              const isLoading = loading[category.id];
              
              return (
                <div
                  key={category.id}
                  className="space-y-3 p-4 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-2 mb-3">
                    {category.icon}
                    <div>
                      <p className="text-sm font-semibold">{category.title}</p>
                      <p className="text-xs text-muted-foreground">{category.description}</p>
                    </div>
                  </div>

                  {isLoading ? (
                    <div className="space-y-2">
                      {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-8 w-full" />
                      ))}
                    </div>
                  ) : categoryData.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No data available</p>
                  ) : (
                    <div className="space-y-2">
                      {categoryData.map((entry) => (
                        <div
                          key={`${entry.userId}-${entry.rank}`}
                          className={`flex items-center justify-between p-2 rounded text-sm ${
                            entry.rank === 1
                              ? "bg-yellow-50 dark:bg-yellow-950/30"
                              : entry.rank === 2
                              ? "bg-gray-100 dark:bg-gray-800/30"
                              : entry.rank === 3
                              ? "bg-orange-50 dark:bg-orange-950/30"
                              : "bg-muted/30"
                          }`}
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="font-bold text-xs w-6">
                              {entry.medal || `#${entry.rank}`}
                            </span>
                            <p className="truncate text-xs font-medium">{entry.userName}</p>
                          </div>
                          <p className="font-bold text-xs text-primary ml-1 flex-shrink-0">
                            {category.valueFormat ? category.valueFormat(entry.value) : entry.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
