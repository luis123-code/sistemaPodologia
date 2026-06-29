import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import DashboardPage from "./pages/DashboardPage";
import PatientsPage from "./pages/PatientsPage";
import AppointmentsPage from "./pages/AppointmentsPage";
import MedicalHistoryPage from "./pages/MedicalHistoryPage";
import ReportsPage from "./pages/ReportsPage";
import SettingsPage from "./pages/SettingsPage";
import WaitingRoomPage from "./pages/WaitingRoomPage";
import ServicesPage from "./pages/ServicesPage";
import InventoryPage from "./pages/InventoryPage";
import BillingPage from "./pages/BillingPage";
import DocumentsPage from "./pages/DocumentsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/pacientes" element={<PatientsPage />} />
            <Route path="/citas" element={<AppointmentsPage />} />
            <Route path="/historial" element={<MedicalHistoryPage />} />
            <Route path="/reportes" element={<ReportsPage />} />
            <Route path="/sala-espera" element={<Navigate to="/ruta-dia" replace />} />
            <Route path="/ruta-dia" element={<WaitingRoomPage />} />
            <Route path="/servicios" element={<ServicesPage />} />
            <Route path="/inventario" element={<InventoryPage />} />
            <Route path="/facturacion" element={<BillingPage />} />
            <Route path="/documentacion" element={<DocumentsPage />} />
            <Route path="/configuracion" element={<SettingsPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
