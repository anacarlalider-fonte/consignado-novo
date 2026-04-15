import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { AUTH_ENABLED } from "../config/auth-flags";
import { apiPost, setAccessToken } from "../services/api";
import { useAudit } from "./audit-context";
import type { Cargo, Seller } from "./sellers-context";

type LoginResponse = {
  user: {
    id: string;
    name: string;
    email: string;
    tenantId: string;
    permissions: string[];
  };
  accessToken: string;
  refreshToken: string;
};

export type CrmUser = {
  id: string;
  name: string;
  email: string;
  tenantId: string;
  permissions: string[];
  cargo: Cargo;
  sellerName: string;
};

const GESTORA_PERMISSIONS = [
  "leads:read", "leads:create",
  "opportunities:read", "opportunities:create", "opportunities:update",
  "orders:read", "orders:update",
  "reports:read",
  "integrations:write",
  "admin:read", "admin:write",
  "goals:read", "goals:write",
];

const VENDEDORA_PERMISSIONS = [
  "leads:read", "leads:create",
  "opportunities:read", "opportunities:create", "opportunities:update",
  "orders:read", "orders:update",
  "goals:read",
];

const SELLERS_KEY = "crm-kato-sellers-v1";

function readSellersFromStorage(): Seller[] {
  try {
    const raw = localStorage.getItem(SELLERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

type AuthState = {
  user: CrmUser | null;
  isAuthenticated: boolean;
  isGestora: boolean;
  /** Somente cargo Adm (ex.: relatório de comissão). */
  isAdm: boolean;
  currentSellerName: string;
  cargo: Cargo | null;
  login: (email: string, password: string) => Promise<void>;
  loginAsSeller: (sellerName: string, pin: string) => boolean;
  loginLocal: () => void;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
};

const USER_KEY = "crm_kato_user";
const APP_VERSION_KEY = "crm_kato_version";
const CURRENT_VERSION = "2";
const AuthContext = createContext<AuthState | null>(null);

function defaultAutoUser(): CrmUser {
  return {
    id: "offline-admin",
    name: "Administrador",
    email: "admin@kato.com",
    tenantId: "default-tenant",
    permissions: GESTORA_PERMISSIONS,
    cargo: "Adm",
    sellerName: "Administrador",
  };
}

function parseStoredUser(raw: string): CrmUser | null {
  try {
    const parsed = JSON.parse(raw) as CrmUser;
    return {
      ...parsed,
      cargo: parsed.cargo || "Gestora",
      sellerName: parsed.sellerName || parsed.name,
    };
  } catch {
    return null;
  }
}

function migrateIfNeeded() {
  const v = localStorage.getItem(APP_VERSION_KEY);
  if (v !== CURRENT_VERSION) {
    if (AUTH_ENABLED) {
      localStorage.removeItem(USER_KEY);
    }
    localStorage.setItem(APP_VERSION_KEY, CURRENT_VERSION);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { logEvent } = useAudit();
  const [user, setUser] = useState<CrmUser | null>(() => {
    migrateIfNeeded();
    if (!AUTH_ENABLED) {
      const raw = localStorage.getItem(USER_KEY);
      const fromStore = raw ? parseStoredUser(raw) : null;
      const u = fromStore ?? defaultAutoUser();
      localStorage.setItem(USER_KEY, JSON.stringify(u));
      setAccessToken("offline-mode-token");
      return u;
    }
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    return parseStoredUser(raw);
  });

  async function login(email: string, password: string) {
    try {
      const data = await apiPost<LoginResponse>("/auth/login", { email, password });
      const crmUser: CrmUser = {
        ...data.user,
        cargo: "Gestora",
        sellerName: data.user.name,
      };
      setUser(crmUser);
      localStorage.setItem(USER_KEY, JSON.stringify(crmUser));
      setAccessToken(data.accessToken);
      logEvent(crmUser.name, "LOGIN", `Login realizado por ${crmUser.email}`);
    } catch {
      /* Modo local (sem VITE_AUTH_ENABLED): permite admin fixo só quando a API não existe. */
      if (
        !AUTH_ENABLED &&
        email.toLowerCase() === "admin@kato.com" &&
        password === "Admin@123"
      ) {
        const offlineUser: CrmUser = {
          id: "offline-admin",
          name: "Admin Local",
          email: "admin@kato.com",
          tenantId: "default-tenant",
          permissions: GESTORA_PERMISSIONS,
          cargo: "Gestora",
          sellerName: "Admin Local",
        };
        setUser(offlineUser);
        localStorage.setItem(USER_KEY, JSON.stringify(offlineUser));
        setAccessToken("offline-mode-token");
        logEvent(offlineUser.name, "LOGIN_OFFLINE", "Login em modo local sem backend");
        return;
      }
      throw new Error("Falha no login");
    }
  }

  function loginAsSeller(sellerName: string, pin: string): boolean {
    const sellers = readSellersFromStorage();
    const norm = sellerName.trim().toLowerCase();
    const seller = sellers.find((s) => s.name.toLowerCase() === norm && s.active);
    if (!seller) return false;

    if (seller.senha) {
      if (seller.senha !== pin) return false;
    }

    const cargo = seller.cargo || "Vendedora";
    const permissions = (cargo === "Gestora" || cargo === "Adm") ? GESTORA_PERMISSIONS : VENDEDORA_PERMISSIONS;
    const crmUser: CrmUser = {
      id: seller.id,
      name: seller.name,
      email: `${seller.name.toLowerCase().replace(/\s+/g, ".")}@kato.com`,
      tenantId: "default-tenant",
      permissions,
      cargo,
      sellerName: seller.name,
    };
    setUser(crmUser);
    localStorage.setItem(USER_KEY, JSON.stringify(crmUser));
    setAccessToken("offline-mode-token");
    logEvent(crmUser.name, "LOGIN_SELLER", `Login como ${cargo}: ${seller.name}`);
    return true;
  }

  function loginLocal() {
    const offlineUser: CrmUser = {
      id: "offline-admin",
      name: "Admin Local",
      email: "admin@kato.com",
      tenantId: "default-tenant",
      permissions: GESTORA_PERMISSIONS,
      cargo: "Adm",
      sellerName: "Admin Local",
    };
    setUser(offlineUser);
    localStorage.setItem(USER_KEY, JSON.stringify(offlineUser));
    setAccessToken("offline-mode-token");
    logEvent(offlineUser.name, "LOGIN_LOCAL_BUTTON", "Entrada manual em modo local");
  }

  function logout() {
    if (!AUTH_ENABLED) {
      return;
    }
    if (user) logEvent(user.name, "LOGOUT", "Usuario encerrou a sessao");
    setUser(null);
    localStorage.removeItem(USER_KEY);
    setAccessToken("");
  }

  function hasPermission(permission: string) {
    return !!user?.permissions.includes(permission);
  }

  const isGestora = user?.cargo === "Gestora" || user?.cargo === "Adm";
  const isAdm = user?.cargo === "Adm";
  const currentSellerName = user?.sellerName ?? "";
  const cargo = user?.cargo ?? null;

  const value = useMemo<AuthState>(
    () => ({
      user,
      isAuthenticated: !!user,
      isGestora,
      isAdm,
      currentSellerName,
      cargo,
      login,
      loginAsSeller,
      loginLocal,
      logout,
      hasPermission,
    }),
    [user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
