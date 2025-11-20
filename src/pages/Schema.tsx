import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, 
  Clock, MapPin, Users, Ticket, BookOpen
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguageStore } from '@/store/languageStore';
import { useAuthStore } from '@/store/authStore';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addWeeks, subWeeks, startOfMonth, endOfMonth, eachWeekOfInterval } from 'date-fns';
import { sv as svLocale, enUS as enLocale, es as esLocale } from 'date-fns/locale';

type ViewMode = 'day' | 'week' | 'month';

type CalendarItem = {
  id: string;
  title: string;
  type: 'lesson' | 'event';
  startTime: string;
  endTime: string;
  location: string;
  style?: string;
  description?: string;
  date: Date;
};

export default function Schema() {
  const { t, language } = useLanguageStore();
  const { userId } = useAuthStore();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarItems, setCalendarItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Get the appropriate date-fns locale based on current language
  const getDateLocale = () => {
    switch (language) {
      case 'en':
        return enLocale;
      case 'es':
        return esLocale;
      default:
        return svLocale;
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const startDate = startOfMonth(subWeeks(currentDate, 2)).toISOString();
        const endDate = endOfMonth(addWeeks(currentDate, 2)).toISOString();

        console.log('🔍 Loading Schema data...', {
          userId,
          startDate,
          endDate,
          currentDate
        });

        // Fetch course lessons
        const { data: lessons, error: lessonsError } = await supabase
          .from('course_lessons')
          .select('*')
          .gte('starts_at', startDate)
          .lte('starts_at', endDate);

        console.log('📚 Lessons query result:', { 
          count: lessons?.length, 
          error: lessonsError,
          lessons: lessons 
        });

        if (lessonsError) {
          console.error('❌ Lessons error details:', lessonsError);
          throw lessonsError;
        }

        // Fetch events
        const { data: events, error: eventsError } = await supabase
          .from('events')
          .select('*')
          .gte('start_at', startDate)
          .lte('start_at', endDate)
          .eq('status', 'published');

        console.log('🎉 Events query result:', { 
          count: events?.length, 
          error: eventsError,
          events: events 
        });

        if (eventsError) {
          console.error('❌ Events error details:', eventsError);
          throw eventsError;
        }

        // Map lessons to calendar items
        const lessonItems: CalendarItem[] = (lessons || []).map((lesson) => {
          const startDate = new Date(lesson.starts_at);
          const endDate = lesson.ends_at ? new Date(lesson.ends_at) : addDays(startDate, 2);
          return {
            id: lesson.id,
            title: lesson.title || t.calendar.lesson,
            type: 'lesson' as const,
            startTime: format(startDate, 'HH:mm'),
            endTime: format(endDate, 'HH:mm'),
            location: lesson.venue || '',
            description: lesson.notes || '',
            date: startDate,
          };
        });

        // Map events to calendar items
        const eventItems: CalendarItem[] = (events || []).map((event) => {
          const startDate = new Date(event.start_at);
          const endDate = event.end_at ? new Date(event.end_at) : addDays(startDate, 0);
          return {
            id: event.id,
            title: event.title,
            type: 'event' as const,
            startTime: format(startDate, 'HH:mm'),
            endTime: format(endDate, 'HH:mm'),
            location: event.venue,
            description: event.description,
            date: startDate,
          };
        });

        // Combine and sort all items
        const combined = [...lessonItems, ...eventItems];
        console.log('✅ Combined calendar items:', { 
          lessons: lessonItems.length, 
          events: eventItems.length,
          total: combined.length
        });
        
        setCalendarItems(combined);
      } catch (error) {
        console.error('❌ Error loading calendar:', error);
      } finally {
        setLoading(false);
      }
    };

    // Only load data if user is authenticated
    if (!userId) {
      console.warn('⚠️ No userId found, waiting for authentication...');
      setLoading(false);
      return;
    }

    loadData();
  }, [currentDate, userId]);

  const getCalendarItems = (date: Date): CalendarItem[] => {
    return calendarItems
      .filter(item => isSameDay(item.date, date))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  };

  const getStyleColor = (style?: string) => {
    if (!style) return 'bg-accent text-accent-foreground';
    const colors: Record<string, string> = {
      Salsa: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20',
      Bachata: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20',
      Tango: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
      Kizomba: 'bg-pink-500/10 text-pink-700 dark:text-pink-400 border-pink-500/20',
      Zouk: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20',
      HipHop: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20',
    };
    return colors[style] || 'bg-accent text-accent-foreground';
  };

  const timeSlots = [
    '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00',
    '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00'
  ];

  // Helper function to calculate event positioning within a time slot
  const calculateEventPosition = (startTime: string, endTime: string) => {
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    const duration = Math.max(endMinutes - startMinutes, 30); // Minimum 30 min height
    
    return { 
      startHour,
      startMin,
      duration 
    };
  };

  const handlePrevious = () => {
    if (viewMode === 'day') {
      setCurrentDate(addDays(currentDate, -1));
    } else if (viewMode === 'week') {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    }
  };

  const handleNext = () => {
    if (viewMode === 'day') {
      setCurrentDate(addDays(currentDate, 1));
    } else if (viewMode === 'week') {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const renderDayView = () => {
    const items = getCalendarItems(currentDate);
    
    return (
      <div className="space-y-4">
        <div className="text-center py-4 border-b">
          <h3 className="text-2xl font-bold">{format(currentDate, 'EEEE', { locale: getDateLocale() })}</h3>
          <p className="text-muted-foreground">{format(currentDate, 'd MMMM yyyy', { locale: getDateLocale() })}</p>
        </div>
        
        {items.length === 0 ? (
          <div className="text-center py-12">
            <CalendarIcon className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground">{t.schedule.noEventsToday}</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full border-collapse">
              <tbody>
                {timeSlots.map((time) => {
                  const slotHour = parseInt(time.split(':')[0]);
                  const itemsAtThisHour = items.filter((item) => {
                    const itemHour = parseInt(item.startTime.split(':')[0]);
                    return itemHour === slotHour;
                  });
                  
                  return (
                    <tr key={time} className="border-b last:border-b-0">
                      <td className="w-20 border-r p-2 text-xs text-muted-foreground text-right align-top font-medium">
                        {time}
                      </td>
                      <td className="p-2 relative min-h-20">
                        <div className="space-y-1">
                          {itemsAtThisHour.map((item) => {
                            const pos = calculateEventPosition(item.startTime, item.endTime);
                            const heightRem = Math.max(pos.duration / 15, 3); // 1rem per 15min, min 3rem
                            
                            return (
                              <div
                                key={item.id}
                                className={`rounded-md p-3 border-l-4 shadow-sm cursor-pointer transition-all hover:shadow-md ${
                                  item.type === 'lesson'
                                    ? 'bg-blue-500/10 border-blue-500 hover:bg-blue-500/20'
                                    : 'bg-purple-500/10 border-purple-500 hover:bg-purple-500/20'
                                }`}
                                style={{ minHeight: `${heightRem}rem` }}
                                onClick={() => item.type === 'event' && navigate('/event')}
                              >
                                <div className="flex items-start justify-between gap-2 mb-1">
                                  <h4 className="font-bold text-sm">{item.title}</h4>
                                  <Badge variant="outline" className="text-xs">
                                    {item.type === 'lesson' ? t.calendar.lesson : t.calendar.event}
                                  </Badge>
                                </div>
                                <div className="text-xs text-muted-foreground space-y-1">
                                  <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {item.startTime} - {item.endTime}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {item.location}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
    const today = new Date();

    return (
      <div className="overflow-x-auto">
        <div className="min-w-[768px]">
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="sticky left-0 bg-muted/30 w-20 p-2 text-xs font-medium text-muted-foreground text-right border-r">
                    {t.schedule.time}
                  </th>
                  {days.map((day) => {
                    const isToday = isSameDay(day, today);
                    return (
                      <th 
                        key={day.toString()} 
                        className={`p-2 text-center border-r last:border-r-0 min-w-32 ${
                          isToday ? 'bg-primary/5' : ''
                        }`}
                      >
                        <div className={`text-sm font-bold ${isToday ? 'text-primary' : ''}`}>
                          {format(day, 'EEE', { locale: getDateLocale() })}
                        </div>
                        <div className={`text-2xl font-bold ${isToday ? 'text-primary' : ''}`}>
                          {format(day, 'd')}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {timeSlots.map((time) => {
                  const slotHour = parseInt(time.split(':')[0]);
                  
                  return (
                    <tr key={time} className="border-b last:border-b-0 h-20">
                      <td className="border-r p-2 text-xs text-muted-foreground text-right align-top font-medium">
                        {time}
                      </td>
                      {days.map((day) => {
                        const items = getCalendarItems(day);
                        const isToday = isSameDay(day, today);
                        const itemsAtThisHour = items.filter((item) => {
                          const itemHour = parseInt(item.startTime.split(':')[0]);
                          return itemHour === slotHour;
                        });
                        
                        return (
                          <td 
                            key={day.toString()} 
                            className={`border-r last:border-r-0 p-1 relative ${
                              isToday ? 'bg-primary/5' : ''
                            }`}
                          >
                            <div className="space-y-1">
                              {itemsAtThisHour.map((item) => (
                                <div
                                  key={item.id}
                                  className={`rounded p-1 text-xs font-medium shadow-sm border-l-2 cursor-pointer transition-all hover:shadow-md ${
                                    item.type === 'lesson'
                                      ? 'bg-blue-500/10 border-blue-500 hover:bg-blue-500/20'
                                      : 'bg-purple-500/10 border-purple-500 hover:bg-purple-500/20'
                                  }`}
                                  onClick={() => item.type === 'event' && navigate('/event')}
                                >
                                  <div className="flex items-center gap-1 truncate">
                                    {item.type === 'event' && <Ticket className="h-3 w-3 flex-shrink-0" />}
                                    {item.type === 'lesson' && <BookOpen className="h-3 w-3 flex-shrink-0" />}
                                    <span className="truncate font-semibold">{item.title}</span>
                                  </div>
                                  <div className="truncate text-muted-foreground mt-0.5">
                                    {item.startTime}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
    
    const weeks = eachWeekOfInterval({ start: startDate, end: endDate }, { weekStartsOn: 1 });
    const weekdays = [
      t.schedule.weekdays.mon,
      t.schedule.weekdays.tue,
      t.schedule.weekdays.wed,
      t.schedule.weekdays.thu,
      t.schedule.weekdays.fri,
      t.schedule.weekdays.sat,
      t.schedule.weekdays.sun,
    ];
    const today = new Date();

    return (
      <div className="space-y-2">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border rounded-t-lg overflow-hidden bg-muted/30">
          {weekdays.map((day) => (
            <div key={day} className="text-center text-sm font-medium text-muted-foreground py-3 border-r last:border-r-0">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="border rounded-b-lg overflow-hidden">
          {weeks.map((weekStart, weekIdx) => {
            const days = eachDayOfInterval({ 
              start: weekStart, 
              end: addDays(weekStart, 6) 
            });
            
            return (
              <div key={weekStart.toString()} className={`grid grid-cols-7 ${weekIdx < weeks.length - 1 ? 'border-b' : ''}`}>
                {days.map((day) => {
                  const items = getCalendarItems(day);
                  const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                  const isToday = isSameDay(day, today);
                  
                  return (
                    <div
                      key={day.toString()} 
                      className={`min-h-28 p-2 cursor-pointer transition-all hover:bg-muted/50 border-r last:border-r-0 ${
                        !isCurrentMonth ? 'opacity-40 bg-muted/20' : ''
                      } ${isToday ? 'bg-primary/5 ring-2 ring-inset ring-primary/20' : ''}`}
                      onClick={() => {
                        setCurrentDate(day);
                        setViewMode('day');
                      }}
                    >
                      <div className={`text-sm font-bold mb-2 ${isToday ? 'text-primary' : ''}`}>
                        {format(day, 'd')}
                      </div>
                      <div className="space-y-1">
                        {items.slice(0, 3).map((item) => (
                          <div 
                            key={item.id} 
                            className={`text-xs p-1 rounded truncate border-l-2 flex items-center gap-1 ${
                              item.type === 'lesson' 
                                ? 'bg-blue-500/10 border-blue-500' 
                                : 'bg-purple-500/10 border-purple-500'
                            }`}
                            onClick={(e) => {
                              if (item.type === 'event') {
                                e.stopPropagation();
                                navigate('/event');
                              }
                            }}
                          >
                            {item.type === 'event' && <Ticket className="h-3 w-3 flex-shrink-0" />}
                            {item.type === 'lesson' && <BookOpen className="h-3 w-3 flex-shrink-0" />}
                            <span className="truncate">
                              <span className="font-medium">{item.startTime}</span> {item.title}
                            </span>
                          </div>
                        ))}
                        {items.length > 3 && (
                          <div className="text-xs text-muted-foreground font-medium">
                            +{items.length - 3} {t.schedule.moreItems}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const getViewTitle = () => {
    if (viewMode === 'day') {
      return format(currentDate, 'd MMMM yyyy', { locale: getDateLocale() });
    } else if (viewMode === 'week') {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `${format(weekStart, 'd MMM', { locale: getDateLocale() })} - ${format(weekEnd, 'd MMM yyyy', { locale: getDateLocale() })}`;
    } else {
      return format(currentDate, 'MMMM yyyy', { locale: getDateLocale() });
    }
  };

  if (loading) {
    return <div className="text-center py-12">{t.common.loading}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold">{t.schedule.title}</h1>
            <p className="mt-1 text-muted-foreground">
              {t.schedule.subtitle}
            </p>
          </div>
          
          {/* View mode selector */}
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'day' ? 'default' : 'outline'}
              onClick={() => setViewMode('day')}
              size="sm"
            >
              {t.schedule.day}
            </Button>
            <Button
              variant={viewMode === 'week' ? 'default' : 'outline'}
              onClick={() => setViewMode('week')}
              size="sm"
            >
              {t.schedule.week}
            </Button>
            <Button
              variant={viewMode === 'month' ? 'default' : 'outline'}
              onClick={() => setViewMode('month')}
              size="sm"
            >
              {t.schedule.month}
            </Button>
          </div>
        </div>

        {/* Navigation */}
        <Card className="shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Button variant="outline" size="icon" onClick={handlePrevious}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={handleToday} size="sm">
                  {t.schedule.today}
                </Button>
                <h2 className="text-lg font-semibold">{getViewTitle()}</h2>
              </div>
              
              <Button variant="outline" size="icon" onClick={handleNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Calendar View */}
      <Card className="shadow-lg">
        <CardContent className="p-4 md:p-6">
          {viewMode === 'day' && renderDayView()}
          {viewMode === 'week' && renderWeekView()}
          {viewMode === 'month' && renderMonthView()}
        </CardContent>
      </Card>

      {/* Legend */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="text-base">{t.schedule.colorCoding}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge className={getStyleColor('Salsa')}>{t.styles.Salsa}</Badge>
            <Badge className={getStyleColor('Bachata')}>{t.styles.Bachata}</Badge>
            <Badge className={getStyleColor('Kizomba')}>{t.styles.Kizomba}</Badge>
            <Badge className={getStyleColor('HipHop')}>{t.styles.HipHop}</Badge>
            <Badge className="bg-secondary">{t.calendar.event}</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
