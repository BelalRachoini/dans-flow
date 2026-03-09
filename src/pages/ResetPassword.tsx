import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import logo from '@/assets/dance-vida-logo.png';
import { useLanguageStore } from '@/store/languageStore';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();
  const { t } = useLanguageStore();

  useEffect(() => {
    // Listen for the PASSWORD_RECOVERY event which fires when user clicks the recovery link
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
      }
    });

    // Also check if we already have a session with recovery type
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error(t.auth.passwordsDoNotMatch);
      return;
    }

    if (password.length < 6) {
      toast.error('Lösenordet måste vara minst 6 tecken');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      toast.success(t.auth.passwordResetSuccess);
      // Sign out so user logs in with new password
      await supabase.auth.signOut();
      navigate('/auth');
    } catch (error: any) {
      toast.error(error.message || 'Kunde inte uppdatera lösenord');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <img src={logo} alt="Dance Vida" className="h-16 w-auto mx-auto mb-4" />
          <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            {t.auth.resetPassword}
          </h1>
        </div>

        <Card className="backdrop-blur-sm bg-card/95 shadow-lg border-border/50">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl font-bold text-center">
              {t.auth.updatePassword}
            </CardTitle>
            <CardDescription className="text-center">
              {ready
                ? t.auth.newPassword
                : 'Väntar på verifiering...'}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {ready ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">{t.auth.newPassword}</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">{t.auth.confirmPassword}</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="h-11"
                  />
                </div>

                <Button type="submit" className="w-full h-11 font-medium" disabled={loading}>
                  {loading ? '...' : t.auth.updatePassword}
                </Button>
              </form>
            ) : (
              <p className="text-center text-muted-foreground py-4">
                Laddar...
              </p>
            )}

            <Button
              variant="link"
              className="w-full mt-4"
              onClick={() => navigate('/auth')}
            >
              {t.auth.backToLogin}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
