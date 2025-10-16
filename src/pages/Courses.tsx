import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, MapPin, User, Clock, Coins, ShoppingCart } from 'lucide-react';
import { listCourses, listPointsTransactions } from '@/services/mockApi';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';
import { toast } from 'sonner';
import { sv } from '@/locales/sv';
import type { Course, PointsTransaction } from '@/types';

export default function Courses() {
  const { user } = useAuthStore();
  const { addItem } = useCartStore();
  const [courses, setCourses] = useState<Course[]>([]);
  const [transactions, setTransactions] = useState<PointsTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [coursesData, transactionsData] = await Promise.all([
          listCourses(),
          user?.id ? listPointsTransactions(user.id) : Promise.resolve([]),
        ]);
        setCourses(coursesData);
        setTransactions(transactionsData);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user?.id]);

  const handleBuyCourse = (course: Course) => {
    addItem({
      id: `course-${course.id}`,
      type: 'course',
      itemId: course.id,
      name: course.title,
      priceSEK: course.priceSEK,
      quantity: 1,
    });
    toast.success(`${course.title} tillagd i varukorg!`);
  };

  const getStyleColor = (style: string) => {
    const colors: Record<string, string> = {
      Salsa: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      Bachata: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      Tango: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      Kizomba: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
      Zouk: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      HipHop: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    };
    return colors[style] || 'bg-gray-100 text-gray-700';
  };

  if (loading) {
    return <div className="text-center py-12">{sv.common.loading}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{sv.nav.kurserPoang}</h1>
          <p className="mt-1 text-muted-foreground">
            Köp kurser, samla poäng och delta i lektioner
          </p>
        </div>
        <Card className="shadow-md">
          <CardContent className="py-4 px-6">
            <div className="flex items-center gap-3">
              <Coins className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Ditt saldo</p>
                <p className="text-2xl font-bold text-primary">{user?.pointsBalance || 0} poäng</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="courses" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="courses">Tillgängliga Kurser</TabsTrigger>
          <TabsTrigger value="history">Poänghistorik</TabsTrigger>
        </TabsList>

        <TabsContent value="courses" className="mt-6">
          {/* Info Banner */}
          <Card className="mb-6 gradient-primary text-white shadow-md">
            <CardContent className="py-6">
              <div className="flex items-start gap-4">
                <Coins className="h-12 w-12 shrink-0" />
                <div>
                  <h3 className="text-lg font-semibold mb-2">Så fungerar poängsystemet</h3>
                  <p className="text-white/90">
                    Köp en kurs – få lika många poäng som lektioner. Varje gång du checkar in på en lektion 
                    dras 1 poäng. Poängen är flexibla och kan användas i vilken klass som helst, 
                    oavsett stil eller nivå!
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Courses Grid */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <Card key={course.id} className="shadow-md transition-smooth hover:shadow-lg flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-xl">{course.title}</CardTitle>
                    <Badge className={getStyleColor(course.style)}>
                      {sv.styles[course.style]}
                    </Badge>
                  </div>
                  <CardDescription className="mt-2">
                    {course.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{course.totalLessons} lektioner</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'][course.dayOfWeek]} {course.time}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{course.location}</span>
                  </div>
                  {course.instructorId && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>Instruktör</span>
                    </div>
                  )}
                  <div className="pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Pris</p>
                        <p className="text-2xl font-bold">{course.priceSEK} kr</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Poäng</p>
                        <p className="text-2xl font-bold text-primary">+{course.totalLessons}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex gap-2">
                  <Button 
                    variant="hero" 
                    className="flex-1"
                    onClick={() => handleBuyCourse(course)}
                  >
                    <ShoppingCart size={16} className="mr-2" />
                    Köp kurs
                  </Button>
                  <Button variant="outline">
                    {sv.courses.viewSchedule}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>{sv.courses.pointsHistory}</CardTitle>
              <CardDescription>
                Din poängaktivitet och transaktioner
              </CardDescription>
            </CardHeader>
            <CardContent>
              {transactions.length > 0 ? (
                <div className="space-y-3">
                  {transactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between rounded-lg border border-border p-4 transition-smooth hover:shadow-sm"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{transaction.description}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(transaction.createdAt).toLocaleString('sv-SE')}
                        </p>
                      </div>
                      <div className={`text-lg font-bold ${transaction.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {transaction.amount > 0 ? '+' : ''}{transaction.amount}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Ingen poänghistorik ännu
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
