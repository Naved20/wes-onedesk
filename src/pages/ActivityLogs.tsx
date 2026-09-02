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
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

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
  user_agent: string | null;
}

export interface EmployeeOption {
  id: string;
  user_id: string;
  name: string;
  email: string;
}

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
        .limit(300);

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

  // Filtered employees list for the multi-select dropdown search
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
        return matchesAction || matchesModule || matchesDesc || matchesEmail || matchesName;
      }

      return true;
    });
  }, [logs, selectedActorType, selectedEmployeeUserIds, selectedEmployeeEmails, selectedModule, selectedStatus, searchTerm]);

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
          <Button onClick={fetchLogs} disabled={loading} className="gap-2 self-start md:self-auto">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh Logs
          </Button>
        </div>

        {/* Filters Card */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Filter className="h-4 w-4 text-primary" /> Filter Activity Logs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search actions, emails, text..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Actor Type Filter */}
              <Select value={selectedActorType} onValueChange={(val) => {
                setSelectedActorType(val);
                // Clear employee selection if switching away from 'user'
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
        <Card className="border-border/60 shadow-sm overflow-hidden">
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
                <div className="grid grid-cols-2 gap-3 p-3 bg-muted/40 rounded-lg text-xs">
                  <div>
                    <span className="text-muted-foreground block">Log ID:</span>
                    <span className="font-mono">{selectedLog.id}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Timestamp:</span>
                    <span className="font-mono">{format(new Date(selectedLog.created_at), "yyyy-MM-dd HH:mm:ss (xxx)")}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Actor Type:</span>
                    <span className="font-semibold uppercase">{selectedLog.actor_type}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Actor Email:</span>
                    <span className="font-medium">{selectedLog.actor_email || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Module:</span>
                    <span className="font-mono">{selectedLog.module}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Action:</span>
                    <span className="font-mono font-bold text-primary">{selectedLog.action}</span>
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
