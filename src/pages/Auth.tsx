import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Mail, Chrome, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import heroImage from '@/assets/hero-dance.jpg';
import { useAuthStore } from '@/store/authStore';
import DanceRoleSelector from '@/components/DanceRoleSelector';
import logo from '@/assets/dance-vida-logo.png';

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

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });
      if (error) throw error;
    } catch (error: any) {
      toast.error(error.message || 'Kunde inte logga in med Google');
      setLoading(false);
    }
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

  return (
    <div className="flex min-h-screen w-full">
      {/* Hero Section */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 gradient-primary opacity-90" />
        <img 
          src={heroImage} 
          alt="Dance School" 
          className="absolute inset-0 h-full w-full object-cover mix-blend-overlay"
        />
        <div className="relative z-10 flex flex-col justify-center p-12 text-white">
          <img src={logo} alt="Dance Vida" className="mb-6 h-32 w-auto" />
          <h1 className="mb-4 text-5xl font-bold">Välkommen till Dance Vida</h1>
          <p className="text-xl text-white/90">
            Upptäck din passion för dans. Från Salsa till HipHop - vi har kurser för alla nivåer.
          </p>
        </div>
      </div>

      {/* Auth Form */}
      <div className="flex w-full items-center justify-center p-8 lg:w-1/2">
        <div className="w-full max-w-md space-y-6">
          <div className="flex justify-center lg:hidden">
            <img src={logo} alt="Dance Vida" className="h-24 w-auto" />
          </div>

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl">Kom igång</CardTitle>
              <CardDescription>
                Logga in eller skapa ett konto för att fortsätta
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="login">Logga in</TabsTrigger>
                  <TabsTrigger value="signup">Skapa konto</TabsTrigger>
                </TabsList>

                <TabsContent value="login" className="space-y-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                  >
                    <Chrome className="mr-2 h-4 w-4" />
                    Fortsätt med Google
                  </Button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">
                        Eller
                      </span>
                    </div>
                  </div>

                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">E-post</Label>
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="din@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password">Lösenord</Label>
                      <Input
                        id="login-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      variant="hero"
                      disabled={loading}
                    >
                      <Mail className="mr-2 h-4 w-4" />
                      {loading ? 'Loggar in...' : 'Logga in'}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="signup" className="space-y-4">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Instruktörer tilldelas av en administratör. Alla nya konton börjar som medlem.
                    </AlertDescription>
                  </Alert>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                  >
                    <Chrome className="mr-2 h-4 w-4" />
                    Fortsätt med Google
                  </Button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">
                        Eller
                      </span>
                    </div>
                  </div>

                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name">Förnamn & Efternamn</Label>
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="Anna Andersson"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">E-post</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="din@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-phone">Telefon (valfritt)</Label>
                      <Input
                        id="signup-phone"
                        type="tel"
                        placeholder="070-123 45 67"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Lösenord</Label>
                      <Input
                        id="signup-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      variant="hero"
                      disabled={loading}
                    >
                      <Mail className="mr-2 h-4 w-4" />
                      {loading ? 'Skapar konto...' : 'Skapa konto'}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>

      {showDanceRoleSelector && newUserId && (
        <DanceRoleSelector 
          userId={newUserId} 
          onComplete={async () => {
            await initialize();
            const redirect = await getRoleRedirect(newUserId);
            navigate(redirect);
          }} 
        />
      )}
    </div>
  );
}
