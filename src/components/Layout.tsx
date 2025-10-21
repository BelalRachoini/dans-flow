import { useState } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, BookOpen, Calendar, PartyPopper, Ticket, 
  Users, CreditCard, Repeat, Settings,
  Menu, X, QrCode, UserCircle, LogOut, Bell, Languages
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
import { useLanguageStore, type Language } from '@/store/languageStore';

export const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { t, language, setLanguage } = useLanguageStore();

  const navItems = [
    { icon: LayoutDashboard, label: t.nav.oversikt, path: '/', roles: ['ADMIN', 'INSTRUKTOR', 'MEDLEM'] },
    { icon: BookOpen, label: t.nav.kurserPoang, path: '/kurser-poang', roles: ['ADMIN', 'INSTRUKTOR', 'MEDLEM'] },
    { icon: Calendar, label: t.nav.schema, path: '/schema', roles: ['ADMIN', 'INSTRUKTOR', 'MEDLEM'] },
    { icon: PartyPopper, label: t.nav.event, path: '/event', roles: ['ADMIN', 'INSTRUKTOR', 'MEDLEM'] },
    { icon: Ticket, label: t.nav.biljetter, path: '/biljetter', roles: ['ADMIN', 'INSTRUKTOR', 'MEDLEM'] },
    { icon: Users, label: t.nav.medlemmar, path: '/medlemmar', roles: ['ADMIN', 'INSTRUKTOR'] },
    { icon: Repeat, label: t.nav.prenumerationer, path: '/prenumerationer', roles: ['ADMIN', 'INSTRUKTOR'] },
    { icon: CreditCard, label: t.nav.betalningar, path: '/betalningar', roles: ['ADMIN', 'INSTRUKTOR'] },
    { icon: Settings, label: t.nav.admin, path: '/admin', roles: ['ADMIN'] },
  ];

  if (!user) return null;

  const userInitials = user.name.split(' ').map(n => n[0]).join('').toUpperCase();
  const visibleNavItems = navItems.filter(item => item.roles.includes(user.role));

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
            <Link to="/" className="text-xl font-bold text-sidebar-foreground">
              Dansskolan
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
                <p className="truncate text-sm font-medium text-sidebar-foreground">{user.name}</p>
                <p className="text-xs text-sidebar-foreground/70">{t.roles[user.role]}</p>
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
                {visibleNavItems.find(item => item.path === location.pathname)?.label || 'Dansskolan'}
              </h1>
            </div>

            <div className="flex items-center gap-2 lg:gap-3">
              {/* Quick actions - Hidden on small mobile */}
              <Button variant="outline" size="sm" className="hidden sm:flex">
                <QrCode size={16} className="mr-2" />
                {t.qr.scan}
              </Button>

              {/* Language selector */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="hidden sm:flex">
                    <Languages size={20} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-popover z-50">
                  <DropdownMenuLabel>{t.language.title}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => setLanguage('sv')}
                    className={language === 'sv' ? 'bg-accent' : ''}
                  >
                    {t.language.swedish}
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setLanguage('en')}
                    className={language === 'en' ? 'bg-accent' : ''}
                  >
                    {t.language.english}
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setLanguage('es')}
                    className={language === 'es' ? 'bg-accent' : ''}
                  >
                    {t.language.spanish}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Notifications */}
              <Button variant="ghost" size="icon" className="relative hidden sm:flex">
                <Bell size={20} />
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-secondary"></span>
              </Button>

              {/* User menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2 px-2 lg:px-4">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden lg:inline">{user.name}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-popover z-50">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <UserCircle className="mr-2 h-4 w-4" />
                    {t.members.profile}
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Ticket className="mr-2 h-4 w-4" />
                    {t.tickets.myTickets}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <span className="mr-2 font-semibold text-primary">{t.courses.pointsBalance}:</span>
                    {user.pointsBalance}
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
