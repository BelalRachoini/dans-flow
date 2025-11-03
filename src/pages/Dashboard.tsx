import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  Coins, TrendingUp, Users, Calendar, 
  PartyPopper, ShoppingBag, ArrowRight, QrCode,
  Award, Star, Crown, Sparkles, Gift, Check
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { listCourses, listEvents, listInvoices } from '@/services/mockApi';
import { useLanguageStore } from '@/store/languageStore';
import type { Course, Event as EventType, Invoice } from '@/types';

type MembershipTier = {
  name: string;
  pointsRequired: number;
  icon: typeof Award;
  color: string;
  benefits: string[];
};

const membershipTiers: MembershipTier[] = [
  {
    name: 'Brons',
    pointsRequired: 0,
    icon: Award,
    color: 'text-orange-700 dark:text-orange-400',
    benefits: [
      'Tillgång till alla grundkurser',
      'Bokningssystem för klasser',
      'Medlemsrabatt 5%',
    ],
  },
  {
    name: 'Silver',
    pointsRequired: 50,
    icon: Star,
    color: 'text-slate-500 dark:text-slate-400',
    benefits: [
      'Alla Brons-förmåner',
      'Förtur vid bokningar',
      'Medlemsrabatt 10%',
      'En gratis workshop per månad',
      'Tillgång till medlems-events',
    ],
  },
  {
    name: 'Guld',
    pointsRequired: 100,
    icon: Crown,
    color: 'text-yellow-600 dark:text-yellow-400',
    benefits: [
      'Alla Silver-förmåner',
      'Medlemsrabatt 15%',
      'Obegränsade workshops',
      'VIP-tillträde till alla event',
      'Personlig träningsplan',
      'Gratis gästbiljett per månad',
    ],
  },
  {
    name: 'Platinum',
    pointsRequired: 200,
    icon: Sparkles,
    color: 'text-purple-600 dark:text-purple-400',
    benefits: [
      'Alla Guld-förmåner',
      'Medlemsrabatt 20%',
      'Privatlektioner varje månad',
      'Exklusiva masterclasses',
      'Gratis eventbiljetter',
      'Egen parkeringsplats',
      'VIP-lounge tillgång',
    ],
  },
];

export default function Dashboard() {
  const { userId } = useAuthStore();
  const { t } = useLanguageStore();
  const [courses, setCourses] = useState<Course[]>([]);
  const [events, setEvents] = useState<EventType[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  const userPoints = 0; // TODO: fetch from database

  // Calculate current tier and progress
  const getCurrentTier = () => {
    for (let i = membershipTiers.length - 1; i >= 0; i--) {
      if (userPoints >= membershipTiers[i].pointsRequired) {
        return i;
      }
    }
    return 0;
  };

  const currentTierIndex = getCurrentTier();
  const currentTier = membershipTiers[currentTierIndex];
  const nextTier = membershipTiers[currentTierIndex + 1];
  
  const pointsToNextLevel = nextTier 
    ? nextTier.pointsRequired - userPoints 
    : 0;
  
  const progressPercentage = nextTier
    ? ((userPoints - currentTier.pointsRequired) / (nextTier.pointsRequired - currentTier.pointsRequired)) * 100
    : 100;

  const CurrentTierIcon = currentTier.icon;
  const NextTierIcon = nextTier?.icon;

  useEffect(() => {
    const loadData = async () => {
      const [coursesData, eventsData, invoicesData] = await Promise.all([
        listCourses(),
        listEvents(),
        listInvoices(userId),
      ]);
      
      setCourses(coursesData);
      setEvents(eventsData);
      setRecentInvoices(invoicesData.slice(0, 5));
    };

    loadData();
  }, [userId]);

  const upcomingEvent = events[0];
  const todayCourse = courses[0];

  return (
    <div className="space-y-4 pb-6 max-w-full overflow-x-hidden">
      {/* Membership Progress Section */}
      <Card className="shadow-lg gradient-subtle">
        <CardContent className="p-6">
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center ${currentTier.color}`}>
                  <CurrentTierIcon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Din nivå</p>
                  <p className="text-xl font-bold">{currentTier.name}</p>
                </div>
              </div>

              {nextTier && (
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <button className="flex flex-col items-center gap-1 hover-scale cursor-pointer group">
                      <div className={`h-16 w-16 rounded-full bg-background shadow-lg flex items-center justify-center border-2 border-primary/20 group-hover:border-primary/40 transition-smooth ${nextTier.color}`}>
                        {NextTierIcon && <NextTierIcon className="h-8 w-8" />}
                      </div>
                      <span className="text-xs font-semibold text-muted-foreground group-hover:text-primary transition-smooth">
                        {nextTier.name}
                      </span>
                    </button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        {NextTierIcon && <NextTierIcon className={`h-6 w-6 ${nextTier.color}`} />}
                        {nextTier.name} Medlemskap
                      </DialogTitle>
                      <DialogDescription>
                        Lås upp dessa förmåner med {nextTier.pointsRequired} poäng
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-3">
                        {nextTier.benefits.map((benefit, index) => (
                          <div key={index} className="flex items-start gap-3">
                            <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <Check className="h-3 w-3 text-primary" />
                            </div>
                            <p className="text-sm">{benefit}</p>
                          </div>
                        ))}
                      </div>
                      <div className="pt-4 border-t">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Dina poäng:</span>
                          <span className="font-bold">{userPoints} poäng</span>
                        </div>
                        <div className="flex items-center justify-between text-sm mt-2">
                          <span className="text-muted-foreground">Behöver:</span>
                          <span className="font-bold text-primary">{pointsToNextLevel} poäng till</span>
                        </div>
                      </div>
                      <Link to="/kurser-poang" onClick={() => setDialogOpen(false)}>
                        <Button className="w-full" size="lg">
                          <Coins className="mr-2 h-4 w-4" />
                          Köp poäng
                        </Button>
                      </Link>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {/* Progress Bar */}
            {nextTier ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground font-medium">Framsteg till {nextTier.name}</span>
                  <span className="font-bold text-primary flex items-center gap-1">
                    <TrendingUp className="h-4 w-4" />
                    {pointsToNextLevel} poäng kvar
                  </span>
                </div>
                <div className="relative">
                  <Progress value={progressPercentage} className="h-4" />
                  <div className="absolute -top-1 left-0 right-0 flex justify-between px-1 pointer-events-none">
                    <div className={`h-6 w-6 rounded-full bg-background shadow-md flex items-center justify-center border-2 transition-smooth ${
                      progressPercentage > 0 ? 'border-primary' : 'border-muted'
                    }`}>
                      <CurrentTierIcon className={`h-3 w-3 ${currentTier.color}`} />
                    </div>
                    <div className={`h-6 w-6 rounded-full bg-background shadow-md flex items-center justify-center border-2 transition-smooth ${
                      progressPercentage >= 100 ? 'border-primary' : 'border-muted'
                    }`}>
                      {NextTierIcon && <NextTierIcon className={`h-3 w-3 ${nextTier.color}`} />}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-muted-foreground">{currentTier.name}</span>
                  <span className={nextTier.color}>{nextTier.name}</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-2">
                <Badge variant="secondary" className="gap-1">
                  <Sparkles className="h-3 w-3" />
                  Du har nått högsta nivån!
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Points Card - Prominent on Mobile */}
      <Card className="shadow-lg hover-scale">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Dina poäng</p>
              <p className="text-4xl font-bold text-primary">{userPoints}</p>
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
    </div>
  );
}
