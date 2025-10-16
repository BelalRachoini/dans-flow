import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Coins, TrendingUp, Users, Calendar, 
  PartyPopper, ShoppingBag, ArrowRight 
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { listCourses, listEvents, listInvoices } from '@/services/mockApi';
import { sv } from '@/locales/sv';
import type { Course, Event, Invoice } from '@/types';

export default function Dashboard() {
  const { user } = useAuthStore();
  const [courses, setCourses] = useState<Course[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
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
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="rounded-lg gradient-primary p-8 text-white shadow-glow">
        <h1 className="mb-2 text-3xl font-bold">{sv.dashboard.welcome}, {user?.name}!</h1>
        <p className="text-lg text-white/90">
          {user?.role === 'ADMIN' && 'Hantera din dansskola från en central plats'}
          {user?.role === 'INSTRUKTOR' && 'Övervaka dina klasser och elever'}
          {user?.role === 'MEDLEM' && 'Din dansresa fortsätter här'}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-md transition-smooth hover:shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {sv.courses.pointsBalance}
            </CardTitle>
            <Coins className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{user?.pointsBalance || 0}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {sv.courses.flexiblePoints}
            </p>
            <Link to="/kurser-poang">
              <Button variant="link" className="mt-2 h-auto p-0 text-xs">
                {sv.courses.buyPoints} <ArrowRight size={12} className="ml-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="shadow-md transition-smooth hover:shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Aktiva Kurser
            </CardTitle>
            <Calendar className="h-5 w-5 text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{courses.length}</div>
            <p className="mt-1 text-xs text-muted-foreground">Tillgängliga just nu</p>
            <Link to="/kurser-poang">
              <Button variant="link" className="mt-2 h-auto p-0 text-xs">
                Se alla kurser <ArrowRight size={12} className="ml-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="shadow-md transition-smooth hover:shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Kommande Event
            </CardTitle>
            <PartyPopper className="h-5 w-5 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{events.length}</div>
            <p className="mt-1 text-xs text-muted-foreground">Planerade evenemang</p>
            <Link to="/event">
              <Button variant="link" className="mt-2 h-auto p-0 text-xs">
                Visa event <ArrowRight size={12} className="ml-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="shadow-md transition-smooth hover:shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Totala Intäkter
            </CardTitle>
            <TrendingUp className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {recentInvoices.reduce((sum, inv) => sum + inv.amountSEK, 0)} kr
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Denna månaden</p>
            {(user?.role === 'ADMIN' || user?.role === 'INSTRUKTOR') && (
              <Link to="/betalningar">
                <Button variant="link" className="mt-2 h-auto p-0 text-xs">
                  Se betalningar <ArrowRight size={12} className="ml-1" />
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Today's Schedule */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              {sv.dashboard.todaysSchedule}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {todayCourse ? (
              <div className="rounded-lg border border-border p-4 transition-smooth hover:shadow-md">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{todayCourse.title}</h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="outline">{sv.styles[todayCourse.style]}</Badge>
                      <Badge variant="secondary">{todayCourse.time}</Badge>
                      <Badge variant="outline">{todayCourse.location}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                      {todayCourse.description}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" variant="hero">
                    {sv.courses.checkIn}
                  </Button>
                  <Link to="/schema">
                    <Button size="sm" variant="outline">
                      {sv.courses.viewSchedule}
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Inga klasser schemalagda idag
              </p>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PartyPopper className="h-5 w-5 text-secondary" />
              Kommande Event
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {upcomingEvent ? (
              <div className="rounded-lg border border-border p-4 transition-smooth hover:shadow-md">
                <h3 className="font-semibold text-lg">{upcomingEvent.title}</h3>
                <div className="mt-2 flex gap-2">
                  <Badge variant="secondary">{upcomingEvent.date}</Badge>
                  <Badge variant="outline">{upcomingEvent.location}</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                  {upcomingEvent.description}
                </p>
                <div className="mt-4">
                  <Link to={`/event`}>
                    <Button size="sm" variant="premium">
                      {sv.tickets.buy}
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Inga kommande event
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>{sv.dashboard.quickActions}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {user?.role === 'ADMIN' && (
              <>
                <Link to="/event" className="block">
                  <Button variant="outline" className="w-full h-auto py-6 flex-col gap-2">
                    <PartyPopper size={24} />
                    {sv.events.createEvent}
                  </Button>
                </Link>
                <Link to="/medlemmar" className="block">
                  <Button variant="outline" className="w-full h-auto py-6 flex-col gap-2">
                    <Users size={24} />
                    {sv.members.addMember}
                  </Button>
                </Link>
              </>
            )}
            <Link to="/biljetter" className="block">
              <Button variant="outline" className="w-full h-auto py-6 flex-col gap-2">
                <ShoppingBag size={24} />
                {sv.tickets.buy}
              </Button>
            </Link>
            <Link to="/kurser-poang" className="block">
              <Button variant="outline" className="w-full h-auto py-6 flex-col gap-2">
                <Coins size={24} />
                {sv.courses.buyPoints}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Recent Payments */}
      {recentInvoices.length > 0 && (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>{sv.dashboard.recentPayments}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentInvoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3 transition-smooth hover:shadow-sm"
                >
                  <div className="flex-1">
                    <p className="font-medium">{invoice.description}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(invoice.createdAt).toLocaleDateString('sv-SE')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{invoice.amountSEK} kr</p>
                    <Badge variant={invoice.paid ? 'default' : 'secondary'} className="mt-1">
                      {invoice.paid ? 'Betald' : 'Väntande'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
