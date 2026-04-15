import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../state/auth-context";
import { useToast } from "../state/toast-context";

const DATA_KEY = "crm-kato-front-v1";
const SELLERS_KEY = "crm-kato-sellers-v1";
const GOALS_KEY = "crm-kato-goals-v1";

export function LoginPage() {
  const { loginAsSeller, loginLocal } = useAuth();
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSenha, setShowSenha] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleExportBackup() {
    const data: Record<string, unknown> = {};
    for (const key of [DATA_KEY, SELLERS_KEY, GOALS_KEY]) {
      const raw = localStorage.getItem(key);
      if (raw) {
        try { data[key] = JSON.parse(raw); } catch { data[key] = raw; }
      }
    }
    if (Object.keys(data).length === 0) {
      pushToast("error", "Nenhum dado encontrado neste navegador.");
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup_realsynk_crm_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast("success", "Backup exportado com sucesso!");
  }

  function handleImportBackup(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        let restored = 0;
        for (const key of [DATA_KEY, SELLERS_KEY, GOALS_KEY]) {
          if (data[key]) {
            localStorage.setItem(key, typeof data[key] === "string" ? data[key] : JSON.stringify(data[key]));
            restored++;
          }
        }
        if (restored > 0) {
          pushToast("success", `Backup restaurado! Recarregando...`);
          setTimeout(() => window.location.reload(), 800);
        } else {
          pushToast("error", "Arquivo não contém dados válidos do CRM.");
        }
      } catch {
        pushToast("error", "Arquivo inválido. Use o JSON exportado pelo CRM.");
      }
    };
    reader.readAsText(file);
  }

  function handleLogin() {
    setError("");
    const trimmed = nome.trim();
    if (!trimmed) {
      setError("Informe seu nome.");
      return;
    }
    setLoading(true);
    const success = loginAsSeller(trimmed, senha);
    if (success) {
      pushToast("success", `Bem-vinda, ${trimmed}!`);
      navigate("/dashboard", { replace: true });
    } else {
      setError("Nome não encontrado ou senha incorreta.");
    }
    setLoading(false);
  }

  function handleLocalEntry() {
    loginLocal();
    pushToast("success", "Entrada como administradora local.");
    navigate("/dashboard", { replace: true });
  }

  return (
    <div className="login-page">
      <div className="login-bg-accent" />

      <section className="login-card">
        <div className="login-logo-wrap">
          <img src="/logo-kato.png" alt="RealSynk Consignado" className="login-logo" />
        </div>

        <div className="login-brand-text">
          <h1>RealSynk Consignado</h1>
          <span>CRM Comercial</span>
        </div>

        <div className="login-separator" />

        <form
          className="login-form"
          onSubmit={(e) => { e.preventDefault(); handleLogin(); }}
        >
          <label className="login-field">
            <span>Nome</span>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Digite seu nome completo"
              autoFocus
              autoComplete="name"
            />
          </label>

          <label className="login-field">
            <span>Senha</span>
            <div className="login-field-password">
              <input
                type={showSenha ? "text" : "password"}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Sua senha de acesso"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="login-eye-btn"
                onClick={() => setShowSenha((v) => !v)}
                tabIndex={-1}
                aria-label={showSenha ? "Ocultar senha" : "Mostrar senha"}
              >
                {showSenha ? "🙈" : "👁"}
              </button>
            </div>
          </label>

          {error && <p className="login-error">{error}</p>}

          <button type="submit" className="login-submit" disabled={loading}>
            {loading ? "Entrando..." : "Acessar"}
          </button>
        </form>

        <div className="login-footer-divider">
          <span>ou</span>
        </div>

        <button
          type="button"
          className="login-admin-link"
          onClick={handleLocalEntry}
          disabled={loading}
        >
          Entrar como Administradora
        </button>

        <div className="login-backup-section">
          <button type="button" className="login-backup-btn" onClick={handleExportBackup}>
            Exportar Backup
          </button>
          <button type="button" className="login-backup-btn" onClick={() => fileRef.current?.click()}>
            Importar Backup
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImportBackup(f);
              e.target.value = "";
            }}
          />
        </div>
      </section>
    </div>
  );
}
