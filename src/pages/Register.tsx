import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/store/authStore';
import { mockRegister } from '@/services/mockApi';
import { toast } from 'sonner';
import { sv } from '@/locales/sv';
import heroImage from '@/assets/hero-dance.jpg';

export default function Register() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const { setUser } = useAuthStore();
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast.error('Lösenorden matchar inte');
      return;
    }

    setLoading(true);

    try {
      const user = await mockRegister({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
      });
      setUser(user);
      toast.success('Välkommen till Dansskolan!');
      navigate('/');
    } catch (error) {
      toast.error('Kunde inte skapa konto');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full">
      {/* Hero Section */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 gradient-secondary opacity-90" />
        <img 
          src={heroImage} 
          alt="Dance School" 
          className="absolute inset-0 h-full w-full object-cover mix-blend-overlay"
        />
        <div className="relative z-10 flex flex-col justify-center p-12 text-white">
          <h1 className="mb-4 text-5xl font-bold">Börja din dansresa idag</h1>
          <p className="text-xl text-white/90">
            Gå med i vår gemenskap och upplev glädjen i att dansa!
          </p>
        </div>
      </div>

      {/* Register Form */}
      <div className="flex w-full items-center justify-center p-8 lg:w-1/2">
        <div className="w-full max-w-md space-y-6">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl">{sv.auth.register}</CardTitle>
              <CardDescription>
                Skapa ditt konto och kom igång
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleRegister}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{sv.auth.name}</Label>
                  <Input
                    id="name"
                    placeholder="Ditt namn"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">{sv.auth.email}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="din@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">{sv.auth.phone} (valfritt)</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+46701234567"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{sv.auth.password}</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Bekräfta lösenord</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    required
                  />
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-4">
                <Button
                  type="submit"
                  className="w-full"
                  variant="premium"
                  disabled={loading}
                >
                  {loading ? sv.common.loading : sv.auth.register}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  Har du redan ett konto?{' '}
                  <Link to="/login" className="text-primary hover:underline font-medium">
                    {sv.auth.login}
                  </Link>
                </p>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
