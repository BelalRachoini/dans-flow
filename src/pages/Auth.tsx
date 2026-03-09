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
import { useLanguageStore } from '@/store/languageStore';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDanceRoleSelector, setShowDanceRoleSelector] = useState(false);
  const [newUserId, setNewUserId] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const navigate = useNavigate();
  const { initialize } = useAuthStore();
  const { t } = useLanguageStore();

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

  const sendWelcomeEmail = async (userEmail: string, userName: string) => {
    try {
      const loginUrl = `${window.location.origin}/auth`;
      const welcomeHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <div style="background: linear-gradient(135deg, #c59333 0%, #d4a84b 100%); padding: 40px 20px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">
                💃 Välkommen till DanceVida!
              </h1>
            </div>
            <div style="padding: 40px 30px;">
              <p style="font-size: 18px; color: #333333; margin-bottom: 20px;">
                Hej <strong>${userName}</strong>!
              </p>
              <p style="font-size: 16px; color: #555555; line-height: 1.6; margin-bottom: 20px;">
                Tack för att du skapade ett konto hos oss! Vi är glada att ha dig med i vår dansfamilj.
              </p>
              <p style="font-size: 16px; color: #555555; line-height: 1.6; margin-bottom: 30px;">
                Utforska våra kurser, boka lektioner och delta i våra evenemang. Vi ser fram emot att dansa med dig!
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #c59333 0%, #d4a84b 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  Logga in & kom igång
                </a>
              </div>
              <hr style="border: none; border-top: 1px solid #eeeeee; margin: 30px 0;">
              <p style="font-size: 14px; color: #888888; margin-bottom: 10px;">
                <strong>Dina kontouppgifter:</strong>
              </p>
              <p style="font-size: 14px; color: #555555; margin: 5px 0;">
                📧 E-post: ${userEmail}
              </p>
              <p style="font-size: 14px; color: #555555; margin: 5px 0;">
                👤 Namn: ${userName}
              </p>
            </div>
            <div style="background-color: #f8f8f8; padding: 20px 30px; text-align: center; border-top: 1px solid #eeeeee;">
              <p style="font-size: 12px; color: #888888; margin: 0;">
                © ${new Date().getFullYear()} DanceVida. Alla rättigheter förbehållna.
              </p>
              <p style="font-size: 12px; color: #888888; margin: 10px 0 0 0;">
                📍 Stockholm, Sverige | 📧 tickets@dancevida.se
              </p>
            </div>
          </div>
        </body>
        </html>
      `;

      await supabase.functions.invoke('send-email', {
        body: {
          to: userEmail,
          subject: 'Välkommen till DanceVida! 💃',
          html: welcomeHtml
        }
      });
      console.log('Welcome email sent to:', userEmail);
    } catch (error) {
      console.error('Failed to send welcome email:', error);
      // Don't fail signup if email fails
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
        
        // Send welcome email (non-blocking)
        sendWelcomeEmail(email, fullName);
        
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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setResetSent(true);
      toast.success(t.auth.resetLinkSent);
    } catch (error: any) {
      toast.error(error.message || 'Kunde inte skicka återställningslänk');
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
          <p className="text-muted-foreground mt-2 max-w-md mx-auto">
            Välkommen till vår dansskola. Lär dig socialdans på kort tid!
            <br />
            Vi har danskurser på alla nivåer och håller workshops, socialdanser, fester och evenemang.
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
