import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Calendar, 
  Music, 
  Users, 
  CreditCard, 
  BookOpen,
  CalendarDays
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguageStore } from '@/store/languageStore';

export default function AdminDashboard() {
  const { t } = useLanguageStore();
  const [upcomingLessons, setUpcomingLessons] = useState<any[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [totalMembers, setTotalMembers] = useState(0);
  const [activeTickets, setActiveTickets] = useState(0);
  const [lessonsThisWeek, setLessonsThisWeek] = useState(0);
  const [eventsThisWeek, setEventsThisWeek] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const today = new Date().toISOString();
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      // Fetch upcoming lessons (with course title)
      const { data: lessonsData } = await supabase
        .from('course_lessons')
        .select('*, courses(title)')
        .gte('starts_at', today)
        .order('starts_at', { ascending: true })
        .limit(10);

      // Fetch lessons this week count
      const { count: lessonsCount } = await supabase
        .from('course_lessons')
        .select('*', { count: 'exact', head: true })
        .gte('starts_at', today)
        .lte('starts_at', nextWeek);

      // Fetch upcoming events
      const { data: eventsData } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'published')
        .gte('start_at', today)
        .order('start_at', { ascending: true })
        .limit(10);

      // Fetch events this week count
      const { count: eventsCount } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'published')
        .gte('start_at', today)
        .lte('start_at', nextWeek);

      // Fetch total members
      const { count: membersCount } = await supabase
        .from('user_roles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'member');

      // Fetch active tickets
      const { count: ticketsCount } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'valid')
        .gt('expires_at', today)
        .gt('total_tickets', 0);

      setUpcomingLessons(lessonsData || []);
      setUpcomingEvents(eventsData || []);
      setTotalMembers(membersCount || 0);
      setActiveTickets(ticketsCount || 0);
      setLessonsThisWeek(lessonsCount || 0);
      setEventsThisWeek(eventsCount || 0);
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
            <CardTitle className="text-sm font-medium">Lessons this week</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lessonsThisWeek}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{ad.eventsThisWeek}</CardTitle>
            <Music className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{eventsThisWeek}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{ad.totalMembers}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMembers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{ad.activeTickets}</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeTickets}</div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Classes & Events */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            {ad.upcomingClasses}
          </CardTitle>
          <CardDescription>Next 10 upcoming lessons and events</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <div className="h-16 bg-muted animate-pulse rounded" />
              <div className="h-16 bg-muted animate-pulse rounded" />
            </div>
          ) : (() => {
            // Combine lessons and events
            const combinedItems = [
              ...upcomingLessons.map((lesson: any) => ({
                id: `lesson-${lesson.id}`,
                type: 'lesson',
                title: lesson.courses?.title || lesson.title || 'Lesson',
                date: lesson.starts_at,
                venue: lesson.venue,
              })),
              ...upcomingEvents.map((event: any) => ({
                id: `event-${event.id}`,
                type: 'event',
                title: event.title,
                date: event.start_at,
                venue: event.venue,
              })),
            ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 10);

            return combinedItems.length > 0 ? (
              <div className="space-y-3">
                {combinedItems.map((item: any) => (
                  <div key={item.id} className="flex items-start justify-between p-3 rounded-lg border">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{item.type === 'lesson' ? '📚' : '🎉'}</span>
                        <p className="font-medium">{item.title}</p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {new Date(item.date).toLocaleDateString('sv-SE', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                      {item.venue && <p className="text-xs text-muted-foreground">{item.venue}</p>}
                    </div>
                    <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded">
                      {item.type === 'lesson' ? 'Lesson' : 'Event'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                {ad.noUpcomingClasses}
              </p>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}
