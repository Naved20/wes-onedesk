import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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

export default function ActivityLogs() {
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedActorType, setSelectedActorType] = useState<string>("all");
  const [selectedModule, setSelectedModule] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedLog, setSelectedLog] = useState<ActivityLogItem | null>(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('activity_logs' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

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

  useEffect(() => {
    fetchLogs();
  }, []);

  // Unique modules list for filter dropdown
  const modulesList = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((log) => {
      if (log.module) set.add(log.module);
    });
    return Array.from(set).sort();
  }, [logs]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Filter by Actor Type
      if (selectedActorType !== "all" && log.actor_type !== selectedActorType) {
        return false;
      }
      // Filter by Module
      if (selectedModule !== "all" && log.module !== selectedModule) {
        return false;
      }
      // Filter by Status
      if (selectedStatus !== "all" && log.status !== selectedStatus) {
        return false;
      }
      // Search term
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
  }, [logs, selectedActorType, selectedModule, selectedStatus, searchTerm]);

  // Actor type badge renderer
  const renderActorBadge = (type: ActivityLogItem['actor_type'], email?: string | null) => {
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
          <CardContent>
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
              <Select value={selectedActorType} onValueChange={setSelectedActorType}>
                <SelectTrigger>
                  <SelectValue placeholder="Actor Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actors (Users, Bots, Scripts)</SelectItem>
                  <SelectItem value="user">Users</SelectItem>
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
              <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
                <Activity className="h-5 w-5 text-primary" /> Log Entry Details
              </DialogTitle>
              <DialogDescription>
                Full execution payload and environmental metadata.
              </DialogDescription>
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
                    <p className="p-2 bg-card border rounded text-xs text-foreground">{selectedLog.description}</p>
                  </div>
                )}

                {selectedLog.user_agent && (
                  <div>
                    <span className="text-xs font-semibold text-muted-foreground block mb-1">User Agent / Execution Env</span>
                    <p className="p-2 bg-muted/30 border rounded text-[11px] font-mono text-muted-foreground break-all">
                      {selectedLog.user_agent}
                    </p>
                  </div>
                )}

                <div>
                  <span className="text-xs font-semibold text-muted-foreground block mb-1">Payload / JSON Metadata</span>
                  <pre className="p-3 bg-slate-950 text-slate-100 rounded-lg text-xs font-mono overflow-x-auto max-h-[300px]">
                    {selectedLog.metadata
                      ? JSON.stringify(selectedLog.metadata, null, 2)
                      : "// No extra payload metadata attached"}
                  </pre>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
