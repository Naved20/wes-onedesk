import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface OperationStep {
  step: string;
  status: 'pending' | 'success' | 'error' | 'warning';
  message?: string;
  error?: string;
  details?: string[];
}

interface TaskOperationStatusModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operationType: 'create' | 'edit';
  steps: OperationStep[];
  isProcessing: boolean;
}

export const TaskOperationStatusModal = ({
  open,
  onOpenChange,
  operationType,
  steps,
  isProcessing
}: TaskOperationStatusModalProps) => {
  const hasErrors = steps.some(s => s.status === 'error');
  const hasWarnings = steps.some(s => s.status === 'warning');
  const allSuccess = steps.length > 0 && steps.every(s => s.status === 'success');

  const getStatusIcon = (status: OperationStep['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      case 'pending':
        return <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />;
    }
  };

  const getStatusBadge = (status: OperationStep['status']) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-600">Success</Badge>;
      case 'error':
        return <Badge variant="destructive">Failed</Badge>;
      case 'warning':
        return <Badge variant="outline" className="border-yellow-600 text-yellow-600">Warning</Badge>;
      case 'pending':
        return <Badge variant="outline" className="border-blue-600 text-blue-600">Processing...</Badge>;
    }
  };

  const getOverallStatus = () => {
    if (isProcessing) return { title: "Processing...", color: "text-blue-600" };
    if (hasErrors) return { title: "Operation Failed", color: "text-red-600" };
    if (hasWarnings) return { title: "Completed with Warnings", color: "text-yellow-600" };
    if (allSuccess) return { title: "Operation Successful", color: "text-green-600" };
    return { title: "Operation Status", color: "text-gray-600" };
  };

  const overallStatus = getOverallStatus();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className={`text-xl font-bold ${overallStatus.color}`}>
            {overallStatus.title}
          </DialogTitle>
          <DialogDescription>
            {operationType === 'create' ? 'Task Creation' : 'Task Update'} - Detailed Status Report
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[500px] pr-4">
          <div className="space-y-4 py-4">
            {steps.map((step, index) => (
              <div
                key={index}
                className={`border rounded-lg p-4 ${
                  step.status === 'error' ? 'border-red-300 bg-red-50' :
                  step.status === 'warning' ? 'border-yellow-300 bg-yellow-50' :
                  step.status === 'success' ? 'border-green-300 bg-green-50' :
                  'border-blue-300 bg-blue-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {getStatusIcon(step.status)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-sm">{step.step}</h4>
                      {getStatusBadge(step.status)}
                    </div>
                    
                    {step.message && (
                      <p className="text-sm text-gray-700 mb-2">{step.message}</p>
                    )}
                    
                    {step.error && (
                      <div className="mt-2 p-2 bg-red-100 border border-red-200 rounded text-xs">
                        <p className="font-semibold text-red-800 mb-1">Error Details:</p>
                        <p className="text-red-700 font-mono whitespace-pre-wrap">{step.error}</p>
                      </div>
                    )}
                    
                    {step.details && step.details.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {step.details.map((detail, i) => (
                          <div key={i} className="text-xs text-gray-600 pl-4 border-l-2 border-gray-300">
                            {detail}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {steps.length === 0 && !isProcessing && (
              <div className="text-center text-gray-500 py-8">
                No operation steps recorded
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
            variant={hasErrors ? "destructive" : "default"}
          >
            {isProcessing ? "Processing..." : "Close"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
