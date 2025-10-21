import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Users, Search, Filter, ArrowUpDown, 
  Phone, Mail, Coins, TrendingUp, TrendingDown,
  Award, Star, Crown, Sparkles, Gem
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { sv } from '@/locales/sv';
import type { User } from '@/types';

type MemberTier = 'Brons' | 'Silver' | 'Guld' | 'Platinum' | 'VIP';

type MemberWithRevenue = User & {
  totalRevenue: number;
  tier: MemberTier;
};

const tierConfig = {
  'Brons': { 
    icon: Award, 
    color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    points: 0
  },
  'Silver': { 
    icon: Star, 
    color: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400',
    points: 50
  },
  'Guld': { 
    icon: Crown, 
    color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    points: 100
  },
  'Platinum': { 
    icon: Sparkles, 
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    points: 200
  },
  'VIP': { 
    icon: Gem, 
    color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
    points: 500
  },
};

export default function Medlemmar() {
  const { user } = useAuthStore();
  const [members, setMembers] = useState<MemberWithRevenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<MemberTier | 'all'>('all');
  const [sortBy, setSortBy] = useState<'revenue-high' | 'revenue-low' | 'newest' | 'oldest'>('revenue-high');

  useEffect(() => {
    const loadMembers = async () => {
      try {
        // TODO: Load from API
        // Mock data for now
        const mockMembers: MemberWithRevenue[] = [
          {
            id: 'user-3',
            name: 'Maria Johansson',
            email: 'maria@example.com',
            phone: '+46705555555',
            role: 'MEDLEM',
            avatarUrl: '',
            createdAt: '2024-03-10T10:00:00Z',
            pointsBalance: 75,
            memberships: [],
            totalRevenue: 12400,
            tier: 'Silver',
          },
          {
            id: 'user-4',
            name: 'Lars Nilsson',
            email: 'lars@example.com',
            phone: '+46706666666',
            role: 'MEDLEM',
            avatarUrl: '',
            createdAt: '2024-03-15T10:00:00Z',
            pointsBalance: 120,
            memberships: [],
            totalRevenue: 18900,
            tier: 'Guld',
          },
          {
            id: 'user-5',
            name: 'Emma Andersson',
            email: 'emma@example.com',
            phone: '+46707777777',
            role: 'MEDLEM',
            avatarUrl: '',
            createdAt: '2024-02-20T10:00:00Z',
            pointsBalance: 35,
            memberships: [],
            totalRevenue: 4200,
            tier: 'Brons',
          },
          {
            id: 'user-6',
            name: 'Oscar Berg',
            email: 'oscar@example.com',
            phone: '+46708888888',
            role: 'MEDLEM',
            avatarUrl: '',
            createdAt: '2024-01-05T10:00:00Z',
            pointsBalance: 250,
            memberships: [],
            totalRevenue: 34500,
            tier: 'Platinum',
          },
          {
            id: 'user-7',
            name: 'Sofia Lundqvist',
            email: 'sofia@example.com',
            phone: '+46709999999',
            role: 'MEDLEM',
            avatarUrl: '',
            createdAt: '2023-12-01T10:00:00Z',
            pointsBalance: 600,
            memberships: [],
            totalRevenue: 78900,
            tier: 'VIP',
          },
        ];
        
        setMembers(mockMembers);
      } finally {
        setLoading(false);
      }
    };

    loadMembers();
  }, []);

  // Calculate tier from points
  const getTierFromPoints = (points: number): MemberTier => {
    if (points >= 500) return 'VIP';
    if (points >= 200) return 'Platinum';
    if (points >= 100) return 'Guld';
    if (points >= 50) return 'Silver';
    return 'Brons';
  };

  // Filter and sort members
  const filteredAndSortedMembers = useMemo(() => {
    let result = [...members];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(member => 
        member.name.toLowerCase().includes(query) ||
        member.email.toLowerCase().includes(query) ||
        member.phone?.includes(query)
      );
    }

    // Apply tier filter
    if (tierFilter !== 'all') {
      result = result.filter(member => member.tier === tierFilter);
    }

    // Apply sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case 'revenue-high':
          return b.totalRevenue - a.totalRevenue;
        case 'revenue-low':
          return a.totalRevenue - b.totalRevenue;
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        default:
          return 0;
      }
    });

    return result;
  }, [members, searchQuery, tierFilter, sortBy]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalRevenue = members.reduce((sum, m) => sum + m.totalRevenue, 0);
    const tierCounts = members.reduce((acc, m) => {
      acc[m.tier] = (acc[m.tier] || 0) + 1;
      return acc;
    }, {} as Record<MemberTier, number>);

    return {
      totalMembers: members.length,
      totalRevenue,
      averageRevenue: members.length > 0 ? totalRevenue / members.length : 0,
      tierCounts,
    };
  }, [members]);

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
    });
  };

  if (user?.role !== 'ADMIN') {
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
      <div>
        <h1 className="text-3xl font-bold">Medlemmar CRM</h1>
        <p className="mt-1 text-muted-foreground">
          Hantera medlemmar och se intäktsöversikt
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Totala medlemmar</p>
                <p className="text-3xl font-bold">{stats.totalMembers}</p>
              </div>
              <Users className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

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
                <p className="text-sm text-muted-foreground">Snitt per medlem</p>
                <p className="text-3xl font-bold">{formatCurrency(stats.averageRevenue)}</p>
              </div>
              <Coins className="h-8 w-8 text-amber-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardContent className="p-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground mb-3">Nivåfördelning</p>
              <div className="space-y-1">
                {Object.entries(tierConfig).map(([tier, config]) => {
                  const Icon = config.icon;
                  const count = stats.tierCounts[tier as MemberTier] || 0;
                  return (
                    <div key={tier} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1">
                        <Icon className="h-3 w-3" />
                        <span>{tier}</span>
                      </div>
                      <span className="font-semibold">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card className="shadow-md">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Sök efter namn, email eller telefon..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Tier Filter */}
            <Select value={tierFilter} onValueChange={(value) => setTierFilter(value as MemberTier | 'all')}>
              <SelectTrigger className="w-full lg:w-48">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  <SelectValue placeholder="Filtrera nivå" />
                </div>
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                <SelectItem value="all">Alla nivåer</SelectItem>
                {Object.keys(tierConfig).map((tier) => (
                  <SelectItem key={tier} value={tier}>{tier}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Sort */}
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
              <SelectTrigger className="w-full lg:w-48">
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="h-4 w-4" />
                  <SelectValue placeholder="Sortera" />
                </div>
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                <SelectItem value="revenue-high">Högst intäkt</SelectItem>
                <SelectItem value="revenue-low">Lägst intäkt</SelectItem>
                <SelectItem value="newest">Nyaste först</SelectItem>
                <SelectItem value="oldest">Äldsta först</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Members Table */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Medlemslista</span>
            <Badge variant="secondary">{filteredAndSortedMembers.length} medlemmar</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Namn</TableHead>
                  <TableHead>Kontakt</TableHead>
                  <TableHead>Nivå</TableHead>
                  <TableHead>Poäng</TableHead>
                  <TableHead className="text-right">Total intäkt</TableHead>
                  <TableHead>Medlem sedan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedMembers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Inga medlemmar hittades
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSortedMembers.map((member) => {
                    const TierIcon = tierConfig[member.tier].icon;
                    return (
                      <TableRow key={member.id} className="hover:bg-muted/50 transition-colors">
                        <TableCell className="font-medium">{member.name}</TableCell>
                        <TableCell>
                          <div className="space-y-1 text-sm">
                            <div className="flex items-center gap-2">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              <span className="text-muted-foreground">{member.email}</span>
                            </div>
                            {member.phone && (
                              <div className="flex items-center gap-2">
                                <Phone className="h-3 w-3 text-muted-foreground" />
                                <span className="text-muted-foreground">{member.phone}</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${tierConfig[member.tier].color} gap-1`}>
                            <TierIcon className="h-3 w-3" />
                            {member.tier}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Coins className="h-4 w-4 text-primary" />
                            <span className="font-semibold">{member.pointsBalance}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {formatCurrency(member.totalRevenue)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(member.createdAt)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
