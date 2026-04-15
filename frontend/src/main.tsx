import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import "./styles.css";
import { CRMProvider } from "./state/crm-context";
import { AuthProvider } from "./state/auth-context";
import { ToastProvider } from "./state/toast-context";
import { AuditProvider } from "./state/audit-context";
import { ThemeProvider } from "./state/theme-context";
import { SellersProvider } from "./state/sellers-context";
import { GoalsProvider } from "./state/goals-context";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuditProvider>
        <AuthProvider>
          <ToastProvider>
            <SellersProvider>
              <CRMProvider>
                <GoalsProvider>
                  <BrowserRouter>
                    <App />
                  </BrowserRouter>
                </GoalsProvider>
              </CRMProvider>
            </SellersProvider>
          </ToastProvider>
        </AuthProvider>
      </AuditProvider>
    </ThemeProvider>
  </React.StrictMode>
);
