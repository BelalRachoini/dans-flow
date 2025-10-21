import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useAuthStore } from "@/store/authStore";
import Dashboard from "@/pages/Dashboard";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Courses from "@/pages/Courses";
import CourseDetail from "@/pages/CourseDetail";
import Schema from "@/pages/Schema";
import Biljetter from "@/pages/Biljetter";
import Medlemmar from "@/pages/Medlemmar";
import Betalningar from "@/pages/Betalningar";
import EventsPage from "@/pages/Events";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuthStore();
  return user ? <>{children}</> : <Navigate to="/login" replace />;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/register" element={<Register />} />
    
    <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
      <Route path="/" element={<Dashboard />} />
      <Route path="/kurser-poang" element={<Courses />} />
      <Route path="/kurser-poang/:id" element={<CourseDetail />} />
      <Route path="/schema" element={<Schema />} />
      <Route path="/event" element={<EventsPage />} />
      <Route path="/biljetter" element={<Biljetter />} />
      <Route path="/medlemmar" element={<Medlemmar />} />
      <Route path="/betalningar" element={<Betalningar />} />
      <Route path="/prenumerationer" element={<div className="text-center py-12">Prenumerationer - Under utveckling</div>} />
      <Route path="/rapporter" element={<div className="text-center py-12">Rapporter - Under utveckling</div>} />
      <Route path="/admin" element={<div className="text-center py-12">Admin - Under utveckling</div>} />
    </Route>
    
    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
    <Route path="*" element={<NotFound />} />
  </Routes>
);

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
