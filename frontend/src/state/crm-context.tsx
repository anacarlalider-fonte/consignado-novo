import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  leadsMock,
  opportunitiesMock,
  ordersMock,
  mergeClientWithImport,
  normalizeCpf,
  type Client,
  type Interaction,
  type Lead,
  type NewLead,
  type NewClient,
  type NewInteraction,
  type NewTask,
  type Opportunity,
  type Order,
  type Task
} from "../data/mock-data";
import { isDeprecatedSellerName } from "../constants/deprecated-sellers";
import { apiGet, apiPatch, apiPost, getAccessToken, onAuthChanged } from "../services/api";
import { useAudit } from "./audit-context";

const CRM_DEPRECATED_VENDEDOR = "Nao definido";

type NewOpportunity = Omit<Opportunity, "id" | "criadoEm">;

type CRMContextValue = {
  leads: Lead[];
  opportunities: Opportunity[];
  orders: Order[];
  clients: Client[];
  interactions: Interaction[];
  tasks: Task[];
  isApiMode: boolean;
  isLoading: boolean;
  addLead: (payload: NewLead) => Promise<void>;
  /** Importação em lote; ignora CPF já existente em lead (11 dígitos). */
  addLeadsBatch: (payloads: NewLead[]) => Promise<number>;
  updateLead: (id: string, patch: Partial<Lead>) => void;
  addOpportunity: (payload: NewOpportunity) => Promise<string>;
  updateOpportunity: (id: string, patch: Partial<Omit<Opportunity, "id">>) => Promise<void>;
  removeOpportunity: (id: string) => Promise<void>;
  addClient: (payload: NewClient) => Promise<string>;
  updateClient: (id: string, patch: Partial<Client>) => void;
  addClientsBatch: (payloads: NewClient[]) => Promise<number>;
  /** Insere novos ou atualiza existentes pelo CPF (mescla campos). */
  upsertClientsBatch: (payloads: NewClient[]) => Promise<{ added: number; merged: number }>;
  removeClient: (id: string) => Promise<void>;
  updateOpportunityStage: (id: string, etapa: Opportunity["etapa"]) => Promise<void>;
  updateOrder: (pedido: number, patch: Partial<Order>) => Promise<void>;
  addInteraction: (payload: NewInteraction) => Promise<void>;
  removeInteraction: (id: string) => void;
  updateInteraction: (id: string, patch: Partial<Interaction>) => void;
  addTask: (payload: NewTask) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  removeTask: (id: string) => void;
  exportAllData: () => string;
  importAllData: (json: string, mode: "replace" | "merge") => number;
};

const STORAGE_KEY = "crm-kato-front-v1";

/** Migração única: esvaziar clientes herdados do CRM antigo (RealSynk). */
const CLIENTS_BASE_RESET_FLAG = "realsynk_clientes_base_reset_v1";

/** Migração única: remover leads demo (L-001…L-004) do seed Kato / CRM antigo. */
const LEADS_KATO_MOCK_REMOVED_FLAG = "realsynk_leads_kato_mock_removed_v1";
const LEGACY_DEMO_LEAD_IDS = new Set(["L-001", "L-002", "L-003", "L-004"]);

const CRMContext = createContext<CRMContextValue | null>(null);

type Persisted = {
  leads: Lead[];
  opportunities: Opportunity[];
  orders: Order[];
  clients?: Client[];
  interactions?: Interaction[];
  tasks?: Task[];
};

type LoadedCrm = Persisted & { clients: Client[]; interactions: Interaction[]; tasks: Task[] };

