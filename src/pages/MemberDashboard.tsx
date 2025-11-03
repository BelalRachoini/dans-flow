import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CalendarDays, Ticket, ShoppingCart, Calendar, Music, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/authStore';

export default function MemberDashboard() {
  const { userId } = useAuthStore();
  const [tickets, setTickets] = useState<any[]>([]);
  const [todayCourses, setTodayCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      fetchData();
    }
  }, [userId]);

  const fetchData = async () => {
    try {
      // Fetch tickets with courses
      const { data: ticketsData } = await supabase
        .from('tickets')
        .select(`
          *,
          courses (
            id,
            title,
            starts_at,
            venue
          )
        `)
        .eq('member_id', userId)
        .eq('status', 'valid')
        .order('purchased_at', { ascending: false })
        .limit(5);

      setTickets(ticketsData || []);

      // Fetch today's courses
      const today = new Date().toISOString().split('T')[0];
      const { data: coursesData } = await supabase
        .from('tickets')
        .select(`
          courses!inner (
            id,
            title,
            starts_at,
            venue
          )
        `)
        .eq('member_id', userId)
        .gte('courses.starts_at', `${today}T00:00:00`)
        .lte('courses.starts_at', `${today}T23:59:59`)
        .limit(3);

      setTodayCourses(coursesData?.map(t => t.courses).filter(Boolean) || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Översikt</h1>
        <p className="text-muted-foreground">Välkommen tillbaka! Här är din översikt.</p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Hur behörigheter fungerar</AlertTitle>
        <AlertDescription>
          Som medlem kan du se dina klasser, biljetter och händelser. Du kan köpa kurser och evenemang, 
          samt visa QR-koder för incheckning. För att bli instruktör kontakta en administratör.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Today's Classes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Mina klasser idag
            </CardTitle>
            <CardDescription>Dina schemalagda klasser för idag</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                <div className="h-16 bg-muted animate-pulse rounded" />
                <div className="h-16 bg-muted animate-pulse rounded" />
              </div>
            ) : todayCourses.length > 0 ? (
              <div className="space-y-3">
                {todayCourses.map((course: any) => (
                  <div key={course.id} className="flex items-start justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-medium">{course.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(course.starts_at).toLocaleTimeString('sv-SE', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </p>
                      <p className="text-xs text-muted-foreground">{course.venue}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Inga klasser idag
              </p>
            )}
          </CardContent>
        </Card>

        {/* My Tickets */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ticket className="h-5 w-5" />
              Mina biljetter
            </CardTitle>
            <CardDescription>Senaste aktiva biljetter</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                <div className="h-16 bg-muted animate-pulse rounded" />
                <div className="h-16 bg-muted animate-pulse rounded" />
              </div>
            ) : tickets.length > 0 ? (
              <div className="space-y-3">
                {tickets.slice(0, 3).map((ticket: any) => (
                  <div key={ticket.id} className="flex items-start justify-between p-3 rounded-lg border">
                    <div className="flex-1">
                      <p className="font-medium">{ticket.courses?.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {ticket.courses?.starts_at && 
                          new Date(ticket.courses.starts_at).toLocaleDateString('sv-SE')}
                      </p>
                    </div>
                    <Badge variant="secondary">{ticket.status}</Badge>
                  </div>
                ))}
                <Button asChild variant="outline" className="w-full">
                  <Link to="/biljetter">Visa alla biljetter</Link>
                </Button>
              </div>
            ) : (
              <div className="text-center py-8 space-y-3">
                <p className="text-sm text-muted-foreground">Inga aktiva biljetter</p>
                <Button asChild variant="outline">
                  <Link to="/kurser-poang">Köp kurs</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Snabbgenvägar</CardTitle>
          <CardDescription>Snabb tillgång till dina viktigaste funktioner</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Button asChild variant="outline" className="h-auto py-4">
              <Link to="/kurser-poang" className="flex flex-col items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                <span>Köp kurs</span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto py-4">
              <Link to="/biljetter" className="flex flex-col items-center gap-2">
                <Ticket className="h-5 w-5" />
                <span>Mina biljetter</span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto py-4">
              <Link to="/schema" className="flex flex-col items-center gap-2">
                <Calendar className="h-5 w-5" />
                <span>Kalender</span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto py-4">
              <Link to="/event" className="flex flex-col items-center gap-2">
                <Music className="h-5 w-5" />
                <span>Event</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
