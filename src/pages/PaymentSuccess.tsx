import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const verifyPayment = async () => {
      const sessionId = searchParams.get("session_id");
      const paymentType = searchParams.get("type");
      
      if (!sessionId) {
        setError("Ingen betalningssession hittades");
        setVerifying(false);
        return;
      }

      try {
        // Use type parameter to call the correct verification function directly
        if (paymentType === "standalone_tickets") {
          const ticketCount = searchParams.get("count");
          const { data, error } = await supabase.functions.invoke(
            "verify-standalone-ticket-payment",
            { body: { sessionId } }
          );

          if (!error && data?.success) {
            toast({
              title: "Betalning genomförd!",
              description: `Du har köpt ${ticketCount} klippkort som nu finns i Biljetter.`,
            });
            setVerifying(false);
            return;
          }
          throw new Error(error?.message || "Kunde inte verifiera klippkortsköp");
        }

        if (paymentType === "course") {
          const { data, error } = await supabase.functions.invoke(
            "verify-course-payment",
            { body: { session_id: sessionId } }
          );

          if (!error && data?.success) {
            toast({
              title: "Betalning genomförd!",
              description: "Din kursbiljett har skapats och finns nu i Biljetter.",
            });
            setVerifying(false);
            return;
          }
          throw new Error(error?.message || data?.error || "Kunde inte verifiera kursköp");
        }

        if (paymentType === "event") {
          const { data, error } = await supabase.functions.invoke(
            "verify-event-payment",
            { body: { session_id: sessionId } }
          );

          if (!error && data?.success) {
            toast({
              title: "Betalning genomförd!",
              description: "Din eventbiljett har skapats och finns nu i Biljetter.",
            });
            setVerifying(false);
            return;
          }
          throw new Error(error?.message || data?.error || "Kunde inte verifiera eventköp");
        }

        // Fallback: try all verification methods if type is not specified
        console.log("No payment type specified, trying all verification methods");
        
        const { data: eventData, error: eventError } = await supabase.functions.invoke(
          "verify-event-payment",
          { body: { session_id: sessionId } }
        );

        if (!eventError && eventData?.success) {
          toast({
            title: "Betalning genomförd!",
            description: "Din eventbiljett har skapats och finns nu i Biljetter.",
          });
          setVerifying(false);
          return;
        }

        const { data: courseData, error: courseError } = await supabase.functions.invoke(
          "verify-course-payment",
          { body: { session_id: sessionId } }
        );

        if (!courseError && courseData?.success) {
          toast({
            title: "Betalning genomförd!",
            description: "Din kursbiljett har skapats och finns nu i Biljetter.",
          });
          setVerifying(false);
          return;
        }

        throw new Error(eventError?.message || courseError?.message || "Kunde inte verifiera betalning");
      } catch (err) {
        console.error("Payment verification error:", err);
        setError(err instanceof Error ? err.message : "Ett fel uppstod vid verifiering av betalning");
        setVerifying(false);
      }
    };

    verifyPayment();
  }, [searchParams, toast]);

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Verifierar betalning...
            </CardTitle>
            <CardDescription>
              Vänligen vänta medan vi bekräftar din betalning
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Något gick fel</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/events")} className="w-full">
              Tillbaka till Events
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-primary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <CheckCircle className="h-6 w-6" />
            Betalning genomförd!
          </CardTitle>
          <CardDescription>
            Din biljett har skapats och finns nu tillgänglig i Biljetter
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={() => navigate("/biljetter")} className="w-full">
            Visa mina biljetter
          </Button>
          <Button onClick={() => navigate("/member")} variant="outline" className="w-full">
            Tillbaka till Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
