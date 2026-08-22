import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { format, formatDistanceToNow, isToday, isYesterday, subDays, parseISO } from "date-fns";
import { MaterialDateRangePicker } from "@/components/ui/date-range-picker";
import {
  History,
  ArrowLeft,
  Search,
  Filter,
  RefreshCw,
  Download,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  UserCheck,
  UserX,
  Smartphone,
  Monitor,
  MapPin,
  Globe,
  Clock,
  Zap,
  ChevronUp,
  ChevronDown
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface CheckinRecord {
  id: string;
  user_id: string | null;
  matched: boolean;
  match_distance: number | null;
  notes: string | null;
  created_at: string;
  attendance_id?: string | null;
  // Joined fields
  employee_name?: string;
  employee_id?: string;
  department?: string;
  profile_photo_url?: string;
  device_info?: string;
  location_address?: string;
  ip_address?: string;
}

export default function FaceCheckinHistory() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<CheckinRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "matched" | "unmatched">("all");
  const [startDateFilter, setStartDateFilter] = useState<string>("");
  const [endDateFilter, setEndDateFilter] = useState<string>("");

  // Sorting
  const [sortField, setSortField] = useState<"created_at" | "employee_name" | "match_distance">("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const fetchCheckinHistory = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      // 1. Fetch check-in history records
      const { data: rawHistory, error: historyError } = await supabase
        .from("face_checkin_history" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (historyError) throw historyError;

      const historyData = (rawHistory || []) as any[];

      // 2. Fetch employee profile details for matched user_ids
      const userIds = Array.from(new Set(historyData.map((r) => r.user_id).filter(Boolean))) as string[];

      const profileMap = new Map<string, { name: string; empId: string; dept: string; photo?: string }>();

      if (userIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from("employee_profiles")
          .select("user_id, first_name, last_name, employee_id, department, profile_photo_url")
          .in("user_id", userIds);

        if (!profilesError && profiles) {
          profiles.forEach((p) => {
            const firstName = (p.first_name || "Unknown").trim();
            const lastName = (p.last_name || "").trim();
            const fullName = `${firstName} ${lastName}`.trim() || "Unknown Employee";
            profileMap.set(p.user_id, {
              name: fullName,
              empId: p.employee_id || "N/A",
              dept: p.department || "General",
              photo: p.profile_photo_url || undefined,
            });
          });
        }
      }

      // 3. Fetch face attendance sessions to accurately match terminal device, IP & GPS per check-in timestamp
      const { data: sessions } = await supabase
        .from("face_attendance_sessions" as any)
        .select("login_time, logout_time, created_at, device_type, os_name, browser_name, location_address, ip_address")
        .order("login_time", { ascending: false });

      const allSessions = (sessions || []) as any[];

      // 4. Combine into complete record object
      const formattedRecords: CheckinRecord[] = historyData.map((row) => {
        const profile = row.user_id ? profileMap.get(row.user_id) : null;
        
        let deviceStr = "Face Hub Terminal";
        let locationAddr: string | undefined = undefined;
        let ipAddr: string | undefined = undefined;

        // A. Check if notes has embedded session details (from updated edge function)
        if (row.notes && row.notes.includes(" | ")) {
          const parts = row.notes.split(" | ");
          if (parts.length >= 2) {
            deviceStr = parts[1].replace(/\s*\[IP:[^\]]+\]/, "").replace(/\s*\([^)]*\)/, "").trim();
            const ipMatch = parts[1].match(/\[IP:\s*([^\]]+)\]/);
            if (ipMatch) {
              ipAddr = ipMatch[1];
            }
            const locMatch = parts[1].match(/\(([^)]+)\)/);
            if (locMatch) {
              locationAddr = locMatch[1];
            }
          }
        }

        // B. If not parsed from notes, match active session during check-in time
        const recTime = new Date(row.created_at).getTime();

        const matchedSession = allSessions.find((s) => {
          const loginT = new Date(s.login_time || s.created_at).getTime();
          const logoutT = s.logout_time ? new Date(s.logout_time).getTime() : Infinity;
          // Allow 5 minute window before session login time
          return (loginT - 300000) <= recTime && recTime <= logoutT;
        });

        if (matchedSession) {
          if (deviceStr === "Face Hub Terminal") {
            deviceStr = [matchedSession.os_name, matchedSession.browser_name].filter(Boolean).join(" - ") || "Face Hub Terminal";
          }
          if (!locationAddr) locationAddr = matchedSession.location_address || undefined;
          if (!ipAddr) ipAddr = matchedSession.ip_address || undefined;
        }

        return {
          id: row.id,
          user_id: row.user_id,
          matched: row.matched,
          match_distance: row.match_distance,
          notes: row.notes,
          created_at: row.created_at,
          attendance_id: row.attendance_id,
          employee_name: profile ? profile.name : row.matched ? "Employee" : "Unrecognized Face",
          employee_id: profile ? profile.empId : "-",
          department: profile ? profile.dept : "-",
          profile_photo_url: profile?.photo,
          device_info: deviceStr,
          location_address: locationAddr,
          ip_address: ipAddr,
        };
      });

      setRecords(formattedRecords);
    } catch (err: any) {
      console.error("Error loading check-in history:", err);
      toast({
        title: "Failed to load history",
        description: err.message || "Could not fetch check-in history",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCheckinHistory();

    // Realtime subscription for instant check-in updates
    const channel = supabase
      .channel("face_checkin_history_realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "face_checkin_history" },
        () => {
          fetchCheckinHistory(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Filtered and Sorted Records
  const processedRecords = useMemo(() => {
    return records
      .filter((record) => {
        // Status filter
        if (statusFilter === "matched" && !record.matched) return false;
        if (statusFilter === "unmatched" && record.matched) return false;

        // Date range filter
        if (startDateFilter) {
          const recDateStr = format(parseISO(record.created_at), "yyyy-MM-dd");
          if (recDateStr < startDateFilter) return false;
        }
        if (endDateFilter) {
          const recDateStr = format(parseISO(record.created_at), "yyyy-MM-dd");
          if (recDateStr > endDateFilter) return false;
        }

        // Search query filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const nameMatch = record.employee_name?.toLowerCase().includes(q);
          const idMatch = record.employee_id?.toLowerCase().includes(q);
          const deptMatch = record.department?.toLowerCase().includes(q);
          const notesMatch = record.notes?.toLowerCase().includes(q);
          return nameMatch || idMatch || deptMatch || notesMatch;
        }

        return true;
      })
      .sort((a, b) => {
        let modifier = sortDirection === "asc" ? 1 : -1;

        if (sortField === "created_at") {
          return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * modifier;
        }
        if (sortField === "employee_name") {
          return (a.employee_name || "").localeCompare(b.employee_name || "") * modifier;
        }
        if (sortField === "match_distance") {
          const distA = a.match_distance ?? 99;
          const distB = b.match_distance ?? 99;
          return (distA - distB) * modifier;
        }
        return 0;
      });
  }, [records, statusFilter, startDateFilter, endDateFilter, searchQuery, sortField, sortDirection]);

  // Statistics KPIs calculated dynamically from processedRecords
  const stats = useMemo(() => {
    const targetRecords = processedRecords;
    const matched = targetRecords.filter((r) => r.matched).length;
    const unmatched = targetRecords.filter((r) => !r.matched).length;
    const total = targetRecords.length;
    const successRate = total > 0 ? Math.round((matched / total) * 100) : 100;
    const isFiltered = !!(searchQuery || statusFilter !== "all" || startDateFilter || endDateFilter);

    return {
      total,
      matched,
      unmatched,
      successRate,
      totalCount: records.length,
      isFiltered,
    };
  }, [processedRecords, records.length, searchQuery, statusFilter, startDateFilter, endDateFilter]);

  // Toggle sorting
  const handleSort = (field: "created_at" | "employee_name" | "match_distance") => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (processedRecords.length === 0) {
      toast({ title: "No data to export", description: "Filter returns 0 rows." });
      return;
    }

    const headers = ["Timestamp", "Employee Name", "Employee ID", "Department", "Status", "Match Score", "Device Info", "IP Address", "Location Address", "Notes"];
    const csvRows = processedRecords.map((r) => [
      format(parseISO(r.created_at), "yyyy-MM-dd HH:mm:ss"),
      `"${r.employee_name || ""}"`,
      `"${r.employee_id || ""}"`,
      `"${r.department || ""}"`,
      r.matched ? "Matched" : "Unmatched",
      r.match_distance !== null ? r.match_distance.toFixed(4) : "N/A",
      `"${r.device_info || ""}"`,
      `"${r.ip_address || ""}"`,
      `"${r.location_address || ""}"`,
      `"${r.notes || ""}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...csvRows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `face_checkin_history_${format(new Date(), "yyyy-MM-dd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "CSV Exported",
      description: `Downloaded ${processedRecords.length} check-in logs.`,
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => navigate("/attendance")}
                title="Back to Attendance"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Face Check-in History</h1>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
                Live Audit Logs
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm pl-10">
              Detailed log of all face recognition scan attempts, device sources, and match scores.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchCheckinHistory(true)}
              disabled={refreshing}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button
              size="sm"
              onClick={() => navigate("/face-sessions")}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <ShieldCheck className="h-4 w-4" />
              Active Sessions
            </Button>
          </div>
        </div>

 

        {/* Filters & Search Controls */}
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
              {/* Search Bar */}
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by Employee Name, ID, or Notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-10"
                />
              </div>

              {/* Status & Date Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-[140px]">
                  <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="matched">Matched Only</SelectItem>
                      <SelectItem value="unmatched">Unmatched Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <MaterialDateRangePicker
                  startDate={startDateFilter}
                  endDate={endDateFilter}
                  onRangeChange={(start, end) => {
                    setStartDateFilter(start);
                    setEndDateFilter(end);
                  }}
                  placeholder="Select Date Range"
                  className="w-full sm:w-[220px]"
                />

                {(searchQuery || statusFilter !== "all" || startDateFilter || endDateFilter) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearchQuery("");
                      setStatusFilter("all");
                      setStartDateFilter("");
                      setEndDateFilter("");
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground h-10"
                  >
                    Reset Filters
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* History Data Table */}
        <Card className="shadow-sm overflow-hidden">
          <CardHeader className="p-4 border-b bg-muted/30">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Check-in Audit Logs</CardTitle>
                <CardDescription className="text-xs">
                  Showing {processedRecords.length} of {records.length} records
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {loading ? (
              <div className="py-12 text-center text-muted-foreground space-y-3">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary" />
                <p className="text-sm font-medium">Loading check-in history records...</p>
              </div>
            ) : processedRecords.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground space-y-3">
                <History className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-700" />
                <p className="text-base font-semibold text-foreground">No Check-in Logs Found</p>
                <p className="text-xs max-w-sm mx-auto">
                  No face attendance scan attempts match your current search and filter options.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead
                        className="cursor-pointer select-none hover:text-foreground transition-colors"
                        onClick={() => handleSort("employee_name")}
                      >
                        <div className="flex items-center gap-1">
                          Employee / User
                          {sortField === "employee_name" && (
                            sortDirection === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </div>
                      </TableHead>

                      <TableHead
                        className="cursor-pointer select-none hover:text-foreground transition-colors"
                        onClick={() => handleSort("created_at")}
                      >
                        <div className="flex items-center gap-1">
                          Date & Time
                          {sortField === "created_at" && (
                            sortDirection === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </div>
                      </TableHead>

                      <TableHead>Status</TableHead>

                      <TableHead
                        className="cursor-pointer select-none hover:text-foreground transition-colors"
                        onClick={() => handleSort("match_distance")}
                      >
                        <div className="flex items-center gap-1">
                          Match Score
                          {sortField === "match_distance" && (
                            sortDirection === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </div>
                      </TableHead>

                      <TableHead>Terminal & Device</TableHead>

                      <TableHead className="text-right">Notes / Log</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processedRecords.map((record) => {
                      const recordTime = parseISO(record.created_at);
                      const formattedDate = format(recordTime, "dd MMM yyyy, hh:mm:ss a");
                      const relativeTime = formatDistanceToNow(recordTime, { addSuffix: true });

                      return (
                        <TableRow key={record.id} className="hover:bg-muted/40 transition-colors">
                          {/* Employee Details */}
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs shrink-0 overflow-hidden">
                                {record.profile_photo_url ? (
                                  <img
                                    src={record.profile_photo_url}
                                    alt={record.employee_name}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  (record.employee_name || "U")[0].toUpperCase()
                                )}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-sm font-semibold truncate text-foreground">
                                  {record.employee_name}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {record.employee_id !== "-" ? `ID: ${record.employee_id}` : record.department}
                                </span>
                              </div>
                            </div>
                          </TableCell>

                          {/* Timestamp */}
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-xs font-mono font-medium">{formattedDate}</span>
                              <span className="text-[10px] text-muted-foreground">{relativeTime}</span>
                            </div>
                          </TableCell>

                          {/* Status Badge */}
                          <TableCell>
                            {record.matched ? (
                              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 gap-1 text-xs">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                Verified Match
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="gap-1 text-xs">
                                <XCircle className="h-3.5 w-3.5" />
                                Unrecognized
                              </Badge>
                            )}
                          </TableCell>

                          {/* Match Score */}
                          <TableCell>
                            {record.match_distance !== null ? (
                              <div className="flex items-center gap-1.5">
                                <Badge
                                  variant="outline"
                                  className={`font-mono text-xs ${
                                    record.match_distance <= 0.25
                                      ? "bg-emerald-100 text-emerald-800 border-emerald-300 font-bold"
                                      : record.match_distance <= 0.30
                                      ? "bg-amber-100 text-amber-800 border-amber-300 font-semibold"
                                      : "bg-red-100 text-red-800 border-red-300"
                                  }`}
                                >
                                  {record.match_distance.toFixed(3)}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground">
                                  {record.match_distance <= 0.25
                                    ? "(High match)"
                                    : record.match_distance <= 0.30
                                    ? "(Good match)"
                                    : "(Low score)"}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground font-mono">N/A</span>
                            )}
                          </TableCell>

                          {/* Device / Terminal & IP & Location */}
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                              <Smartphone className="h-3.5 w-3.5 text-primary shrink-0" />
                              <span className="truncate max-w-[180px]" title={record.device_info}>
                                {record.device_info}
                              </span>
                            </div>

                            {record.ip_address && (
                              <div className="flex items-center gap-1 text-[10px] font-mono text-slate-500 mt-0.5" title={`IP Address: ${record.ip_address}`}>
                                <Globe className="h-3 w-3 text-blue-500 shrink-0" />
                                <span>IP: {record.ip_address}</span>
                              </div>
                            )}

                            {record.location_address ? (
                              <div className="flex items-center gap-1 text-[10px] text-slate-500 truncate max-w-[200px]" title={record.location_address}>
                                <MapPin className="h-3 w-3 text-emerald-600 shrink-0" />
                                <span className="truncate">{record.location_address}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-[10px] text-slate-400">
                                <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                                <span>GPS Logged</span>
                              </div>
                            )}
                          </TableCell>

                          {/* Notes */}
                          <TableCell className="text-right text-xs text-muted-foreground max-w-[180px] truncate" title={record.notes || ""}>
                            {record.notes || "-"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
