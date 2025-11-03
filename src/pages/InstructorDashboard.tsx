import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScanLine, CalendarDays, Users, Info, Calendar, Music } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/authStore';

export default function InstructorDashboard() {
  const { userId } = useAuthStore();
  const [todayCourses, setTodayCourses] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      fetchData();
    }
  }, [userId]);

  const fetchData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Fetch today's courses where user is instructor
      const { data: coursesData } = await supabase
        .from('courses')
        .select('*')
        .eq('instructor_id', userId)
        .gte('starts_at', `${today}T00:00:00`)
        .lte('starts_at', `${today}T23:59:59`)
        .order('starts_at', { ascending: true });

      setTodayCourses(coursesData || []);

      // Fetch today's attendance
      if (coursesData && coursesData.length > 0) {
        const courseIds = coursesData.map(c => c.id);
        
        const { data: attendanceData } = await supabase
          .from('checkins')
          .select(`
            *,
            tickets!inner (
              course_id,
              courses!inner (
                title
              ),
              profiles!inner (
                full_name
              )
            )
          `)
          .in('tickets.course_id', courseIds)
          .gte('scanned_at', `${today}T00:00:00`)
          .order('scanned_at', { ascending: false });

        setAttendance(attendanceData || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Översikt - Instruktör</h1>
        <p className="text-muted-foreground">Hantera dina klasser och skanna biljetter</p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Hur behörigheter fungerar</AlertTitle>
        <AlertDescription>
          Som instruktör kan du se dina egna klasser, skanna medlemsbiljetter och se närvaro. 
          Du har inte tillgång till medlemshantering, betalningar eller prenumerationer.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Today's Classes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Dagens klasser
            </CardTitle>
            <CardDescription>Dina schemalagda klasser för idag</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                <div className="h-20 bg-muted animate-pulse rounded" />
              </div>
            ) : todayCourses.length > 0 ? (
              <div className="space-y-3">
                {todayCourses.map((course: any) => (
                  <div key={course.id} className="p-4 rounded-lg border">
                    <h3 className="font-semibold">{course.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {new Date(course.starts_at).toLocaleTimeString('sv-SE', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                      {course.ends_at && ` - ${new Date(course.ends_at).toLocaleTimeString('sv-SE', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{course.venue}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Inga klasser schemalagda idag
              </p>
            )}
          </CardContent>
        </Card>

        {/* Scan Button & Attendance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Närvaro idag
            </CardTitle>
            <CardDescription>Incheckade medlemmar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button asChild variant="hero" className="w-full">
              <Link to="/scan" className="flex items-center gap-2">
                <ScanLine className="h-5 w-5" />
                Skanna biljett
              </Link>
            </Button>

            {loading ? (
              <div className="space-y-2">
                <div className="h-12 bg-muted animate-pulse rounded" />
              </div>
            ) : attendance.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {attendance.map((checkin: any) => (
                  <div key={checkin.id} className="flex items-center justify-between p-2 rounded border">
                    <div>
                      <p className="text-sm font-medium">{checkin.tickets?.profiles?.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {checkin.tickets?.courses?.title}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(checkin.scanned_at).toLocaleTimeString('sv-SE', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Ingen närvaro ännu idag
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs for additional views */}
      <Card>
        <CardHeader>
          <CardTitle>Navigation</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Översikt</TabsTrigger>
              <TabsTrigger value="calendar">
                <Link to="/schema" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Kalender
                </Link>
              </TabsTrigger>
              <TabsTrigger value="events">
                <Link to="/event" className="flex items-center gap-2">
                  <Music className="h-4 w-4" />
                  Event
                </Link>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="mt-4">
              <p className="text-sm text-muted-foreground">
                Du ser översikten ovan. Använd flikarna för att navigera till andra sektioner.
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