function migrateCrmDeprecatedVendedores(data: LoadedCrm): { result: LoadedCrm; changed: boolean } {
  const fix = (name: string) => (isDeprecatedSellerName(name) ? CRM_DEPRECATED_VENDEDOR : name);
  let changed = false;
  const leads = data.leads.map((l) => {
    const n = fix(l.responsavel);
    if (n !== l.responsavel) changed = true;
    return { ...l, responsavel: n };
  });
  const opportunities = data.opportunities.map((o) => {
    const n = fix(o.vendedor);
    if (n !== o.vendedor) changed = true;
    return { ...o, vendedor: n };
  });
  const orders = data.orders.map((o) => {
    const n = fix(o.vendedor);
    if (n !== o.vendedor) changed = true;
    return { ...o, vendedor: n };
  });
  const interactions = data.interactions.map((i) => {
    const n = fix(i.vendedor);
    if (n !== i.vendedor) changed = true;
    return { ...i, vendedor: n };
  });
  const tasks = data.tasks.map((t) => {
    const n = fix(t.responsavel);
    if (n !== t.responsavel) changed = true;
    return { ...t, responsavel: n };
  });
  return {
    result: { ...data, leads, opportunities, orders, interactions, tasks },
    changed,
  };
}

/** Evita crash se localStorage tiver cliente incompleto ou corrompido. */
function sanitizeClient(c: unknown): Client | null {
  if (!c || typeof c !== "object") return null;
  const o = c as Record<string, unknown>;
  const nome = typeof o.nome === "string" ? o.nome.trim() : "";
  if (nome.length < 1) return null;
  const str = (k: string) => (typeof o[k] === "string" ? (o[k] as string) : "");
  const id = typeof o.id === "string" && o.id ? o.id : `C-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const criadoEm = typeof o.criadoEm === "string" && o.criadoEm ? o.criadoEm : new Date().toISOString();
  return {
    id,
    nome: nome.slice(0, 150),
    telefone: str("telefone"),
    ...(typeof o.telefone2 === "string" ? { telefone2: o.telefone2 } : {}),
    ...(typeof o.telefone3 === "string" ? { telefone3: o.telefone3 } : {}),
    email: str("email"),
    endereco: str("endereco"),
    numero: str("numero"),
    complemento: str("complemento"),
    bairro: str("bairro"),
    cidade: str("cidade"),
    estado: str("estado").slice(0, 2).toUpperCase(),
    cep: str("cep"),
    observacoes: str("observacoes"),
    criadoEm,
    ...(typeof o.cpf === "string" && o.cpf ? { cpf: o.cpf.replace(/\D/g, "").slice(0, 11) } : {}),
    ...(typeof o.dataNascimento === "string" ? { dataNascimento: o.dataNascimento } : {}),
    ...(o.sexo === "M" || o.sexo === "F" || o.sexo === "OUTRO" ? { sexo: o.sexo } : {}),
    ...(typeof o.nomeMae === "string" ? { nomeMae: o.nomeMae } : {}),
    ...(typeof o.naturalidadeUf === "string" ? { naturalidadeUf: o.naturalidadeUf } : {}),
    ...(typeof o.docTipo === "string" ? { docTipo: o.docTipo } : {}),
    ...(typeof o.docNumero === "string" ? { docNumero: o.docNumero } : {}),
    ...(typeof o.docOrgao === "string" ? { docOrgao: o.docOrgao } : {}),
    ...(typeof o.docDataEmissao === "string" ? { docDataEmissao: o.docDataEmissao } : {}),
    ...(typeof o.docUfEmissao === "string" ? { docUfEmissao: o.docUfEmissao } : {}),
    ...(typeof o.beneficiarioTipo === "string" ? { beneficiarioTipo: o.beneficiarioTipo as Client["beneficiarioTipo"] } : {}),
    ...(typeof o.matriculaNb === "string" ? { matriculaNb: o.matriculaNb } : {}),
    ...(typeof o.orgaoEmpregador === "string" ? { orgaoEmpregador: o.orgaoEmpregador } : {}),
    ...(typeof o.cartaoBeneficio === "boolean" ? { cartaoBeneficio: o.cartaoBeneficio } : {}),
    ...(typeof o.salarioBrutoReferencia === "number" ? { salarioBrutoReferencia: o.salarioBrutoReferencia } : {}),
    ...(typeof o.margemDisponivelInformada === "number" ? { margemDisponivelInformada: o.margemDisponivelInformada } : {}),
    ...(typeof o.percentualMargemAplicado === "number" ? { percentualMargemAplicado: o.percentualMargemAplicado } : {}),
    ...(typeof o.dataUltimaConsultaMargem === "string" ? { dataUltimaConsultaMargem: o.dataUltimaConsultaMargem } : {}),
    ...(Array.isArray(o.documentosAnexos) ? { documentosAnexos: o.documentosAnexos as Client["documentosAnexos"] } : {}),
    ...(typeof o.lgpdConsentimento === "boolean" ? { lgpdConsentimento: o.lgpdConsentimento } : {}),
    ...(typeof o.lgpdConsentimentoEm === "string" ? { lgpdConsentimentoEm: o.lgpdConsentimentoEm } : {}),
    ...(typeof o.lgpdOperadorNome === "string" ? { lgpdOperadorNome: o.lgpdOperadorNome } : {}),
    ...(typeof o.canalOrigem === "string" ? { canalOrigem: o.canalOrigem } : {}),
    ...(typeof o.dataDespachoBeneficio === "string" ? { dataDespachoBeneficio: o.dataDespachoBeneficio } : {}),
    ...(typeof o.idadeRef === "number" && Number.isFinite(o.idadeRef) ? { idadeRef: o.idadeRef } : {}),
    ...(typeof o.especieBeneficio === "string" ? { especieBeneficio: o.especieBeneficio } : {}),
    ...(typeof o.margemPct35 === "number" && Number.isFinite(o.margemPct35) ? { margemPct35: o.margemPct35 } : {}),
    ...(typeof o.margemRmc === "number" && Number.isFinite(o.margemRmc) ? { margemRmc: o.margemRmc } : {}),
    ...(typeof o.margemRcc === "number" && Number.isFinite(o.margemRcc) ? { margemRcc: o.margemRcc } : {}),
    ...(typeof o.vlrLiberado35 === "number" && Number.isFinite(o.vlrLiberado35) ? { vlrLiberado35: o.vlrLiberado35 } : {}),
    ...(typeof o.vlrLiberadoRmc === "number" && Number.isFinite(o.vlrLiberadoRmc) ? { vlrLiberadoRmc: o.vlrLiberadoRmc } : {}),
    ...(typeof o.vlrLiberadoRcc === "number" && Number.isFinite(o.vlrLiberadoRcc) ? { vlrLiberadoRcc: o.vlrLiberadoRcc } : {}),
    ...(typeof o.totalLiberado === "number" && Number.isFinite(o.totalLiberado) ? { totalLiberado: o.totalLiberado } : {}),
  };
}

const STORAGE_QUOTA_MSG =
  "Limite de armazenamento do navegador excedido. Exporte um backup em Admin, limpe dados antigos ou importe em partes menores.";

/** Upsert em O(n+m): atualiza por id/CPF sem varrer a lista inteira a cada linha. */
function computeUpsertClients(prev: Client[], payloads: NewClient[]): { clients: Client[]; added: number; merged: number } {
  const byCpf = new Map<string, Client>();
  for (const c of prev) {
    const k = normalizeCpf(c.cpf);
    if (k.length === 11) byCpf.set(k, c);
  }
  const byId = new Map<string, Client>(prev.map((c) => [c.id, c]));
  const now = Date.now();
  let tick = 0;
  let added = 0;
  let merged = 0;
  const newIds: string[] = [];

  for (const p of payloads) {
    const cpfN = normalizeCpf(p.cpf);
    if (cpfN.length !== 11) continue;
    const existing = byCpf.get(cpfN);
    if (existing) {
      const next = mergeClientWithImport(existing, p);
      byId.set(existing.id, next);
      byCpf.set(cpfN, next);
      merged++;
    } else {
      const item: Client = { ...p, id: `C-${now + tick}`, criadoEm: new Date(now + tick).toISOString() };
      tick++;
      byId.set(item.id, item);
      byCpf.set(cpfN, item);
      newIds.unshift(item.id);
      added++;
    }
  }

  const list = [...newIds.map((id) => byId.get(id)!), ...prev.map((c) => byId.get(c.id)!)];
  return { clients: list, added, merged };
}

function loadInitial(): LoadedCrm {
  const fallback: LoadedCrm = {
    leads: leadsMock,
    opportunities: opportunitiesMock,
    orders: ordersMock,
    clients: [] as Client[],
    interactions: [] as Interaction[],
    tasks: [] as Task[]
  };
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    if (!localStorage.getItem(CLIENTS_BASE_RESET_FLAG)) {
      localStorage.setItem(CLIENTS_BASE_RESET_FLAG, new Date().toISOString());
    }
    return fallback;
  }
  try {
    const parsed = JSON.parse(raw) as Persisted;
    const rawClients = Array.isArray(parsed.clients) ? parsed.clients : [];
    const clients = rawClients.map(sanitizeClient).filter((x): x is Client => x !== null);
    const merged: LoadedCrm = {
      leads: parsed.leads ?? leadsMock,
      opportunities: parsed.opportunities ?? opportunitiesMock,
      orders: parsed.orders ?? ordersMock,
      clients,
      interactions: Array.isArray(parsed.interactions) ? parsed.interactions : [],
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : []
    };
    let { result, changed } = migrateCrmDeprecatedVendedores(merged);
    const clientsDropped = rawClients.length !== clients.length;
    if (changed || clientsDropped) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          leads: result.leads,
          opportunities: result.opportunities,
          orders: result.orders,
          clients: result.clients,
          interactions: result.interactions,
          tasks: result.tasks,
        })
      );
    }
    if (!localStorage.getItem(CLIENTS_BASE_RESET_FLAG)) {
      result = { ...result, clients: [] };
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          leads: result.leads,
          opportunities: result.opportunities,
          orders: result.orders,
          clients: [],
          interactions: result.interactions,
          tasks: result.tasks,
        })
      );
      localStorage.setItem(CLIENTS_BASE_RESET_FLAG, new Date().toISOString());
    }
    if (!localStorage.getItem(LEADS_KATO_MOCK_REMOVED_FLAG)) {
      const leadsSemDemo = result.leads.filter((l) => !LEGACY_DEMO_LEAD_IDS.has(l.id));
      if (leadsSemDemo.length !== result.leads.length) {
        result = { ...result, leads: leadsSemDemo };
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            leads: result.leads,
            opportunities: result.opportunities,
            orders: result.orders,
            clients: result.clients,
            interactions: result.interactions,
            tasks: result.tasks,
          })
        );
      }
      localStorage.setItem(LEADS_KATO_MOCK_REMOVED_FLAG, new Date().toISOString());
    }
    return result;
  } catch {
    return fallback;
  }
}

export function CRMProvider({ children }: { children: ReactNode }) {
  const { logEvent } = useAudit();
  const initial = useMemo(loadInitial, []);
  const [leads, setLeads] = useState<Lead[]>(initial.leads);
  const [opportunities, setOpportunities] = useState<Opportunity[]>(initial.opportunities);
  const [orders, setOrders] = useState<Order[]>(initial.orders);
  const [clients, setClients] = useState<Client[]>(initial.clients);
  const [interactions, setInteractions] = useState<Interaction[]>(initial.interactions);
  const [tasks, setTasks] = useState<Task[]>(initial.tasks);
  const [isApiMode, setIsApiMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  function persist(next: { leads: Lead[]; opportunities: Opportunity[]; orders: Order[]; clients: Client[]; interactions: Interaction[]; tasks: Task[] }) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function p() {
    return { leads, opportunities, orders, clients, interactions, tasks };
  }

  useEffect(() => {
    let mounted = true;
    async function loadFromApi() {
      setIsLoading(true);
      const token = getAccessToken();
      if (!token || token === "offline-mode-token") {
        setIsApiMode(false);
        setIsLoading(false);
        return;
      }
      try {
        const [apiLeads, apiOpportunities, apiOrders] = await Promise.all([
          apiGet<Lead[]>("/crm/leads"),
          apiGet<Opportunity[]>("/crm/opportunities"),
          apiGet<Order[]>("/crm/orders")
        ]);
        if (!mounted) return;
        setLeads(apiLeads);
        setOpportunities(apiOpportunities);
        setOrders(apiOrders);
        setIsApiMode(true);
      } catch {
        setIsApiMode(false);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    loadFromApi();
    const unsub = onAuthChanged(() => { loadFromApi(); });
    return () => { mounted = false; unsub(); };
  }, []);

  /* ── Leads ──────────────────────────────────────────────────────────── */

  async function addLead(payload: NewLead) {
    const now = new Date().toISOString();
    if (isApiMode) {
      const created = await apiPost<Lead>("/crm/leads", { ...payload, criadoEm: now });
      setLeads((prev) => { const n = [created, ...prev]; persist({ ...p(), leads: n }); return n; });
      logEvent("Sistema", "LEAD_CREATE", `Lead criado: ${payload.nome}`);
      return;
    }
    const item: Lead = { ...payload, id: `L-${String(Date.now()).slice(-5)}`, criadoEm: now };
    setLeads((prev) => { const n = [item, ...prev]; persist({ ...p(), leads: n }); return n; });
    logEvent("Sistema", "LEAD_CREATE_LOCAL", `Lead local criado: ${payload.nome}`);
  }

  async function addLeadsBatch(payloads: NewLead[]): Promise<number> {
    if (isApiMode) {
      let n = 0;
      for (const payload of payloads) {
        await addLead(payload);
        n++;
      }
      return n;
    }
    const now = Date.now();
    let addedCount = 0;
    let failed = false;
    setLeads((prev) => {
      const cpfSeen = new Set(
        prev.map((l) => normalizeCpf(l.cpf)).filter((c) => c.length === 11)
      );
      const items: Lead[] = [];
      for (let i = 0; i < payloads.length; i++) {
        const p = payloads[i];
        const cpfN = normalizeCpf(p.cpf);
        if (cpfN.length === 11) {
          if (cpfSeen.has(cpfN)) continue;
          cpfSeen.add(cpfN);
        }
        items.push({
          ...p,
          id: `L-${now + i}-${Math.random().toString(36).slice(2, 7)}`,
          criadoEm: new Date(now + i).toISOString(),
        });
      }
      addedCount = items.length;
      const next = [...items, ...prev];
      try {
        persist({ ...p(), leads: next });
      } catch (e) {
        if (e instanceof DOMException && e.name === "QuotaExceededError") {
          failed = true;
          return prev;
        }
        throw e;
      }
      return next;
    });
    if (failed) throw new Error(STORAGE_QUOTA_MSG);
    logEvent("Sistema", "LEAD_IMPORT_BATCH", `${addedCount} leads importados (CPF duplicado ignorado)`);
    return addedCount;
  }

  function updateLead(id: string, patch: Partial<Lead>) {
    setLeads((prev) => { const n = prev.map((l) => (l.id === id ? { ...l, ...patch } : l)); persist({ ...p(), leads: n }); return n; });
    logEvent("Sistema", "LEAD_UPDATE", `Lead ${id} atualizado`);
  }

  /* ── Opportunities ──────────────────────────────────────────────────── */

  async function addOpportunity(payload: NewOpportunity): Promise<string> {
    const now = new Date().toISOString();
    if (isApiMode) {
      const created = await apiPost<Opportunity>("/crm/opportunities", { ...payload, criadoEm: now });
      setOpportunities((prev) => { const n = [created, ...prev]; persist({ ...p(), opportunities: n }); return n; });
      logEvent("Sistema", "OPPORTUNITY_CREATE", `Oportunidade criada: ${payload.titulo}`);
      return created.id;
    }
    const item: Opportunity = { ...payload, id: `O-${String(Date.now()).slice(-5)}`, criadoEm: now };
    setOpportunities((prev) => { const n = [item, ...prev]; persist({ ...p(), opportunities: n }); return n; });
    logEvent("Sistema", "OPPORTUNITY_CREATE_LOCAL", `Oportunidade local criada: ${payload.titulo}`);
    return item.id;
  }

  async function updateOpportunity(id: string, patch: Partial<Omit<Opportunity, "id">>) {
    setOpportunities((prev) => { const n = prev.map((op) => (op.id === id ? { ...op, ...patch } : op)); persist({ ...p(), opportunities: n }); return n; });
    logEvent("Sistema", "OPPORTUNITY_UPDATE_LOCAL", `Oportunidade ${id} editada`);
  }

  async function removeOpportunity(id: string) {
    const op = opportunities.find((o) => o.id === id);
    setOpportunities((prev) => { const n = prev.filter((o) => o.id !== id); persist({ ...p(), opportunities: n }); return n; });
    logEvent("Sistema", "OPPORTUNITY_REMOVE_LOCAL", `Oportunidade removida: ${op?.titulo ?? id}`);
  }

  async function updateOpportunityStage(id: string, etapa: Opportunity["etapa"]) {
    const extra: Partial<Opportunity> = {};
    if (etapa === "Fechado") extra.fechadoEm = new Date().toISOString();
    if (isApiMode) {
      const updated = await apiPatch<Opportunity>(`/crm/opportunities/${id}/stage`, { etapa });
      setOpportunities((prev) => { const n = prev.map((op) => (op.id === id ? { ...updated, ...extra } : op)); persist({ ...p(), opportunities: n }); return n; });
      logEvent("Sistema", "OPPORTUNITY_STAGE_UPDATE", `Oportunidade ${id} movida para ${etapa}`);
      return;
    }
    setOpportunities((prev) => { const n = prev.map((op) => (op.id === id ? { ...op, etapa, ...extra } : op)); persist({ ...p(), opportunities: n }); return n; });
    logEvent("Sistema", "OPPORTUNITY_STAGE_UPDATE_LOCAL", `Oportunidade ${id} movida para ${etapa}`);
  }

  /* ── Orders ─────────────────────────────────────────────────────────── */

  async function updateOrder(pedido: number, patch: Partial<Order>) {
    if (isApiMode) {
      const updated = await apiPatch<Order>(`/crm/orders/${pedido}`, patch);
      setOrders((prev) => { const n = prev.map((o) => (o.pedido === pedido ? updated : o)); persist({ ...p(), orders: n }); return n; });
      logEvent("Sistema", "ORDER_UPDATE", `Pedido ${pedido} atualizado`);
      return;
    }
    setOrders((prev) => { const n = prev.map((o) => (o.pedido === pedido ? { ...o, ...patch } : o)); persist({ ...p(), orders: n }); return n; });
    logEvent("Sistema", "ORDER_UPDATE_LOCAL", `Pedido ${pedido} atualizado localmente`);
  }

  /* ── Clients ────────────────────────────────────────────────────────── */

  async function addClient(payload: NewClient): Promise<string> {
    const cpfN = normalizeCpf(payload.cpf);
    if (cpfN.length === 11) {
      const dup = clients.some((c) => normalizeCpf(c.cpf) === cpfN);
      if (dup) throw new Error("CPF já cadastrado.");
    }
    const id = `C-${Date.now()}`;
    const item: Client = { ...payload, id, criadoEm: new Date().toISOString() };
    setClients((prev) => { const n = [item, ...prev]; persist({ ...p(), clients: n }); return n; });
    logEvent("Sistema", "CLIENT_CREATE_LOCAL", `Cliente cadastrado: ${payload.nome}`);
    return id;
  }

  function updateClient(id: string, patch: Partial<Client>) {
    setClients((prev) => { const n = prev.map((c) => (c.id === id ? { ...c, ...patch } : c)); persist({ ...p(), clients: n }); return n; });
    logEvent("Sistema", "CLIENT_UPDATE", `Cliente ${id} atualizado`);
  }

  async function addClientsBatch(payloads: NewClient[]): Promise<number> {
    const now = Date.now();
    let added = 0;
    let failed = false;
    setClients((prev) => {
      const existingCpfs = new Set(prev.map((c) => normalizeCpf(c.cpf)).filter((x) => x.length === 11));
      const items: Client[] = [];
      for (let i = 0; i < payloads.length; i++) {
        const p = payloads[i];
        const cpfN = normalizeCpf(p.cpf);
        if (cpfN.length === 11 && existingCpfs.has(cpfN)) continue;
        if (cpfN.length === 11) existingCpfs.add(cpfN);
        items.push({ ...p, id: `C-${now + items.length}`, criadoEm: new Date(now + i).toISOString() });
        added++;
      }
      const n = [...items, ...prev];
      try {
        persist({ ...p(), clients: n });
      } catch (e) {
        if (e instanceof DOMException && e.name === "QuotaExceededError") {
          failed = true;
          return prev;
        }
        throw e;
      }
      return n;
    });
    if (failed) throw new Error(STORAGE_QUOTA_MSG);
    logEvent("Sistema", "CLIENT_IMPORT_BATCH", `${added} clientes importados em lote (CPF duplicado ignorado)`);
    return added;
  }

  async function upsertClientsBatch(payloads: NewClient[]): Promise<{ added: number; merged: number }> {
    let added = 0;
    let merged = 0;
    let failed = false;
    setClients((prev) => {
      const r = computeUpsertClients(prev, payloads);
      try {
        persist({ leads, opportunities, orders, clients: r.clients, interactions, tasks });
      } catch (e) {
        if (e instanceof DOMException && e.name === "QuotaExceededError") {
          failed = true;
          return prev;
        }
        throw e;
      }
      added = r.added;
      merged = r.merged;
      return r.clients;
    });
    if (failed) throw new Error(STORAGE_QUOTA_MSG);
    logEvent("Sistema", "CLIENT_UPSERT_BATCH", `${added} novos, ${merged} mesclados por CPF`);
    return { added, merged };
  }

  async function removeClient(id: string) {
    setClients((prev) => { const n = prev.filter((c) => c.id !== id); persist({ ...p(), clients: n }); return n; });
    logEvent("Sistema", "CLIENT_REMOVE_LOCAL", `Cliente removido`);
  }

  /* ── Interactions ───────────────────────────────────────────────────── */

  async function addInteraction(payload: NewInteraction) {
    const item: Interaction = { ...payload, id: `I-${Date.now()}`, criadoEm: new Date().toISOString() };
    setInteractions((prev) => { const n = [item, ...prev]; persist({ ...p(), interactions: n }); return n; });
    logEvent(payload.vendedor, "INTERACTION_LOG", `Contato registrado com ${payload.cliente} (${payload.tipo}) — ${payload.resultado}`);
  }

  function removeInteraction(id: string) {
    setInteractions((prev) => { const n = prev.filter((i) => i.id !== id); persist({ ...p(), interactions: n }); return n; });
    logEvent("Sistema", "INTERACTION_REMOVE", `Interação ${id} removida`);
  }

  function updateInteraction(id: string, patch: Partial<Interaction>) {
    setInteractions((prev) => { const n = prev.map((i) => (i.id === id ? { ...i, ...patch } : i)); persist({ ...p(), interactions: n }); return n; });
    logEvent("Sistema", "INTERACTION_UPDATE", `Interação ${id} atualizada`);
  }

  /* ── Tasks ──────────────────────────────────────────────────────────── */

  function addTask(payload: NewTask) {
    const item: Task = { ...payload, id: `T-${Date.now()}`, criadoEm: new Date().toISOString() };
    setTasks((prev) => { const n = [item, ...prev]; persist({ ...p(), tasks: n }); return n; });
    logEvent("Sistema", "TASK_CREATE", `Tarefa criada: ${payload.titulo}`);
  }

  function updateTask(id: string, patch: Partial<Task>) {
    setTasks((prev) => { const n = prev.map((t) => (t.id === id ? { ...t, ...patch } : t)); persist({ ...p(), tasks: n }); return n; });
    logEvent("Sistema", "TASK_UPDATE", `Tarefa ${id} atualizada`);
  }

  function removeTask(id: string) {
    setTasks((prev) => { const n = prev.filter((t) => t.id !== id); persist({ ...p(), tasks: n }); return n; });
    logEvent("Sistema", "TASK_REMOVE", `Tarefa ${id} removida`);
  }

  /* ── Backup ─────────────────────────────────────────────────────────── */

  function exportAllData(): string {
    const sellersRaw = localStorage.getItem("crm-kato-sellers-v1");
    const goalsRaw = localStorage.getItem("crm-kato-goals-v1");
    return JSON.stringify({
      _exportedAt: new Date().toISOString(),
      leads, opportunities, orders, clients, interactions, tasks,
      _sellers: sellersRaw ? JSON.parse(sellersRaw) : null,
      _goals: goalsRaw ? JSON.parse(goalsRaw) : null,
    }, null, 2);
  }

  function importAllData(json: string, mode: "replace" | "merge"): number {
    const data = JSON.parse(json);
    let count = 0;

    if (mode === "replace") {
      if (data.leads) { setLeads(data.leads); count += data.leads.length; }
      if (data.opportunities) { setOpportunities(data.opportunities); count += data.opportunities.length; }
      if (data.orders) { setOrders(data.orders); count += data.orders.length; }
      if (data.clients) { setClients(data.clients); count += data.clients.length; }
      if (data.interactions) { setInteractions(data.interactions); count += data.interactions.length; }
      if (data.tasks) { setTasks(data.tasks); count += data.tasks.length; }
    } else {
      const mergeArr = <T extends { id: string }>(existing: T[], incoming: T[]) => {
        const ids = new Set(existing.map((e) => e.id));
        const newItems = incoming.filter((i) => !ids.has(i.id));
        count += newItems.length;
        return [...newItems, ...existing];
      };
      if (data.leads) setLeads((prev) => mergeArr(prev, data.leads));
      if (data.opportunities) setOpportunities((prev) => mergeArr(prev, data.opportunities));
      if (data.clients) setClients((prev) => mergeArr(prev, data.clients));
      if (data.interactions) setInteractions((prev) => mergeArr(prev, data.interactions));
      if (data.tasks) setTasks((prev) => mergeArr(prev, data.tasks));
    }

    if (data._sellers) localStorage.setItem("crm-kato-sellers-v1", JSON.stringify(data._sellers));
    if (data._goals) localStorage.setItem("crm-kato-goals-v1", JSON.stringify(data._goals));

    // Persist
    setTimeout(() => {
      const raw = localStorage.getItem(STORAGE_KEY);
      const current = raw ? JSON.parse(raw) : {};
      persist({
        leads: data.leads ?? current.leads ?? leads,
        opportunities: data.opportunities ?? current.opportunities ?? opportunities,
        orders: data.orders ?? current.orders ?? orders,
        clients: data.clients ?? current.clients ?? clients,
        interactions: data.interactions ?? current.interactions ?? interactions,
        tasks: data.tasks ?? current.tasks ?? tasks,
      });
    }, 100);

    logEvent("Sistema", "DATA_IMPORT", `Dados importados (${mode}): ${count} registros`);
    return count;
  }

  return (
    <CRMContext.Provider
      value={{
        leads, opportunities, orders, clients, interactions, tasks,
        isApiMode, isLoading,
        addLead, addLeadsBatch, updateLead,
        addOpportunity, updateOpportunity, removeOpportunity, updateOpportunityStage,
        updateOrder,
        addClient, updateClient, addClientsBatch, upsertClientsBatch, removeClient,
        addInteraction, removeInteraction, updateInteraction,
        addTask, updateTask, removeTask,
        exportAllData, importAllData,
      }}
    >
      {children}
    </CRMContext.Provider>
  );
}

export function useCRM() {
  const ctx = useContext(CRMContext);
  if (!ctx) throw new Error("useCRM deve ser usado dentro de CRMProvider");
  return ctx;
}
