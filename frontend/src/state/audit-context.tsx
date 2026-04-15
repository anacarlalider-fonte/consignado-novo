import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type AuditEvent = {
  id: number;
  at: string;
  user: string;
  action: string;
  details: string;
};

type AuditState = {
  events: AuditEvent[];
  logEvent: (user: string, action: string, details: string) => void;
};

const STORAGE_KEY = "crm_kato_audit_events";
const AuditContext = createContext<AuditState | null>(null);

function loadInitial(): AuditEvent[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as AuditEvent[];
  } catch {
    return [];
  }
}

export function AuditProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<AuditEvent[]>(loadInitial);

  function logEvent(user: string, action: string, details: string) {
    const next: AuditEvent[] = [
      { id: Date.now(), at: new Date().toISOString(), user, action, details },
      ...events
    ].slice(0, 300);
    setEvents(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  const value = useMemo(() => ({ events, logEvent }), [events]);
  return <AuditContext.Provider value={value}>{children}</AuditContext.Provider>;
}

export function useAudit() {
  const ctx = useContext(AuditContext);
  if (!ctx) throw new Error("useAudit deve ser usado dentro de AuditProvider");
  return ctx;
}
