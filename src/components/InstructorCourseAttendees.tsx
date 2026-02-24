import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Users, CheckCircle } from 'lucide-react';

interface Props {
  userId: string;
}

export default function InstructorCourseAttendees({ userId }: Props) {
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [attendees, setAttendees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCourses();
  }, [userId]);

  useEffect(() => {
    if (selectedCourseId) {
      fetchAttendees(selectedCourseId);
    }
  }, [selectedCourseId]);

  const fetchCourses = async () => {
    // Get courses where user is instructor (via instructor_id or course_instructors)
    const { data: directCourses } = await supabase
      .from('courses')
      .select('id, title, starts_at, status')
      .eq('instructor_id', userId)
      .order('starts_at', { ascending: false });

    const { data: linkedCourses } = await supabase
      .from('course_instructors')
      .select('course_id, courses(id, title, starts_at, status)')
      .eq('instructor_id', userId);

    const allCourses = new Map<string, any>();
    (directCourses || []).forEach(c => allCourses.set(c.id, c));
    (linkedCourses || []).forEach(l => {
      const c = l.courses as any;
      if (c) allCourses.set(c.id, c);
    });

    const sorted = Array.from(allCourses.values()).sort(
      (a, b) => new Date(b.starts_at || 0).getTime() - new Date(a.starts_at || 0).getTime()
    );
    setCourses(sorted);
  };

  const fetchAttendees = async (courseId: string) => {
    setLoading(true);
    try {
      const { data: tickets } = await supabase
        .from('tickets')
        .select(`
          id, status, total_tickets, tickets_used,
          profiles:member_id (id, full_name, email, phone, dance_role)
        `)
        .eq('course_id', courseId);

      if (!tickets) {
        setAttendees([]);
        return;
      }

      // Get checkins for these tickets
      const ticketIds = tickets.map(t => t.id);
      const { data: checkins } = await supabase
        .from('checkins')
        .select('ticket_id')
        .in('ticket_id', ticketIds);

      const checkedInTicketIds = new Set((checkins || []).map(c => c.ticket_id));

      const enriched = tickets.map(t => ({
        ...t,
        hasCheckedIn: checkedInTicketIds.has(t.id),
      }));

      setAttendees(enriched);
    } catch (err) {
      console.error('Error fetching attendees:', err);
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    total: attendees.length,
    leaders: attendees.filter(a => (a.profiles as any)?.dance_role === 'leader').length,
    followers: attendees.filter(a => (a.profiles as any)?.dance_role === 'follower').length,
    checkedIn: attendees.filter(a => a.hasCheckedIn).length,
  };

  return (
    <div className="space-y-4">
      <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
        <SelectTrigger>
          <SelectValue placeholder="Välj en kurs..." />
        </SelectTrigger>
        <SelectContent>
          {courses.map(c => (
            <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedCourseId && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg border text-center">
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Totalt</p>
            </div>
            <div className="p-3 rounded-lg border text-center">
              <p className="text-2xl font-bold text-blue-600">{stats.leaders}</p>
              <p className="text-xs text-muted-foreground">Leaders</p>
            </div>
            <div className="p-3 rounded-lg border text-center">
              <p className="text-2xl font-bold text-pink-600">{stats.followers}</p>
              <p className="text-xs text-muted-foreground">Followers</p>
            </div>
            <div className="p-3 rounded-lg border text-center">
              <p className="text-2xl font-bold text-green-600">{stats.checkedIn}</p>
              <p className="text-xs text-muted-foreground">Incheckade</p>
            </div>
          </div>

          {/* Attendee table */}
          {loading ? (
            <div className="h-20 bg-muted animate-pulse rounded" />
          ) : attendees.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Namn</TableHead>
                  <TableHead>Dansroll</TableHead>
                  <TableHead>Incheckning</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendees.map((a: any) => {
                  const profile = a.profiles as any;
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">
                        {profile?.full_name || 'Okänd'}
                      </TableCell>
                      <TableCell>
                        {profile?.dance_role === 'leader' && (
                          <Badge variant="outline" className="border-blue-300 text-blue-700">Leader</Badge>
                        )}
                        {profile?.dance_role === 'follower' && (
                          <Badge variant="outline" className="border-pink-300 text-pink-700">Follower</Badge>
                        )}
                        {!profile?.dance_role && (
                          <Badge variant="outline" className="text-muted-foreground">Ej satt</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {a.hasCheckedIn ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">
              Inga anmälda deltagare för denna kurs
            </p>
          )}
        </>
      )}
    </div>
  );
}
