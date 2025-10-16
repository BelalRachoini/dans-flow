import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/store/authStore';
import { mockLogin } from '@/services/mockApi';
import { toast } from 'sonner';
import { sv } from '@/locales/sv';
import heroImage from '@/assets/hero-dance.jpg';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { setUser } = useAuthStore();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const user = await mockLogin(email, password);
      setUser(user);
      toast.success('Välkommen tillbaka!');
      navigate('/');
    } catch (error) {
      toast.error('Fel e-post eller lösenord');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = async (role: 'ADMIN' | 'INSTRUKTOR' | 'MEDLEM') => {
    setLoading(true);
    try {
      const demoUsers = {
        ADMIN: 'anna@example.com',
        INSTRUKTOR: 'erik@example.com',
        MEDLEM: 'maria@example.com',
      };
      const user = await mockLogin(demoUsers[role], 'demo');
      setUser(user);
      toast.success(`Inloggad som ${role.toLowerCase()}`);
      navigate('/');
    } catch (error) {
      toast.error('Något gick fel');
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
          <h1 className="mb-4 text-5xl font-bold">Välkommen till Dansskolan</h1>
          <p className="text-xl text-white/90">
            Upptäck din passion för dans. Från Salsa till HipHop - vi har kurser för alla nivåer.
          </p>
        </div>
      </div>

      {/* Login Form */}
      <div className="flex w-full items-center justify-center p-8 lg:w-1/2">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center lg:hidden">
            <h2 className="text-3xl font-bold gradient-primary bg-clip-text text-transparent">Dansskolan</h2>
          </div>

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl">{sv.auth.login}</CardTitle>
              <CardDescription>
                Logga in för att komma åt ditt konto
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleLogin}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{sv.auth.email}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="din@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{sv.auth.password}</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-4">
                <Button
                  type="submit"
                  className="w-full"
                  variant="hero"
                  disabled={loading}
                >
                  {loading ? sv.common.loading : sv.auth.login}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  Har du inget konto?{' '}
                  <Link to="/register" className="text-primary hover:underline font-medium">
                    {sv.auth.register}
                  </Link>
                </p>
              </CardFooter>
            </form>
          </Card>

          {/* Quick Login Demo */}
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="text-sm">Demo-inloggning</CardTitle>
              <CardDescription className="text-xs">
                Testa systemet som olika roller
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => quickLogin('ADMIN')}
                disabled={loading}
              >
                Admin
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => quickLogin('INSTRUKTOR')}
                disabled={loading}
              >
                Instruktör
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => quickLogin('MEDLEM')}
                disabled={loading}
              >
                Medlem
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
