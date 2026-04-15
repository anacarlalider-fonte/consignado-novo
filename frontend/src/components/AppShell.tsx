import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AUTH_ENABLED } from "../config/auth-flags";
import type { SidebarItem } from "../sidebar-config";
import { useAuth } from "../state/auth-context";
import { useTheme } from "../state/theme-context";
import { useCRM } from "../state/crm-context";
import { useDebouncedValue } from "../hooks/useDebouncedValue";

type Props = {
  items: SidebarItem[];
  children: ReactNode;
};

export function AppShell({ items, children }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, hasPermission, isGestora, cargo } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { leads, opportunities, orders, interactions, tasks } = useCRM();
  const visibleItems = items.filter((item) => {
    if (item.requiredPermission && !hasPermission(item.requiredPermission)) return false;
    if (item.gestoraOnly && !isGestora) return false;
    return true;
  });
  const [search, setSearch] = useState("");
  const [showNotifs, setShowNotifs] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const debouncedSearch = useDebouncedValue(search, 250);

  const overdueCount = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    function parseDate(s: string): Date | null {
      const m = s.match(/^(\d{1,2})\/?(\d{1,2})\/?(\d{2,4})$/);
      if (!m) return null;
      let y = parseInt(m[3], 10);
      if (y < 100) y += 2000;
      return new Date(y, parseInt(m[2], 10) - 1, parseInt(m[1], 10));
    }
    let count = 0;
    for (const o of orders) {
      if (o.proximoFollowup) {
        const d = parseDate(o.proximoFollowup);
        if (d && d < today) count++;
      }
    }
    for (const i of interactions) {
      if (i.proximoRetorno) {
        const d = parseDate(i.proximoRetorno);
        if (d && d < today) count++;
      }
    }
    return count;
  }, [orders, interactions]);

  type Notification = { id: string; type: "danger" | "warning" | "success" | "info"; message: string; route: string };

  const notifications = useMemo<Notification[]>(() => {
    const items: Notification[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    function parseDate(s: string): Date | null {
      const m = s.match(/^(\d{1,2})\/?(\d{1,2})\/?(\d{2,4})$/);
      if (!m) return null;
      let y = parseInt(m[3], 10);
      if (y < 100) y += 2000;
      return new Date(y, parseInt(m[2], 10) - 1, parseInt(m[1], 10));
    }

    // Overdue follow-ups from orders
    for (const o of orders) {
      if (o.proximoFollowup) {
        const d = parseDate(o.proximoFollowup);
        if (d && d < today) {
          const days = Math.ceil((today.getTime() - d.getTime()) / 86_400_000);
          items.push({ id: `fu-${o.pedido}`, type: "danger", message: `Follow-up do pedido #${o.pedido} (${o.cliente}) atrasado há ${days}d`, route: "/agenda" });
        }
      }
    }

    // Overdue from interactions
    for (const i of interactions) {
      if (i.proximoRetorno) {
        const d = parseDate(i.proximoRetorno);
        if (d && d < today) {
          const days = Math.ceil((today.getTime() - d.getTime()) / 86_400_000);
          items.push({ id: `int-${i.id}`, type: "danger", message: `Retorno com ${i.cliente} atrasado há ${days}d`, route: "/agenda" });
        }
      }
    }

    // Leads without contact for > 5 days
    for (const l of leads) {
      if (l.status === "Perdido" || l.status === "Qualificado") continue;
      const lastInt = interactions
        .filter((i) => i.cliente.toLowerCase() === l.nome.toLowerCase())
        .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))[0];
      const daysSince = lastInt
        ? Math.floor((Date.now() - new Date(lastInt.criadoEm).getTime()) / 86_400_000)
        : (l.criadoEm ? Math.floor((Date.now() - new Date(l.criadoEm).getTime()) / 86_400_000) : 0);
      if (daysSince > 5) {
        items.push({ id: `lead-${l.id}`, type: "warning", message: `Lead "${l.nome}" sem contato há ${daysSince}d`, route: "/leads" });
      }
    }

    // Overdue tasks
    const todayStr = today.toISOString().split("T")[0];
    for (const t of tasks) {
      if (t.status === "Concluida") continue;
      if (t.prazo && t.prazo < todayStr) {
        items.push({ id: `task-${t.id}`, type: "warning", message: `Tarefa "${t.titulo}" vencida`, route: "/tarefas" });
      }
    }

    items.sort((a, b) => {
      const pri = { danger: 0, warning: 1, info: 2, success: 3 };
      return pri[a.type] - pri[b.type];
    });

    return items.slice(0, 20);
  }, [orders, interactions, leads, tasks]);

  const pendingTasksCount = useMemo(() => {
    return tasks.filter((t) => t.status !== "Concluida").length;
  }, [tasks]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable === true;
      if (isTyping) return;
      if (event.key === "/") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const searchResults = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return [];
    const leadMatches = leads
      .filter((x) => x.nome.toLowerCase().includes(q))
      .slice(0, 3)
      .map((x) => ({ label: `Lead: ${x.nome}`, route: "/leads" }));
    const oppMatches = opportunities
      .filter((x) => x.cliente.toLowerCase().includes(q) || x.titulo.toLowerCase().includes(q))
      .slice(0, 3)
      .map((x) => ({ label: `Pipeline: ${x.titulo}`, route: "/pipeline" }));
    const orderMatches = orders
      .filter((x) => x.cliente.toLowerCase().includes(q) || String(x.pedido).includes(q))
      .slice(0, 4)
      .map((x) => ({ label: `Pedido ${x.pedido}: ${x.cliente}`, route: "/pedidos" }));
    return [...leadMatches, ...oppMatches, ...orderMatches].slice(0, 8);
  }, [debouncedSearch, leads, opportunities, orders]);

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <h1>RealSynk Consignado</h1>
          <small>CRM Comercial</small>
        </div>

        <nav>
          {visibleItems.map((item) => {
            const active = location.pathname === item.route;
            return (
              <Link key={item.key} to={item.route} className={active ? "nav-item active" : "nav-item"} title={item.label}>
                <span className="nav-icon">{item.label.slice(0, 1)}</span>
                <span className="nav-label">{item.label}</span>
                {item.key === "agenda" && overdueCount > 0 && (
                  <span className="sidebar-badge pulse">{overdueCount}</span>
                )}
                {item.key === "tarefas" && pendingTasksCount > 0 && (
                  <span className="sidebar-badge pulse">{pendingTasksCount}</span>
                )}
              </Link>
            );
          })}
        </nav>
        <footer className="sidebar-footer">
          <span className="user-avatar">{(user?.name ?? "U").slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>{user?.name ?? "Usuario"}</strong>
            <small style={{ textTransform: "uppercase", letterSpacing: 0.5, fontSize: 10, color: cargo === "Adm" ? "var(--warning)" : cargo === "Gestora" ? "var(--primary)" : "var(--secondary)" }}>{cargo ?? ""}</small>
          </div>
        </footer>
      </aside>

      <main className="content">
        <header className="top">
          <strong>RealSynk Consignado</strong>
          <div className="top-search">
            <input
              ref={searchInputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Busca global: cliente, lead ou pedido"
            />
            {searchResults.length > 0 ? (
              <div className="search-results">
                {searchResults.map((item, idx) => (
                  <button
                    key={`${item.label}-${idx}`}
                    className="search-item"
                    onClick={() => {
                      setSearch("");
                      navigate(item.route);
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="top-right">
            <div style={{ position: "relative" }}>
              <button type="button" className={`notify-btn ${notifications.length > 0 ? "has-alert" : ""}`} onClick={() => setShowNotifs((v) => !v)} aria-label="Notificacoes">
                <span>🔔</span>
                {notifications.length > 0 ? <em>{notifications.length}</em> : null}
              </button>
              {showNotifs && (
                <div className="notif-panel">
                  <div className="notif-header">
                    <strong>Notificações ({notifications.length})</strong>
                    <button type="button" className="modal-close" onClick={() => setShowNotifs(false)} style={{ fontSize: 14 }}>✕</button>
                  </div>
                  <div className="notif-list">
                    {notifications.length === 0 ? (
                      <p className="notif-empty">Tudo em dia! Nenhuma pendência.</p>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n.id}
                          className={`notif-item notif-${n.type}`}
                          onClick={() => { setShowNotifs(false); navigate(n.route); }}
                        >
                          <span className="notif-dot" />
                          <span>{n.message}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <button type="button" onClick={toggleTheme}>
              {theme === "light" ? "Modo escuro" : "Modo claro"}
            </button>
            <small>{user?.name} <span style={{ fontSize: 10, color: cargo === "Adm" ? "var(--warning)" : cargo === "Gestora" ? "var(--primary)" : "var(--secondary)", fontWeight: 600 }}>({cargo})</span></small>
            {AUTH_ENABLED ? (
              <button type="button" onClick={logout}>
                Sair
              </button>
            ) : null}
          </div>
        </header>
        <div className="page">{children}</div>
      </main>
    </div>
  );
}
