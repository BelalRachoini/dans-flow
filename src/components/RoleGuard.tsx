import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';

type Role = 'member' | 'instructor' | 'admin';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: Role[];
}

export function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  const { userId, role, loading } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;

    if (!userId) {
      toast.error('Vänligen logga in');
      navigate('/auth');
      return;
    }

    if (role && !allowedRoles.includes(role)) {
      toast.error('Du har inte behörighet till denna sida');
      
      // Redirect to user's home based on their role
      switch (role) {
        case 'admin':
          navigate('/admin');
          break;
        case 'instructor':
          navigate('/instructor');
          break;
        case 'member':
          navigate('/member');
          break;
        default:
          navigate('/auth');
      }
    }
  }, [userId, role, loading, allowedRoles, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If authenticated but role not yet loaded, optimistically render and let backend RLS enforce access
  if (userId && !role) {
    return <>{children}</>;
  }

  if (!userId || (role && !allowedRoles.includes(role))) {
    return null;
  }

  return <>{children}</>;
}
