import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/integrations/supabase/client';

type Role = 'member' | 'instructor' | 'admin';

interface AuthState {
  userId: string | null;
  role: Role | null;
  loading: boolean;
  setAuth: (userId: string | null, role: Role | null) => void;
  fetchRole: (userId: string) => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      userId: null,
      role: null,
      loading: true,
      
      setAuth: (userId, role) => set({ userId, role, loading: false }),
      
      fetchRole: async (userId: string) => {
        try {
          const { data, error } = await (supabase as any)
            .from('user_roles')
            .select('role, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (error) throw error;
          if (data?.role) {
            set({ userId, role: data.role as Role, loading: false });
          } else {
            // Do not assume 'member' to avoid incorrect redirects
            set({ userId, role: null, loading: false });
          }
        } catch (error) {
          console.error('Error fetching role:', error);
          // Keep role unknown instead of forcing member
          set({ userId, role: null, loading: false });
        }
      },
      
      logout: async () => {
        await supabase.auth.signOut();
        set({ userId: null, role: null, loading: false });
        // Clear persisted state
        localStorage.removeItem('dance-school-auth');
      },
      
      initialize: async () => {
        set({ loading: true });
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          // Always fetch fresh role from database, don't trust persisted state
          const { data, error } = await (supabase as any)
            .from('user_roles')
            .select('role')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!error && data?.role) {
            set({ userId: session.user.id, role: data.role as Role, loading: false });
          } else {
            // If no role in user_roles, check profiles as fallback
            const { data: profileData } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', session.user.id)
              .single();
            
            const fallbackRole = (profileData?.role as Role) || 'member';
            set({ userId: session.user.id, role: fallbackRole, loading: false });
          }
        } else {
          set({ userId: null, role: null, loading: false });
        }
      },
    }),
    {
      name: 'dance-school-auth',
    }
  )
);
