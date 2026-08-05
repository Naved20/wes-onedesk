import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface EmployeeBalance {
  user_id: string;
  employee_name: string;
}

interface HistoryRecord {
  month: number;
  year: number;
  casual: number;
  medical: number;
  emergency: number;
  lop: number;
  half_day: number;
  total_used: number;
}

interface ViewBalanceHistoryDialogProps {
  employee: EmployeeBalance | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ViewBalanceHistoryDialog({
  employee,
  open,
  onOpenChange,
}: ViewBalanceHistoryDialogProps) {
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && employee) {
      fetchHistory();
    }
  }, [open, employee]);

  const fetchHistory = async () => {
    if (!employee) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("leave_balances")
        .select("*")
        .eq("user_id", employee.user_id)
        .order("year", { ascending: false })
        .order("month", { ascending: false });

      if (error) throw error;

      const records = (data || []).map((record: any) => ({
        month: record.month,
        year: record.year,
        casual: Number(record.casual_leaves_used) || 0,
        medical: Number(record.medical_leaves_used) || 0,
        emergency: Number(record.emergency_leaves_used) || 0,
        lop: Number(record.lop_leaves_used) || 0,
        half_day: Number(record.half_day_leaves_used) || 0,
        total_used:
          (Number(record.casual_leaves_used) || 0) +
          (Number(record.medical_leaves_used) || 0) +
          (Number(record.emergency_leaves_used) || 0) +
          (Number(record.lop_leaves_used) || 0) +
          (Number(record.half_day_leaves_used) || 0),
      }));

      setHistory(records);
    } catch (error) {
      console.error("Error fetching history:", error);
    } finally {
      setLoading(false);
    }
  };

  const getMonthName = (month: number) => {
    return format(new Date(2024, month - 1, 1), "MMM");
  };

  if (!employee) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Leave Balance History</DialogTitle>
          <DialogDescription>
            Historical leave balance records for {employee.employee_name}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No history records found
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-center">Casual</TableHead>
                  <TableHead className="text-center">Medical</TableHead>
                  <TableHead className="text-center">Emergency</TableHead>
                  <TableHead className="text-center">LOP</TableHead>
                  <TableHead className="text-center">Half Day</TableHead>
                  <TableHead className="text-center">Total Used</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((record) => (
                  <TableRow key={`${record.year}-${record.month}`}>
                    <TableCell className="font-medium">
                      {getMonthName(record.month)} {record.year}
                    </TableCell>
                    <TableCell className="text-center">{record.casual}</TableCell>
                    <TableCell className="text-center">{record.medical}</TableCell>
                    <TableCell className="text-center">
                      {record.emergency}
                    </TableCell>
                    <TableCell className="text-center">{record.lop}</TableCell>
                    <TableCell className="text-center">
                      {record.half_day}
                    </TableCell>
                    <TableCell className="text-center font-semibold">
                      {record.total_used}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
