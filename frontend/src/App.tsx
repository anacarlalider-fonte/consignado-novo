import { Navigate, Route, Routes } from "react-router-dom";
import type { ReactElement } from "react";
import { SIDEBAR_ITEMS } from "./sidebar-config";
import { AppShell } from "./components/AppShell";
import { DashboardPage } from "./pages/DashboardPage";
import { LeadsPage } from "./pages/LeadsPage";
import { PipelinePage } from "./pages/PipelinePage";
import { OrdersPage } from "./pages/OrdersPage";
import { LoginPage } from "./pages/LoginPage";
import { useAuth } from "./state/auth-context";
import { ReportsPage } from "./pages/ReportsPage";
import { IntegrationsPage } from "./pages/IntegrationsPage";
import { AtendimentosPage } from "./pages/AtendimentosPage";
import { AgendaPage } from "./pages/AgendaPage";
import { TasksPage } from "./pages/TasksPage";
import { CustomersPage } from "./pages/CustomersPage";
import { AdminPage } from "./pages/AdminPage";
import { GoalsPage } from "./pages/GoalsPage";

export function App() {
  const { isAuthenticated, hasPermission, isGestora } = useAuth();

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  function RequirePermission({
    permission,
    element
  }: {
    permission: string;
    element: ReactElement;
  }) {
    return hasPermission(permission) ? element : <Navigate to="/dashboard" replace />;
  }

  return (
    <AppShell items={SIDEBAR_ITEMS}>
      <Routes>
        <Route path="/login" element={<Navigate to="/dashboard" replace />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/leads" element={<RequirePermission permission="leads:read" element={<LeadsPage />} />} />
        <Route
          path="/pipeline"
          element={<RequirePermission permission="opportunities:read" element={<PipelinePage />} />}
        />
        <Route path="/atendimentos" element={<Navigate to="/pedidos" replace />} />
        <Route path="/agenda" element={<AgendaPage />} />
        <Route path="/tarefas" element={<TasksPage />} />
        <Route path="/clientes" element={<CustomersPage />} />
        <Route path="/metas" element={<GoalsPage />} />
        <Route path="/pedidos" element={<RequirePermission permission="orders:read" element={<OrdersPage />} />} />
        <Route
          path="/relatorios"
          element={<RequirePermission permission="reports:read" element={<ReportsPage />} />}
        />
        <Route
          path="/integracoes"
          element={<RequirePermission permission="integrations:write" element={<IntegrationsPage />} />}
        />
        <Route path="/admin" element={isGestora ? <AdminPage /> : <Navigate to="/dashboard" replace />} />
      </Routes>
    </AppShell>
  );
}
