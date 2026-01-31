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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Mail, Phone, Award, DollarSign, ShoppingBag, Clock, X, Edit, Trash2, UserCog, CheckCircle, CalendarIcon, Gift } from 'lucide-react';
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
  
  // State
  const [newNote, setNewNote] = useState('');
  const [newLevel, setNewLevel] = useState('');
  const [ticketCount, setTicketCount] = useState<string>('1');
  const [ticketExpiry, setTicketExpiry] = useState<Date | undefined>(
    new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 3 months from now
  );
  const [removeTicketCount, setRemoveTicketCount] = useState<string>('1');
  const [newRole, setNewRole] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [checkinDialogOpen, setCheckinDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: '',
    email: '',
    phone: '',
  });
  const [checkinForm, setCheckinForm] = useState({
    course_id: '',
    note: '',
  });

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

  // Fetch member role from user_roles table
  const { data: memberRole } = useQuery({
    queryKey: ['member-role', memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles' as any)
        .select('role')
        .eq('user_id', memberId)
        .order('role', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      const role = data ? (data as any).role : 'member';
      return role as string;
    },
    enabled: open,
  });

  // Fetch courses for check-in
  const { data: courses = [] } = useQuery({
    queryKey: ['courses-for-checkin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('id, title')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: open && checkinDialogOpen,
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
          source_course:courses!source_course_id(title, price_cents)
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

  // Give free tickets mutation
  const giveTicketsMutation = useMutation({
    mutationFn: async (data: { ticketCount: number; expiresAt?: string }) => {
      const { data: result, error } = await supabase.rpc("admin_give_free_tickets", {
        p_member_id: memberId,
        p_ticket_count: data.ticketCount,
        p_expires_at: data.expiresAt,
      });

      if (error) throw error;
      return result;
    },
    onSuccess: (result: any) => {
      toast.success(t.common.ticketsGiven.replace("{count}", result.tickets.toString()));
      setTicketCount("1");
      queryClient.invalidateQueries({ queryKey: ["member-tickets", memberId] });
    },
    onError: (error: any) => {
      console.error("Give tickets error:", error);
      toast.error("Kunde inte ge klipp: " + error.message);
    },
  });

  // Remove tickets mutation
  const removeTicketsMutation = useMutation({
    mutationFn: async (data: { ticketCount: number }) => {
      const { data: result, error } = await supabase.rpc("admin_remove_tickets" as any, {
        p_member_id: memberId,
        p_ticket_count: data.ticketCount,
      });

      if (error) throw error;
      return result;
    },
    onSuccess: (result: any) => {
      toast.success(t.common.ticketsRemoved.replace("{count}", result.tickets_removed.toString()));
      setRemoveTicketCount("1");
      queryClient.invalidateQueries({ queryKey: ["member-tickets", memberId] });
    },
    onError: (error: any) => {
      console.error("Remove tickets error:", error);
      if (error.message?.includes("NOT_ENOUGH_TICKETS")) {
        toast.error(t.common.notEnoughTickets);
      } else {
        toast.error("Kunde inte ta bort klipp: " + error.message);
      }
    },
  });

  // Update member mutation (for level, status)
  const updateMemberMutation = useMutation({
    mutationFn: async (params: { new_level?: string; new_status?: string }) => {
      const { data, error } = await supabase.rpc('admin_update_member', {
        target: memberId,
        new_level: params.new_level,
        new_status: params.new_status,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member-profile', memberId] });
      queryClient.invalidateQueries({ queryKey: ['crm-members'] });
      toast.success(t.crm.updated);
      setNewLevel('');
    },
    onError: () => {
      toast.error(t.crm.error);
    },
  });

  // Update member profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (params: { full_name?: string; email?: string; phone?: string; role?: string }) => {
      const { data, error } = await supabase.rpc('admin_update_member_profile', {
        target_user_id: memberId,
        p_full_name: params.full_name || null,
        p_email: params.email || null,
        p_phone: params.phone || null,
        p_role: params.role as any || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member-profile', memberId] });
      queryClient.invalidateQueries({ queryKey: ['crm-members'] });
      toast.success(t.crm.updated);
      setEditDialogOpen(false);
      setNewRole('');
    },
    onError: (error: any) => {
      toast.error(error.message || t.crm.error);
    },
  });

  // Delete member mutation
  const deleteMemberMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('admin_delete_member', {
        target_user_id: memberId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-members'] });
      toast.success('Member deleted successfully');
      setDeleteDialogOpen(false);
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || t.crm.error);
    },
  });

  // Manual check-in mutation
  const manualCheckinMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('admin_manual_checkin', {
        p_member_id: memberId,
        p_course_id: checkinForm.course_id,
        p_note: checkinForm.note || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member-tickets', memberId] });
      queryClient.invalidateQueries({ queryKey: ['member-checkins', memberId] });
      toast.success('Check-in successful');
      setCheckinDialogOpen(false);
      setCheckinForm({ course_id: '', note: '' });
    },
    onError: (error: any) => {
      toast.error(error.message || t.crm.error);
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

  const handleEditClick = () => {
    if (profile) {
      setEditForm({
        full_name: profile.full_name || '',
        email: profile.email || '',
        phone: profile.phone || '',
      });
      setEditDialogOpen(true);
    }
  };

  const handleEditSubmit = () => {
    updateProfileMutation.mutate(editForm);
  };

  const handleRoleChange = async (role: string) => {
    try {
      setNewRole(role);
      
      // First, delete existing roles for this user
      const { error: deleteError } = await supabase
        .from('user_roles' as any)
        .delete()
        .eq('user_id', memberId);

      if (deleteError) throw deleteError;

      // Then, insert the new role
      const { error: insertError } = await supabase
        .from('user_roles' as any)
        .insert({
          user_id: memberId,
          role: role,
        });

      if (insertError) throw insertError;

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['member-role', memberId] });
      queryClient.invalidateQueries({ queryKey: ['crm-members'] });
      toast.success('Role updated successfully');
      setNewRole('');
    } catch (error: any) {
      console.error('Error updating role:', error);
      toast.error(error.message || 'Failed to update role');
    }
  };

  const handleCheckinSubmit = () => {
    if (!checkinForm.course_id) {
      toast.error('Please select a course');
      return;
    }
    manualCheckinMutation.mutate();
  };

  if (!profile) return null;

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="h-[90vh]">
          <div className="mx-auto w-full max-w-4xl h-full flex flex-col">
            <DrawerHeader className="border-b">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3 sm:gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={profile.avatar_url || ''} alt={profile.full_name} />
                    <AvatarFallback>{getInitials(profile.full_name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <DrawerTitle className="text-xl sm:text-2xl truncate">
                      {profile.full_name || '—'}
                    </DrawerTitle>
                    <DrawerDescription className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                      <Badge variant="outline" className={levelColors[profile.level as keyof typeof levelColors]}>
                        {t.crm.level[profile.level as keyof typeof t.crm.level]}
                      </Badge>
                      <Badge variant="outline">
                        {memberRole || 'member'}
                      </Badge>
                      {profile.email && (
                        <a href={`mailto:${profile.email}`} className="flex items-center gap-1 hover:underline">
                          <Mail className="h-3 w-3" />
                          <span className="truncate max-w-[140px] sm:max-w-none">{profile.email}</span>
                        </a>
                      )}
                      {profile.phone && (
                        <a href={`tel:${profile.phone}`} className="flex items-center gap-1 hover:underline">
                          <Phone className="h-3 w-3" />
                          <span className="truncate max-w-[120px] sm:max-w-none">{profile.phone}</span>
                        </a>
                      )}
                    </DrawerDescription>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
                  <Button variant="outline" size="sm" onClick={handleEditClick} className="flex-1 sm:flex-none">
                    <Edit className="h-4 w-4 mr-2" />
                    {t.crm.actions.edit}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setDeleteDialogOpen(true)} className="flex-1 sm:flex-none">
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t.crm.actions.delete}
                  </Button>
                  <DrawerClose asChild>
                    <Button variant="ghost" size="icon">
                      <X className="h-4 w-4" />
                    </Button>
                  </DrawerClose>
                </div>
              </div>
            </DrawerHeader>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                  <TabsTrigger value="overview">{t.crm.drawer.overview}</TabsTrigger>
                  <TabsTrigger value="purchases">{t.crm.drawer.purchases}</TabsTrigger>
                  <TabsTrigger value="tickets">{t.crm.drawer.tickets}</TabsTrigger>
                  <TabsTrigger value="subs">{t.crm.drawer.subs}</TabsTrigger>
                  <TabsTrigger value="notes">{t.crm.drawer.notes}</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  {/* Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    
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
                            <div className="flex flex-col sm:flex-row gap-2">
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
                              className="w-full sm:w-auto"
                              onClick={() => updateMemberMutation.mutate({ new_level: newLevel })}
                              disabled={!newLevel || updateMemberMutation.isPending}
                            >
                              {t.common.save}
                            </Button>
                          </div>
                        </div>

                        {/* Give Free Tickets */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium">{t.common.giveTickets}</label>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <Input
                              type="number"
                              min="1"
                              max="50"
                              placeholder={t.common.ticketCount}
                              value={ticketCount}
                              onChange={(e) => setTicketCount(e.target.value)}
                              className="w-full sm:w-auto"
                            />
                            <Button
                              className="w-full sm:w-auto"
                              onClick={() =>
                                giveTicketsMutation.mutate({
                                  ticketCount: parseInt(ticketCount),
                                  expiresAt: ticketExpiry?.toISOString(),
                                })
                              }
                              disabled={
                                !ticketCount ||
                                parseInt(ticketCount) < 1 ||
                                giveTicketsMutation.isPending
                              }
                            >
                              {giveTicketsMutation.isPending ? 'Ger...' : t.common.giveTickets}
                            </Button>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">
                              {t.common.ticketExpiry}
                            </Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className="w-full justify-start text-left font-normal"
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {ticketExpiry ? (
                                    format(ticketExpiry, "PPP")
                                  ) : (
                                    <span>Välj datum</span>
                                  )}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0">
                                <Calendar
                                  mode="single"
                                  selected={ticketExpiry}
                                  onSelect={setTicketExpiry}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>

                        {/* Remove Tickets */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium">{t.common.removeTickets}</label>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <Input
                              type="number"
                              min="1"
                              max="50"
                              placeholder={t.common.ticketCount}
                              value={removeTicketCount}
                              onChange={(e) => setRemoveTicketCount(e.target.value)}
                              className="w-full sm:w-auto"
                            />
                            <Button
                              variant="destructive"
                              className="w-full sm:w-auto"
                              onClick={() =>
                                removeTicketsMutation.mutate({
                                  ticketCount: parseInt(removeTicketCount),
                                })
                              }
                              disabled={
                                !removeTicketCount ||
                                parseInt(removeTicketCount) < 1 ||
                                removeTicketsMutation.isPending
                              }
                            >
                              {removeTicketsMutation.isPending ? '...' : t.common.removeTickets}
                            </Button>
                          </div>
                        </div>

                        {/* Change role */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium">{t.crm.actions.changeRole}</label>
                          <Select value={newRole || memberRole || 'member'} onValueChange={handleRoleChange}>
                            <SelectTrigger>
                              <SelectValue placeholder={t.crm.selectRole} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="member">{t.roles.MEDLEM}</SelectItem>
                              <SelectItem value="instructor">{t.roles.INSTRUKTOR}</SelectItem>
                              <SelectItem value="admin">{t.roles.ADMIN}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Manual check-in */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium">{t.crm.actions.manualCheckin}</label>
                          <Button
                            variant="outline"
                            onClick={() => setCheckinDialogOpen(true)}
                            className="w-full"
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            {t.crm.actions.manualCheckin}
                          </Button>
                        </div>
                      </div>

                      {/* Toggle status */}
                      <div>
                        <Button
                          variant="outline"
                          className="w-full sm:w-auto"
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
                        <div className="overflow-x-auto -mx-4 md:mx-0">
                          <Table className="min-w-[600px]">
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
                        </div>
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
                        <div className="overflow-x-auto -mx-4 md:mx-0">
                          <Table className="min-w-[600px]">
                            <TableHeader>
                              <TableRow>
                                <TableHead>{t.tickets.fromCourse}</TableHead>
                                <TableHead>{t.tickets.ticketsRemaining}</TableHead>
                                <TableHead>{t.tickets.purchasedOn}</TableHead>
                                <TableHead>{t.tickets.expiresAt}</TableHead>
                                <TableHead>{t.courses.price}</TableHead>
                                <TableHead>{t.tickets.checkInStatus}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {tickets.map((ticket: any) => {
                                const isAdminGift = ticket.order_id?.startsWith('admin_gift:');
                                const isExpired = ticket.expires_at && new Date(ticket.expires_at) < new Date();
                                const statusColor = 
                                  ticket.status === 'used' ? 'text-muted-foreground' :
                                  isExpired ? 'text-destructive' :
                                  'text-green-600';
                                const statusText = 
                                  ticket.status === 'used' ? t.tickets.expired :
                                  isExpired ? t.tickets.expired :
                                  '✓ Valid';
                                
                                return (
                                  <TableRow key={ticket.id}>
                                    <TableCell>
                                      {isAdminGift ? (
                                        <div className="flex items-center gap-2">
                                          <span>🎁</span>
                                          <span className="text-sm font-medium">{t.crm.adminGift}</span>
                                        </div>
                                      ) : (
                                        ticket.source_course?.title || '—'
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      <span className="font-medium">
                                        {ticket.tickets_used} / {ticket.total_tickets}
                                      </span>
                                      <span className="text-muted-foreground text-sm ml-2">
                                        ({ticket.total_tickets - ticket.tickets_used} {t.tickets.remainingTickets})
                                      </span>
                                    </TableCell>
                                    <TableCell>
                                      {format(new Date(ticket.purchased_at), 'yyyy-MM-dd')}
                                    </TableCell>
                                    <TableCell>
                                      {ticket.expires_at ? format(new Date(ticket.expires_at), 'yyyy-MM-dd') : '—'}
                                    </TableCell>
                                    <TableCell>
                                      {isAdminGift ? (
                                        <span className="text-green-600 font-medium">{t.crm.freeTicket}</span>
                                      ) : (
                                        formatCurrency(ticket.source_course?.price_cents || 0)
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      <span className={statusColor}>{statusText}</span>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
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
                        <div className="overflow-x-auto -mx-4 md:mx-0">
                          <Table className="min-w-[520px]">
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
                        </div>
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

      {/* Edit Profile Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.crm.editMember}</DialogTitle>
            <DialogDescription>
              Update member profile information
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t.crm.fullName}</Label>
              <Input
                value={editForm.full_name}
                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
              />
            </div>
            <div>
              <Label>{t.crm.email}</Label>
              <Input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            </div>
            <div>
              <Label>{t.crm.phone}</Label>
              <Input
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button onClick={handleEditSubmit} disabled={updateProfileMutation.isPending}>
              {t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Check-in Dialog */}
      <Dialog open={checkinDialogOpen} onOpenChange={setCheckinDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.crm.actions.manualCheckin}</DialogTitle>
            <DialogDescription>
              Check in member to a course manually
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t.crm.selectCourse}</Label>
              <Select
                value={checkinForm.course_id}
                onValueChange={(value) => setCheckinForm({ ...checkinForm, course_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t.crm.selectCourse} />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t.crm.checkinNote}</Label>
              <Textarea
                value={checkinForm.note}
                onChange={(e) => setCheckinForm({ ...checkinForm, note: e.target.value })}
                placeholder={t.crm.noteBody}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckinDialogOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button onClick={handleCheckinSubmit} disabled={manualCheckinMutation.isPending}>
              {t.crm.actions.manualCheckin}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.crm.confirmDelete}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.crm.deleteWarning}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMemberMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t.crm.actions.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
