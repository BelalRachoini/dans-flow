import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, Smartphone, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface SwishPaymentStatusProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentRequestId: string;
  paymentRequestToken?: string;
  onSuccess: () => void;
}

export function SwishPaymentStatus({
  open,
  onOpenChange,
  paymentRequestId,
  paymentRequestToken,
  onSuccess,
}: SwishPaymentStatusProps) {
  const [status, setStatus] = useState<"polling" | "paid" | "failed" | "timeout">("polling");
  const [elapsed, setElapsed] = useState(0);

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const TIMEOUT_SEC = 300; // 5 minutes

  const checkStatus = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("swish_payments")
        .select("status")
        .eq("payment_request_id", paymentRequestId)
        .single();

      if (error) return;

      if (data?.status === "PAID") {
        setStatus("paid");
      } else if (["DECLINED", "ERROR", "CANCELLED"].includes(data?.status)) {
        setStatus("failed");
      }
    } catch {
      // Ignore polling errors
    }
  }, [paymentRequestId]);

  useEffect(() => {
    if (!open || status !== "polling") return;

    const interval = setInterval(() => {
      setElapsed((prev) => {
        if (prev >= TIMEOUT_SEC) {
          setStatus("timeout");
          return prev;
        }
        return prev + 3;
      });
      checkStatus();
    }, 3000);

    // Initial check
    checkStatus();

    return () => clearInterval(interval);
  }, [open, status, checkStatus]);

  useEffect(() => {
    if (status === "paid") {
      const timer = setTimeout(() => {
        onSuccess();
        onOpenChange(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [status, onSuccess, onOpenChange]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStatus("polling");
      setElapsed(0);
    }
  }, [open]);

  const swishDeepLink = paymentRequestToken
    ? `swish://paymentrequest?token=${paymentRequestToken}&callbackurl=`
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Swish-betalning
          </DialogTitle>
          <DialogDescription>
            {status === "polling" && "Öppna Swish-appen och godkänn betalningen"}
            {status === "paid" && "Betalningen är genomförd!"}
            {status === "failed" && "Betalningen misslyckades"}
            {status === "timeout" && "Tidsgränsen har gått ut"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-6">
          {status === "polling" && (
            <>
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Väntar på betalning i Swish-appen...
              </p>

              {isMobile && swishDeepLink && (
                <Button
                  variant="default"
                  className="w-full gap-2"
                  onClick={() => window.location.href = swishDeepLink}
                >
                  <ExternalLink className="h-4 w-4" />
                  Öppna Swish-appen
                </Button>
              )}

              {!isMobile && (
                <div className="text-center space-y-2">
                  <p className="text-sm font-medium">
                    Öppna Swish på din telefon
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Godkänn betalningen i appen
                  </p>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                {Math.floor((TIMEOUT_SEC - elapsed) / 60)}:{String((TIMEOUT_SEC - elapsed) % 60).padStart(2, "0")} kvar
              </p>
            </>
          )}

          {status === "paid" && (
            <>
              <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              <p className="text-lg font-semibold text-green-600">Betalning klar!</p>
              <p className="text-sm text-muted-foreground">Du omdirigeras automatiskt...</p>
            </>
          )}

          {(status === "failed" || status === "timeout") && (
            <>
              <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
                <XCircle className="h-10 w-10 text-destructive" />
              </div>
              <p className="text-lg font-semibold text-destructive">
                {status === "timeout" ? "Tiden gick ut" : "Betalningen avbröts"}
              </p>
              <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full">
                Stäng
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
