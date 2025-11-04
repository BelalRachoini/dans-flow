import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Calendar, 
  Music, 
  Users, 
  CreditCard, 
  Settings, 
  BookOpen,
  CalendarDays,
  Plus,
  QrCode
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguageStore } from '@/store/languageStore';

export default function AdminDashboard() {
  const { t } = useLanguageStore();
  const [upcomingCourses, setUpcomingCourses] = useState<any[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const today = new Date().toISOString();
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      // Fetch upcoming courses
      const { data: coursesData } = await supabase
        .from('courses')
        .select('*')
        .gte('starts_at', today)
        .lte('starts_at', nextWeek)
        .order('starts_at', { ascending: true })
        .limit(5);

      setUpcomingCourses(coursesData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Safely access adminDashboard translations with fallbacks
  const ad = t.adminDashboard || {
    title: 'Admin - Overview',
    subtitle: 'Complete control over the system',
    coursesThisWeek: 'Courses this week',
    eventsThisWeek: 'Events this week',
    totalMembers: 'Total members',
    activeTickets: 'Active tickets',
    upcomingClasses: 'Upcoming classes & events',
    nextWeek: 'Next week',
    noUpcomingClasses: 'No upcoming classes',
    quickActions: 'Quick Actions',
    quickActionsDesc: 'Quick access to common tasks',
    scanQR: 'Scan QR',
    createCourse: 'Create course',
    createEvent: 'Create event',
    openSchedule: 'Open Schedule',
    manageMembers: 'Manage members',
    payments: 'Payments',
    settings: 'Settings',
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">{ad.title}</h1>
        <p className="text-muted-foreground">{ad.subtitle}</p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{ad.coursesThisWeek}</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingCourses.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{ad.eventsThisWeek}</CardTitle>
            <Music className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{ad.totalMembers}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{ad.activeTickets}</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Events */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            {ad.upcomingClasses}
          </CardTitle>
          <CardDescription>{ad.nextWeek}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <div className="h-16 bg-muted animate-pulse rounded" />
              <div className="h-16 bg-muted animate-pulse rounded" />
            </div>
          ) : upcomingCourses.length > 0 ? (
            <div className="space-y-3">
              {upcomingCourses.map((course: any) => (
                <div key={course.id} className="flex items-start justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">{course.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(course.starts_at).toLocaleDateString('sv-SE', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
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
              {ad.noUpcomingClasses}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>{ad.quickActions}</CardTitle>
          <CardDescription>{ad.quickActionsDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Button asChild variant="outline" className="h-auto py-4">
              <Link to="/scan" className="flex flex-col items-center gap-2">
                <QrCode className="h-5 w-5" />
                <span>{ad.scanQR}</span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto py-4">
              <Link to="/admin/kurser-poang" className="flex flex-col items-center gap-2">
                <Plus className="h-5 w-5" />
                <span>{ad.createCourse}</span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto py-4">
              <Link to="/admin/event" className="flex flex-col items-center gap-2">
                <Music className="h-5 w-5" />
                <span>{ad.createEvent}</span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto py-4">
              <Link to="/admin/schema" className="flex flex-col items-center gap-2">
                <Calendar className="h-5 w-5" />
                <span>{ad.openSchedule}</span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto py-4">
              <Link to="/admin/medlemmar" className="flex flex-col items-center gap-2">
                <Users className="h-5 w-5" />
                <span>{ad.manageMembers}</span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto py-4">
              <Link to="/admin/betalningar" className="flex flex-col items-center gap-2">
                <CreditCard className="h-5 w-5" />
                <span>{ad.payments}</span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto py-4">
              <Link to="/admin" className="flex flex-col items-center gap-2">
                <Settings className="h-5 w-5" />
                <span>{ad.settings}</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
