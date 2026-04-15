/** Campos da planilha consignado guardados no lead (base fria importada). */
export type LeadDadosConsignado = {
  nb?: string;
  dataNascimento?: string;
  /** DDB / data de despacho do benefício (planilha). */
  dataDespachoBeneficio?: string;
  idadeRef?: number;
  especieBeneficio?: string;
  salarioBrutoReferencia?: number;
  margemPct35?: number;
  margemRmc?: number;
  margemRcc?: number;
  vlrLiberado35?: number;
  vlrLiberadoRmc?: number;
  vlrLiberadoRcc?: number;
  totalLiberado?: number;
  cidade?: string;
  estado?: string;
};

export type Lead = {
  id: string;
  nome: string;
  telefone?: string;
  email?: string;
  /** Preenchido em importação de base fria (CSV consignado) — deduplicação. */
  cpf?: string;
  /** Resumo NB / total liberado / local (importação). */
  notasImportacao?: string;
  /** Dados completos da planilha (margens, NB, local, etc.) quando importado como base fria. */
  dadosConsignado?: LeadDadosConsignado;
  origem: string;
  responsavel: string;
  score: number;
  status: "Novo" | "Em contato" | "Qualificado" | "Perdido";
  motivoPerda?: string;
  convertidoParaOportunidadeId?: string;
  /** Preenchido quando o lead vira cliente pelo cadastro consignado. */
  convertidoParaClienteId?: string;
  criadoEm: string;
};

export type NewLead = Omit<Lead, "id" | "criadoEm">;

export type Opportunity = {
  id: string;
  titulo: string;
  cliente: string;
  vendedor: string;
  valor: number;
  etapa: "Prospeccao" | "Diagnostico" | "Proposta" | "Negociacao" | "Fechado" | "Perdido";
  telefoneCliente?: string;
  emailCliente?: string;
  origemLead?: string;
  motivoPerda?: string;
  convertidoDeLeadId?: string;
  probabilidade?: number;
  previsaoFechamento?: string;
  criadoEm: string;
  fechadoEm?: string;
};

export type Order = {
  pedido: number;
  cliente: string;
  vendedor: string;
  aFaturar: number;
  diasAberto: number;
  urgencia: "CRITICO" | "ATENCAO" | "RECENTE";
  etapaCRM: "Novo" | "Contato iniciado" | "Negociacao" | "Aguardando pagamento" | "Concluido";
  proximoFollowup?: string;
};

/** Tipos de beneficiário — governa regras de margem / produtos (consignado). */
export type BeneficiarioTipoConsignado =
  | ""
  | "APOSENTADO_PENSIONISTA_INSS"
  | "SERVIDOR_PUBLICO_ATIVO"
  | "SERVIDOR_PUBLICO_APOSENTADO"
  | "PENSIONISTA"
  | "OUTRO";

/** Metadado de documento anexado (sem binário no localStorage). */
export type ClienteDocumentoAnexo = {
  tipo: string;
  nomeArquivo: string;
  tamanhoBytes: number;
  carregadoEm: string;
};

/** Cadastro de cliente — campos base + extensão correspondente bancário / consignado. */
export type Client = {
  id: string;
  nome: string;
  telefone: string;
  /** Telefones adicionais (ex.: recado, familiar, segundo celular). */
  telefone2?: string;
  telefone3?: string;
  email: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  observacoes: string;
  criadoEm: string;
  /** --- Consignado / correspondente (opcional em clientes antigos) --- */
  cpf?: string;
  dataNascimento?: string;
  sexo?: "M" | "F" | "OUTRO" | "";
  nomeMae?: string;
  naturalidadeUf?: string;
  docTipo?: string;
  docNumero?: string;
  docOrgao?: string;
  docDataEmissao?: string;
  docUfEmissao?: string;
  beneficiarioTipo?: BeneficiarioTipoConsignado;
  /** Matrícula / NB — chave para consulta de margem (API bancária). */
  matriculaNb?: string;
  orgaoEmpregador?: string;
  cartaoBeneficio?: boolean;
  salarioBrutoReferencia?: number;
  margemDisponivelInformada?: number;
  percentualMargemAplicado?: number;
  dataUltimaConsultaMargem?: string;
  documentosAnexos?: ClienteDocumentoAnexo[];
  lgpdConsentimento?: boolean;
  lgpdConsentimentoEm?: string;
  lgpdOperadorNome?: string;
  canalOrigem?: string;
  /** Dados típicos de planilha consignado / INSS (importação). */
  dataDespachoBeneficio?: string;
  idadeRef?: number;
  especieBeneficio?: string;
  margemPct35?: number;
  margemRmc?: number;
  margemRcc?: number;
  vlrLiberado35?: number;
  vlrLiberadoRmc?: number;
  vlrLiberadoRcc?: number;
  totalLiberado?: number;
};

