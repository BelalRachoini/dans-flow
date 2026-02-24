import { useState, useEffect } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { 
  LayoutDashboard, BookOpen, Calendar, PartyPopper, Ticket, 
  Users, CreditCard, Repeat, Settings,
  Menu, X, QrCode, UserCircle, LogOut, Languages
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/store/authStore';
import { useLanguageStore } from '@/store/languageStore';
import { LanguageMenu } from '@/components/LanguageMenu';
import logo from '@/assets/dance-vida-logo.png';

export const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userName, setUserName] = useState<string>('User');
  const [ticketsRemaining, setTicketsRemaining] = useState<number>(0);
  const location = useLocation();
  const navigate = useNavigate();
  const { userId, role, logout } = useAuthStore();
  const { t, language, setLanguage } = useLanguageStore();

  // Fetch user profile data
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!userId) return;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .single();
      
      if (data?.full_name) {
        const firstName = data.full_name.split(' ')[0];
        setUserName(firstName);
      }
    };

    fetchUserProfile();
  }, [userId]);

  // Fetch remaining tickets
  useEffect(() => {
    const fetchTickets = async () => {
      if (!userId) return;
      
      const { data, error } = await supabase
        .from('tickets')
        .select('total_tickets, tickets_used, expires_at, status')
        .eq('member_id', userId)
        .neq('status', 'used')
        .gt('expires_at', new Date().toISOString());
      
      if (data) {
        const remaining = data.reduce((sum, ticket) => 
          sum + (ticket.total_tickets - ticket.tickets_used), 0
        );
        setTicketsRemaining(remaining);
      }
    };

    fetchTickets();
  }, [userId]);

  // Get the correct overview path based on role
  const getOverviewPath = () => {
    if (role === 'admin') return '/admin';
    if (role === 'instructor') return '/instructor';
    return '/member';
  };

  const navItems = [
    { icon: LayoutDashboard, label: t.nav.oversikt, path: getOverviewPath(), roles: ['ADMIN', 'INSTRUKTOR', 'MEDLEM'] },
    { icon: BookOpen, label: t.nav.kurserPoang, path: '/kurser-poang', roles: ['ADMIN', 'INSTRUKTOR', 'MEDLEM'] },
    { icon: Calendar, label: t.nav.schema, path: '/schema', roles: ['ADMIN', 'INSTRUKTOR', 'MEDLEM'] },
    { icon: PartyPopper, label: t.nav.event, path: '/event', roles: ['ADMIN', 'INSTRUKTOR', 'MEDLEM'] },
    { icon: Ticket, label: t.nav.biljetter, path: '/biljetter', roles: ['ADMIN', 'INSTRUKTOR', 'MEDLEM'] },
    { icon: Users, label: t.nav.medlemmar, path: '/medlemmar', roles: ['ADMIN'] },
    { icon: Repeat, label: t.nav.prenumerationer, path: '/prenumerationer', roles: ['ADMIN'] },
    { icon: CreditCard, label: t.nav.betalningar, path: '/betalningar', roles: ['ADMIN'] },
  ];

  if (!userId || !role) return null;

  const userInitials = 'U';
  const roleUpper = role.toUpperCase() as 'ADMIN' | 'INSTRUKTOR' | 'MEDLEM';
  const roleMap: Record<string, 'ADMIN' | 'INSTRUKTOR' | 'MEDLEM'> = {
    'admin': 'ADMIN',
    'instructor': 'INSTRUKTOR',
    'member': 'MEDLEM'
  };
  const visibleNavItems = navItems.filter(item => item.roles.includes(roleMap[role]));

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          role="button"
          aria-label="Close sidebar"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 z-50 h-screen transition-transform duration-300 w-64 gradient-dark border-r border-sidebar-border
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
            <Link to="/" className="flex items-center">
              <img src={logo} alt="Dance Vida" className="h-10 w-auto" />
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(false)}
              className="text-sidebar-foreground hover:bg-sidebar-accent lg:hidden"
            >
              <X size={20} />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 overflow-y-auto p-4">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={(e) => {
                    setSidebarOpen(false);
                    // If already on this path, force navigation
                    if (location.pathname.startsWith(item.path)) {
                      e.preventDefault();
                      navigate(item.path);
                    }
                  }}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-smooth ${
                    isActive || location.pathname.startsWith(item.path)
                      ? 'bg-sidebar-accent text-primary shadow-sm'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                  }`}
                >
                  <Icon size={20} className="shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User section */}
          <div className="border-t border-sidebar-border p-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium text-sidebar-foreground">{userName}</p>
                <p className="text-xs text-sidebar-foreground/70">{t.roles[roleMap[role]]}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 w-full lg:ml-64">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
          <div className="flex h-16 items-center justify-between px-4 lg:px-6">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden"
              >
                <Menu size={20} />
              </Button>
              <h1 className="text-base lg:text-lg font-semibold truncate">
                {visibleNavItems.find(item => item.path === location.pathname)?.label || 'Dance Vida'}
              </h1>
            </div>

            <div className="flex items-center gap-2 lg:gap-3">
              {/* Language Menu */}
              <LanguageMenu />

              {/* Quick actions for admin and instructor only */}
              {(role === 'admin' || role === 'instructor') && (
                <>
                  {/* Icon-only button on mobile */}
                  <Button variant="outline" size="icon" className="sm:hidden" asChild>
                    <Link to="/scan">
                      <QrCode size={16} />
                    </Link>
                  </Button>
                  {/* Full button with text on larger screens */}
                  <Button variant="outline" size="sm" className="hidden sm:flex" asChild>
                    <Link to="/scan">
                      <QrCode size={16} className="mr-2" />
                      {t.qr.scan}
                    </Link>
                  </Button>
                </>
              )}

              {/* User menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2 px-2 lg:px-4">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden lg:inline">{userName}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-popover z-50">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">{userName}</p>
                      <p className="text-xs text-muted-foreground">user@example.com</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="cursor-pointer">
                      <UserCircle className="mr-2 h-4 w-4" />
                      {t.members.profile}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/biljetter" className="cursor-pointer">
                      <Ticket className="mr-2 h-4 w-4" />
                      {t.tickets.myTickets}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <span className="mr-2 font-semibold text-primary">{t.courses.ticketsRemaining}:</span>
                    {ticketsRemaining}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    {t.auth.logout}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-3 sm:p-4 lg:p-6 w-full overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
