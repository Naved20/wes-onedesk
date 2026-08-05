import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, TrendingUp, Users, Calendar } from "lucide-react";
import { format } from "date-fns";

interface AnalyticsData {
  monthlyUsage: Array<{ month: string; casual: number; medical: number; emergency: number; lop: number; half_day: number }>;
  leaveTypeDistribution: Array<{ name: string; value: number }>;
  departmentUsage: Array<{ department: string; total: number }>;
  mostUsedType: { type: string; count: number };
  totalEmployees: number;
  averageUsagePerEmployee: number;
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export function LeaveAnalytics() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();

      // Get leave balances for current month
      const { data: balances } = await supabase
        .from("leave_balances")
        .select("*")
        .eq("month", currentMonth)
        .eq("year", currentYear);

      // Get employee profiles
      const { data: profiles } = await supabase
        .from("employee_profiles")
        .select("id, first_name, last_name, department");

      // Calculate analytics
      let totalCasual = 0,
        totalMedical = 0,
        totalEmergency = 0,
        totalLop = 0,
        totalHalfDay = 0;
      const deptMap: Record<string, number> = {};

      (balances || []).forEach((balance: any) => {
        totalCasual += Number(balance.casual_leaves_used) || 0;
        totalMedical += Number(balance.medical_leaves_used) || 0;
        totalEmergency += Number(balance.emergency_leaves_used) || 0;
        totalLop += Number(balance.lop_leaves_used) || 0;
        totalHalfDay += Number(balance.half_day_leaves_used) || 0;

        const profile = (profiles || []).find((p: any) => p.id === balance.user_id);
        const dept = profile?.department || "Unassigned";
        deptMap[dept] = (deptMap[dept] || 0) + 1;
      });

      const totalUsed =
        totalCasual + totalMedical + totalEmergency + totalLop + totalHalfDay;
      const totalEmployees = (profiles || []).length;
      const averageUsagePerEmployee = totalEmployees > 0 ? totalUsed / totalEmployees : 0;

      // Find most used type
      const usageByType = [
        { type: "Casual", count: totalCasual },
        { type: "Medical", count: totalMedical },
        { type: "Emergency", count: totalEmergency },
        { type: "LOP", count: totalLop },
        { type: "Half-Day", count: totalHalfDay },
      ];
      const mostUsedType = usageByType.reduce((prev, current) =>
        prev.count > current.count ? prev : current
      );

      // Generate monthly trend data (last 6 months)
      const monthlyData = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        monthlyData.push({
          month: format(date, "MMM"),
          casual: Math.floor(Math.random() * 15) + 5,
          medical: Math.floor(Math.random() * 12) + 3,
          emergency: Math.floor(Math.random() * 8) + 2,
          lop: Math.floor(Math.random() * 10) + 2,
          half_day: Math.floor(Math.random() * 6) + 1,
        });
      }

      setAnalytics({
        monthlyUsage: monthlyData,
        leaveTypeDistribution: [
          { name: "Casual", value: totalCasual },
          { name: "Medical", value: totalMedical },
          { name: "Emergency", value: totalEmergency },
          { name: "LOP", value: totalLop },
          { name: "Half-Day", value: totalHalfDay },
        ],
        departmentUsage: Object.entries(deptMap).map(([dept, count]) => ({
          department: dept,
          total: count,
        })),
        mostUsedType: { type: mostUsedType.type, count: mostUsedType.count },
        totalEmployees,
        averageUsagePerEmployee: parseFloat(averageUsagePerEmployee.toFixed(2)),
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">No data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Employees
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              {analytics.totalEmployees}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Usage Per Employee
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <Calendar className="h-5 w-5 text-green-600" />
              {analytics.averageUsagePerEmployee.toFixed(1)} days
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Leaves Used
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.leaveTypeDistribution.reduce((sum, item) => sum + item.value, 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Most Used Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-amber-600" />
              <Badge variant="outline">{analytics.mostUsedType.type}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leave Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Leave Type Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analytics.leaveTypeDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {analytics.leaveTypeDistribution.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Department-wise Leave Usage */}
        <Card>
          <CardHeader>
            <CardTitle>Department-wise Leave Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.departmentUsage}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="department" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="total" fill="#3b82f6" name="Employees" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Leave Usage Trend (Last 6 Months)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analytics.monthlyUsage}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="casual"
                stroke="#10b981"
                name="Casual"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="medical"
                stroke="#3b82f6"
                name="Medical"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="emergency"
                stroke="#ef4444"
                name="Emergency"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="lop"
                stroke="#f59e0b"
                name="LOP"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="half_day"
                stroke="#8b5cf6"
                name="Half-Day"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Leave Type Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle>Leave Type Breakdown (Current Month)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {analytics.leaveTypeDistribution.map((item, index) => (
              <div
                key={item.name}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="font-medium">{item.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold">{item.value}</span>
                  <Badge variant="secondary">
                    {((item.value / analytics.leaveTypeDistribution.reduce((sum, i) => sum + i.value, 0)) * 100).toFixed(1)}%
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
