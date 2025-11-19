import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { XCircle } from "lucide-react";

export default function PaymentCancelled() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-muted">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-muted-foreground">
            <XCircle className="h-6 w-6" />
            Betalning avbruten
          </CardTitle>
          <CardDescription>
            Din betalning avbröts. Inga pengar har dragits från ditt konto.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={() => navigate("/events")} className="w-full">
            Tillbaka till Events
          </Button>
          <Button onClick={() => navigate("/courses")} variant="outline" className="w-full">
            Visa kurser
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
