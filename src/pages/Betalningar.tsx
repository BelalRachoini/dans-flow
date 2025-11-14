import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  CreditCard, Plus, TrendingUp, DollarSign, 
  Calendar, Filter, Search, Download,
  CheckCircle, Clock, XCircle
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { sv } from '@/locales/sv';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';

type PaymentStatus = 'paid' | 'pending' | 'failed';
type PaymentType = 'course' | 'event' | 'membership' | 'other';

type Payment = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  amountSEK: number;
  type: PaymentType;
  status: PaymentStatus;
  description: string;
  createdAt: string;
  paidAt?: string;
  method?: string;
  stripePaymentIntentId?: string;
  stripeCustomerId?: string;
};

const paymentSchema = z.object({
  userName: z.string().min(1, 'Namn krävs'),
  userEmail: z.string().email('Ogiltig e-post'),
  amountSEK: z.number().min(1, 'Belopp måste vara större än 0'),
  type: z.enum(['course', 'event', 'membership', 'other']),
  status: z.enum(['paid', 'pending', 'failed']),
  description: z.string().min(1, 'Beskrivning krävs'),
  method: z.string().optional(),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

export default function Betalningar() {
  const { role } = useAuthStore();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<PaymentType | 'all'>('all');
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'week' | 'month'>('all');

  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      status: 'paid',
      type: 'other',
    }
  });

  useEffect(() => {
    loadPayments();
  }, []);

  const loadPayments = async () => {
    try {
      console.log('[Betalningar] Loading Stripe payments...');
      toast.loading('Hämtar betalningar...', { id: 'load-payments' });

      const { data, error } = await supabase.functions.invoke('get-stripe-payments', {
        body: { limit: 100 },
      });

      toast.dismiss('load-payments');

      if (error) {
        console.error('[Betalningar] Error loading payments:', error);
        throw error;
      }

      if (data?.payments) {
        console.log('[Betalningar] Loaded', data.payments.length, 'payments');
        setPayments(data.payments);
        toast.success(`Laddade ${data.payments.length} betalningar från Stripe`);
      } else {
        setPayments([]);
        toast.info('Inga betalningar hittades');
      }
    } catch (error: any) {
      console.error('[Betalningar] Error:', error);
      toast.error(error.message || 'Kunde inte hämta betalningar från Stripe');
      // Keep empty array on error
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    try {
      // Prepare CSV headers
      const headers = [
        'ID',
        'Datum',
        'Namn',
        'E-post',
        'Belopp (SEK)',
        'Typ',
        'Status',
        'Beskrivning',
        'Betalningsmetod',
        'Betald datum',
        'Stripe Payment Intent ID',
      ];

      // Prepare CSV rows
      const rows = filteredPayments.map(payment => [
        payment.id,
        formatDate(payment.createdAt),
        payment.userName,
        payment.userEmail,
        payment.amountSEK.toFixed(2),
        getTypeLabel(payment.type),
        payment.status,
        payment.description,
        payment.method || '-',
        payment.paidAt ? formatDate(payment.paidAt) : '-',
        payment.stripePaymentIntentId || '-',
      ]);

      // Create CSV content
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
      ].join('\n');

      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `betalningar-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success('Betalningar exporterade till CSV');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Kunde inte exportera betalningar');
    }
  };

  const onSubmitPayment = async (data: PaymentFormData) => {
    try {
      const newPayment: Payment = {
        id: `pay-${Date.now()}`,
        userId: 'manual',
        userName: data.userName,
        userEmail: data.userEmail,
        amountSEK: data.amountSEK,
        type: data.type,
        status: data.status,
        description: data.description,
        createdAt: new Date().toISOString(),
        paidAt: data.status === 'paid' ? new Date().toISOString() : undefined,
        method: data.method,
      };

      setPayments([newPayment, ...payments]);
      toast.success('Betalning registrerad!');
      setDialogOpen(false);
      reset();
    } catch (error) {
      toast.error('Något gick fel');
    }
  };

  // Filter payments
  const filteredPayments = useMemo(() => {
    let result = [...payments];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(payment => 
        payment.userName.toLowerCase().includes(query) ||
        payment.userEmail.toLowerCase().includes(query) ||
        payment.description.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter(payment => payment.status === statusFilter);
    }

    // Apply type filter
    if (typeFilter !== 'all') {
      result = result.filter(payment => payment.type === typeFilter);
    }

    // Apply date range filter
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    if (dateRange !== 'all') {
      result = result.filter(payment => {
        const paymentDate = new Date(payment.createdAt);
        switch (dateRange) {
          case 'today':
            return paymentDate >= today;
          case 'week':
            return paymentDate >= weekAgo;
          case 'month':
            return paymentDate >= monthAgo;
          default:
            return true;
        }
      });
    }

    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [payments, searchQuery, statusFilter, typeFilter, dateRange]);

  // Calculate statistics
  const stats = useMemo(() => {
    const paidPayments = payments.filter(p => p.status === 'paid');
    const totalRevenue = paidPayments.reduce((sum, p) => sum + p.amountSEK, 0);
    
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthPayments = paidPayments.filter(p => new Date(p.createdAt) >= monthStart);
    const monthlyRevenue = thisMonthPayments.reduce((sum, p) => sum + p.amountSEK, 0);

    const pendingPayments = payments.filter(p => p.status === 'pending');
    const pendingAmount = pendingPayments.reduce((sum, p) => sum + p.amountSEK, 0);

    return {
      totalRevenue,
      monthlyRevenue,
      pendingAmount,
      totalPayments: payments.length,
      paidCount: paidPayments.length,
      pendingCount: pendingPayments.length,
    };
  }, [payments]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: PaymentStatus) => {
    const config = {
      paid: { label: 'Betald', icon: CheckCircle, color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
      pending: { label: 'Väntande', icon: Clock, color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
      failed: { label: 'Misslyckad', icon: XCircle, color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    };
    const { label, icon: Icon, color } = config[status];
    return (
      <Badge className={`${color} gap-1`}>
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    );
  };

  const getTypeLabel = (type: PaymentType) => {
    const labels = {
      course: 'Kurs',
      event: 'Event',
      membership: 'Medlemskap',
      other: 'Övrigt',
    };
    return labels[type];
  };

  if (role !== 'admin' && role !== 'instructor') {
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
          <h1 className="text-3xl font-bold">Betalningar</h1>
          <p className="mt-1 text-muted-foreground">
            Hantera och spåra alla inkomster
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="hero">
              <Plus className="mr-2" size={16} />
              Registrera betalning
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Registrera betalning manuellt</DialogTitle>
              <DialogDescription>
                Lägg till en betalning som gjordes utanför systemet
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmitPayment)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="userName">Kundnamn</Label>
                  <Input id="userName" {...register('userName')} placeholder="Anna Andersson" />
                  {errors.userName && <p className="text-sm text-destructive mt-1">{errors.userName.message}</p>}
                </div>

                <div>
                  <Label htmlFor="userEmail">E-post</Label>
                  <Input id="userEmail" type="email" {...register('userEmail')} placeholder="anna@example.com" />
                  {errors.userEmail && <p className="text-sm text-destructive mt-1">{errors.userEmail.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="amountSEK">Belopp (SEK)</Label>
                  <Input id="amountSEK" type="number" {...register('amountSEK', { valueAsNumber: true })} placeholder="2400" />
                  {errors.amountSEK && <p className="text-sm text-destructive mt-1">{errors.amountSEK.message}</p>}
                </div>

                <div>
                  <Label htmlFor="method">Betalmetod</Label>
                  <Input id="method" {...register('method')} placeholder="Swish, Kort, Kontant..." />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="type">Typ</Label>
                  <Select onValueChange={(value) => setValue('type', value as PaymentType)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Välj typ" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      <SelectItem value="course">Kurs</SelectItem>
                      <SelectItem value="event">Event</SelectItem>
                      <SelectItem value="membership">Medlemskap</SelectItem>
                      <SelectItem value="other">Övrigt</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.type && <p className="text-sm text-destructive mt-1">{errors.type.message}</p>}
                </div>

                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select onValueChange={(value) => setValue('status', value as PaymentStatus)} defaultValue="paid">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      <SelectItem value="paid">Betald</SelectItem>
                      <SelectItem value="pending">Väntande</SelectItem>
                      <SelectItem value="failed">Misslyckad</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="description">Beskrivning</Label>
                <Textarea id="description" {...register('description')} placeholder="T.ex. Salsa Nybörjare - 12 lektioner" rows={3} />
                {errors.description && <p className="text-sm text-destructive mt-1">{errors.description.message}</p>}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  {sv.common.cancel}
                </Button>
                <Button type="submit" variant="hero">
                  Registrera
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total intäkt</p>
                <p className="text-3xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Denna månad</p>
                <p className="text-3xl font-bold">{formatCurrency(stats.monthlyRevenue)}</p>
              </div>
              <Calendar className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Väntande</p>
                <p className="text-3xl font-bold">{formatCurrency(stats.pendingAmount)}</p>
                <p className="text-xs text-muted-foreground mt-1">{stats.pendingCount} betalningar</p>
              </div>
              <Clock className="h-8 w-8 text-amber-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Totalt betalningar</p>
                <p className="text-3xl font-bold">{stats.totalPayments}</p>
                <p className="text-xs text-muted-foreground mt-1">{stats.paidCount} betalda</p>
              </div>
              <CreditCard className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="shadow-md">
        <CardContent className="p-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {/* Search */}
            <div className="lg:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Sök namn, email eller beskrivning..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                <SelectItem value="all">Alla statusar</SelectItem>
                <SelectItem value="paid">Betald</SelectItem>
                <SelectItem value="pending">Väntande</SelectItem>
                <SelectItem value="failed">Misslyckad</SelectItem>
              </SelectContent>
            </Select>

            {/* Type Filter */}
            <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as typeof typeFilter)}>
              <SelectTrigger>
                <SelectValue placeholder="Typ" />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                <SelectItem value="all">Alla typer</SelectItem>
                <SelectItem value="course">Kurs</SelectItem>
                <SelectItem value="event">Event</SelectItem>
                <SelectItem value="membership">Medlemskap</SelectItem>
                <SelectItem value="other">Övrigt</SelectItem>
              </SelectContent>
            </Select>

            {/* Date Range */}
            <Select value={dateRange} onValueChange={(value) => setDateRange(value as typeof dateRange)}>
              <SelectTrigger>
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                <SelectItem value="all">Alla datum</SelectItem>
                <SelectItem value="today">Idag</SelectItem>
                <SelectItem value="week">Senaste veckan</SelectItem>
                <SelectItem value="month">Senaste månaden</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Payments Table */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span>Betalningar</span>
              <Badge variant="secondary">{filteredPayments.length} transaktioner</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={exportToCSV}
                disabled={filteredPayments.length === 0}
              >
                <Download className="mr-2 h-4 w-4" />
                Exportera CSV
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={loadPayments}
              >
                Uppdatera
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Kund</TableHead>
                  <TableHead>Beskrivning</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead>Metod</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Belopp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Inga betalningar hittades
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPayments.map((payment) => (
                    <TableRow key={payment.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(payment.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium">{payment.userName}</p>
                          <p className="text-xs text-muted-foreground">{payment.userEmail}</p>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <p className="truncate">{payment.description}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getTypeLabel(payment.type)}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {payment.method || '-'}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(payment.status)}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(payment.amountSEK)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
