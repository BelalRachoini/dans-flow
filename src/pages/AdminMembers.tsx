import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Search, UserCog } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Role = 'member' | 'instructor' | 'admin';
type DanceRole = 'follower' | 'leader' | null;

interface Member {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  dance_role: DanceRole;
  created_at: string;
}

export default function AdminMembers() {
  const [members, setMembers] = useState<Member[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [danceRoleFilter, setDanceRoleFilter] = useState<string>('all');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [newRole, setNewRole] = useState<Role | null>(null);

  useEffect(() => {
    fetchMembers();
  }, []);

  useEffect(() => {
    filterMembers();
  }, [searchTerm, roleFilter, danceRoleFilter, members]);

  const fetchMembers = async () => {
    try {
      // Single query with JOIN to get profiles with their roles
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          email,
          created_at,
          dance_role,
          user_roles!inner(role)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Query error:', error);
        throw error;
      }

      // Map the data to our Member interface
      const membersWithRoles = (data || []).map((profile: any) => ({
        id: profile.id,
        full_name: profile.full_name || 'Okänd',
        email: profile.email || '-',
        role: profile.user_roles[0]?.role || 'member',
        dance_role: profile.dance_role as DanceRole,
        created_at: profile.created_at,
      }));

      setMembers(membersWithRoles);
      setFilteredMembers(membersWithRoles);
    } catch (error: any) {
      console.error('Error fetching members:', error);
      toast.error(`Kunde inte hämta medlemmar: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const filterMembers = () => {
    let filtered = [...members];

    if (searchTerm) {
      filtered = filtered.filter(m => 
        m.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (roleFilter !== 'all') {
      filtered = filtered.filter(m => m.role === roleFilter);
    }

    if (danceRoleFilter !== 'all') {
      if (danceRoleFilter === 'not_set') {
        filtered = filtered.filter(m => !m.dance_role);
      } else {
        filtered = filtered.filter(m => m.dance_role === danceRoleFilter);
      }
    }

    setFilteredMembers(filtered);
  };

  const handleRoleChange = async () => {
    if (!selectedMember || !newRole) return;

    try {
      setLoading(true);

      // Delete existing role
      const { error: deleteError } = await (supabase as any)
        .from('user_roles')
        .delete()
        .eq('user_id', selectedMember.id);

      if (deleteError) throw deleteError;

      // Insert new role
      const { error: insertError } = await (supabase as any)
        .from('user_roles')
        .insert({ user_id: selectedMember.id, role: newRole });

      if (insertError) throw insertError;

      toast.success(`Roll ändrad till ${getRoleLabel(newRole)}`);
      
      // Refresh members list
      await fetchMembers();
      
      setSelectedMember(null);
      setNewRole(null);
    } catch (error: any) {
      console.error('Error changing role:', error);
      toast.error('Kunde inte ändra roll');
    } finally {
      setLoading(false);
    }
  };

  const getRoleLabel = (role: Role) => {
    switch (role) {
      case 'admin': return 'Admin';
      case 'instructor': return 'Instruktör';
      case 'member': return 'Medlem';
    }
  };

  const getRoleBadgeVariant = (role: Role) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'instructor': return 'default';
      case 'member': return 'secondary';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Medlemshantering</h1>
        <p className="text-muted-foreground">Hantera medlemmar och roller</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            Alla medlemmar
          </CardTitle>
          <CardDescription>
            Sök, filtrera och uppdatera medlemsroller
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Sök efter namn eller e-post..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filtrera efter roll" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla roller</SelectItem>
                <SelectItem value="member">Medlem</SelectItem>
                <SelectItem value="instructor">Instruktör</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>

            <Select value={danceRoleFilter} onValueChange={setDanceRoleFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filtrera dansroll" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla dansroller</SelectItem>
                <SelectItem value="follower">Följare</SelectItem>
                <SelectItem value="leader">Ledare</SelectItem>
                <SelectItem value="not_set">Ej valt</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Namn</TableHead>
                  <TableHead>E-post</TableHead>
                  <TableHead>Roll</TableHead>
                  <TableHead>Dansroll</TableHead>
                  <TableHead>Skapad</TableHead>
                  <TableHead className="text-right">Åtgärder</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredMembers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Inga medlemmar hittades
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMembers.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">{member.full_name}</TableCell>
                      <TableCell>{member.email}</TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(member.role)}>
                          {getRoleLabel(member.role)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {member.dance_role ? (
                          <Badge variant={member.dance_role === 'follower' ? 'secondary' : 'default'}>
                            {member.dance_role === 'follower' ? 'Följare' : 'Ledare'}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(member.created_at).toLocaleDateString('sv-SE')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Select
                          onValueChange={(value: Role) => {
                            setSelectedMember(member);
                            setNewRole(value);
                          }}
                        >
                          <SelectTrigger className="w-[140px] ml-auto">
                            <SelectValue placeholder="Ändra roll" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="member">Till Medlem</SelectItem>
                            <SelectItem value="instructor">Till Instruktör</SelectItem>
                            <SelectItem value="admin">Till Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!selectedMember && !!newRole} onOpenChange={() => {
        setSelectedMember(null);
        setNewRole(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bekräfta rolluppdatering</AlertDialogTitle>
            <AlertDialogDescription>
              Vill du ändra rollen för <strong>{selectedMember?.full_name}</strong> från{' '}
              <strong>{selectedMember && getRoleLabel(selectedMember.role)}</strong> till{' '}
              <strong>{newRole && getRoleLabel(newRole)}</strong>?
              <br /><br />
              Denna ändring kommer att loggas i revisionsloggen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={handleRoleChange}>
              Bekräfta ändring
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
