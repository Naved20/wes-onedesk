import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Coins, TrendingUp, Users, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface EarningRecord {
  earning_name: string;
  amount: number;
  user_id: string;
  first_name: string;
  last_name: string;
  month: number;
  year: number;
  task_id?: string;
  status?: string;
}

export function EarningsAnalytics() {
  const { role } = useAuth();
  const [earnings, setEarnings] = useState<EarningRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [rlsIssue, setRlsIssue] = useState(false);

  const months = [
    { label: "January", value: 1 },
    { label: "February", value: 2 },
    { label: "March", value: 3 },
    { label: "April", value: 4 },
    { label: "May", value: 5 },
    { label: "June", value: 6 },
    { label: "July", value: 7 },
    { label: "August", value: 8 },
    { label: "September", value: 9 },
    { label: "October", value: 10 },
    { label: "November", value: 11 },
    { label: "December", value: 12 },
  ];

  const fetchEarnings = async () => {
    setLoading(true);
    try {
      // First, try a simple fetch without joins to see if we can access the table
      console.log("🔍 Attempting to fetch task_earnings...");
      
      const { data: simpleData, error: simpleError } = await supabase
        .from("task_earnings" as any)
        .select("*")
        .order("earned_at", { ascending: false });

      console.log("📊 Simple fetch result - Error:", simpleError);
      console.log("📊 Simple fetch result - Data length:", simpleData?.length);
      console.log("📊 Sample record:", simpleData?.[0]);

      if (simpleError) {
        console.error("❌ Error fetching task_earnings:", simpleError);
        if (simpleError.message?.includes("violates RLS") || simpleError.message?.includes("policy")) {
          setRlsIssue(true);
        }
        throw simpleError;
      }

      if (!simpleData || simpleData.length === 0) {
        console.warn("⚠️ No task_earnings records found!");
        console.warn("🔒 Current user role:", role);
        
        if (role === "admin") {
          console.warn("⚠️ RLS policy is likely blocking admin access.");
          setRlsIssue(true);
        }
        
        setEarnings([]);
        setLoading(false);
        return;
      }

      console.log("✅ Successfully fetched data, now processing...");

      // Extract user IDs and task IDs for batch fetches
      const userIds = Array.from(new Set((simpleData || []).map((e: any) => e.user_id)));
      const taskIds = Array.from(new Set((simpleData || []).map((e: any) => e.task_id).filter(Boolean)));

      // Fetch employee details
      const { data: empData } = await supabase
        .from("employee_profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", userIds);

      // Fetch task details if we have task IDs
      let taskMap: Record<string, any> = {};
      if (taskIds.length > 0) {
        const { data: taskData } = await supabase
          .from("tasks")
          .select("id, title, type")
          .in("id", taskIds);
        
        taskData?.forEach((task: any) => {
          taskMap[task.id] = task;
        });
        console.log("📋 Tasks fetched:", taskData?.length);
        if (taskData && taskData.length > 0) {
          console.log("📋 Sample task:", taskData[0]);
        }
      }

      const empMap: Record<string, any> = {};
      (empData || []).forEach((emp: any) => {
        empMap[emp.user_id] = emp;
      });
      console.log("👥 Employees fetched:", empData?.length);

      // Map task types to standard categories
      const taskTypeMap: Record<string, string> = {
        'Lesson Plan & Delivery': 'Lesson Plan',
        'English Reading, listening & speaking Task': 'ENG Training',
        'Soft & Digital Skills': 'Digital Training',
      };

      // Transform data
      const transformedEarnings: EarningRecord[] = [];
      
      (simpleData || []).forEach((earning: any, idx: number) => {
        const earnedDate = new Date(earning.earned_at);
        const month = earnedDate.getMonth() + 1;
        const year = earnedDate.getFullYear();
        
        const emp = empMap[earning.user_id];
        const task = earning.task_id ? taskMap[earning.task_id] : null;
        
        // Determine task type - try multiple approaches
        let taskType = 'Unknown Task';
        
        if (task?.type) {
          taskType = taskTypeMap[task.type] || task.type;
          if (idx < 3) console.log(`✅ Record ${idx}: Found task.type: ${task.type} -> ${taskType}`);
        } else if (earning.task_type) {
          taskType = taskTypeMap[earning.task_type] || earning.task_type;
          if (idx < 3) console.log(`✅ Record ${idx}: Found earning.task_type: ${earning.task_type} -> ${taskType}`);
        } else {
          if (idx < 3) {
            console.log(`⚠️ Record ${idx}: No type found. Earning:`, earning);
            console.log(`⚠️ Record ${idx}: Task data:`, task);
          }
        }
        
        transformedEarnings.push({
          earning_name: taskType,
          amount: parseFloat(earning.amount) || 0,
          user_id: earning.user_id,
          first_name: emp?.first_name || "Unknown",
          last_name: emp?.last_name || "",
          month,
          year,
          status: earning.status,
        });
      });

      console.log("✅ Transformed earnings count:", transformedEarnings.length);
      console.log("📊 Sample earnings:", transformedEarnings.slice(0, 3));
      setEarnings(transformedEarnings);
    } catch (error) {
      console.error("❌ Error fetching earnings:", error);
      setEarnings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEarnings();
  }, []);

  // Calculate person-wise totals for selected year
  const personEarnings: Record<string, { name: string; total: number; byType: Record<string, number>; byMonth: Record<string, number> }> = {};
  earnings
    .filter(e => e.year === selectedYear)
    .forEach((earning) => {
      if (!personEarnings[earning.user_id]) {
        personEarnings[earning.user_id] = {
          name: `${earning.first_name} ${earning.last_name}`,
          total: 0,
          byType: {},
          byMonth: {},
        };
      }

      const person = personEarnings[earning.user_id];
      person.total += earning.amount;
      person.byType[earning.earning_name] = (person.byType[earning.earning_name] || 0) + earning.amount;

      const monthKey = `${earning.month}-${earning.year}`;
      person.byMonth[monthKey] = (person.byMonth[monthKey] || 0) + earning.amount;
    });

  // Calculate month-wise totals
  const monthEarnings: Record<string, { month: string; total: number; byType: Record<string, number>; byPerson: Record<string, number> }> = {};
  earnings
    .filter(e => e.year === selectedYear)
    .forEach((earning) => {
      const monthKey = `${earning.month}-${earning.year}`;
      if (!monthEarnings[monthKey]) {
        monthEarnings[monthKey] = {
          month: `${months[earning.month - 1].label} ${earning.year}`,
          total: 0,
          byType: {},
          byPerson: {},
        };
      }

      const month = monthEarnings[monthKey];
      month.total += earning.amount;
      month.byType[earning.earning_name] = (month.byType[earning.earning_name] || 0) + earning.amount;
      month.byPerson[`${earning.first_name} ${earning.last_name}`] =
        (month.byPerson[`${earning.first_name} ${earning.last_name}`] || 0) + earning.amount;
    });

  // Calculate totals for selected month or entire year
  let filteredEarnings = earnings.filter(e => e.year === selectedYear);
  if (selectedMonth) {
    filteredEarnings = filteredEarnings.filter((e) => e.month === selectedMonth);
  }

  const totalEarnings = filteredEarnings.reduce((sum, e) => sum + e.amount, 0);

  const earningsByType: Record<string, number> = {};
  filteredEarnings.forEach((e) => {
    earningsByType[e.earning_name] = (earningsByType[e.earning_name] || 0) + e.amount;
  });

  const earningsByPerson: Record<string, number> = {};
  filteredEarnings.forEach((e) => {
    const name = `${e.first_name} ${e.last_name}`;
    earningsByPerson[name] = (earningsByPerson[name] || 0) + e.amount;
  });

  if (loading) {
    return <div className="p-4 text-center text-muted-foreground">Loading earnings data...</div>;
  }

  if (rlsIssue) {
    return (
      <Alert className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/20">
        <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
        <AlertDescription className="text-yellow-800 dark:text-yellow-200">
          <strong>RLS Policy Issue:</strong> Database has 51 task_earnings records, but current RLS policy is blocking access. 
          A migration file has been created at <code className="bg-yellow-100 dark:bg-yellow-900 px-2 py-1 rounded text-sm">
            20260610_add_admin_earnings_policy.sql
          </code> to fix this. Please run this migration to allow admins to view all earnings.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="flex gap-4 items-end">
        <div>
          <label className="text-sm font-medium">Year</label>
          <Select value={String(selectedYear)} onValueChange={(val) => setSelectedYear(Number(val))}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026].map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium">Month (Optional)</label>
          <Select 
            value={selectedMonth ? String(selectedMonth) : "all"} 
            onValueChange={(val) => setSelectedMonth(val === "all" ? null : Number(val))}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Months</SelectItem>
              {months.map((month) => (
                <SelectItem key={month.value} value={String(month.value)}>
                  {month.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Total Earnings Card */}
      <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border-green-200 dark:border-green-800">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-700 dark:text-green-300 mb-1">
                {selectedMonth ? `${months[selectedMonth - 1].label} ${selectedYear}` : `Year ${selectedYear}`} - Total Earnings
              </p>
              <p className="text-4xl font-bold text-green-900 dark:text-green-100">
                ₹{totalEarnings.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                {filteredEarnings.length} transactions
              </p>
            </div>
            <Coins className="h-12 w-12 text-green-600 opacity-20" />
          </div>
        </CardContent>
      </Card>

      {/* Task Type Breakdown Cards */}
      {filteredEarnings.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {['Lesson Plan', 'ENG Training', 'Digital Training'].map((type) => {
            const amount = earningsByType[type] || 0;
            return (
              <Card key={type} className="border-l-4 border-l-blue-500">
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">{type}</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      ₹{amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {filteredEarnings.filter(e => e.earning_name === type).length} transactions
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {filteredEarnings.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            No earnings data available for the selected period
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="by-person" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="by-person">By Person</TabsTrigger>
            <TabsTrigger value="details">Details Table</TabsTrigger>
          </TabsList>

          {/* By Type */}
          <TabsContent value="by-type" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Earnings by Task Type
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(earningsByType).length === 0 ? (
                    <p className="text-muted-foreground">No earnings data available</p>
                  ) : (
                    Object.entries(earningsByType)
                      .sort((a, b) => b[1] - a[1])
                      .map(([type, amount]) => (
                        <div key={type} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <span className="font-medium capitalize">{type}</span>
                          <Badge variant="secondary">
                            ₹{amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </Badge>
                        </div>
                      ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* By Person */}
          <TabsContent value="by-person" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Earnings by Person
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(earningsByPerson).length === 0 ? (
                    <p className="text-muted-foreground">No earnings data available</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(earningsByPerson)
                          .sort((a, b) => b[1] - a[1])
                          .map(([name, amount]) => (
                            <TableRow key={name}>
                              <TableCell className="font-medium">{name}</TableCell>
                              <TableCell className="text-right">
                                ₹{amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Details Table */}
          <TabsContent value="details" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Earnings Details</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Task Type</TableHead>
                      <TableHead>Month</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEarnings.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                          No earnings data available
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredEarnings
                        .sort((a, b) => {
                          const nameA = `${a.first_name} ${a.last_name}`;
                          const nameB = `${b.first_name} ${b.last_name}`;
                          return nameA.localeCompare(nameB);
                        })
                        .map((earning, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">
                              {earning.first_name} {earning.last_name}
                            </TableCell>
                            <TableCell className="capitalize">{earning.earning_name}</TableCell>
                            <TableCell>{months[earning.month - 1].label} {earning.year}</TableCell>
                            <TableCell className="text-right font-semibold">
                              ₹{earning.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </TableCell>
                          </TableRow>
                        ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
