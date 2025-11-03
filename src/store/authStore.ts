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
          const { data, error } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (error) throw error;
          set({ userId, role: data.role as Role, loading: false });
        } catch (error) {
          console.error('Error fetching role:', error);
          set({ userId: null, role: null, loading: false });
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
          const { data, error } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (!error && data) {
            set({ userId: session.user.id, role: data.role as Role, loading: false });
          } else {
            set({ userId: null, role: null, loading: false });
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