export type NewClient = Omit<Client, "id" | "criadoEm">;

/**
 * CPF só com dígitos, sempre 11 caracteres quando há 1–11 dígitos (zeros à esquerda).
 * Planilhas/Excel costumam remover zeros iniciais ou exportar como número (ex.: 1629140.0).
 */
export function normalizeCpf(raw: string | number | undefined): string {
  if (raw === undefined || raw === null) return "";
  let s = typeof raw === "number" && Number.isFinite(raw) ? String(Math.trunc(raw)) : String(raw).trim();
  // "1629140.0" ou notação científica vinda de export numérico
  if (/^\d+\.\d+$/.test(s) || /e/i.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n) && n >= 0 && n < 1e12) s = String(Math.floor(n));
  }
  const digits = s.replace(/\D/g, "");
  if (digits.length === 0) return "";
  if (digits.length > 11) return digits.slice(0, 11);
  return digits.padStart(11, "0");
}

/**
 * NB / matrícula — preserva dígitos com zeros à esquerda (Excel costuma cortar zeros).
 */
export function normalizeNb(raw: string | number | undefined): string {
  if (raw === undefined || raw === null) return "";
  let s = typeof raw === "number" && Number.isFinite(raw) ? String(Math.trunc(raw)) : String(raw).trim();
  if (/^\d+\.\d+$/.test(s) || /e/i.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n) && n >= 0 && n < 1e13) s = String(Math.floor(n));
  }
  const digits = s.replace(/\D/g, "");
  if (digits.length === 0) return s.slice(0, 40);
  if (digits.length <= 11) return digits.padStart(11, "0");
  return s.slice(0, 40);
}

/** Mescla dois registros de importação (ex.: planilha base + LEMIT). Campos preenchidos em `incoming` sobrepõem `base`; não apaga dados com vazio. */
export function mergeImportedNewClient(base: NewClient, incoming: NewClient): NewClient {
  const out = { ...base };
  for (const key of Object.keys(incoming) as (keyof NewClient)[]) {
    const v = incoming[key];
    if (v === undefined || v === null) continue;
    if (typeof v === "string" && !v.trim()) continue;
    if (typeof v === "string" && v === "—" && String(out[key] ?? "").trim() && String(out[key]) !== "—") continue;
    if (typeof v === "number" && !Number.isFinite(v)) continue;
    if (typeof v === "number" && v === 0 && key === "salarioBrutoReferencia" && (base.salarioBrutoReferencia ?? 0) > 0) continue;
    if (key === "observacoes") {
      const combined = [base.observacoes, incoming.observacoes].filter((x) => x && String(x).trim()).join("\n\n");
      if (combined) out.observacoes = combined;
      continue;
    }
    (out as Record<string, unknown>)[key] = v;
  }
  return out;
}

/** Atualiza cliente existente com dados de uma nova importação (mesmo CPF). */
export function mergeClientWithImport(existing: Client, incoming: NewClient): Client {
  const { id, criadoEm, ...rest } = existing;
  const merged = mergeImportedNewClient(rest as NewClient, incoming);
  return { ...existing, ...merged, id, criadoEm };
}

/** Regra exibida: % da margem conforme tipo + cartão benefício. */
export function percentualMargemConsignado(
  tipo: BeneficiarioTipoConsignado,
  cartaoBeneficio: boolean
): number {
  if (!tipo || tipo === "OUTRO") return 30;
  if (tipo === "APOSENTADO_PENSIONISTA_INSS" && cartaoBeneficio) return 35;
  return 30;
}

