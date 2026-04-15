import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type ToastKind = "success" | "error" | "info";
type ToastItem = { id: number; kind: ToastKind; message: string };

type ToastState = {
  pushToast: (kind: ToastKind, message: string) => void;
};

const ToastContext = createContext<ToastState | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  function pushToast(kind: ToastKind, message: string) {
    const id = Date.now();
    setItems((prev) => [...prev, { id, kind, message }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }, 2800);
  }

  const value = useMemo(() => ({ pushToast }), []);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-wrap">
        {items.map((item) => (
          <div key={item.id} className={`toast ${item.kind}`}>
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast deve ser usado dentro de ToastProvider");
  return ctx;
}
