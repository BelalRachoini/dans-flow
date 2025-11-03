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
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .maybeSingle();

          if (error) throw error;
          if (data?.role) {
            set({ userId, role: data.role as Role, loading: false });
          } else {
            // Fallback to member until profile is created by trigger
            set({ userId, role: 'member', loading: false });
          }
        } catch (error) {
          console.error('Error fetching role:', error);
          // Fallback to member to avoid blocking the UI
          set({ userId, role: 'member', loading: false });
        }
      },
      
      logout: async () => {
        await supabase.auth.signOut();
        set({ userId: null, role: null, loading: false });
      },
      
      initialize: async () => {
        set({ loading: true });
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          const { data, error } = await (supabase as any)
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .maybeSingle();

          if (!error && data?.role) {
            set({ userId: session.user.id, role: data.role as Role, loading: false });
          } else {
            // Fallback to member to avoid UX deadlock while profile trigger runs
            set({ userId: session.user.id, role: 'member', loading: false });
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
