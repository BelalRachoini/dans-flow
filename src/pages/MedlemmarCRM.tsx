import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguageStore } from '@/store/languageStore';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, DollarSign, TrendingUp, Award, Search, MoreVertical, Mail, UserPlus } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MemberDetailDrawer } from '@/components/MemberDetailDrawer';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';

interface MemberWithRevenue {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  level: string;
  points: number;
  status: string;
  created_at: string;
  revenue_cents: number;
  txn_count: number;
}

const levelColors = {
  bronze: 'bg-orange-100 text-orange-800 border-orange-200',
  silver: 'bg-slate-200 text-slate-800 border-slate-300',
  gold: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  platinum: 'bg-purple-100 text-purple-800 border-purple-200',
  vip: 'bg-rose-100 text-rose-800 border-rose-200',
};

export default function MedlemmarCRM() {
  const { t } = useLanguageStore();
  const { role } = useAuthStore();
  const queryClient = useQueryClient();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('revenue');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [newMember, setNewMember] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    level: 'bronze',
  });

  // Fetch members with revenue
  const { data: members = [], isLoading } = useQuery({
    queryKey: ['crm-members'],
    queryFn: async () => {
      // Use JOIN to get profiles with member and instructor roles in one query
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          *,
          user_roles!inner(role)
        `)
        .in('user_roles.role', ['member', 'instructor']);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        throw profilesError;
      }

      // Fetch revenue data separately (can't join views easily)
      const { data: revenues, error: revenuesError } = await supabase
        .from('v_member_revenue')
        .select('*');

      if (revenuesError) {
        console.error('Error fetching revenues:', revenuesError);
        throw revenuesError;
      }

      const revenueMap = new Map(revenues?.map(r => [r.member_id, r]) || []);

      return (profiles || []).map(p => ({
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        phone: p.phone,
        role: (p.user_roles as any)?.[0]?.role || 'member',
        level: p.level,
        points: p.points,
        status: p.status,
        created_at: p.created_at,
        revenue_cents: revenueMap.get(p.id)?.revenue_cents || 0,
        txn_count: revenueMap.get(p.id)?.txn_count || 0,
      })) as MemberWithRevenue[];
    },
    enabled: role === 'admin',
  });

  // Calculate KPIs
  const stats = useMemo(() => {
    const totalMembers = members.length;
    const totalRevenue = members.reduce((sum, m) => sum + (m.revenue_cents || 0), 0);
    const avgPerMember = totalMembers > 0 ? totalRevenue / totalMembers : 0;
    const levelDist = members.reduce((acc, m) => {
      acc[m.level] = (acc[m.level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalMembers,
      totalRevenue,
      avgPerMember,
      levelDist,
    };
  }, [members]);

  // Filter and sort members
  const filteredMembers = useMemo(() => {
    let filtered = members.filter(m => {
      const matchesSearch = searchQuery === '' || 
        m.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.phone?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesLevel = levelFilter === 'all' || m.level === levelFilter;
      const matchesRole = roleFilter === 'all' || m.role === roleFilter;
      
      return matchesSearch && matchesLevel && matchesRole;
    });

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'revenue':
          return (b.revenue_cents || 0) - (a.revenue_cents || 0);
        case 'recent':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'points':
          return (b.points || 0) - (a.points || 0);
        case 'name':
          return (a.full_name || '').localeCompare(b.full_name || '');
        default:
          return 0;
      }
    });

    return filtered;
  }, [members, searchQuery, levelFilter, sortBy]);

  // Add member mutation (uses edge function to create auth user + profile)
  const addMemberMutation = useMutation({
    mutationFn: async (data: typeof newMember) => {
      const { data: result, error } = await supabase.functions.invoke('admin-create-member', {
        body: {
          email: data.email,
          password: data.password,
          full_name: data.full_name,
          phone: data.phone || null,
          level: data.level,
          role: 'member',
        },
      });
      if (error) throw error;
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['crm-members'] });
      const message = data?.created === false 
        ? 'Existing user profile updated successfully'
        : t.crm.addMember || 'Member added successfully';
      toast.success(message);
      setAddMemberOpen(false);
      setNewMember({ email: '', password: '', full_name: '', phone: '', level: 'bronze' });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add member');
    },
  });

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
    }).format(cents / 100);
  };

  if (role !== 'admin') {
    return (
      <div className="container mx-auto py-12 text-center">
        <p className="text-muted-foreground">{t.qr.noAccess}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-12 text-center">
        <p className="text-muted-foreground">{t.common.loading}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-4 md:py-8 px-4 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl md:text-3xl font-bold truncate">{t.crm.title}</h1>
          <p className="text-sm md:text-base text-muted-foreground truncate">{t.crm.subtitle}</p>
        </div>
        <Button onClick={() => setAddMemberOpen(true)} size="sm" className="shrink-0">
          <UserPlus className="h-4 w-4" />
          <span className="hidden sm:inline ml-2">{t.crm.addMember || 'Add Member'}</span>
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.crm.totalMembers}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMembers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.crm.totalRevenue}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.crm.avgPerMember}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.avgPerMember)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.crm.levelDistribution}</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-xs">
              {Object.entries(stats.levelDist).map(([level, count]) => (
                <div key={level} className="flex justify-between">
                  <span className="capitalize">{t.crm.level[level as keyof typeof t.crm.level]}</span>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="pt-4 md:pt-6">
          <div className="flex flex-col gap-3 md:gap-4">
            <div className="relative w-full">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t.crm.search.placeholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
              <Select value={levelFilter} onValueChange={setLevelFilter}>
                <SelectTrigger className="w-full sm:flex-1">
                  <SelectValue placeholder={t.crm.filter.level} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.crm.filter.level}</SelectItem>
                  <SelectItem value="bronze">{t.crm.level.bronze}</SelectItem>
                  <SelectItem value="silver">{t.crm.level.silver}</SelectItem>
                  <SelectItem value="gold">{t.crm.level.gold}</SelectItem>
                  <SelectItem value="platinum">{t.crm.level.platinum}</SelectItem>
                  <SelectItem value="vip">{t.crm.level.vip}</SelectItem>
                </SelectContent>
              </Select>

              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-full sm:flex-1">
                  <SelectValue placeholder="Alla roller" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alla roller</SelectItem>
                  <SelectItem value="member">Medlem</SelectItem>
                  <SelectItem value="instructor">Instruktör</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full sm:flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="revenue">{t.crm.sort.revenue}</SelectItem>
                  <SelectItem value="recent">{t.crm.sort.recent}</SelectItem>
                  <SelectItem value="oldest">{t.crm.sort.oldest}</SelectItem>
                  <SelectItem value="points">{t.crm.sort.points}</SelectItem>
                  <SelectItem value="name">{t.crm.sort.name}</SelectItem>
                </SelectContent>
              </Select>

              <Badge variant="secondary" className="whitespace-nowrap self-center sm:self-auto">
                {filteredMembers.length} {t.crm.members}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Members Table */}
      <Card>
        <CardContent className="pt-4 md:pt-6">
          {filteredMembers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{t.crm.empty}</p>
          ) : (
            <div className="overflow-x-auto -mx-4 md:mx-0">
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background z-10">{t.crm.table.name}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t.crm.table.contact}</TableHead>
                    <TableHead>Roll</TableHead>
                    <TableHead>{t.crm.table.level}</TableHead>
                    <TableHead className="text-right hidden md:table-cell">{t.crm.table.points}</TableHead>
                    <TableHead className="text-right">{t.crm.table.revenue}</TableHead>
                    <TableHead className="hidden lg:table-cell">{t.crm.table.since}</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium sticky left-0 bg-background z-10">
                        <div className="min-w-[120px]">
                          {member.full_name || '—'}
                          <div className="sm:hidden text-xs text-muted-foreground mt-1">
                            {member.email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="text-sm space-y-1 min-w-[180px]">
                          {member.email && <div className="truncate">{member.email}</div>}
                          {member.phone && <div className="text-muted-foreground">{member.phone}</div>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={member.role === 'instructor' 
                            ? 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-800' 
                            : 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200 dark:border-green-800'
                          }
                        >
                          {member.role === 'instructor' ? 'Instruktör' : 'Medlem'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`${levelColors[member.level as keyof typeof levelColors]} whitespace-nowrap text-xs`}>
                          {t.crm.level[member.level as keyof typeof t.crm.level]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right hidden md:table-cell">{member.points || 0}</TableCell>
                      <TableCell className="text-right font-medium whitespace-nowrap">
                        {formatCurrency(member.revenue_cents || 0)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">{format(new Date(member.created_at), 'yyyy-MM-dd')}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setSelectedMemberId(member.id)}>
                              {t.crm.view}
                            </DropdownMenuItem>
                            {member.email && (
                              <DropdownMenuItem asChild>
                                <a href={`mailto:${member.email}`} className="flex items-center gap-2">
                                  <Mail className="h-4 w-4" />
                                  {t.crm.actions.email}
                                </a>
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Drawer */}
      {selectedMemberId && (
        <MemberDetailDrawer
          memberId={selectedMemberId}
          open={!!selectedMemberId}
          onOpenChange={(open) => !open && setSelectedMemberId(null)}
        />
      )}

      {/* Add Member Dialog */}
      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.crm.addMember || 'Add Member'}</DialogTitle>
            <DialogDescription>
              Create a new member account
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">{t.crm.fullName || 'Full Name'}</Label>
              <Input
                id="full_name"
                value={newMember.full_name}
                onChange={(e) => setNewMember({ ...newMember, full_name: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t.crm.email || 'Email'}</Label>
              <Input
                id="email"
                type="email"
                value={newMember.email}
                onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                placeholder="john@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t.crm.password || 'Password'}</Label>
              <Input
                id="password"
                type="password"
                value={newMember.password}
                onChange={(e) => setNewMember({ ...newMember, password: e.target.value })}
                placeholder={t.crm.passwordPlaceholder || 'Enter password'}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">{t.crm.phone || 'Phone'}</Label>
              <Input
                id="phone"
                type="tel"
                value={newMember.phone}
                onChange={(e) => setNewMember({ ...newMember, phone: e.target.value })}
                placeholder="+46 70 123 45 67"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="level">{t.crm.table.level || 'Level'}</Label>
              <Select value={newMember.level} onValueChange={(val) => setNewMember({ ...newMember, level: val })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bronze">{t.crm.level.bronze}</SelectItem>
                  <SelectItem value="silver">{t.crm.level.silver}</SelectItem>
                  <SelectItem value="gold">{t.crm.level.gold}</SelectItem>
                  <SelectItem value="platinum">{t.crm.level.platinum}</SelectItem>
                  <SelectItem value="vip">{t.crm.level.vip}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMemberOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button 
              onClick={() => addMemberMutation.mutate(newMember)}
              disabled={!newMember.email || !newMember.password || !newMember.full_name || addMemberMutation.isPending}
            >
              {addMemberMutation.isPending ? t.common.loading : (t.crm.addMember || 'Add Member')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}