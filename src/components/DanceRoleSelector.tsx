import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Users, UserCheck } from 'lucide-react';

interface DanceRoleSelectorProps {
  userId: string;
  onComplete: () => void;
}

export default function DanceRoleSelector({ userId, onComplete }: DanceRoleSelectorProps) {
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'follower' | 'leader' | null>(null);

  const handleRoleSelect = async (role: 'follower' | 'leader') => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ dance_role: role })
        .eq('id', userId);

      if (error) throw error;

      toast.success(`Du har valt rollen: ${role === 'follower' ? 'Följare' : 'Ledare'}`);
      onComplete();
    } catch (error: any) {
      console.error('Error setting dance role:', error);
      toast.error('Kunde inte spara dansroll');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={true}>
      <DialogContent className="sm:max-w-[600px]" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-2xl text-center">Välj din dansroll</DialogTitle>
          <DialogDescription className="text-center pt-2">
            Välj den roll du vanligtvis dansar. Detta hjälper oss att ge dig bättre rekommendationer.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 mt-6">
          <Card
            className={`cursor-pointer transition-all hover:border-primary hover:shadow-lg p-6 ${
              selectedRole === 'follower' ? 'border-primary shadow-lg bg-primary/5' : ''
            }`}
            onClick={() => setSelectedRole('follower')}
          >
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
                <Users className="w-8 h-8 text-secondary-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">Följare</h3>
                <p className="text-sm text-muted-foreground">
                  Följer ledarens rörelser och signaler på dansgolvet
                </p>
              </div>
            </div>
          </Card>

          <Card
            className={`cursor-pointer transition-all hover:border-primary hover:shadow-lg p-6 ${
              selectedRole === 'leader' ? 'border-primary shadow-lg bg-primary/5' : ''
            }`}
            onClick={() => setSelectedRole('leader')}
          >
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center">
                <UserCheck className="w-8 h-8 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">Ledare</h3>
                <p className="text-sm text-muted-foreground">
                  Leder dansen genom att ge signaler och välja rörelser
                </p>
              </div>
            </div>
          </Card>
        </div>

        <Button
          onClick={() => selectedRole && handleRoleSelect(selectedRole)}
          disabled={!selectedRole || loading}
          className="w-full mt-6"
          size="lg"
        >
          {loading ? 'Sparar...' : 'Fortsätt'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
