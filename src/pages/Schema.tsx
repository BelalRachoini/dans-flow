import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, 
  Clock, MapPin, Users
} from 'lucide-react';
import { listCourses, listEvents } from '@/services/mockApi';
import { useLanguageStore } from '@/store/languageStore';
import type { Course, Event as EventType } from '@/types';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addWeeks, subWeeks, startOfMonth, endOfMonth, eachWeekOfInterval } from 'date-fns';
import { sv as svLocale } from 'date-fns/locale';
import { sv } from '@/locales/sv';

type ViewMode = 'day' | 'week' | 'month';

type CalendarItem = {
  id: string;
  title: string;
  type: 'course' | 'event';
  startTime: string;
  endTime: string;
  location: string;
  style?: string;
  description?: string;
  date: Date;
};

export default function Schema() {
  const { t } = useLanguageStore();
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [courses, setCourses] = useState<Course[]>([]);
  const [events, setEvents] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [coursesData, eventsData] = await Promise.all([
          listCourses(),
          listEvents(),
        ]);
        setCourses(coursesData);
        setEvents(eventsData);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const getCalendarItems = (date: Date): CalendarItem[] => {
    const items: CalendarItem[] = [];

    // Add recurring course sessions for the given date
    courses.forEach((course) => {
      const courseDate = new Date(course.startDate);
      const courseEndDate = new Date(course.endDate);
      
      if (date >= courseDate && date <= courseEndDate && date.getDay() === course.dayOfWeek) {
        const endTime = course.time.split(':');
        const startHour = parseInt(endTime[0]);
        const endTimeStr = `${(startHour + 1).toString().padStart(2, '0')}:30`;
        
        items.push({
          id: `${course.id}-${format(date, 'yyyy-MM-dd')}`,
          title: course.title,
          type: 'course',
          startTime: course.time,
          endTime: endTimeStr,
          location: course.location,
          style: course.style,
          description: course.description,
          date: date,
        });
      }
    });

    // Add events for the given date
    events.forEach((event) => {
      const eventDate = new Date(event.date);
      if (isSameDay(eventDate, date)) {
        const endTime = event.time.split(':');
        const startHour = parseInt(endTime[0]);
        const endTimeStr = `${(startHour + 3).toString().padStart(2, '0')}:00`;
        
        items.push({
          id: event.id,
          title: event.title,
          type: 'event',
          startTime: event.time,
          endTime: endTimeStr,
          location: event.location,
          description: event.description,
          date: eventDate,
        });
      }
    });

    return items.sort((a, b) => a.startTime.localeCompare(b.startTime));
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

  const timeSlots = ['18:00', '19:00', '20:00', '21:00', '22:00', '23:00'];

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
      <div className="space-y-3">
        <div className="text-center py-4 border-b">
          <h3 className="text-2xl font-bold">{format(currentDate, 'EEEE', { locale: svLocale })}</h3>
          <p className="text-muted-foreground">{format(currentDate, 'd MMMM yyyy', { locale: svLocale })}</p>
        </div>
        
        <div className="space-y-2">
          {items.length === 0 ? (
            <div className="text-center py-12">
              <CalendarIcon className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground">Inga klasser eller event denna dag</p>
            </div>
          ) : (
            items.map((item) => (
              <Card key={item.id} className="shadow-md hover-scale overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 text-center min-w-16">
                      <div className="text-sm font-semibold text-primary">{item.startTime}</div>
                      <div className="text-xs text-muted-foreground">{item.endTime}</div>
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-bold text-lg">{item.title}</h4>
                        <Badge className={item.style ? getStyleColor(item.style) : 'bg-secondary'}>
                          {item.type === 'course' ? item.style : 'Event'}
                        </Badge>
                      </div>
                      {item.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {item.location}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

    return (
      <div className="overflow-x-auto">
        <div className="min-w-[768px]">
          {/* Header */}
          <div className="grid grid-cols-8 gap-2 mb-4">
            <div className="text-sm font-medium text-muted-foreground">Tid</div>
            {days.map((day) => (
              <div key={day.toString()} className="text-center">
                <div className={`text-sm font-bold ${isSameDay(day, new Date()) ? 'text-primary' : ''}`}>
                  {format(day, 'EEE', { locale: svLocale })}
                </div>
                <div className={`text-2xl font-bold ${isSameDay(day, new Date()) ? 'text-primary' : ''}`}>
                  {format(day, 'd')}
                </div>
              </div>
            ))}
          </div>

          {/* Time slots */}
          <div className="space-y-2">
            {timeSlots.map((time) => (
              <div key={time} className="grid grid-cols-8 gap-2">
                <div className="text-sm font-medium text-muted-foreground py-2">{time}</div>
                {days.map((day) => {
                  const items = getCalendarItems(day);
                  const itemsAtThisTime = items.filter((item) => item.startTime === time);
                  
                  return (
                    <div key={day.toString()} className="min-h-20">
                      {itemsAtThisTime.map((item) => (
                        <Card key={item.id} className={`mb-1 border ${item.style ? getStyleColor(item.style) : 'bg-secondary/50'}`}>
                          <CardContent className="p-2">
                            <div className="text-xs font-bold truncate">{item.title}</div>
                            <div className="text-xs text-muted-foreground truncate">{item.location}</div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
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
    const weekdays = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];

    return (
      <div className="space-y-4">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-2">
          {weekdays.map((day) => (
            <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="space-y-2">
          {weeks.map((weekStart) => {
            const days = eachDayOfInterval({ 
              start: weekStart, 
              end: addDays(weekStart, 6) 
            });
            
            return (
              <div key={weekStart.toString()} className="grid grid-cols-7 gap-2">
                {days.map((day) => {
                  const items = getCalendarItems(day);
                  const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                  const isToday = isSameDay(day, new Date());
                  
                  return (
                    <Card 
                      key={day.toString()} 
                      className={`min-h-24 cursor-pointer transition-smooth hover:shadow-md ${
                        !isCurrentMonth ? 'opacity-40' : ''
                      } ${isToday ? 'ring-2 ring-primary' : ''}`}
                      onClick={() => {
                        setCurrentDate(day);
                        setViewMode('day');
                      }}
                    >
                      <CardContent className="p-2">
                        <div className={`text-sm font-bold mb-1 ${isToday ? 'text-primary' : ''}`}>
                          {format(day, 'd')}
                        </div>
                        <div className="space-y-1">
                          {items.slice(0, 2).map((item) => (
                            <div 
                              key={item.id} 
                              className={`text-xs p-1 rounded truncate border ${
                                item.style ? getStyleColor(item.style) : 'bg-secondary/50'
                              }`}
                            >
                              {item.startTime} {item.title}
                            </div>
                          ))}
                          {items.length > 2 && (
                            <div className="text-xs text-muted-foreground">+{items.length - 2} mer</div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
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
      return format(currentDate, 'd MMMM yyyy', { locale: svLocale });
    } else if (viewMode === 'week') {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `${format(weekStart, 'd MMM', { locale: svLocale })} - ${format(weekEnd, 'd MMM yyyy', { locale: svLocale })}`;
    } else {
      return format(currentDate, 'MMMM yyyy', { locale: svLocale });
    }
  };

  if (loading) {
    return <div className="text-center py-12">{sv.common.loading}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold">Schema</h1>
            <p className="mt-1 text-muted-foreground">
              Kurser och event 18:00 - 23:00
            </p>
          </div>
          
          {/* View mode selector */}
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'day' ? 'default' : 'outline'}
              onClick={() => setViewMode('day')}
              size="sm"
            >
              Dag
            </Button>
            <Button
              variant={viewMode === 'week' ? 'default' : 'outline'}
              onClick={() => setViewMode('week')}
              size="sm"
            >
              Vecka
            </Button>
            <Button
              variant={viewMode === 'month' ? 'default' : 'outline'}
              onClick={() => setViewMode('month')}
              size="sm"
            >
              Månad
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
                  Idag
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
          <CardTitle className="text-base">Färgkodning</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge className={getStyleColor('Salsa')}>Salsa</Badge>
            <Badge className={getStyleColor('Bachata')}>Bachata</Badge>
            <Badge className={getStyleColor('Kizomba')}>Kizomba</Badge>
            <Badge className={getStyleColor('HipHop')}>HipHop</Badge>
            <Badge className="bg-secondary">Event</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
