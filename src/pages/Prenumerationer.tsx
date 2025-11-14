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
import { Repeat, TrendingUp, Users, DollarSign, Search, UserPlus } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';

interface SubscriptionWithMember {
  id: string;
  member_id: string;
  plan: string;
  status: string;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
  member?: {
    full_name: string | null;
    email: string | null;
    phone: string | null;
    level: string;
  };
}

const statusColors = {
  active: 'bg-green-100 text-green-800 border-green-200',
  inactive: 'bg-gray-100 text-gray-800 border-gray-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
  past_due: 'bg-yellow-100 text-yellow-800 border-yellow-200',
};

export default function Prenumerationer() {
  const { t } = useLanguageStore();
  const { role } = useAuthStore();
  const queryClient = useQueryClient();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('recent');
  const [addSubOpen, setAddSubOpen] = useState(false);
  const [newSub, setNewSub] = useState({
    member_id: '',
    plan: 'basic',
    status: 'active',
    current_period_end: '',
  });

  // Fetch members for the dropdown
  const { data: members = [] } = useQuery({
    queryKey: ['members-list'],
    queryFn: async () => {
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles' as any)
        .select('user_id')
        .eq('role', 'member');
      
      if (rolesError) throw rolesError;
      
      const memberIds = (userRoles || []).map((ur: any) => ur.user_id);
      const { data, error } = memberIds.length > 0
        ? await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', memberIds)
            .order('full_name')
        : { data: [], error: null };
      if (error) throw error;
      return data;
    },
    enabled: role === 'admin' && addSubOpen,
  });

  // Fetch subscriptions with member info
  const { data: subscriptions = [], isLoading } = useQuery({
    queryKey: ['subscriptions-list'],
    queryFn: async () => {
      const { data: subs, error } = await supabase
        .from('subscriptions')
        .select(`
          *,
          member:profiles!member_id(full_name, email, phone, level)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      return subs.map(sub => ({
        ...sub,
        member: Array.isArray(sub.member) ? sub.member[0] : sub.member
      })) as SubscriptionWithMember[];
    },
    enabled: role === 'admin',
  });

  // Calculate KPIs
  const stats = useMemo(() => {
    const activeSubscriptions = subscriptions.filter(s => s.status === 'active');
    const totalActive = activeSubscriptions.length;
    
    // Estimate MRR based on plan names (you may need to adjust this)
    const planPrices: Record<string, number> = {
      basic: 29900, // 299 SEK in cents
      premium: 49900, // 499 SEK
      vip: 99900, // 999 SEK
    };
    
    const estimatedMRR = activeSubscriptions.reduce((sum, sub) => {
      const price = planPrices[sub.plan.toLowerCase()] || 0;
      return sum + price;
    }, 0);

    const plans = subscriptions.reduce((acc, s) => {
      acc[s.plan] = (acc[s.plan] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalSubscriptions: subscriptions.length,
      activeSubscriptions: totalActive,
      estimatedMRR,
      planDistribution: plans,
    };
  }, [subscriptions]);

  // Filter and sort
  const filteredSubs = useMemo(() => {
    let filtered = subscriptions.filter(s => {
      const matchesSearch = searchQuery === '' || 
        s.member?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.member?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.plan?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
      const matchesPlan = planFilter === 'all' || s.plan === planFilter;
      
      return matchesSearch && matchesStatus && matchesPlan;
    });

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'recent':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'name':
          return (a.member?.full_name || '').localeCompare(b.member?.full_name || '');
        case 'ending':
          if (!a.current_period_end) return 1;
          if (!b.current_period_end) return -1;
          return new Date(a.current_period_end).getTime() - new Date(b.current_period_end).getTime();
        default:
          return 0;
      }
    });

    return filtered;
  }, [subscriptions, searchQuery, statusFilter, planFilter, sortBy]);

  // Add subscription mutation
  const addSubMutation = useMutation({
    mutationFn: async (data: typeof newSub) => {
      const { error } = await supabase.from('subscriptions').insert({
        member_id: data.member_id,
        plan: data.plan,
        status: data.status,
        current_period_end: data.current_period_end || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
      toast.success('Prenumeration skapad');
      setAddSubOpen(false);
      setNewSub({ member_id: '', plan: 'basic', status: 'active', current_period_end: '' });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Misslyckades att skapa prenumeration');
    },
  });

  // Update subscription status mutation
  const updateSubMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('subscriptions')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
      toast.success('Status uppdaterad');
    },
    onError: () => {
      toast.error('Misslyckades att uppdatera status');
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
        <p className="text-muted-foreground">Du har inte behörighet</p>
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
          <h1 className="text-2xl md:text-3xl font-bold truncate">Prenumerationer</h1>
          <p className="text-sm md:text-base text-muted-foreground truncate">Hantera alla medlemsprenumerationer</p>
        </div>
        <Button onClick={() => setAddSubOpen(true)} size="sm" className="shrink-0">
          <UserPlus className="h-4 w-4" />
          <span className="hidden sm:inline ml-2">Ny prenumeration</span>
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Totalt</CardTitle>
            <Repeat className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSubscriptions}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aktiva</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeSubscriptions}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MRR (Uppskattat)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.estimatedMRR)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Planer</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-xs">
              {Object.entries(stats.planDistribution).map(([plan, count]) => (
                <div key={plan} className="flex justify-between">
                  <span className="capitalize">{plan}</span>
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
                placeholder="Sök medlem, email eller plan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:flex-1">
                  <SelectValue placeholder="Filtrera status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alla statusar</SelectItem>
                  <SelectItem value="active">Aktiv</SelectItem>
                  <SelectItem value="inactive">Inaktiv</SelectItem>
                  <SelectItem value="cancelled">Avbruten</SelectItem>
                  <SelectItem value="past_due">Förfallen</SelectItem>
                </SelectContent>
              </Select>

              <Select value={planFilter} onValueChange={setPlanFilter}>
                <SelectTrigger className="w-full sm:flex-1">
                  <SelectValue placeholder="Filtrera plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alla planer</SelectItem>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full sm:flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Senaste först</SelectItem>
                  <SelectItem value="oldest">Äldsta först</SelectItem>
                  <SelectItem value="name">Namn</SelectItem>
                  <SelectItem value="ending">Förnyelsedatum</SelectItem>
                </SelectContent>
              </Select>

              <Badge variant="secondary" className="whitespace-nowrap self-center sm:self-auto">
                {filteredSubs.length} prenumerationer
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subscriptions Table */}
      <Card>
        <CardContent className="pt-4 md:pt-6">
          {filteredSubs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Inga prenumerationer hittades</p>
          ) : (
            <div className="overflow-x-auto -mx-4 md:mx-0">
              <Table className="min-w-[720px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background z-10">Medlem</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Startad</TableHead>
                    <TableHead>Förnyas</TableHead>
                    <TableHead className="text-right">Åtgärder</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubs.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell className="font-medium sticky left-0 bg-background z-10">
                        <div className="min-w-[150px]">
                          {sub.member?.full_name || '—'}
                          <div className="text-xs text-muted-foreground truncate max-w-[180px]">
                            {sub.member?.email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {sub.plan}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`${statusColors[sub.status as keyof typeof statusColors] || 'bg-gray-100'} text-xs`}>
                          {sub.status === 'active' ? 'Aktiv' : 
                           sub.status === 'inactive' ? 'Inaktiv' :
                           sub.status === 'cancelled' ? 'Avbruten' :
                           sub.status === 'past_due' ? 'Förfallen' : sub.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {format(new Date(sub.created_at), 'yyyy-MM-dd')}
                      </TableCell>
                      <TableCell>
                        {sub.current_period_end ? format(new Date(sub.current_period_end), 'yyyy-MM-dd') : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Select
                          value={sub.status}
                          onValueChange={(value) => updateSubMutation.mutate({ id: sub.id, status: value })}
                        >
                          <SelectTrigger className="w-[120px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Aktiv</SelectItem>
                            <SelectItem value="inactive">Inaktiv</SelectItem>
                            <SelectItem value="cancelled">Avbruten</SelectItem>
                            <SelectItem value="past_due">Förfallen</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Subscription Dialog */}
      <Dialog open={addSubOpen} onOpenChange={setAddSubOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Lägg till prenumeration</DialogTitle>
            <DialogDescription>
              Skapa en ny prenumeration för en medlem
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="member_id">Medlem</Label>
              <Select value={newSub.member_id} onValueChange={(val) => setNewSub({ ...newSub, member_id: val })}>
                <SelectTrigger>
                  <SelectValue placeholder="Välj medlem" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.full_name} ({member.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan">Plan</Label>
              <Select value={newSub.plan} onValueChange={(val) => setNewSub({ ...newSub, plan: val })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Basic (299 kr/mån)</SelectItem>
                  <SelectItem value="premium">Premium (499 kr/mån)</SelectItem>
                  <SelectItem value="vip">VIP (999 kr/mån)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={newSub.status} onValueChange={(val) => setNewSub({ ...newSub, status: val })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Aktiv</SelectItem>
                  <SelectItem value="inactive">Inaktiv</SelectItem>
                  <SelectItem value="cancelled">Avbruten</SelectItem>
                  <SelectItem value="past_due">Förfallen</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="current_period_end">Förnyelsedatum (valfritt)</Label>
              <Input
                id="current_period_end"
                type="date"
                value={newSub.current_period_end}
                onChange={(e) => setNewSub({ ...newSub, current_period_end: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddSubOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button 
              onClick={() => addSubMutation.mutate(newSub)}
              disabled={!newSub.member_id || addSubMutation.isPending}
            >
              {addSubMutation.isPending ? t.common.loading : 'Skapa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
