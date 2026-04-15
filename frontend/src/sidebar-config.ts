export type SidebarItem = {
  key: string;
  label: string;
  icon: string;
  route: string;
  requiredPermission?: string;
  gestoraOnly?: boolean;
};

export const SIDEBAR_ITEMS: SidebarItem[] = [
  { key: "dashboard", label: "Dashboard", icon: "LayoutDashboard", route: "/dashboard" },
  { key: "leads", label: "Leads", icon: "Users", route: "/leads", requiredPermission: "leads:read" },
  { key: "pipeline", label: "Pipeline", icon: "KanbanSquare", route: "/pipeline", requiredPermission: "opportunities:read" },
  { key: "agenda", label: "Agenda/Follow-up", icon: "CalendarClock", route: "/agenda" },
  { key: "tarefas", label: "Tarefas", icon: "ListTodo", route: "/tarefas" },
  { key: "clientes", label: "Clientes", icon: "Building2", route: "/clientes" },
  { key: "pedidos", label: "Pedidos", icon: "FileSpreadsheet", route: "/pedidos", requiredPermission: "orders:read" },
  { key: "metas", label: "Farol de Metas", icon: "Target", route: "/metas" },
  { key: "relatorios", label: "Relatorios", icon: "BarChart3", route: "/relatorios", requiredPermission: "reports:read", gestoraOnly: true },
  { key: "integracoes", label: "Integracoes", icon: "Plug", route: "/integracoes", requiredPermission: "integrations:write", gestoraOnly: true },
  { key: "admin", label: "Administracao", icon: "ShieldCheck", route: "/admin", gestoraOnly: true }
];
