import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import DashboardReports from "./pages/DashboardReports";
import UserManagement from "./pages/UserManagement";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminTrainings from "./pages/admin/AdminTrainings";
import Trainings from "./pages/Trainings";
import TrainingDetail from "./pages/TrainingDetail";
import EvaluationPage from "./pages/EvaluationPage";
import Profile from "./pages/Profile";
import AccessLogs from "./pages/AccessLogs";
import AdherenceEvaluations from "./pages/AdherenceEvaluations";
import AttendanceRecords from "./pages/AttendanceRecords";
import CertificatesAdmin from "./pages/CertificatesAdmin";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/overview" element={<Dashboard />}>
            <Route index element={<AdminOverview />} />
          </Route>
          <Route path="/dashboard/trainings" element={<Dashboard />}>
            <Route index element={<AdminTrainings />} />
          </Route>
          <Route path="/dashboard/reports" element={<Dashboard />}>
            <Route index element={<DashboardReports />} />
          </Route>
          <Route path="/dashboard/users" element={<Dashboard />}>
            <Route index element={<UserManagement />} />
          </Route>
          <Route path="/dashboard/adherence" element={<Dashboard />}>
            <Route index element={<AdherenceEvaluations />} />
          </Route>
          <Route path="/dashboard/attendance" element={<Dashboard />}>
            <Route index element={<AttendanceRecords />} />
          </Route>
          <Route path="/dashboard/certificates" element={<Dashboard />}>
            <Route index element={<CertificatesAdmin />} />
          </Route>
          <Route path="/trainings" element={<Trainings />} />
          <Route path="/training/:id" element={<TrainingDetail />} />
          <Route path="/evaluation/:trainingId" element={<EvaluationPage />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/access-logs" element={<AccessLogs />} />
          {/* Redirect old /admin route to new location */}
          <Route path="/admin" element={<Navigate to="/dashboard/trainings" replace />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
