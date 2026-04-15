import { useMemo, useState } from "react";
import { useCRM } from "../state/crm-context";
import { useAuth } from "../state/auth-context";
import type { Task, NewTask } from "../data/mock-data";

const EMPTY_FORM: NewTask = {
  titulo: "",
  descricao: "",
  responsavel: "",
  prazo: "",
  prioridade: "Media",
  status: "Pendente",
};

const STATUS_OPTIONS: Task["status"][] = ["Pendente", "Em andamento", "Concluida"];
const PRIORIDADE_OPTIONS: Task["prioridade"][] = ["Alta", "Media", "Baixa"];

const PRIORIDADE_COLOR: Record<Task["prioridade"], string> = {
  Alta: "task-badge-alta",
  Media: "task-badge-media",
  Baixa: "task-badge-baixa",
};

function formatDateBR(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function parseDateBR(br: string): string {
  const parts = br.replace(/\D/g, "");
  if (parts.length < 8) return "";
  return `${parts.slice(4, 8)}-${parts.slice(2, 4)}-${parts.slice(0, 2)}`;
}

function isOverdue(prazo: string, status: Task["status"]): boolean {
  if (!prazo || status === "Concluida") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(prazo + "T00:00:00");
  return deadline < today;
}

export function TasksPage() {
  const { tasks: rawTasks, addTask, updateTask, removeTask } = useCRM();
  const { isGestora, currentSellerName } = useAuth();

  const tasks = useMemo(() => {
    if (isGestora) return rawTasks;
    return rawTasks.filter((t) => t.responsavel === currentSellerName || !t.responsavel);
  }, [rawTasks, isGestora, currentSellerName]);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<NewTask>({ ...EMPTY_FORM });
  const [prazoInput, setPrazoInput] = useState("");

  const [filterStatus, setFilterStatus] = useState<Task["status"] | "Todas">("Todas");
  const [filterResponsavel, setFilterResponsavel] = useState("");
  const [search, setSearch] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Task>>({});
  const [editPrazoInput, setEditPrazoInput] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);

  const responsaveis = useMemo(
    () => [...new Set(tasks.map((t) => t.responsavel).filter(Boolean))].sort(),
    [tasks],
  );

  const filtered = useMemo(() => {
    let list = [...tasks];
    if (filterStatus !== "Todas") list = list.filter((t) => t.status === filterStatus);
    if (filterResponsavel) list = list.filter((t) => t.responsavel === filterResponsavel);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((t) => t.titulo.toLowerCase().includes(q));
    }
    return list;
  }, [tasks, filterStatus, filterResponsavel, search]);

  const counts = useMemo(() => {
    const c = { total: tasks.length, pendente: 0, andamento: 0, concluida: 0, overdue: 0 };
    for (const t of tasks) {
      if (t.status === "Pendente") c.pendente++;
      else if (t.status === "Em andamento") c.andamento++;
      else c.concluida++;
      if (isOverdue(t.prazo, t.status)) c.overdue++;
    }
    return c;
  }, [tasks]);

  /* ── Create ─────────────────────────────────────────── */

  function handleCreate() {
    if (!form.titulo.trim()) return;
    const isoDate = parseDateBR(prazoInput);
    addTask({ ...form, titulo: form.titulo.trim(), prazo: isoDate });
    setForm({ ...EMPTY_FORM });
    setPrazoInput("");
    setFormOpen(false);
  }

  /* ── Inline edit ────────────────────────────────────── */

  function startEdit(task: Task) {
    setEditingId(task.id);
    setEditForm({ titulo: task.titulo, descricao: task.descricao, responsavel: task.responsavel, prioridade: task.prioridade, prazo: task.prazo, status: task.status });
    setEditPrazoInput(formatDateBR(task.prazo));
  }

  function saveEdit(id: string) {
    const isoDate = parseDateBR(editPrazoInput);
    updateTask(id, { ...editForm, prazo: isoDate || editForm.prazo });
    setEditingId(null);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  /* ── Delete ─────────────────────────────────────────── */

  function confirmDelete() {
    if (deleteTarget) {
      removeTask(deleteTarget.id);
      setDeleteTarget(null);
    }
  }

  return (
    <div className="stack">
      {/* Header + stats */}
      <section className="task-header">
        <div className="task-header-top">
          <div>
            <h2>Tarefas</h2>
            <p className="task-subtitle">
              {counts.total} tarefas &middot; {counts.pendente} pendentes &middot; {counts.andamento} em andamento &middot; {counts.concluida} concluídas
              {counts.overdue > 0 && <span className="task-overdue-count"> &middot; {counts.overdue} atrasada{counts.overdue > 1 ? "s" : ""}</span>}
            </p>
          </div>
          <button className="ripple-btn cta-lead" onClick={() => setFormOpen((v) => !v)}>
            {formOpen ? "Fechar" : "+ Nova Tarefa"}
          </button>
        </div>
      </section>

      {/* Collapsible create form */}
      {formOpen && (
        <section className="task-form-section">
          <h3>Nova Tarefa</h3>
          <div className="task-form-grid">
            <label className="task-field">
              <span>Título *</span>
              <input
                value={form.titulo}
                onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                placeholder="Ex: Recontatar pedidos críticos"
              />
            </label>
            <label className="task-field">
              <span>Responsável</span>
              <input
                value={form.responsavel}
                onChange={(e) => setForm((f) => ({ ...f, responsavel: e.target.value }))}
                placeholder="Nome do responsável"
              />
            </label>
            <label className="task-field">
              <span>Prazo (dd/mm/aaaa)</span>
              <input
                value={prazoInput}
                onChange={(e) => setPrazoInput(e.target.value)}
                placeholder="31/12/2026"
                maxLength={10}
              />
            </label>
            <label className="task-field">
              <span>Prioridade</span>
              <select
                value={form.prioridade}
                onChange={(e) => setForm((f) => ({ ...f, prioridade: e.target.value as Task["prioridade"] }))}
              >
                {PRIORIDADE_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label className="task-field task-field-wide">
              <span>Descrição</span>
              <textarea
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                rows={3}
                placeholder="Detalhes da tarefa..."
              />
            </label>
          </div>
          <div className="task-form-actions">
            <button className="ripple-btn cta-lead" onClick={handleCreate}>Criar Tarefa</button>
            <button className="btn-ghost" onClick={() => { setFormOpen(false); setForm({ ...EMPTY_FORM }); setPrazoInput(""); }}>Cancelar</button>
          </div>
        </section>
      )}

      {/* Filters */}
      <section className="filters-row">
        <input
          className="task-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por título..."
        />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as Task["status"] | "Todas")}>
          <option value="Todas">Todas</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterResponsavel} onChange={(e) => setFilterResponsavel(e.target.value)}>
          <option value="">Todos responsáveis</option>
          {responsaveis.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </section>

      {/* Task list */}
      <section className="task-list">
        {filtered.length === 0 && (
          <p className="task-empty">Nenhuma tarefa encontrada.</p>
        )}

        {filtered.map((task) => {
          const overdue = isOverdue(task.prazo, task.status);
          const editing = editingId === task.id;

          return (
            <div
              key={task.id}
              className={`task-card ${overdue ? "task-card-overdue" : ""} ${task.status === "Concluida" ? "task-card-done" : ""}`}
            >
              {editing ? (
                /* ── Inline edit mode ── */
                <div className="task-edit-form">
                  <div className="task-form-grid">
                    <label className="task-field">
                      <span>Título</span>
                      <input
                        value={editForm.titulo ?? ""}
                        onChange={(e) => setEditForm((f) => ({ ...f, titulo: e.target.value }))}
                      />
                    </label>
                    <label className="task-field">
                      <span>Responsável</span>
                      <input
                        value={editForm.responsavel ?? ""}
                        onChange={(e) => setEditForm((f) => ({ ...f, responsavel: e.target.value }))}
                      />
                    </label>
                    <label className="task-field">
                      <span>Prazo (dd/mm/aaaa)</span>
                      <input
                        value={editPrazoInput}
                        onChange={(e) => setEditPrazoInput(e.target.value)}
                        maxLength={10}
                      />
                    </label>
                    <label className="task-field">
                      <span>Prioridade</span>
                      <select
                        value={editForm.prioridade ?? "Media"}
                        onChange={(e) => setEditForm((f) => ({ ...f, prioridade: e.target.value as Task["prioridade"] }))}
                      >
                        {PRIORIDADE_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </label>
                    <label className="task-field">
                      <span>Status</span>
                      <select
                        value={editForm.status ?? "Pendente"}
                        onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value as Task["status"] }))}
                      >
                        {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </label>
                    <label className="task-field task-field-wide">
                      <span>Descrição</span>
                      <textarea
                        value={editForm.descricao ?? ""}
                        onChange={(e) => setEditForm((f) => ({ ...f, descricao: e.target.value }))}
                        rows={3}
                      />
                    </label>
                  </div>
                  <div className="task-form-actions">
                    <button className="ripple-btn cta-lead" onClick={() => saveEdit(task.id)}>Salvar</button>
                    <button className="btn-ghost" onClick={cancelEdit}>Cancelar</button>
                  </div>
                </div>
              ) : (
                /* ── Display mode ── */
                <>
                  <div className="task-card-header">
                    <h4 className="task-card-title">{task.titulo}</h4>
                    <span className={`task-badge ${PRIORIDADE_COLOR[task.prioridade]}`}>
                      {task.prioridade}
                    </span>
                  </div>

                  {task.descricao && (
                    <p className="task-card-desc">{task.descricao}</p>
                  )}

                  <div className="task-card-meta">
                    <span>👤 {task.responsavel || "Sem responsável"}</span>
                    <span>📅 {task.prazo ? formatDateBR(task.prazo) : "Sem prazo"}</span>
                    {overdue && <span className="task-overdue-label">Atrasada</span>}
                  </div>

                  <div className="task-card-footer">
                    <select
                      className="task-status-select"
                      value={task.status}
                      onChange={(e) => updateTask(task.id, { status: e.target.value as Task["status"] })}
                    >
                      {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>

                    <div className="task-card-actions">
                      <button className="btn-ghost" onClick={() => startEdit(task)}>Editar</button>
                      <button className="btn-danger" onClick={() => setDeleteTarget(task)}>Excluir</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </section>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="modal-backdrop" onClick={() => setDeleteTarget(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>Excluir tarefa</h3>
            <p>Deseja realmente excluir <strong>{deleteTarget.titulo}</strong>?</p>
            <div className="task-form-actions">
              <button className="btn-danger" onClick={confirmDelete}>Excluir</button>
              <button className="btn-ghost" onClick={() => setDeleteTarget(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
