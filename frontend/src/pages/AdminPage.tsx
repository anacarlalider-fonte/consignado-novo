import { useState, useEffect, useRef } from "react";
import { useAuth } from "../state/auth-context";
import { useAudit } from "../state/audit-context";
import { useCRM } from "../state/crm-context";
import { useSellers } from "../state/sellers-context";
import { useToast } from "../state/toast-context";
import type { Cargo } from "../state/sellers-context";

const COMMISSIONS_KEY = "crm-kato-commissions";
const LAST_BACKUP_KEY = "crm-kato-last-backup";

function loadCommissions(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(COMMISSIONS_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function AdminPage() {
  const { user } = useAuth();
  const { events } = useAudit();
  const { exportAllData, importAllData } = useCRM();
  const { sellers, addSeller, renameSeller, updateSeller, toggleSeller, removeSeller } = useSellers();
  const { pushToast } = useToast();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCargo, setNewCargo] = useState<Cargo>("Vendedora");
  const [newSenha, setNewSenha] = useState("");
  const [showNewSenha, setShowNewSenha] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingCargo, setEditingCargo] = useState<Cargo>("Vendedora");
  const [editingSenha, setEditingSenha] = useState("");
  const [showSenhaFor, setShowSenhaFor] = useState<string | null>(null);
  const [lastBackup, setLastBackup] = useState<string | null>(
    localStorage.getItem(LAST_BACKUP_KEY)
  );
  const [commissions, setCommissions] = useState<Record<string, number>>(loadCommissions);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem(COMMISSIONS_KEY, JSON.stringify(commissions));
  }, [commissions]);

  function handleExport() {
    const json = exportAllData();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `backup_realsynk_crm_${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
    const now = new Date().toLocaleString("pt-BR");
    localStorage.setItem(LAST_BACKUP_KEY, now);
    setLastBackup(now);
    pushToast("success", "Backup exportado com sucesso.");
  }

  function handleImportFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      const mode = window.confirm(
        "Substituir todos os dados ou mesclar?\n\nOK = Substituir tudo\nCancelar = Mesclar (adicionar novos)"
      )
        ? "replace" as const
        : "merge" as const;
      try {
        const count = importAllData(content, mode);
        pushToast(
          "success",
          mode === "replace"
            ? `Dados restaurados. ${count} registros importados.`
            : `Merge concluído. ${count} registros adicionados.`
        );
      } catch {
        pushToast("error", "Arquivo inválido. Verifique o formato JSON.");
      }
    };
    reader.readAsText(file);
  }

  function handleCommissionChange(sellerName: string, value: string) {
    const num = Math.max(0, Math.min(100, parseFloat(value) || 0));
    setCommissions((prev) => ({ ...prev, [sellerName]: num }));
  }

  function handleAdd() {
    const trimmed = newName.trim();
    if (trimmed.length < 2) {
      pushToast("error", "Informe pelo menos 2 caracteres para o nome.");
      return;
    }
    const duplicate = sellers.find((s) => s.name.toLowerCase() === trimmed.toLowerCase());
    if (duplicate) {
      pushToast("error", "Já existe um usuário com esse nome.");
      return;
    }
    addSeller(trimmed, newCargo, newSenha.trim() || undefined);
    pushToast("success", `Usuário "${trimmed}" criado como ${newCargo}.`);
    setNewName("");
    setNewCargo("Vendedora");
    setNewSenha("");
    setShowNewSenha(false);
    setShowCreateForm(false);
  }

  function startEdit(id: string, currentName: string, currentCargo: Cargo, currentSenha?: string) {
    setEditingId(id);
    setEditingName(currentName);
    setEditingCargo(currentCargo);
    setEditingSenha(currentSenha ?? "");
  }

  function confirmEdit(id: string) {
    const trimmed = editingName.trim();
    if (trimmed.length < 2) {
      pushToast("error", "Nome muito curto.");
      return;
    }
    updateSeller(id, { name: trimmed, cargo: editingCargo, senha: editingSenha || undefined });
    setEditingId(null);
    setEditingName("");
    pushToast("success", "Dados atualizados.");
  }

  function handleRemove(id: string, name: string) {
    removeSeller(id);
    pushToast("info", `${name} removida do time.`);
  }

  return (
    <div className="stack">
      <section>
        <h2>Administração</h2>
        <p>Controle de acesso, gestão do time, cargos e diagnóstico da sessão.</p>
      </section>

      {/* ── Criar Novo Usuário ── */}
      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h3>Criar Novo Usuário</h3>
            <p style={{ marginTop: 4, color: "var(--muted)", fontSize: 14 }}>
              Cadastre vendedoras e gestoras para acessar o CRM com login individual.
            </p>
          </div>
          <button
            type="button"
            className="cta-lead ripple-btn"
            onClick={() => setShowCreateForm((v) => !v)}
          >
            {showCreateForm ? "Fechar" : "+ Novo Usuário"}
          </button>
        </div>

        {showCreateForm && (
          <div className="create-user-form">
            <div className="create-user-grid">
              <label className="create-user-field">
                <span>Nome completo *</span>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Maria Silva"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                />
              </label>
              <label className="create-user-field">
                <span>Cargo / Perfil *</span>
                <select
                  value={newCargo}
                  onChange={(e) => setNewCargo(e.target.value as Cargo)}
                >
                  <option value="Vendedora">Vendedora</option>
                  <option value="Gestora">Gestora</option>
                  <option value="Adm">Administrador(a)</option>
                </select>
              </label>
              <label className="create-user-field">
                <span>Senha de acesso</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    type={showNewSenha ? "text" : "password"}
                    value={newSenha}
                    onChange={(e) => setNewSenha(e.target.value)}
                    placeholder="Opcional — deixe vazio para sem senha"
                    style={{ flex: 1 }}
                    onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                  />
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setShowNewSenha((v) => !v)}
                    style={{ fontSize: 12, whiteSpace: "nowrap" }}
                  >
                    {showNewSenha ? "Ocultar" : "Mostrar"}
                  </button>
                </div>
              </label>
            </div>
            <p className="create-user-hint">
              {newCargo === "Adm"
                ? "Administrador(a) terá acesso total: todos os dados, relatórios, configurações e metas."
                : newCargo === "Gestora"
                ? "Gestora terá acesso total: todos os dados, relatórios, administração e metas."
                : "Vendedora verá apenas seus próprios leads, oportunidades e metas."}
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button type="button" className="cta-lead ripple-btn" onClick={handleAdd}>
                Criar Usuário
              </button>
              <button type="button" className="btn-ghost" onClick={() => { setShowCreateForm(false); setNewName(""); setNewSenha(""); }}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ── Time Comercial ── */}
      <section>
        <h3>Usuários Cadastrados</h3>
        <p style={{ marginTop: 4, marginBottom: 12, color: "var(--muted)", fontSize: 14 }}>
          {sellers.length} usuário{sellers.length !== 1 ? "s" : ""} cadastrado{sellers.length !== 1 ? "s" : ""}. Clique em "Editar" para alterar nome, cargo ou senha.
        </p>

        <div className="team-list">
          {sellers.map((seller) => {
            const initials = seller.name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
            const avatarBg = !seller.active ? "var(--muted)"
              : seller.cargo === "Adm" ? "var(--warning)"
              : seller.cargo === "Gestora" ? "var(--primary)"
              : "var(--secondary)";

            return (
            <div key={seller.id} className={`team-row ${!seller.active ? "team-row-inactive" : ""}`}>
              <span
                className="team-avatar"
                style={{ background: avatarBg }}
              >
                {initials}
              </span>

              {editingId === seller.id ? (
                <div className="team-edit-wrap">
                  <input
                    className="team-edit-input"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") confirmEdit(seller.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    autoFocus
                    placeholder="Nome"
                  />
                  <select
                    className="team-edit-input"
                    value={editingCargo}
                    onChange={(e) => setEditingCargo(e.target.value as Cargo)}
                  >
                    <option value="Vendedora">Vendedora</option>
                    <option value="Gestora">Gestora</option>
                    <option value="Adm">Administrador(a)</option>
                  </select>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input
                      className="team-edit-input"
                      type={showSenhaFor === seller.id ? "text" : "password"}
                      value={editingSenha}
                      onChange={(e) => setEditingSenha(e.target.value)}
                      placeholder="Nova senha (vazio = sem senha)"
                      style={{ width: 180 }}
                    />
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => setShowSenhaFor(showSenhaFor === seller.id ? null : seller.id)}
                      style={{ fontSize: 11, padding: "4px 8px", whiteSpace: "nowrap" }}
                    >
                      {showSenhaFor === seller.id ? "Ocultar" : "Mostrar"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="team-info">
                  <span className="team-name">{seller.name}</span>
                  <div className="team-meta">
                    <span className={`team-cargo-badge ${seller.cargo === "Adm" ? "cargo-adm" : seller.cargo === "Gestora" ? "cargo-gestora" : "cargo-vendedora"}`}>
                      {seller.cargo || "Vendedora"}
                    </span>
                    <span className={`team-senha-badge ${seller.senha ? "has-senha" : "no-senha"}`}>
                      {seller.senha ? "Com senha" : "Sem senha"}
                    </span>
                  </div>
                </div>
              )}

              <span className={`team-status-badge ${seller.active ? "active" : "inactive"}`}>
                {seller.active ? "Ativa" : "Inativa"}
              </span>

              <div className="team-actions">
                {editingId === seller.id ? (
                  <>
                    <button type="button" className="team-action-save" onClick={() => confirmEdit(seller.id)}>
                      Salvar
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => setEditingId(null)}>
                      Cancelar
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className="btn-ghost" onClick={() => startEdit(seller.id, seller.name, seller.cargo || "Vendedora", seller.senha)}>
                      Editar
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => toggleSeller(seller.id)}
                      title={seller.active ? "Ocultar do dashboard" : "Reativar no dashboard"}
                    >
                      {seller.active ? "Desativar" : "Reativar"}
                    </button>
                    <button
                      type="button"
                      className="btn-ghost btn-danger"
                      onClick={() => handleRemove(seller.id, seller.name)}
                      title="Remover permanentemente"
                    >
                      Remover
                    </button>
                  </>
                )}
              </div>
            </div>
            );
          })}
        </div>
      </section>

      {/* ── Legenda de Permissões ── */}
      <section>
        <h3>Permissões por Cargo</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginTop: 12 }}>
          <article style={{ background: "var(--card)", borderRadius: 12, padding: 16, border: "1px solid var(--border)" }}>
            <h4 style={{ margin: "0 0 8px", color: "var(--secondary)" }}>Vendedora</h4>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13, color: "var(--muted)", lineHeight: 1.8 }}>
              <li>Vê apenas <strong>seus próprios</strong> leads e oportunidades</li>
              <li>Vê seus pedidos e follow-ups</li>
              <li>Vê suas próprias metas</li>
              <li>Clientes: base completa (da empresa)</li>
              <li>Sem acesso à Administração</li>
            </ul>
          </article>
          <article style={{ background: "var(--card)", borderRadius: 12, padding: 16, border: "1px solid var(--border)" }}>
            <h4 style={{ margin: "0 0 8px", color: "var(--primary)" }}>Gestora</h4>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13, color: "var(--muted)", lineHeight: 1.8 }}>
              <li>Vê dados de <strong>todas</strong> as vendedoras</li>
              <li>Acesso a Relatórios completos</li>
              <li>Acesso à Administração</li>
              <li>Edita metas do time e individuais</li>
              <li>Exporta/importa backups</li>
            </ul>
          </article>
          <article style={{ background: "var(--card)", borderRadius: 12, padding: 16, border: "1px solid var(--border)" }}>
            <h4 style={{ margin: "0 0 8px", color: "var(--warning)" }}>Administrador(a)</h4>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13, color: "var(--muted)", lineHeight: 1.8 }}>
              <li>Acesso <strong>total</strong> ao sistema</li>
              <li>Todos os dados e relatórios</li>
              <li>Gerencia usuários e cargos</li>
              <li>Configurações e backups</li>
              <li>Mesmo nível de acesso da Gestora</li>
            </ul>
          </article>
        </div>
      </section>

      {/* ── Backup Export/Import ── */}
      <section>
        <h3>Backup e Restauração</h3>
        <p style={{ marginTop: 4, marginBottom: 12, color: "var(--muted)", fontSize: 14 }}>
          Exporte todos os dados do CRM como JSON ou restaure a partir de um backup anterior.
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" className="cta-lead ripple-btn" onClick={handleExport}>
            ↓ Exportar Backup
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => fileInputRef.current?.click()}
          >
            ↑ Importar Backup
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImportFile(file);
              e.target.value = "";
            }}
          />
        </div>

        {lastBackup && (
          <p style={{ marginTop: 10, fontSize: 13, color: "var(--muted)" }}>
            Último backup: <strong>{lastBackup}</strong>
          </p>
        )}
      </section>

      {/* ── Comissões ── */}
      <section>
        <h3>Comissões por Vendedora</h3>
        <p style={{ marginTop: 4, marginBottom: 12, color: "var(--muted)", fontSize: 14 }}>
          Defina a porcentagem de comissão de cada vendedora. Os valores são salvos automaticamente.
        </p>

        {sellers.filter((s) => s.active).length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 13 }}>Nenhuma vendedora ativa.</p>
        ) : (
          <div className="team-list">
            {sellers
              .filter((s) => s.active)
              .map((seller) => (
                <div key={seller.id} className="team-row" style={{ alignItems: "center" }}>
                  <span
                    className="team-avatar"
                    style={{
                      background: "var(--primary)",
                    }}
                  >
                    {seller.name
                      .split(" ")
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((p) => p[0]?.toUpperCase())
                      .join("")}
                  </span>
                  <span className="team-name" style={{ flex: 1 }}>{seller.name}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={commissions[seller.name] ?? 5}
                      onChange={(e) => handleCommissionChange(seller.name, e.target.value)}
                      style={{ width: 70, textAlign: "right" }}
                    />
                    <span style={{ fontSize: 14, color: "var(--muted)" }}>%</span>
                  </div>
                </div>
              ))}
          </div>
        )}
      </section>

      <section>
        <h3>Usuário logado</h3>
        <p>
          <strong>Nome:</strong> {user?.name}
        </p>
        <p>
          <strong>Cargo:</strong> {user?.cargo ?? "—"}
        </p>
        <p>
          <strong>Email:</strong> {user?.email}
        </p>
      </section>

      <section>
        <h3>Timeline de auditoria</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Data/Hora</th>
              <th>Usuario</th>
              <th>Acao</th>
              <th>Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {events.slice(0, 25).map((ev) => (
              <tr key={ev.id}>
                <td>{new Date(ev.at).toLocaleString("pt-BR")}</td>
                <td>{ev.user}</td>
                <td>{ev.action}</td>
                <td>{ev.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
