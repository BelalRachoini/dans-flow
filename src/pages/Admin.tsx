import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Users, Plus, Edit, Trash2, Mail, Phone, 
  Search, UserCheck, Calendar
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { sv } from '@/locales/sv';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { User } from '@/types';

const instructorSchema = z.object({
  name: z.string().min(1, 'Namn krävs').max(100),
  email: z.string().email('Ogiltig e-post'),
  phone: z.string().optional(),
});

type InstructorFormData = z.infer<typeof instructorSchema>;

type Instructor = User & {
  coursesCount?: number;
  studentsCount?: number;
};

export default function Admin() {
  const { role } = useAuthStore();
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInstructor, setEditingInstructor] = useState<Instructor | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [instructorToDelete, setInstructorToDelete] = useState<Instructor | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm<InstructorFormData>({
    resolver: zodResolver(instructorSchema),
  });

  useEffect(() => {
    loadInstructors();
  }, []);

  const loadInstructors = async () => {
    try {
      // TODO: Load from API
      // Mock data for now
      const mockInstructors: Instructor[] = [
        {
          id: 'user-2',
          name: 'Erik Svensson',
          email: 'erik@example.com',
          phone: '+46709876543',
          role: 'INSTRUKTOR',
          avatarUrl: '',
          createdAt: '2024-02-01T10:00:00Z',
          pointsBalance: 20,
          memberships: [],
          coursesCount: 4,
          studentsCount: 45,
        },
        {
          id: 'inst-2',
          name: 'Anna Lindström',
          email: 'anna.lindstrom@example.com',
          phone: '+46708887766',
          role: 'INSTRUKTOR',
          avatarUrl: '',
          createdAt: '2024-03-15T10:00:00Z',
          pointsBalance: 15,
          memberships: [],
          coursesCount: 2,
          studentsCount: 28,
        },
      ];
      
      setInstructors(mockInstructors);
    } finally {
      setLoading(false);
    }
  };

  const onSubmitInstructor = async (data: InstructorFormData) => {
    try {
      if (editingInstructor) {
        // Update existing instructor
        const updated: Instructor = {
          ...editingInstructor,
          name: data.name,
          email: data.email,
          phone: data.phone,
        };
        setInstructors(instructors.map(i => i.id === updated.id ? updated : i));
        toast.success('Instruktören har uppdaterats!');
      } else {
        // Create new instructor
        const newInstructor: Instructor = {
          id: `inst-${Date.now()}`,
          name: data.name,
          email: data.email,
          phone: data.phone,
          role: 'INSTRUKTOR',
          avatarUrl: '',
          createdAt: new Date().toISOString(),
          pointsBalance: 0,
          memberships: [],
          coursesCount: 0,
          studentsCount: 0,
        };
        setInstructors([newInstructor, ...instructors]);
        toast.success('Instruktören har lagts till!');
      }
      
      setDialogOpen(false);
      setEditingInstructor(null);
      reset();
    } catch (error) {
      toast.error('Något gick fel');
    }
  };

  const handleEdit = (instructor: Instructor) => {
    setEditingInstructor(instructor);
    setValue('name', instructor.name);
    setValue('email', instructor.email);
    setValue('phone', instructor.phone || '');
    setDialogOpen(true);
  };

  const handleDeleteClick = (instructor: Instructor) => {
    setInstructorToDelete(instructor);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!instructorToDelete) return;
    
    try {
      setInstructors(instructors.filter(i => i.id !== instructorToDelete.id));
      toast.success('Instruktören har tagits bort!');
      setDeleteDialogOpen(false);
      setInstructorToDelete(null);
    } catch (error) {
      toast.error('Något gick fel');
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingInstructor(null);
    reset();
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Filter instructors
  const filteredInstructors = instructors.filter(instructor => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      instructor.name.toLowerCase().includes(query) ||
      instructor.email.toLowerCase().includes(query) ||
      instructor.phone?.toLowerCase().includes(query)
    );
  });

  if (role !== 'admin') {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Du har inte behörighet att se denna sida</p>
      </div>
    );
  }

  if (loading) {
    return <div className="text-center py-12">{sv.common.loading}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Administratör</h1>
          <p className="mt-1 text-muted-foreground">
            Hantera instruktörer och systeminställningar
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
          <DialogTrigger asChild>
            <Button variant="hero">
              <Plus className="mr-2" size={16} />
              Lägg till instruktör
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingInstructor ? 'Redigera instruktör' : 'Lägg till instruktör'}
              </DialogTitle>
              <DialogDescription>
                {editingInstructor 
                  ? 'Uppdatera instruktörsinformation' 
                  : 'Skapa ett nytt instruktörskonto'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmitInstructor)} className="space-y-4">
              <div>
                <Label htmlFor="name">Namn</Label>
                <Input id="name" {...register('name')} placeholder="T.ex. Anna Andersson" />
                {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
              </div>

              <div>
                <Label htmlFor="email">E-post</Label>
                <Input id="email" type="email" {...register('email')} placeholder="anna@example.com" />
                {errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message}</p>}
              </div>

              <div>
                <Label htmlFor="phone">Telefon (valfritt)</Label>
                <Input id="phone" {...register('phone')} placeholder="+46701234567" />
                {errors.phone && <p className="text-sm text-destructive mt-1">{errors.phone.message}</p>}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleDialogClose}>
                  {sv.common.cancel}
                </Button>
                <Button type="submit" variant="hero">
                  {editingInstructor ? 'Uppdatera' : 'Lägg till'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Totala instruktörer</p>
                <p className="text-3xl font-bold">{instructors.length}</p>
              </div>
              <UserCheck className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Totala kurser</p>
                <p className="text-3xl font-bold">
                  {instructors.reduce((sum, i) => sum + (i.coursesCount || 0), 0)}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Totala studenter</p>
                <p className="text-3xl font-bold">
                  {instructors.reduce((sum, i) => sum + (i.studentsCount || 0), 0)}
                </p>
              </div>
              <Users className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="shadow-md">
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Sök instruktör efter namn, email eller telefon..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Instructors Table */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Instruktörer</span>
            <Badge variant="secondary">{filteredInstructors.length} instruktörer</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Namn</TableHead>
                  <TableHead>Kontakt</TableHead>
                  <TableHead>Kurser</TableHead>
                  <TableHead>Studenter</TableHead>
                  <TableHead>Medlem sedan</TableHead>
                  <TableHead className="text-right">Åtgärder</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInstructors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Inga instruktörer hittades
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInstructors.map((instructor) => (
                    <TableRow key={instructor.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-sm font-bold text-primary">
                              {instructor.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                            </span>
                          </div>
                          {instructor.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center gap-2">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            <span className="text-muted-foreground">{instructor.email}</span>
                          </div>
                          {instructor.phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              <span className="text-muted-foreground">{instructor.phone}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{instructor.coursesCount || 0} kurser</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold">{instructor.studentsCount || 0}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(instructor.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleEdit(instructor)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleDeleteClick(instructor)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Är du säker?</AlertDialogTitle>
            <AlertDialogDescription>
              Detta kommer permanent ta bort instruktören "{instructorToDelete?.name}". 
              Denna åtgärd kan inte ångras och alla relaterade kurser kommer att påverkas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
