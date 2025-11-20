import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import logo from '@/assets/dance-vida-logo.png';
import { useAuthStore } from '@/store/authStore';
import DanceRoleSelector from '@/components/DanceRoleSelector';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDanceRoleSelector, setShowDanceRoleSelector] = useState(false);
  const [newUserId, setNewUserId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { initialize } = useAuthStore();

  const getRoleRedirect = async (userId: string) => {
    // Prefer user_roles; fall back to RPC check
    const { data, error } = await (supabase as any)
      .from('user_roles')
      .select('role, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data?.role) {
      switch (data.role) {
        case 'admin': return '/admin';
        case 'instructor': return '/instructor';
        case 'member': return '/member';
        default: return '/member';
      }
    }

    // Fallback: use has_role RPC to check admin quickly
    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: userId, _role: 'admin' });
    if (isAdmin) return '/admin';

    return '/member';
  };


  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        // Force refresh auth store with latest role from database
        await initialize();
        const redirect = await getRoleRedirect(data.user.id);
        toast.success('Välkommen tillbaka!');
        navigate(redirect);
      }
    } catch (error: any) {
      toast.error(error.message || 'Fel e-post eller lösenord');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone: phone,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (error) throw error;

      if (data.user) {
        toast.success('Konto skapat! Loggar in...');
        // Wait a bit for trigger to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check if dance_role is already set
        const { data: profile } = await supabase
          .from('profiles')
          .select('dance_role')
          .eq('id', data.user.id)
          .single();
        
        if (!profile?.dance_role) {
          // Show dance role selector
          setNewUserId(data.user.id);
          setShowDanceRoleSelector(true);
          setLoading(false);
          return;
        }
        
        // Already has role, proceed normally
        await initialize();
        const redirect = await getRoleRedirect(data.user.id);
        navigate(redirect);
      }
    } catch (error: any) {
      toast.error(error.message || 'Kunde inte skapa konto');
    } finally {
      setLoading(false);
    }
  };

  const handleDanceRoleSelected = async () => {
    setShowDanceRoleSelector(false);
    if (newUserId) {
      await initialize();
      const redirect = await getRoleRedirect(newUserId);
      navigate(redirect);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <img 
            src={logo} 
            alt="Dance Vida" 
            className="h-16 w-auto mx-auto mb-4"
          />
          <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Dance Vida
          </h1>
          <p className="text-muted-foreground mt-2">
            Din dansskola i Stockholm
          </p>
        </div>

        {/* Main Auth Card */}
        <Card className="backdrop-blur-sm bg-card/95 shadow-lg border-border/50">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl font-bold text-center">
              Välkommen
            </CardTitle>
            <CardDescription className="text-center">
              Logga in eller skapa ett nytt konto
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Login/Signup Tabs */}
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="login">Logga in</TabsTrigger>
                <TabsTrigger value="signup">Skapa konto</TabsTrigger>
              </TabsList>

              {/* Login Form */}
              <TabsContent value="login" className="space-y-4">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">E-post</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="din@email.se"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={loading}
                      className="h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password">Lösenord</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      className="h-11"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-11 font-medium"
                    disabled={loading}
                  >
                    {loading ? 'Loggar in...' : 'Logga in'}
                  </Button>
                </form>
              </TabsContent>

              {/* Signup Form */}
              <TabsContent value="signup" className="space-y-4">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Fullständigt namn</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="Anna Andersson"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      disabled={loading}
                      className="h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-phone">Telefon</Label>
                    <Input
                      id="signup-phone"
                      type="tel"
                      placeholder="070-123 45 67"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      disabled={loading}
                      className="h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email">E-post</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="din@email.se"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={loading}
                      className="h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Lösenord</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      className="h-11"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-11 font-medium"
                    disabled={loading}
                  >
                    {loading ? 'Skapar konto...' : 'Skapa konto'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground mt-6">
          Genom att fortsätta godkänner du våra{' '}
          <a href="#" className="underline hover:text-primary transition-colors">
            användarvillkor
          </a>
        </p>
      </div>

      {/* Dance Role Selector Dialog */}
      {showDanceRoleSelector && newUserId && (
        <DanceRoleSelector
          userId={newUserId}
          onComplete={handleDanceRoleSelected}
        />
      )}
    </div>
  );
}
