import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { RoleGuard } from "@/components/RoleGuard";
import { useAuthStore } from "@/store/authStore";
import { initializeLocale, useLanguageStore } from "@/store/languageStore";
import { supabase } from "@/integrations/supabase/client";
import Auth from "@/pages/Auth";
import MemberDashboard from "@/pages/MemberDashboard";
import Profile from "@/pages/Profile";
import InstructorDashboard from "@/pages/InstructorDashboard";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminMembers from "@/pages/AdminMembers";
import Courses from "@/pages/Courses";
import CourseDetail from "@/pages/CourseDetail";
import Schema from "@/pages/Schema";
import Biljetter from "@/pages/Biljetter";
import Scan from "@/pages/Scan";
import Medlemmar from "@/pages/Medlemmar";
import MedlemmarCRM from "@/pages/MedlemmarCRM";
import Betalningar from "@/pages/Betalningar";
import Prenumerationer from "@/pages/Prenumerationer";
import EventsPage from "@/pages/Events";
import EventDetail from "@/pages/EventDetail";
import PaymentSuccess from "@/pages/PaymentSuccess";
import PaymentCancelled from "@/pages/PaymentCancelled";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const AppRoutes = () => {
  const { initialize } = useAuthStore();
  const { loadUserPreferredLocale } = useLanguageStore();

  useEffect(() => {
    // Initialize locale from cookie
    initializeLocale();
    
    initialize();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const store = useAuthStore.getState();
      if (session?.user) {
        // Set user immediately and defer role fetch to avoid deadlocks
        useAuthStore.setState((s) => ({ ...s, userId: session.user!.id, loading: true }));
        setTimeout(() => {
          store.fetchRole(session.user!.id);
          // Load user's preferred locale
          loadUserPreferredLocale(session.user!.id);
        }, 0);
      } else {
        useAuthStore.setState({ userId: null, role: null, loading: false });
      }
    });

    return () => subscription.unsubscribe();
  }, [initialize, loadUserPreferredLocale]);

  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/auth/callback" element={<Auth />} />
      
      {/* Payment Routes - Outside auth guard for redirect handling */}
      <Route path="/payment-success" element={<PaymentSuccess />} />
      <Route path="/payment-cancelled" element={<PaymentCancelled />} />
      
      {/* Member Routes */}
      <Route element={<RoleGuard allowedRoles={['member', 'instructor', 'admin']}><Layout /></RoleGuard>}>
        <Route path="/member" element={<MemberDashboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/kurser-poang" element={<Courses />} />
        <Route path="/kurser-poang/:id" element={<CourseDetail />} />
        <Route path="/schema" element={<Schema />} />
        <Route path="/event" element={<EventsPage />} />
        <Route path="/event/:id" element={<EventDetail />} />
        <Route path="/biljetter" element={<Biljetter />} />
      </Route>

      {/* Instructor Routes */}
      <Route element={<RoleGuard allowedRoles={['instructor', 'admin']}><Layout /></RoleGuard>}>
        <Route path="/instructor" element={<InstructorDashboard />} />
        <Route path="/scan" element={<Scan />} />
      </Route>

      {/* Admin Routes */}
      <Route element={<RoleGuard allowedRoles={['admin']}><Layout /></RoleGuard>}>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/kurser-poang" element={<Courses />} />
        <Route path="/admin/schema" element={<Schema />} />
        <Route path="/admin/event" element={<EventsPage />} />
        <Route path="/admin/event/:id" element={<EventDetail />} />
        <Route path="/admin/medlemmar" element={<MedlemmarCRM />} />
        <Route path="/admin/prenumerationer" element={<Prenumerationer />} />
        <Route path="/admin/betalningar" element={<Betalningar />} />
        <Route path="/medlemmar" element={<MedlemmarCRM />} />
        <Route path="/betalningar" element={<Betalningar />} />
        <Route path="/prenumerationer" element={<Prenumerationer />} />
      </Route>

      {/* Redirect root to role-appropriate dashboard */}
      <Route path="/" element={<Navigate to="/auth" replace />} />
      
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AppRoutes />
      </TooltipProvider>
    </QueryClientProvider>
  </BrowserRouter>
);

export default App;
