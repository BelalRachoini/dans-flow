import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguageStore } from '@/store/languageStore';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Mail, Phone, Award, DollarSign, ShoppingBag, Clock, X } from 'lucide-react';
import { format } from 'date-fns';

interface MemberDetailDrawerProps {
  memberId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const levelColors = {
  bronze: 'bg-orange-100 text-orange-800 border-orange-200',
  silver: 'bg-slate-200 text-slate-800 border-slate-300',
  gold: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  platinum: 'bg-purple-100 text-purple-800 border-purple-200',
  vip: 'bg-rose-100 text-rose-800 border-rose-200',
};

export function MemberDetailDrawer({ memberId, open, onOpenChange }: MemberDetailDrawerProps) {
  const { t } = useLanguageStore();
  const { userId } = useAuthStore();
  const queryClient = useQueryClient();
  const [newNote, setNewNote] = useState('');
  const [pointsDelta, setPointsDelta] = useState('');
  const [newLevel, setNewLevel] = useState('');

  // Fetch member profile
  const { data: profile } = useQuery({
    queryKey: ['member-profile', memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', memberId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch revenue
  const { data: revenue } = useQuery({
    queryKey: ['member-revenue', memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_member_revenue')
        .select('*')
        .eq('member_id', memberId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch payments
  const { data: payments = [] } = useQuery({
    queryKey: ['member-payments', memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('member_id', memberId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch tickets & checkins
  const { data: tickets = [] } = useQuery({
    queryKey: ['member-tickets', memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          *,
          course:courses(title),
          checkins(*)
        `)
        .eq('member_id', memberId)
        .order('purchased_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch subscriptions
  const { data: subscriptions = [] } = useQuery({
    queryKey: ['member-subs', memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('member_id', memberId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch notes
  const { data: notes = [] } = useQuery({
    queryKey: ['member-notes', memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('member_notes')
        .select(`
          *,
          author:profiles!author_id(full_name)
        `)
        .eq('member_id', memberId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch checkin stats
  const { data: checkinStats } = useQuery({
    queryKey: ['member-checkins', memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_member_checkins')
        .select('*')
        .eq('member_id', memberId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Update member mutation
  const updateMemberMutation = useMutation({
    mutationFn: async (params: { new_level?: string; points_delta?: number; new_status?: string }) => {
      const { data, error } = await supabase.rpc('admin_update_member', {
        target: memberId,
        new_level: params.new_level || null,
        points_delta: params.points_delta || null,
        new_status: params.new_status || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member-profile', memberId] });
      queryClient.invalidateQueries({ queryKey: ['crm-members'] });
      toast.success(t.crm.updated);
      setPointsDelta('');
      setNewLevel('');
    },
    onError: () => {
      toast.error(t.crm.error);
    },
  });

  // Add note mutation
  const addNoteMutation = useMutation({
    mutationFn: async (body: string) => {
      const { error } = await supabase
        .from('member_notes')
        .insert({ member_id: memberId, author_id: userId!, body });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member-notes', memberId] });
      toast.success(t.crm.saved);
      setNewNote('');
    },
    onError: () => {
      toast.error(t.crm.error);
    },
  });

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
    }).format(cents / 100);
  };

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (!profile) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[90vh]">
        <div className="mx-auto w-full max-w-4xl h-full flex flex-col">
          <DrawerHeader className="border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Avatar className="h-12 w-12">
                  <AvatarFallback>{getInitials(profile.full_name)}</AvatarFallback>
                </Avatar>
                <div>
                  <DrawerTitle className="text-2xl">{profile.full_name || '—'}</DrawerTitle>
                  <DrawerDescription className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className={levelColors[profile.level as keyof typeof levelColors]}>
                      {t.crm.level[profile.level as keyof typeof t.crm.level]}
                    </Badge>
                    {profile.email && (
                      <a href={`mailto:${profile.email}`} className="flex items-center gap-1 text-sm hover:underline">
                        <Mail className="h-3 w-3" />
                        {profile.email}
                      </a>
                    )}
                    {profile.phone && (
                      <a href={`tel:${profile.phone}`} className="flex items-center gap-1 text-sm hover:underline">
                        <Phone className="h-3 w-3" />
                        {profile.phone}
                      </a>
                    )}
                  </DrawerDescription>
                </div>
              </div>
              <DrawerClose asChild>
                <Button variant="ghost" size="icon">
                  <X className="h-4 w-4" />
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto p-6">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="overview">{t.crm.drawer.overview}</TabsTrigger>
                <TabsTrigger value="purchases">{t.crm.drawer.purchases}</TabsTrigger>
                <TabsTrigger value="tickets">{t.crm.drawer.tickets}</TabsTrigger>
                <TabsTrigger value="subs">{t.crm.drawer.subs}</TabsTrigger>
                <TabsTrigger value="notes">{t.crm.drawer.notes}</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">{t.crm.points}</CardTitle>
                      <Award className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{profile.points || 0}</div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">{t.crm.total}</CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{formatCurrency(revenue?.revenue_cents || 0)}</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">{t.crm.purchases}</CardTitle>
                      <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{revenue?.txn_count || 0}</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">{t.crm.lastActivity}</CardTitle>
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm">
                        {checkinStats?.last_checkin_at
                          ? format(new Date(checkinStats.last_checkin_at), 'yyyy-MM-dd')
                          : '—'}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Quick actions */}
                <Card>
                  <CardHeader>
                    <CardTitle>{t.dashboard.quickActions}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Change level */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">{t.crm.actions.changeLevel}</label>
                        <div className="flex gap-2">
                          <Select value={newLevel} onValueChange={setNewLevel}>
                            <SelectTrigger>
                              <SelectValue placeholder={t.crm.selectLevel} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="bronze">{t.crm.level.bronze}</SelectItem>
                              <SelectItem value="silver">{t.crm.level.silver}</SelectItem>
                              <SelectItem value="gold">{t.crm.level.gold}</SelectItem>
                              <SelectItem value="platinum">{t.crm.level.platinum}</SelectItem>
                              <SelectItem value="vip">{t.crm.level.vip}</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            onClick={() => updateMemberMutation.mutate({ new_level: newLevel })}
                            disabled={!newLevel || updateMemberMutation.isPending}
                          >
                            {t.common.save}
                          </Button>
                        </div>
                      </div>

                      {/* Adjust points */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">{t.crm.actions.adjustPoints}</label>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            placeholder={t.crm.enterPoints}
                            value={pointsDelta}
                            onChange={(e) => setPointsDelta(e.target.value)}
                          />
                          <Button
                            onClick={() =>
                              updateMemberMutation.mutate({ points_delta: parseInt(pointsDelta) })
                            }
                            disabled={!pointsDelta || updateMemberMutation.isPending}
                          >
                            {t.common.save}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Toggle status */}
                    <div>
                      <Button
                        variant="outline"
                        onClick={() =>
                          updateMemberMutation.mutate({
                            new_status: profile.status === 'active' ? 'inactive' : 'active',
                          })
                        }
                        disabled={updateMemberMutation.isPending}
                      >
                        {profile.status === 'active'
                          ? t.crm.actions.disable
                          : t.crm.actions.enable}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="purchases">
                <Card>
                  <CardContent className="pt-6">
                    {payments.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">{t.common.noData}</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t.events.date}</TableHead>
                            <TableHead>{t.course.description}</TableHead>
                            <TableHead className="text-right">{t.courses.price}</TableHead>
                            <TableHead>{t.events.paymentStatus}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {payments.map((payment) => (
                            <TableRow key={payment.id}>
                              <TableCell>{format(new Date(payment.created_at), 'yyyy-MM-dd')}</TableCell>
                              <TableCell>{payment.description || '—'}</TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(payment.amount_cents)}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={payment.status === 'succeeded' ? 'default' : 'secondary'}
                                >
                                  {payment.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="tickets">
                <Card>
                  <CardContent className="pt-6">
                    {tickets.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">{t.common.noData}</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t.courses.title}</TableHead>
                            <TableHead>{t.qr.checkedIn}</TableHead>
                            <TableHead>{t.events.date}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {tickets.map((ticket: any) => (
                            <TableRow key={ticket.id}>
                              <TableCell>{ticket.course?.title || '—'}</TableCell>
                              <TableCell>
                                {ticket.checked_in_count} / {ticket.max_checkins}
                              </TableCell>
                              <TableCell>
                                {format(new Date(ticket.purchased_at), 'yyyy-MM-dd')}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="subs">
                <Card>
                  <CardContent className="pt-6">
                    {subscriptions.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">{t.common.noData}</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t.memberships.plans}</TableHead>
                            <TableHead>{t.events.bookingStatus}</TableHead>
                            <TableHead>{t.memberships.nextBilling}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {subscriptions.map((sub) => (
                            <TableRow key={sub.id}>
                              <TableCell>{sub.plan}</TableCell>
                              <TableCell>
                                <Badge variant={sub.status === 'active' ? 'default' : 'secondary'}>
                                  {sub.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {sub.current_period_end
                                  ? format(new Date(sub.current_period_end), 'yyyy-MM-dd')
                                  : '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="notes" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>{t.crm.addNote}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      placeholder={t.crm.noteBody}
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                    />
                    <Button
                      onClick={() => addNoteMutation.mutate(newNote)}
                      disabled={!newNote.trim() || addNoteMutation.isPending}
                    >
                      {t.common.save}
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    {notes.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">{t.crm.noNotes}</p>
                    ) : (
                      <div className="space-y-4">
                        {notes.map((note: any) => (
                          <div key={note.id} className="border-b pb-4 last:border-0">
                            <div className="flex justify-between items-start mb-2">
                              <span className="font-medium">{note.author?.full_name || '—'}</span>
                              <span className="text-sm text-muted-foreground">
                                {format(new Date(note.created_at), 'yyyy-MM-dd HH:mm')}
                              </span>
                            </div>
                            <p className="text-sm">{note.body}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}