export function calcularMargemEstimada(salario: number, tipo: BeneficiarioTipoConsignado, cartao: boolean): number {
  if (!Number.isFinite(salario) || salario <= 0) return 0;
  const p = percentualMargemConsignado(tipo, cartao) / 100;
  return Math.round(salario * p * 100) / 100;
}

/** Registro de atendimento / contato com cliente */
export type Interaction = {
  id: string;
  /** "opportunity" = card do pipeline | "order" = pedido | "lead" = lead */
  refType: "opportunity" | "order" | "lead";
  /** id da oportunidade, número do pedido (como string) ou id do lead */
  refId: string;
  cliente: string;
  vendedor: string;
  tipo: "Ligação" | "WhatsApp" | "Visita" | "Email" | "Reunião";
  resumo: string;
  resultado: "Positivo" | "Neutro" | "Negativo" | "Sem resposta";
  /** próximo retorno no formato dd/mm/yyyy ou vazio */
  proximoRetorno: string;
  criadoEm: string; // ISO
};

export type NewInteraction = Omit<Interaction, "id" | "criadoEm">;

export type Task = {
  id: string;
  titulo: string;
  descricao: string;
  responsavel: string;
  prazo: string;
  prioridade: "Alta" | "Media" | "Baixa";
  status: "Pendente" | "Em andamento" | "Concluida";
  criadoEm: string;
};

export type NewTask = Omit<Task, "id" | "criadoEm">;

/** Seed vazio — RealSynk Consignado (dados demo do CRM antigo removidos). */
export const leadsMock: Lead[] = [];

export const opportunitiesMock: Opportunity[] = [
  { id: "O-101", titulo: "Moveis planejados - area gourmet", cliente: "THIAGO HENRIQUE MARTINS", vendedor: "Simone Bosso", valor: 32000, etapa: "Proposta", probabilidade: 60, previsaoFechamento: "2026-04-30", criadoEm: "2026-02-15T11:00:00.000Z" },
  { id: "O-102", titulo: "Reforma sala comercial", cliente: "NEBRASKA MONTEIRO", vendedor: "Tatiane Souza", valor: 12900, etapa: "Negociacao", probabilidade: 75, previsaoFechamento: "2026-04-20", criadoEm: "2026-03-01T09:30:00.000Z" },
  { id: "O-103", titulo: "Cozinha completa apartamento", cliente: "MARCIA SESTITO", vendedor: "Simone Bosso", valor: 24700, etapa: "Diagnostico", probabilidade: 30, previsaoFechamento: "2026-05-15", criadoEm: "2026-03-18T14:00:00.000Z" },
  { id: "O-104", titulo: "Dormitorio planejado", cliente: "EMILENE APARECIDA PRADO", vendedor: "Tatiane Souza", valor: 18900, etapa: "Prospeccao", probabilidade: 15, criadoEm: "2026-04-02T08:45:00.000Z" },
  { id: "O-105", titulo: "Projeto corporativo", cliente: "J. S. TREINAMENTO", vendedor: "Simone Bosso", valor: 56000, etapa: "Fechado", probabilidade: 100, criadoEm: "2026-01-20T10:00:00.000Z", fechadoEm: "2026-03-10T16:00:00.000Z" }
];

export const ordersMock: Order[] = [
  { pedido: 897, cliente: "THIAGO HENRIQUE MARTINS", vendedor: "Simone Bosso", aFaturar: 16000, diasAberto: 1064, urgencia: "CRITICO", etapaCRM: "Negociacao", proximoFollowup: "10/04/2026" },
  { pedido: 1685, cliente: "0 CLIMA LTDA", vendedor: "Simone Bosso", aFaturar: 20960, diasAberto: 179, urgencia: "ATENCAO", etapaCRM: "Contato iniciado", proximoFollowup: "09/04/2026" },
  { pedido: 1818, cliente: "INGRID MENOTTI NEHUES", vendedor: "Tatiane Souza", aFaturar: 9298, diasAberto: 53, urgencia: "RECENTE", etapaCRM: "Novo", proximoFollowup: "11/04/2026" },
  { pedido: 1411, cliente: "LARISSA DE SOUZA FERRAZ", vendedor: "Simone Bosso", aFaturar: 44900, diasAberto: 541, urgencia: "CRITICO", etapaCRM: "Aguardando pagamento", proximoFollowup: "08/04/2026" }
];
