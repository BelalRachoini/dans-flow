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
    <div className="space-y-4 sm:space-y-6 pb-6">
      {/* Welcome Section - Mobile First */}
      <div className="rounded-xl gradient-primary p-4 sm:p-6 lg:p-8 text-white shadow-glow animate-fade-in">
        <h1 className="mb-1 sm:mb-2 text-xl sm:text-2xl lg:text-3xl font-bold leading-tight">
          {t.dashboard.welcome}, {user?.name?.split(' ')[0]}!
        </h1>
        <p className="text-sm sm:text-base lg:text-lg text-white/90">
          {user?.role === 'ADMIN' && 'Hantera din dansskola från en central plats'}
          {user?.role === 'INSTRUKTOR' && 'Övervaka dina klasser och elever'}
          {user?.role === 'MEDLEM' && 'Din dansresa fortsätter här'}
        </p>
      </div>

      {/* Quick Stats - Mobile First Grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card className="shadow-md transition-smooth hover:shadow-lg hover-scale">
          <CardHeader className="flex flex-row items-center justify-between pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
              {t.courses.pointsBalance}
            </CardTitle>
            <Coins className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            <div className="text-2xl sm:text-3xl font-bold text-primary">{user?.pointsBalance || 0}</div>
            <p className="mt-1 text-[10px] sm:text-xs text-muted-foreground line-clamp-1">
              {t.courses.flexiblePoints}
            </p>
            <Link to="/kurser-poang" className="hidden sm:block">
              <Button variant="link" className="mt-2 h-auto p-0 text-xs">
                {t.courses.buyPoints} <ArrowRight size={12} className="ml-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="shadow-md transition-smooth hover:shadow-lg hover-scale">
          <CardHeader className="flex flex-row items-center justify-between pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
              Aktiva Kurser
            </CardTitle>
            <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-secondary" />
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            <div className="text-2xl sm:text-3xl font-bold">{courses.length}</div>
            <p className="mt-1 text-[10px] sm:text-xs text-muted-foreground">Tillgängliga</p>
            <Link to="/kurser-poang" className="hidden sm:block">
              <Button variant="link" className="mt-2 h-auto p-0 text-xs">
                Se alla <ArrowRight size={12} className="ml-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="shadow-md transition-smooth hover:shadow-lg hover-scale">
          <CardHeader className="flex flex-row items-center justify-between pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
              Event
            </CardTitle>
            <PartyPopper className="h-4 w-4 sm:h-5 sm:w-5 text-accent" />
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            <div className="text-2xl sm:text-3xl font-bold">{events.length}</div>
            <p className="mt-1 text-[10px] sm:text-xs text-muted-foreground">Planerade</p>
            <Link to="/event" className="hidden sm:block">
              <Button variant="link" className="mt-2 h-auto p-0 text-xs">
                Visa <ArrowRight size={12} className="ml-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="shadow-md transition-smooth hover:shadow-lg hover-scale">
          <CardHeader className="flex flex-row items-center justify-between pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
              Intäkter
            </CardTitle>
            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            <div className="text-xl sm:text-3xl font-bold">
              {recentInvoices.reduce((sum, inv) => sum + inv.amountSEK, 0)} kr
            </div>
            <p className="mt-1 text-[10px] sm:text-xs text-muted-foreground">Denna mån</p>
            {(user?.role === 'ADMIN' || user?.role === 'INSTRUKTOR') && (
              <Link to="/betalningar" className="hidden sm:block">
                <Button variant="link" className="mt-2 h-auto p-0 text-xs">
                  Se alla <ArrowRight size={12} className="ml-1" />
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        {/* Today's Schedule - Mobile Optimized */}
        <Card className="shadow-md">
          <CardHeader className="pb-3 sm:pb-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              {t.dashboard.todaysSchedule}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {todayCourse ? (
              <div className="rounded-lg border border-border p-3 sm:p-4 transition-smooth hover:shadow-md">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-base sm:text-lg">{todayCourse.title}</h3>
                    <div className="mt-2 flex flex-wrap gap-1.5 sm:gap-2">
                      <Badge variant="outline" className="text-xs">{t.styles[todayCourse.style]}</Badge>
                      <Badge variant="secondary" className="text-xs">{todayCourse.time}</Badge>
                      <Badge variant="outline" className="text-xs">{todayCourse.location}</Badge>
                    </div>
                    <p className="mt-2 text-xs sm:text-sm text-muted-foreground line-clamp-2">
                      {todayCourse.description}
                    </p>
                  </div>
                </div>
                <div className="mt-3 sm:mt-4 flex gap-2">
                  <Button size="sm" variant="hero" className="flex-1 sm:flex-none">
                    {t.courses.checkIn}
                  </Button>
                  <Link to="/schema" className="flex-1 sm:flex-none">
                    <Button size="sm" variant="outline" className="w-full">
                      {t.courses.viewSchedule}
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-6 sm:py-8 text-sm">
                Inga klasser schemalagda idag
              </p>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Events - Mobile Optimized */}
        <Card className="shadow-md">
          <CardHeader className="pb-3 sm:pb-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <PartyPopper className="h-4 w-4 sm:h-5 sm:w-5 text-secondary" />
              Kommande Event
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {upcomingEvent ? (
              <div className="rounded-lg border border-border p-3 sm:p-4 transition-smooth hover:shadow-md">
                <h3 className="font-semibold text-base sm:text-lg">{upcomingEvent.title}</h3>
                <div className="mt-2 flex flex-wrap gap-1.5 sm:gap-2">
                  <Badge variant="secondary" className="text-xs">{upcomingEvent.date}</Badge>
                  <Badge variant="outline" className="text-xs">{upcomingEvent.location}</Badge>
                </div>
                <p className="mt-2 text-xs sm:text-sm text-muted-foreground line-clamp-2">
                  {upcomingEvent.description}
                </p>
                <div className="mt-3 sm:mt-4">
                  <Link to={`/event`} className="block">
                    <Button size="sm" variant="default" className="w-full sm:w-auto">
                      {t.tickets.buy}
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-6 sm:py-8 text-sm">
                Inga kommande event
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions - Mobile Optimized */}
      <Card className="shadow-md">
        <CardHeader className="pb-3 sm:pb-6">
          <CardTitle className="text-base sm:text-lg">{t.dashboard.quickActions}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {user?.role === 'ADMIN' && (
              <>
                <Link to="/event" className="block">
                  <Button variant="outline" className="w-full h-auto py-4 sm:py-6 flex-col gap-2 hover-scale">
                    <PartyPopper size={20} className="sm:w-6 sm:h-6" />
                    <span className="text-xs sm:text-sm">{t.events.createEvent}</span>
                  </Button>
                </Link>
                <Link to="/medlemmar" className="block">
                  <Button variant="outline" className="w-full h-auto py-4 sm:py-6 flex-col gap-2 hover-scale">
                    <Users size={20} className="sm:w-6 sm:h-6" />
                    <span className="text-xs sm:text-sm">{t.members.addMember}</span>
                  </Button>
                </Link>
              </>
            )}
            <Link to="/biljetter" className="block">
              <Button variant="outline" className="w-full h-auto py-4 sm:py-6 flex-col gap-2 hover-scale">
                <ShoppingBag size={20} className="sm:w-6 sm:h-6" />
                <span className="text-xs sm:text-sm">{t.tickets.buy}</span>
              </Button>
            </Link>
            <Link to="/kurser-poang" className="block">
              <Button variant="outline" className="w-full h-auto py-4 sm:py-6 flex-col gap-2 hover-scale">
                <Coins size={20} className="sm:w-6 sm:h-6" />
                <span className="text-xs sm:text-sm">{t.courses.buyPoints}</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Recent Payments - Mobile Optimized */}
      {recentInvoices.length > 0 && (
        <Card className="shadow-md">
          <CardHeader className="pb-3 sm:pb-6">
            <CardTitle className="text-base sm:text-lg">{t.dashboard.recentPayments}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 sm:space-y-3">
              {recentInvoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3 transition-smooth hover:shadow-sm"
                >
                  <div className="flex-1 min-w-0 pr-3">
                    <p className="font-medium text-sm sm:text-base truncate">{invoice.description}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {new Date(invoice.createdAt).toLocaleDateString('sv-SE')}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold text-sm sm:text-base">{invoice.amountSEK} kr</p>
                    <Badge variant={invoice.paid ? 'default' : 'secondary'} className="mt-1 text-xs">
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
