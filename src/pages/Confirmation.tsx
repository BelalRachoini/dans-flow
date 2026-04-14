import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const Confirmation = () => {
  const [searchParams] = useSearchParams();
  const status = searchParams.get('status');
  const amount = searchParams.get('amount');
  const itemName = searchParams.get('item_name');
  const itemType = searchParams.get('item_type');

  const getBackLink = () => {
    switch (itemType) {
      case 'event': return '/event';
      case 'course': return '/kurser-poang';
      case 'ticket': return '/biljetter';
      default: return '/';
    }
  };

  const isSuccess = status === 'success';

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center space-y-6">
          {isSuccess ? (
            <>
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
              <div className="space-y-2">
                <h1 className="text-2xl font-bold">Betalning genomförd! 🎉</h1>
                <p className="text-muted-foreground">
                  Tack för ditt köp. Din bekräftelse har skickats till din e-post.
                </p>
              </div>
              {amount && itemName && (
                <p className="text-sm text-muted-foreground">
                  Du betalade <span className="font-semibold">SEK {amount}</span> för{' '}
                  <span className="font-semibold">{itemName}</span>
                </p>
              )}
              <Button asChild className="w-full gap-2">
                <Link to={getBackLink()}>
                  Gå tillbaka <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold">Tack för ditt köp!</h1>
                <p className="text-muted-foreground">
                  Kontakta oss på info@dancevida.se om du har några frågor.
                </p>
              </div>
              <Button asChild className="w-full gap-2">
                <Link to="/">
                  Gå till startsidan <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Confirmation;
