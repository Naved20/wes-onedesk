import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KeyRound, RefreshCw, Copy, Check, Zap } from "lucide-react";
import { getCurrentFaceOtp, generateNewFaceOtp, FaceOtpInfo } from "@/lib/faceOtpManager";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export function FaceHubOtpCompact() {
  const [otpInfo, setOtpInfo] = useState<FaceOtpInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchOtp = async () => {
    try {
      const data = await getCurrentFaceOtp(false);
      setOtpInfo(data);
    } catch (err) {
      console.error("Error loading OTP:", err);
    }
  };

  const handleGenerateNew = async () => {
    setLoading(true);
    try {
      const data = await generateNewFaceOtp();
      setOtpInfo(data);
      toast({
        title: "New OTP Generated",
        description: `Face Hub OTP: ${data.code} (valid 60 seconds)`,
      });
    } catch (err) {
      console.error("Error generating new OTP:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!otpInfo) return;
    navigator.clipboard.writeText(otpInfo.code);
    setCopied(true);
    toast({ title: "OTP Copied", description: `${otpInfo.code} copied!` });
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    fetchOtp();

    // 1-second countdown timer for active OTP
    const timer = setInterval(() => {
      setOtpInfo((prev) => {
        if (!prev) return null;
        if (prev.secondsRemaining <= 1) {
          return null; // Expired, do NOT auto-generate endlessly
        }
        return {
          ...prev,
          secondsRemaining: prev.secondsRemaining - 1,
        };
      });
    }, 1000);

    // Supabase Realtime subscription
    const channel = supabase
      .channel("face_hub_otp_compact_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "face_hub_otp" },
        () => {
          fetchOtp();
        }
      )
      .subscribe();

    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="inline-flex items-center gap-2 bg-slate-900 text-white rounded-full p-1.5 pl-3 border border-slate-700 shadow-sm text-xs sm:text-sm">
      <KeyRound className="h-4 w-4 text-primary shrink-0" />
      <span className="font-semibold text-slate-300 hidden sm:inline">OTP:</span>

      {otpInfo && otpInfo.secondsRemaining > 0 ? (
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold tracking-wider text-primary text-sm sm:text-base">
            {otpInfo.code}
          </span>
          <Badge
            variant="outline"
            className={`text-[10px] sm:text-xs font-mono px-1.5 py-0.5 border ${
              otpInfo.secondsRemaining <= 10
                ? "bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse"
                : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
            }`}
          >
            {otpInfo.secondsRemaining}s
          </Badge>

          <Button
            onClick={handleCopy}
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-slate-400 hover:text-white hover:bg-slate-800"
            title="Copy OTP"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>

          <Button
            onClick={handleGenerateNew}
            disabled={loading}
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-slate-400 hover:text-white hover:bg-slate-800"
            title="Regenerate OTP"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-xs italic">No active OTP</span>
          <Button
            onClick={handleGenerateNew}
            disabled={loading}
            size="sm"
            className="h-7 text-xs px-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-full"
          >
            <Zap className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`} />
            Generate OTP
          </Button>
        </div>
      )}
    </div>
  );
}
