import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Activity,
  Shield,
  Bot,
  Terminal,
  User,
  Server,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Eye,
  Calendar,
  Layers,
  Filter,
  Users,
  ChevronDown,
  X,
  Check,
  Code,
  UserCheck,
  Sparkles,
  FileText,
  Globe,
  Download,
  TrendingUp,
  AlertOctagon,
  LogIn,
  BarChart3,
  CalendarDays,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Cell,
} from "recharts";

export interface ActivityLogItem {
  id: string;
  created_at: string;
  actor_id: string | null;
  actor_type: 'user' | 'admin' | 'bot' | 'script' | 'system';
  actor_name: string | null;
  actor_email: string | null;
  module: string;
  action: string;
  description: string | null;
  metadata: Record<string, any> | null;
  status: 'success' | 'failed' | 'warning';
  ip_address: string | null;
  user_agent: string | null;
}

export interface EmployeeOption {
  id: string;
  user_id: string;
  name: string;
  email: string;
}

const BAR_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#6366f1'];

export default function ActivityLogs() {
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedActorType, setSelectedActorType] = useState<string>("all");
  const [selectedModule, setSelectedModule] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedLog, setSelectedLog] = useState<ActivityLogItem | null>(null);
  const [detailViewMode, setDetailViewMode] = useState<'admin' | 'developer'>('admin');

  // Date Range Filter States
  const [datePreset, setDatePreset] = useState<"all" | "today" | "7days" | "30days" | "custom">("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Multi-select state for employees
  const [selectedEmployeeUserIds, setSelectedEmployeeUserIds] = useState<string[]>([]);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState("");

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('activity_logs' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(400);

      if (error) {
        console.error("Error fetching logs:", error);
        toast.error("Failed to load activity logs");
      } else {
        setLogs((data as ActivityLogItem[]) || []);
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred while loading logs");
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from("employee_profiles")
        .select("id, user_id, first_name, last_name, email")
        .order("first_name", { ascending: true });

      if (!error && data) {
        const mapped = data.map((emp) => ({
          id: emp.id,
          user_id: emp.user_id,
          name: `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.email,
          email: emp.email,
        }));
        setEmployees(mapped);
      }
    } catch (err) {
      console.error("Error fetching employees:", err);
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchEmployees();
  }, []);

  // Filtered employees list for multi-select dropdown search
  const filteredEmployeeOptions = useMemo(() => {
    if (!employeeSearchQuery.trim()) return employees;
    const query = employeeSearchQuery.toLowerCase();
    return employees.filter(
      (emp) =>
        emp.name.toLowerCase().includes(query) ||
        emp.email.toLowerCase().includes(query)
    );
  }, [employees, employeeSearchQuery]);

  // Selected employee emails array for quick email matching
  const selectedEmployeeEmails = useMemo(() => {
    const emailSet = new Set<string>();
    employees.forEach((emp) => {
      if (selectedEmployeeUserIds.includes(emp.user_id)) {
        emailSet.add(emp.email.toLowerCase());
      }
    });
    return Array.from(emailSet);
  }, [employees, selectedEmployeeUserIds]);

  // Analytics Stats & Chart Data Calculation
  const analyticsStats = useMemo(() => {
    const total = logs.length;
    const todayStr = format(new Date(), "yyyy-MM-dd");

    let loginsToday = 0;
    let failedAttempts = 0;
    const uniqueActors = new Set<string>();
    const moduleCounts: Record<string, number> = {};

    logs.forEach((log) => {
      const logDateStr = format(new Date(log.created_at), "yyyy-MM-dd");

      // Logins today
      if (logDateStr === todayStr && log.module === "auth" && log.action.includes("LOGIN")) {
        loginsToday++;
      }

      // Security alerts / failures
      if (log.status === "failed" || log.status === "warning" || log.action.includes("FAILED")) {
        failedAttempts++;
      }

      // Unique actors
      if (log.actor_email) uniqueActors.add(log.actor_email);
      else if (log.actor_id) uniqueActors.add(log.actor_id);

      // Module distribution
      const mod = (log.module || "SYSTEM").toUpperCase();
      moduleCounts[mod] = (moduleCounts[mod] || 0) + 1;
    });

    const chartData = Object.entries(moduleCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    return {
      total,
      loginsToday,
      failedAttempts,
      uniqueActorsCount: uniqueActors.size,
      chartData,
    };
  }, [logs]);

  // Export Filtered Logs to CSV
  const exportToCSV = () => {
    if (filteredLogs.length === 0) {
      toast.error("No activity logs available to export");
      return;
    }

    const headers = [
      "Log ID",
      "Timestamp",
      "Actor Type",
      "Actor Name",
      "Actor Email",
      "Module",
      "Action",
      "Description",
      "Status",
      "IP Address",
      "User Agent"
    ];

    const csvRows = [
      headers.join(","),
      ...filteredLogs.map((log) => {
        const cleanField = (val: string | null | undefined) =>
          `"${(val || "").replace(/"/g, '""')}"`;

        return [
          cleanField(log.id),
          cleanField(format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss")),
          cleanField(log.actor_type),
          cleanField(log.actor_name),
          cleanField(log.actor_email),
          cleanField(log.module),
          cleanField(log.action),
          cleanField(log.description),
          cleanField(log.status),
          cleanField(log.ip_address),
          cleanField(log.user_agent),
        ].join(",");
      }),
    ];

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `activity_logs_${format(new Date(), "yyyyMMdd_HHmmss")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Successfully exported ${filteredLogs.length} activity log records!`);
  };

  // Toggle individual employee selection
  const toggleEmployeeSelection = (userId: string) => {
    setSelectedEmployeeUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  // Select all employees
  const handleSelectAllEmployees = () => {
    setSelectedEmployeeUserIds(employees.map((emp) => emp.user_id));
  };

  // Clear all employee selections
  const handleClearEmployeeSelections = () => {
    setSelectedEmployeeUserIds([]);
  };

  // Unique modules list for filter dropdown
  const modulesList = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((log) => {
      if (log.module) set.add(log.module);
    });
    return Array.from(set).sort();
  }, [logs]);

  // Filtered logs calculation
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Filter by Actor Type
      if (selectedActorType !== "all" && log.actor_type !== selectedActorType) {
        return false;
      }

      // Filter by Selected Employees (STRICTLY when Actor Type is 'user' and specific employees selected)
      if (selectedActorType === "user" && selectedEmployeeUserIds.length > 0) {
        const matchesId = log.actor_id ? selectedEmployeeUserIds.includes(log.actor_id) : false;
        const matchesEmail = log.actor_email ? selectedEmployeeEmails.includes(log.actor_email.toLowerCase()) : false;
        if (!matchesId && !matchesEmail) {
          return false;
        }
      }

      // Filter by Date Presets & Custom Range
      const logTime = new Date(log.created_at).getTime();

      if (datePreset === "today") {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        if (logTime < todayStart.getTime()) return false;
      } else if (datePreset === "7days") {
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        if (logTime < sevenDaysAgo) return false;
      } else if (datePreset === "30days") {
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        if (logTime < thirtyDaysAgo) return false;
      } else if (datePreset === "custom") {
        if (startDate) {
          const start = new Date(startDate).getTime();
          if (logTime < start) return false;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (logTime > end.getTime()) return false;
        }
      }

      // Filter by Module
      if (selectedModule !== "all" && log.module !== selectedModule) {
        return false;
      }

      // Filter by Status
      if (selectedStatus !== "all" && log.status !== selectedStatus) {
        return false;
      }

      // Search term filter
      if (searchTerm.trim() !== "") {
        const query = searchTerm.toLowerCase();
        const matchesAction = log.action.toLowerCase().includes(query);
        const matchesModule = log.module.toLowerCase().includes(query);
        const matchesDesc = (log.description || "").toLowerCase().includes(query);
        const matchesEmail = (log.actor_email || "").toLowerCase().includes(query);
        const matchesName = (log.actor_name || "").toLowerCase().includes(query);
        const matchesIp = (log.ip_address || "").toLowerCase().includes(query);
        return matchesAction || matchesModule || matchesDesc || matchesEmail || matchesName || matchesIp;
      }

      return true;
    });
  }, [logs, selectedActorType, selectedEmployeeUserIds, selectedEmployeeEmails, datePreset, startDate, endDate, selectedModule, selectedStatus, searchTerm]);

  // Actor type badge renderer
  const renderActorBadge = (type: ActivityLogItem['actor_type']) => {
    switch (type) {
      case 'admin':
        return (
          <Badge className="bg-purple-600 hover:bg-purple-700 text-white gap-1">
            <Shield className="h-3 w-3" /> Admin
          </Badge>
        );
      case 'bot':
        return (
          <Badge className="bg-amber-600 hover:bg-amber-700 text-white gap-1">
            <Bot className="h-3 w-3" /> Bot
          </Badge>
        );
      case 'script':
        return (
          <Badge className="bg-cyan-600 hover:bg-cyan-700 text-white gap-1">
            <Terminal className="h-3 w-3" /> Script
          </Badge>
        );
      case 'system':
        return (
          <Badge className="bg-slate-600 hover:bg-slate-700 text-white gap-1">
            <Server className="h-3 w-3" /> System DB
          </Badge>
        );
      case 'user':
      default:
        return (
          <Badge variant="outline" className="gap-1 border-blue-500 text-blue-600 dark:text-blue-400">
            <User className="h-3 w-3" /> User
          </Badge>
        );
    }
  };

  // Status icon badge renderer
  const renderStatusBadge = (status: ActivityLogItem['status']) => {
    switch (status) {
      case 'success':
        return (
          <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 gap-1">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Success
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="secondary" className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 gap-1">
            <XCircle className="h-3 w-3 text-rose-500" /> Failed
          </Badge>
        );
      case 'warning':
        return (
          <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 gap-1">
            <AlertTriangle className="h-3 w-3 text-amber-500" /> Warning
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Human-friendly metadata renderer for Admin View
  const renderAdminMetadataView = (metadata: Record<string, any> | null) => {
    if (!metadata || Object.keys(metadata).length === 0) {
      return (
        <div className="p-4 text-center text-xs text-muted-foreground border rounded-lg bg-muted/20">
          No extra details attached.
        </div>
      );
    }

    const newData = metadata.new_data || (!metadata.old_data && !metadata.new_data ? metadata : null);
    const oldData = metadata.old_data || null;

    if (oldData && newData) {
      // Comparison / Diff Table for DB Update
      const keys = Array.from(new Set([...Object.keys(newData), ...Object.keys(oldData)]));
      const displayKeys = keys.filter(
        (k) => !['updated_at', 'created_at', 'id', 'user_id', 'actor_id'].includes(k)
      );

      return (
        <div className="border rounded-lg overflow-hidden text-xs bg-card shadow-sm">
          <div className="bg-muted/80 p-2.5 font-semibold text-foreground border-b grid grid-cols-3 gap-2">
            <span>Field Name</span>
            <span className="text-rose-600 dark:text-rose-400">Previous Value</span>
            <span className="text-emerald-600 dark:text-emerald-400">Updated Value</span>
          </div>
          <div className="divide-y max-h-[280px] overflow-y-auto">
            {displayKeys.map((key) => {
              const oldVal = oldData[key];
              const newVal = newData[key];
              const isChanged = JSON.stringify(oldVal) !== JSON.stringify(newVal);

              return (
                <div
                  key={key}
                  className={`p-2.5 grid grid-cols-3 gap-2 items-center transition-colors ${
                    isChanged ? 'bg-amber-500/10 dark:bg-amber-950/20' : 'hover:bg-muted/30'
                  }`}
                >
                  <span className="font-semibold text-foreground capitalize">
                    {key.replace(/_/g, ' ')}
                  </span>
                  <span className="text-muted-foreground font-mono text-[11px] truncate pr-2">
                    {oldVal === null || oldVal === undefined ? '—' : String(oldVal)}
                  </span>
                  <span
                    className={`font-mono text-[11px] truncate ${
                      isChanged
                        ? 'font-bold text-emerald-600 dark:text-emerald-400'
                        : 'text-foreground'
                    }`}
                  >
                    {newVal === null || newVal === undefined ? '—' : String(newVal)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (newData) {
      // Grid of Key-Value cards
      const keys = Object.keys(newData).filter(
        (k) => !['updated_at', 'created_at', 'id', 'user_id', 'actor_id'].includes(k)
      );
      const displayKeys = keys.length > 0 ? keys : Object.keys(newData);

      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border rounded-lg p-3 bg-muted/20">
          {displayKeys.map((key) => {
            const val = newData[key];
            return (
              <div key={key} className="p-2.5 bg-card border rounded-md shadow-2xs flex flex-col gap-0.5">
                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                  {key.replace(/_/g, ' ')}
                </span>
                <span className="font-medium text-foreground text-xs break-all">
                  {val === null || val === undefined
                    ? '—'
                    : typeof val === 'boolean'
                    ? val
                      ? 'Yes'
                      : 'No'
                    : typeof val === 'object'
                    ? JSON.stringify(val)
                    : String(val)}
                </span>
              </div>
            );
          })}
        </div>
      );
    }

    return (
      <pre className="p-3 bg-slate-950 text-slate-100 rounded-lg text-xs font-mono overflow-x-auto max-h-[250px]">
        {JSON.stringify(metadata, null, 2)}
      </pre>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Activity className="h-6 w-6" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">System Activity & Audit Logs</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Real-time audit trail of all actions performed by Users, Admins, Bots, Automated Scripts, and System Triggers.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start md:self-auto">
            <Button
              variant="outline"
              onClick={exportToCSV}
              className="gap-2 border-primary/20 text-primary hover:bg-primary/10"
            >
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            <Button onClick={fetchLogs} disabled={loading} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh Logs
            </Button>
          </div>
        </div>

        {/* Security Anomaly Alert Banner (If failed attempts detected) */}
        {analyticsStats.failedAttempts > 0 && (
          <div className="p-3.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3 text-xs shadow-xs">
            <div className="flex items-center gap-2.5">
              <AlertOctagon className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <div>
                <span className="font-bold text-amber-700 dark:text-amber-300">
                  Security Alert: {analyticsStats.failedAttempts} Warning / Failed Attempt(s) Detected
                </span>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Some login or operational attempts were flagged. Filter by "Status = Failed" to investigate details.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs border-amber-500/40 hover:bg-amber-500/20 text-amber-800 dark:text-amber-200"
              onClick={() => setSelectedStatus("failed")}
            >
              Inspect Failed Logs
            </Button>
          </div>
        )}

        {/* Analytics Summary Cards & Module Activity Chart */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-border/60 shadow-xs">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs flex items-center justify-between">
                Total Logs <TrendingUp className="h-4 w-4 text-blue-500" />
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {analyticsStats.total}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-[11px] text-muted-foreground">
              Total system events tracked
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-xs">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs flex items-center justify-between">
                Logins Today <LogIn className="h-4 w-4 text-emerald-500" />
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {analyticsStats.loginsToday}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-[11px] text-muted-foreground">
              Successful auth sessions today
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-xs">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs flex items-center justify-between">
                Security Alerts <AlertOctagon className="h-4 w-4 text-rose-500" />
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                {analyticsStats.failedAttempts}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-[11px] text-muted-foreground">
              Failed logins / warning logs
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-xs">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs flex items-center justify-between">
                Active Actors <Users className="h-4 w-4 text-purple-500" />
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {analyticsStats.uniqueActorsCount}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-[11px] text-muted-foreground">
              Unique active users / bots
            </CardContent>
          </Card>
        </div>

        {/* Module Distribution Mini Chart */}
        {analyticsStats.chartData.length > 0 && (
          <Card className="border-border/60 shadow-xs">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" /> Activity Distribution by Module
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[140px] pt-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analyticsStats.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#888888" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#888888" />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: "#090d16", borderRadius: "6px", border: "1px solid #1e293b", color: "#fff", fontSize: "12px" }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {analyticsStats.chartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Filters Card */}
        <Card className="border-border/60 shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Filter className="h-4 w-4 text-primary" /> Filter Activity Logs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Top Controls Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search actions, emails, IPs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Actor Type Filter */}
              <Select value={selectedActorType} onValueChange={(val) => {
                setSelectedActorType(val);
                if (val !== 'user') {
                  setSelectedEmployeeUserIds([]);
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Actor Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actors (Users, Bots, Scripts)</SelectItem>
                  <SelectItem value="user">Users (Employees)</SelectItem>
                  <SelectItem value="admin">Admins</SelectItem>
                  <SelectItem value="bot">Bots</SelectItem>
                  <SelectItem value="script">Scripts / Cron Jobs</SelectItem>
                  <SelectItem value="system">System Database Triggers</SelectItem>
                </SelectContent>
              </Select>

              {/* Module Filter */}
              <Select value={selectedModule} onValueChange={setSelectedModule}>
                <SelectTrigger>
                  <SelectValue placeholder="All Modules" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Modules</SelectItem>
                  {modulesList.map((mod) => (
                    <SelectItem key={mod} value={mod}>
                      {mod}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Status Filter */}
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Range Material Pill Style Filters */}
            <div className="pt-3 border-t flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-muted-foreground flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5 text-primary" /> Date Filter:
                </span>
                
                {/* Pill Presets */}
                <div className="flex items-center bg-muted/40 p-1 rounded-full border gap-1">
                  <button
                    type="button"
                    onClick={() => setDatePreset("all")}
                    className={`h-7 text-xs px-3 rounded-full font-medium transition-all ${
                      datePreset === "all"
                        ? "bg-primary text-primary-foreground shadow-2xs font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    All Time
                  </button>
                  <button
                    type="button"
                    onClick={() => setDatePreset("today")}
                    className={`h-7 text-xs px-3 rounded-full font-medium transition-all ${
                      datePreset === "today"
                        ? "bg-primary text-primary-foreground shadow-2xs font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => setDatePreset("7days")}
                    className={`h-7 text-xs px-3 rounded-full font-medium transition-all ${
                      datePreset === "7days"
                        ? "bg-primary text-primary-foreground shadow-2xs font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    Last 7 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => setDatePreset("30days")}
                    className={`h-7 text-xs px-3 rounded-full font-medium transition-all ${
                      datePreset === "30days"
                        ? "bg-primary text-primary-foreground shadow-2xs font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    Last 30 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => setDatePreset("custom")}
                    className={`h-7 text-xs px-3 rounded-full font-medium transition-all ${
                      datePreset === "custom"
                        ? "bg-primary text-primary-foreground shadow-2xs font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    Custom
                  </button>
                </div>
              </div>

              {/* Custom Date Inputs in Material Pill Style: [ dd / mm / yyyy 📅 ] to [ dd / mm / yyyy 📅 ] */}
              {datePreset === "custom" ? (
                <div className="flex items-center gap-2 animate-in fade-in">
                  <div className="relative flex items-center">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="h-8 rounded-full border border-input bg-card px-4 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-2xs cursor-pointer"
                    />
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground px-1">to</span>
                  <div className="relative flex items-center">
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="h-8 rounded-full border border-input bg-card px-4 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-2xs cursor-pointer"
                    />
                  </div>
                  {(startDate || endDate) && (
                    <button
                      type="button"
                      onClick={() => {
                        setStartDate("");
                        setEndDate("");
                      }}
                      className="h-7 w-7 rounded-full bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 flex items-center justify-center transition-colors"
                      title="Clear Custom Range"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ) : (
                /* Collapsed Pill Button: [ 📅 Select Date Range  > ] */
                <button
                  type="button"
                  onClick={() => setDatePreset("custom")}
                  className="h-8 px-4 rounded-full border border-input bg-muted/40 hover:bg-muted text-xs font-medium text-muted-foreground flex items-center gap-2 shadow-2xs transition-colors"
                >
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                  <span>
                    {datePreset === "today"
                      ? "Today"
                      : datePreset === "7days"
                      ? "Last 7 Days"
                      : datePreset === "30days"
                      ? "Last 30 Days"
                      : "Select Date Range"}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-1 opacity-70" />
                </button>
              )}
            </div>

            {/* Dynamic Multi-Select Employee Filter (STRICTLY shown ONLY when Actor Type is 'user') */}
            {selectedActorType === 'user' && (
              <div className="pt-2 border-t flex flex-wrap items-center gap-3">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <Users className="h-3.5 w-3.5 text-primary" /> Filter Employees:
                </span>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 justify-between min-w-[240px] text-xs">
                      <div className="flex items-center gap-2 truncate">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        {selectedEmployeeUserIds.length === 0 ? (
                          <span className="font-normal text-muted-foreground">All Employees ({employees.length})</span>
                        ) : selectedEmployeeUserIds.length === 1 ? (
                          <span className="font-medium text-foreground">
                            {employees.find((e) => e.user_id === selectedEmployeeUserIds[0])?.name || "1 Employee Selected"}
                          </span>
                        ) : (
                          <span className="font-semibold text-primary">
                            {selectedEmployeeUserIds.length} Employees Selected
                          </span>
                        )}
                      </div>
                      <ChevronDown className="h-3.5 w-3.5 opacity-50 ml-2" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[320px] p-3 shadow-lg" align="start">
                    <div className="space-y-3">
                      {/* Search employee input inside popover */}
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          placeholder="Search employee name or email..."
                          value={employeeSearchQuery}
                          onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                          className="h-8 pl-8 text-xs"
                        />
                      </div>

                      {/* Quick Select All / Clear buttons */}
                      <div className="flex items-center justify-between text-xs px-1">
                        <button
                          type="button"
                          onClick={handleSelectAllEmployees}
                          className="text-primary hover:underline font-medium text-[11px]"
                        >
                          Select All ({employees.length})
                        </button>
                        {selectedEmployeeUserIds.length > 0 && (
                          <button
                            type="button"
                            onClick={handleClearEmployeeSelections}
                            className="text-rose-500 hover:underline font-medium text-[11px] flex items-center gap-0.5"
                          >
                            <X className="h-3 w-3" /> Clear Selection
                          </button>
                        )}
                      </div>

                      {/* Employee List with Checkboxes */}
                      <div className="max-h-[220px] overflow-y-auto space-y-1 pr-1 border-t pt-2">
                        {filteredEmployeeOptions.length === 0 ? (
                          <p className="text-xs text-center py-4 text-muted-foreground">No employees found.</p>
                        ) : (
                          filteredEmployeeOptions.map((emp) => {
                            const isChecked = selectedEmployeeUserIds.includes(emp.user_id);
                            return (
                              <label
                                key={emp.id}
                                className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors text-xs ${
                                  isChecked ? "bg-primary/10 font-medium" : "hover:bg-muted/50"
                                }`}
                              >
                                <div className="flex items-center gap-2 overflow-hidden">
                                  <Checkbox
                                    checked={isChecked}
                                    onCheckedChange={() => toggleEmployeeSelection(emp.user_id)}
                                  />
                                  <div className="flex flex-col overflow-hidden">
                                    <span className="truncate text-foreground font-medium">{emp.name}</span>
                                    <span className="text-[10px] text-muted-foreground truncate">{emp.email}</span>
                                  </div>
                                </div>
                                {isChecked && <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-1" />}
                              </label>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Selected Employee Badges */}
                {selectedEmployeeUserIds.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {selectedEmployeeUserIds.slice(0, 3).map((userId) => {
                      const emp = employees.find((e) => e.user_id === userId);
                      if (!emp) return null;
                      return (
                        <Badge
                          key={userId}
                          variant="secondary"
                          className="bg-primary/10 text-primary border-primary/20 text-[11px] gap-1 pr-1"
                        >
                          {emp.name}
                          <X
                            className="h-3 w-3 cursor-pointer hover:text-rose-600"
                            onClick={() => toggleEmployeeSelection(userId)}
                          />
                        </Badge>
                      );
                    })}
                    {selectedEmployeeUserIds.length > 3 && (
                      <Badge variant="outline" className="text-[11px]">
                        +{selectedEmployeeUserIds.length - 3} more
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearEmployeeSelections}
                      className="h-6 px-2 text-[11px] text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                    >
                      Clear
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Logs Table Card */}
        <Card className="border-border/60 shadow-xs overflow-hidden">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" /> Activity Records ({filteredLogs.length})
              </CardTitle>
              <CardDescription>
                Showing latest logs matching your selected filters.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-[180px]">Timestamp</TableHead>
                    <TableHead className="w-[130px]">Actor Type</TableHead>
                    <TableHead>Actor / Initiator</TableHead>
                    <TableHead className="w-[120px]">Module</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="text-right w-[80px]">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                          <span>Loading activity logs...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                        No activity logs found matching the filter criteria.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLogs.map((log) => (
                      <TableRow key={log.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="text-xs text-muted-foreground font-mono">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground/70" />
                            {format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss")}
                          </div>
                        </TableCell>
                        <TableCell>{renderActorBadge(log.actor_type)}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-foreground">
                              {log.actor_name || log.actor_email || log.actor_type.toUpperCase()}
                            </span>
                            {log.actor_email && (
                              <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                                {log.actor_email}
                              </span>
                            )}
                            {log.ip_address && (
                              <span className="text-[10px] font-mono text-primary flex items-center gap-0.5 mt-0.5">
                                <Globe className="h-2.5 w-2.5" /> {log.ip_address}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-[11px] uppercase">
                            {log.module}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-xs font-medium text-foreground">{log.action}</span>
                            {log.description && (
                              <span className="text-[11px] text-muted-foreground line-clamp-1">
                                {log.description}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{renderStatusBadge(log.status)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setSelectedLog(log)}
                            title="View Metadata Details"
                          >
                            <Eye className="h-4 w-4 text-muted-foreground hover:text-primary" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Metadata Inspection Dialog */}
        <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-6">
                <div>
                  <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
                    <Activity className="h-5 w-5 text-primary" /> Log Entry Details
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    Full execution payload and environmental metadata.
                  </DialogDescription>
                </div>

                {/* View Mode Toggle: Admin View (Default) vs Developer View */}
                <div className="flex items-center bg-muted/80 p-1 rounded-lg self-start sm:self-auto border">
                  <Button
                    type="button"
                    variant={detailViewMode === 'admin' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-7 text-[11px] px-2.5 gap-1.5 font-medium"
                    onClick={() => setDetailViewMode('admin')}
                  >
                    <UserCheck className="h-3.5 w-3.5" /> Admin View
                  </Button>
                  <Button
                    type="button"
                    variant={detailViewMode === 'developer' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-7 text-[11px] px-2.5 gap-1.5 font-medium"
                    onClick={() => setDetailViewMode('developer')}
                  >
                    <Code className="h-3.5 w-3.5" /> Developer View
                  </Button>
                </div>
              </div>
            </DialogHeader>
            {selectedLog && (
              <div className="space-y-4 text-sm pt-2">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-muted/40 rounded-lg text-xs">
                  <div>
                    <span className="text-muted-foreground block">Log ID:</span>
                    <span className="font-mono text-[11px] truncate block">{selectedLog.id}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Timestamp:</span>
                    <span className="font-mono text-[11px]">{format(new Date(selectedLog.created_at), "yyyy-MM-dd HH:mm:ss")}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Globe className="h-3.5 w-3.5 text-primary" /> IP Address:
                    </span>
                    <span className="font-mono font-bold text-primary text-xs">
                      {selectedLog.ip_address || (selectedLog.metadata?.ip ? String(selectedLog.metadata.ip) : "Network IP")}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Actor Type:</span>
                    <span className="font-semibold uppercase">{selectedLog.actor_type}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Actor Email:</span>
                    <span className="font-medium truncate block">{selectedLog.actor_email || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Module / Action:</span>
                    <span className="font-mono font-bold text-foreground">{selectedLog.module} / {selectedLog.action}</span>
                  </div>
                </div>

                {selectedLog.description && (
                  <div>
                    <span className="text-xs font-semibold text-muted-foreground block mb-1">Description</span>
                    <p className="p-2.5 bg-card border rounded-md text-xs text-foreground font-medium">{selectedLog.description}</p>
                  </div>
                )}

                {/* View Container */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                      {detailViewMode === 'admin' ? (
                        <>
                          <Sparkles className="h-3.5 w-3.5 text-primary" /> Log Details & Field Changes (Admin View)
                        </>
                      ) : (
                        <>
                          <Code className="h-3.5 w-3.5 text-primary" /> Raw JSON Payload (Developer View)
                        </>
                      )}
                    </span>
                    <span className="text-[10px] text-muted-foreground italic">
                      {detailViewMode === 'admin' ? 'Normal readable view' : 'Raw metadata code view'}
                    </span>
                  </div>

                  {detailViewMode === 'admin' ? (
                    renderAdminMetadataView(selectedLog.metadata)
                  ) : (
                    <pre className="p-3 bg-slate-950 text-slate-100 rounded-lg text-xs font-mono overflow-x-auto max-h-[300px]">
                      {selectedLog.metadata
                        ? JSON.stringify(selectedLog.metadata, null, 2)
                        : "// No extra payload metadata attached"}
                    </pre>
                  )}
                </div>

                {selectedLog.user_agent && (
                  <div>
                    <span className="text-xs font-semibold text-muted-foreground block mb-1">User Agent / Execution Env</span>
                    <p className="p-2 bg-muted/30 border rounded text-[11px] font-mono text-muted-foreground break-all">
                      {selectedLog.user_agent}
                    </p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
