import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, RefreshCw, KeyRound, Copy, Check } from "lucide-react";
import { getCurrentFaceOtp, generateNewFaceOtp, FaceOtpInfo } from "@/lib/faceOtpManager";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export function FaceHubOtpCard() {
  const [otpInfo, setOtpInfo] = useState<FaceOtpInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const fetchOtp = async () => {
    try {
      const data = await getCurrentFaceOtp();
      setOtpInfo(data);
    } catch (err) {
      console.error("Error loading OTP:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleManualRefresh = async () => {
    setLoading(true);
    try {
      const data = await generateNewFaceOtp();
      setOtpInfo(data);
      toast({
        title: "New OTP Generated",
        description: `New Face Hub OTP code generated: ${data.code}`,
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
    toast({ title: "OTP Copied", description: `${otpInfo.code} copied to clipboard!` });
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    fetchOtp();

    // Live 1-second countdown tick
    const timer = setInterval(() => {
      setOtpInfo((prev) => {
        if (!prev) return null;
        if (prev.secondsRemaining <= 1) {
          // Time expired, auto-generate fresh OTP
          fetchOtp();
          return prev;
        }
        return {
          ...prev,
          secondsRemaining: prev.secondsRemaining - 1,
        };
      });
    }, 1000);

    // Supabase Realtime Listener for instant OTP sync across all admin tabs
    const channel = supabase
      .channel("face_hub_otp_realtime")
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

  const progressPercent = otpInfo ? (otpInfo.secondsRemaining / 60) * 100 : 0;

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 text-white shadow-xl overflow-hidden relative">
      <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
        <ShieldCheck className="h-40 w-40 text-primary" />
      </div>

      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/20 text-primary border border-primary/30">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                Face Hub Security OTP
                <Badge variant="outline" className="bg-primary/20 text-primary border-primary/40 text-xs">
                  Rotates Every 60s
                </Badge>
              </CardTitle>
              <CardDescription className="text-slate-300 text-xs mt-0.5">
                Required for logging into Face Attendance Hub devices. Share this live 6-digit code with authorized devices.
              </CardDescription>
            </div>
          </div>

          <Button
            onClick={handleManualRefresh}
            variant="outline"
            size="sm"
            disabled={loading}
            className="bg-slate-800/80 text-slate-200 border-slate-700 hover:bg-slate-700 hover:text-white shrink-0"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "" : ""}`} />
            Regenerate OTP
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 backdrop-blur-sm">
          {/* OTP Code Display */}
          <div className="flex items-center gap-2 sm:gap-3 font-mono">
            {loading || !otpInfo ? (
              <div className="text-2xl font-bold tracking-widest text-slate-500 animate-pulse">
                • • • • • •
              </div>
            ) : (
              <div className="flex items-center gap-1.5 sm:gap-2">
                {otpInfo.code.split("").map((digit, idx) => (
                  <span
                    key={idx}
                    className="w-10 h-12 sm:w-12 sm:h-14 rounded-xl bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700/80 flex items-center justify-center text-2xl sm:text-3xl font-extrabold text-primary shadow-inner tracking-tight"
                  >
                    {digit}
                  </span>
                ))}
              </div>
            )}

            <Button
              onClick={handleCopy}
              disabled={!otpInfo}
              variant="ghost"
              size="icon"
              className="text-slate-400 hover:text-white hover:bg-slate-800 ml-2"
              title="Copy OTP"
            >
              {copied ? <Check className="h-5 w-5 text-green-400" /> : <Copy className="h-5 w-5" />}
            </Button>
          </div>

          {/* Countdown timer & Progress Bar */}
          <div className="w-full sm:w-auto flex flex-col items-end gap-1.5 min-w-[160px]">
            <div className="flex items-center justify-between w-full text-xs font-semibold">
              <span className="text-slate-400">Validity:</span>
              <span className={otpInfo && otpInfo.secondsRemaining <= 10 ? "text-amber-400 font-bold animate-pulse" : "text-emerald-400 font-bold"}>
                {otpInfo ? `${otpInfo.secondsRemaining} sec remaining` : "Loading..."}
              </span>
            </div>

            <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden border border-slate-700/60">
              <div
                className={`h-full transition-all duration-1000 rounded-full ${
                  otpInfo && otpInfo.secondsRemaining <= 10
                    ? "bg-amber-500"
                    : "bg-gradient-to-r from-emerald-500 to-primary"
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
