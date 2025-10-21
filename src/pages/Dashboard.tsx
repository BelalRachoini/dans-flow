import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Coins, TrendingUp, Users, Calendar, 
  PartyPopper, ShoppingBag, ArrowRight, QrCode
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { listCourses, listEvents, listInvoices } from '@/services/mockApi';
import { useLanguageStore } from '@/store/languageStore';
import type { Course, Event as EventType, Invoice } from '@/types';

export default function Dashboard() {
  const { user } = useAuthStore();
  const { t } = useLanguageStore();
  const [courses, setCourses] = useState<Course[]>([]);
  const [events, setEvents] = useState<EventType[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);

  useEffect(() => {
    const loadData = async () => {
      const [coursesData, eventsData, invoicesData] = await Promise.all([
        listCourses(),
        listEvents(),
        listInvoices(user?.id),
      ]);
      
      setCourses(coursesData);
      setEvents(eventsData);
      setRecentInvoices(invoicesData.slice(0, 5));
    };

    loadData();
  }, [user?.id]);

  const upcomingEvent = events[0];
  const todayCourse = courses[0];

  return (
    <div className="space-y-4 pb-6 max-w-full overflow-x-hidden">
      {/* Points Card - Prominent on Mobile */}
      <Card className="shadow-lg hover-scale">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Dina poäng</p>
              <p className="text-4xl font-bold text-primary">{user?.pointsBalance || 0}</p>
              <p className="text-xs text-muted-foreground mt-1">Använd i valfri klass</p>
            </div>
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Coins className="h-8 w-8 text-primary" />
            </div>
          </div>
          <Link to="/kurser-poang" className="block mt-4">
            <Button className="w-full" size="lg">
              <Coins className="mr-2 h-4 w-4" />
              Köp poäng
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Quick Stats - Clean Row */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="shadow-md">
          <CardContent className="p-4 text-center">
            <Calendar className="h-6 w-6 text-secondary mx-auto mb-2" />
            <p className="text-2xl font-bold">{courses.length}</p>
            <p className="text-xs text-muted-foreground">Kurser</p>
          </CardContent>
        </Card>
        
        <Card className="shadow-md">
          <CardContent className="p-4 text-center">
            <PartyPopper className="h-6 w-6 text-accent mx-auto mb-2" />
            <p className="text-2xl font-bold">{events.length}</p>
            <p className="text-xs text-muted-foreground">Event</p>
          </CardContent>
        </Card>
      </div>

      {/* Today's Schedule - Full Width on Mobile */}
      <Card className="shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Dagens klass
          </CardTitle>
        </CardHeader>
        <CardContent>
          {todayCourse ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-bold mb-2">{todayCourse.title}</h3>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="text-sm">{t.styles[todayCourse.style]}</Badge>
                  <Badge variant="outline" className="text-sm">{todayCourse.time}</Badge>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{todayCourse.description}</p>
              <div className="pt-2 space-y-2">
                <Button className="w-full" size="lg">
                  <QrCode className="mr-2 h-4 w-4" />
                  Checka in
                </Button>
                <Link to="/schema" className="block">
                  <Button variant="outline" className="w-full" size="lg">
                    Se hela schemat
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground">Inga klasser idag</p>
              <Link to="/schema" className="block mt-4">
                <Button variant="outline">Se schema</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Events - Full Width on Mobile */}
      <Card className="shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <PartyPopper className="h-5 w-5 text-secondary" />
            Kommande event
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingEvent ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-bold mb-2">{upcomingEvent.title}</h3>
                <div className="flex flex-wrap gap-2">
                  <Badge className="text-sm">{upcomingEvent.date}</Badge>
                  <Badge variant="outline" className="text-sm">{upcomingEvent.location}</Badge>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{upcomingEvent.description}</p>
              <Link to="/event" className="block">
                <Button className="w-full" size="lg" variant="secondary">
                  <ShoppingBag className="mr-2 h-4 w-4" />
                  Köp biljett
                </Button>
              </Link>
            </div>
          ) : (
            <div className="text-center py-8">
              <PartyPopper className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground">Inga event planerade</p>
              <Link to="/event" className="block mt-4">
                <Button variant="outline">Se alla event</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions - Simple List on Mobile */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground px-1">Snabbåtgärder</h3>
        <div className="grid gap-3">
          <Link to="/biljetter">
            <Button variant="outline" className="w-full justify-start h-14" size="lg">
              <ShoppingBag className="mr-3 h-5 w-5" />
              <span>Köp biljett</span>
            </Button>
          </Link>
          <Link to="/schema">
            <Button variant="outline" className="w-full justify-start h-14" size="lg">
              <Calendar className="mr-3 h-5 w-5" />
              <span>Se schema</span>
            </Button>
          </Link>
          {user?.role === 'ADMIN' && (
            <>
              <Link to="/event">
                <Button variant="outline" className="w-full justify-start h-14" size="lg">
                  <PartyPopper className="mr-3 h-5 w-5" />
                  <span>Skapa event</span>
                </Button>
              </Link>
              <Link to="/medlemmar">
                <Button variant="outline" className="w-full justify-start h-14" size="lg">
                  <Users className="mr-3 h-5 w-5" />
                  <span>Hantera medlemmar</span>
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Recent Payments - Clean Mobile List */}
      {recentInvoices.length > 0 && (
        <Card className="shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle>Senaste betalningar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentInvoices.slice(0, 3).map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                >
                  <div className="flex-1 min-w-0 pr-3">
                    <p className="font-medium text-sm truncate">{invoice.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(invoice.createdAt).toLocaleDateString('sv-SE')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{invoice.amountSEK} kr</p>
                  </div>
                </div>
              ))}
            </div>
            {(user?.role === 'ADMIN' || user?.role === 'INSTRUKTOR') && (
              <Link to="/betalningar" className="block mt-4">
                <Button variant="ghost" className="w-full">
                  Se alla betalningar
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
