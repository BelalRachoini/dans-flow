import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CalendarDays, Ticket, Clock, MapPin, QrCode, Calendar as CalendarIcon, PartyPopper, CreditCard } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { useLanguageStore } from '@/store/languageStore';
import { LessonBookingDialog } from '@/components/LessonBookingDialog';
import QRCodeLib from 'qrcode';
import { toast as sonnerToast } from 'sonner';

export default function MemberDashboard() {
  const navigate = useNavigate();
  const { userId } = useAuthStore();
  const { t, language } = useLanguageStore();
  const [upcomingItems, setUpcomingItems] = useState<any[]>([]);
  const [myBookings, setMyBookings] = useState<any[]>([]);
  const [myEventBookings, setMyEventBookings] = useState<any[]>([]);
  const [myTicketPackages, setMyTicketPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Lesson booking dialog state
  const [selectedLesson, setSelectedLesson] = useState<any>(null);
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  
  // QR modal state
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);

  useEffect(() => {
    if (userId) {
      fetchData();
    }
  }, [userId]);

  const fetchData = async () => {
    try {
      await Promise.all([
        fetchUpcomingItems(),
        fetchMyBookings(),
        fetchMyEventBookings(),
        fetchMyTicketPackages(),
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUpcomingItems = async () => {
    const { data: lessonsData } = await supabase
      .from('course_lessons')
      .select('*, courses!inner(id, title)')
      .gte('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: true })
      .limit(5);

    const { data: eventsData } = await supabase
      .from('events')
      .select('*')
      .gte('start_at', new Date().toISOString())
      .eq('status', 'published')
      .order('start_at', { ascending: true })
      .limit(5);

    const combinedItems = [
      ...(lessonsData || []).map(l => ({
        ...l,
        type: 'lesson',
        date: l.starts_at,
        title: l.title || l.courses?.title,
      })),
      ...(eventsData || []).map(e => ({
        ...e,
        type: 'event',
        date: e.start_at,
      }))
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 3);

    setUpcomingItems(combinedItems);
  };

  const fetchMyBookings = async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('lesson_bookings')
      .select(`*, course_lessons (id, title, starts_at, ends_at, venue)`)
      .eq('member_id', userId)
      .eq('status', 'valid')
      .order('purchased_at', { ascending: false })
      .limit(5);
    setMyBookings(data || []);
  };

  const fetchMyEventBookings = async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('event_bookings')
      .select(`*, events (id, title, start_at, end_at, venue, image_url)`)
      .eq('member_id', userId)
      .in('status', ['confirmed', 'checked_in'])
      .order('booked_at', { ascending: false })
      .limit(5);

    // Filter to only future events
    const futureBookings = (data || []).filter(
      (b: any) => b.events && new Date(b.events.start_at) >= new Date()
    );
    setMyEventBookings(futureBookings);
  };

  const fetchMyTicketPackages = async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('tickets')
      .select(`*, courses:source_course_id (id, title)`)
      .eq('member_id', userId)
      .eq('status', 'valid')
      .order('purchased_at', { ascending: false })
      .limit(5);
    setMyTicketPackages(data || []);
  };

  const handleBookLesson = (lesson: any) => {
    setSelectedLesson(lesson);
    setBookingDialogOpen(true);
  };

  const openQRModal = async (booking: any) => {
    setSelectedBooking(booking);
    try {
      const dataUrl = await QRCodeLib.toDataURL(booking.qr_payload, {
        width: 600,
        margin: 2,
        color: { dark: '#000000', light: '#FFFFFF' },
      });
      setQrDataUrl(dataUrl);
      setQrModalOpen(true);
    } catch (error) {
      console.error('QR generation error:', error);
    }
  };

  const handleSelfCheckIn = async (booking: any) => {
    setCheckingIn(booking.id);
    try {
      const { data, error } = await supabase.rpc('check_in_with_qr', {
        qr: booking.qr_payload,
        p_location: 'Self Check-in',
        p_device_info: navigator.userAgent
      });
      if (error) throw error;
      const result = data as any;
      if (result?.success) {
        sonnerToast.success(t.qr.success, {
          description: `${result.lesson_title || 'Lektion'}`
        });
        await fetchMyBookings();
      } else {
        sonnerToast.error('Incheckning misslyckades', {
          description: result?.message || 'Ett fel uppstod'
        });
      }
    } catch (error) {
      console.error('Check-in error:', error);
      sonnerToast.error('Ett fel uppstod', {
        description: 'Kunde inte checka in. Försök igen.'
      });
    } finally {
      setCheckingIn(null);
    }
  };

  const isWithinCheckInWindow = (startsAt: string) => {
    const lessonStart = new Date(startsAt);
    const now = new Date();
    const diffMinutes = (lessonStart.getTime() - now.getTime()) / (1000 * 60);
    return diffMinutes <= 30 && diffMinutes >= -60;
  };

  const getLocale = () => {
    const localeMap: { [key: string]: string } = { sv: 'sv-SE', en: 'en-US', es: 'es-ES' };
    return localeMap[language] || 'sv-SE';
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  return (
    <>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">{t.dashboard.overview}</h1>
          <p className="text-muted-foreground">{t.dashboard.overviewDescription}</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Upcoming Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                {t.dashboard.upcoming}
              </CardTitle>
              <CardDescription>{t.dashboard.upcomingDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  <div className="h-20 bg-muted animate-pulse rounded" />
                  <div className="h-20 bg-muted animate-pulse rounded" />
                </div>
              ) : upcomingItems.length > 0 ? (
                <div className="space-y-3">
                  {upcomingItems.map((item: any) => (
                    <div key={item.id} className="p-3 rounded-lg border space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium">{item.title}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <Clock className="h-3 w-3" />
                            {new Date(item.date).toLocaleDateString(getLocale(), {
                              weekday: 'short', month: 'short', day: 'numeric'
                            })} {new Date(item.date).toLocaleTimeString(getLocale(), {
                              hour: '2-digit', minute: '2-digit'
                            })}
                          </div>
                          {item.venue && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                              <MapPin className="h-3 w-3" />
                              {item.venue}
                            </div>
                          )}
                        </div>
                        <Badge variant={item.type === 'lesson' ? 'default' : 'secondary'}>
                          {item.type === 'lesson' ? (
                            <><CalendarIcon className="h-3 w-3 mr-1" />Lektion</>
                          ) : (
                            <><PartyPopper className="h-3 w-3 mr-1" />Event</>
                          )}
                        </Badge>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          if (item.type === 'lesson') {
                            handleBookLesson(item);
                          } else {
                            navigate(`/event/${item.id}`);
                          }
                        }}
                      >
                        {t.dashboard.bookNow}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {t.dashboard.noUpcoming}
                </p>
              )}
            </CardContent>
          </Card>

          {/* My Bookings Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ticket className="h-5 w-5" />
                {t.dashboard.myBookings}
              </CardTitle>
              <CardDescription>{t.dashboard.myBookingsDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  <div className="h-20 bg-muted animate-pulse rounded" />
                  <div className="h-20 bg-muted animate-pulse rounded" />
                </div>
              ) : myBookings.length > 0 ? (
                <div className="space-y-3">
                  {myBookings.map((booking: any) => (
                    <div key={booking.id} className="p-3 rounded-lg border space-y-2">
                      <div>
                        <p className="font-medium">{booking.course_lessons?.title || 'Lektion'}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                          <Clock className="h-3 w-3" />
                          {new Date(booking.course_lessons?.starts_at).toLocaleDateString(getLocale(), {
                            weekday: 'short', month: 'short', day: 'numeric'
                          })} {new Date(booking.course_lessons?.starts_at).toLocaleTimeString(getLocale(), {
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </div>
                        {booking.course_lessons?.venue && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <MapPin className="h-3 w-3" />
                            {booking.course_lessons.venue}
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Button size="sm" variant="outline" onClick={() => openQRModal(booking)}>
                          <QrCode className="h-4 w-4 mr-1" />
                          {t.tickets.showQR}
                        </Button>
                        {isWithinCheckInWindow(booking.course_lessons?.starts_at) && (
                          <Button
                            size="sm"
                            onClick={() => handleSelfCheckIn(booking)}
                            disabled={checkingIn === booking.id}
                          >
                            {t.tickets.checkIn}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {t.dashboard.noBookings}
                </p>
              )}
            </CardContent>
          </Card>

          {/* My Events Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PartyPopper className="h-5 w-5" />
                {t.dashboard.myEvents}
              </CardTitle>
              <CardDescription>{t.dashboard.myEventsDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  <div className="h-20 bg-muted animate-pulse rounded" />
                </div>
              ) : myEventBookings.length > 0 ? (
                <div className="space-y-3">
                  {myEventBookings.map((booking: any) => (
                    <div key={booking.id} className="p-3 rounded-lg border space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium">{booking.events?.title}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <Clock className="h-3 w-3" />
                            {new Date(booking.events?.start_at).toLocaleDateString(getLocale(), {
                              weekday: 'short', month: 'short', day: 'numeric'
                            })} {new Date(booking.events?.start_at).toLocaleTimeString(getLocale(), {
                              hour: '2-digit', minute: '2-digit'
                            })}
                          </div>
                          {booking.events?.venue && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                              <MapPin className="h-3 w-3" />
                              {booking.events.venue}
                            </div>
                          )}
                        </div>
                        <Badge variant="outline">
                          {booking.ticket_count} {t.dashboard.tickets}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {booking.qr_payload && (
                          <Button size="sm" variant="outline" onClick={() => openQRModal(booking)}>
                            <QrCode className="h-4 w-4 mr-1" />
                            {t.tickets.showQR}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/event/${booking.event_id}`)}
                        >
                          {t.dashboard.viewAll}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {t.dashboard.noEvents}
                </p>
              )}
            </CardContent>
          </Card>

          {/* My Ticket Packages Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    {t.dashboard.myTicketPackages}
                  </CardTitle>
                  <CardDescription>{t.dashboard.myTicketPackagesDescription}</CardDescription>
                </div>
                <Button size="sm" variant="ghost" asChild>
                  <Link to="/biljetter">{t.dashboard.viewAll}</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  <div className="h-16 bg-muted animate-pulse rounded" />
                </div>
              ) : myTicketPackages.length > 0 ? (
                <div className="space-y-3">
                  {myTicketPackages.map((pkg: any) => {
                    const remaining = pkg.total_tickets - pkg.tickets_used;
                    const expired = isExpired(pkg.expires_at);
                    return (
                      <div key={pkg.id} className={`p-3 rounded-lg border space-y-1 ${expired ? 'opacity-50' : ''}`}>
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm">
                            {pkg.courses?.title || 'Klippkort'}
                          </p>
                          {expired ? (
                            <Badge variant="destructive">{t.dashboard.expired}</Badge>
                          ) : (
                            <Badge variant="secondary">
                              {remaining} {t.dashboard.ticketsRemaining}
                            </Badge>
                          )}
                        </div>
                        {pkg.expires_at && (
                          <p className="text-xs text-muted-foreground">
                            {t.dashboard.expires}: {new Date(pkg.expires_at).toLocaleDateString(getLocale())}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {t.dashboard.noTicketPackages}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Lesson Booking Dialog */}
      <LessonBookingDialog
        lesson={selectedLesson}
        open={bookingDialogOpen}
        onOpenChange={(open) => {
          setBookingDialogOpen(open);
          if (!open) {
            setSelectedLesson(null);
            fetchMyBookings();
          }
        }}
      />

      {/* QR Code Modal */}
      <Dialog open={qrModalOpen} onOpenChange={setQrModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.tickets.showQR}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 p-6">
            {qrDataUrl && (
              <img src={qrDataUrl} alt="QR Code" className="w-full max-w-sm" />
            )}
            {selectedBooking && (
              <div className="text-center space-y-1">
                <p className="font-medium">
                  {selectedBooking.course_lessons?.title || selectedBooking.events?.title || 'Biljett'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {new Date(selectedBooking.course_lessons?.starts_at || selectedBooking.events?.start_at).toLocaleDateString(getLocale())}
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
