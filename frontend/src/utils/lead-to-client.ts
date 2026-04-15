/**
 * Mapeia lead (base fria) → dados iniciais do cadastro de cliente consignado.
 */
import { normalizeCpf, type Lead } from "../data/mock-data";

export type LeadWizardPrefill = {
  nome: string;
  cpfDigits: string;
  telefone: string;
  telefone2: string;
  telefone3: string;
  email: string;
  cidade: string;
  estado: string;
  observacoes: string;
  dataNascimento: string;
  /** Data de despacho do benefício (ISO yyyy-mm-dd ou texto da planilha). */
  dataDespachoBeneficio: string;
  matriculaNb: string;
  beneficiarioTipo: "APOSENTADO_PENSIONISTA_INSS" | "";
  cartaoBeneficio: boolean;
  salarioBruto: string;
  canalOrigem: string;
};

/** Converte data (ISO ou dd/mm/aaaa) para yyyy-mm-dd para `<input type="date">`. */
export function toDateInputValue(s: string | undefined): string {
  if (!s?.trim()) return "";
  const t = s.trim();
  const iso = t.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const m = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    let y = parseInt(m[3], 10);
    if (y < 100) y += 2000;
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return "";
}

/** Telefones no lead costumam vir como "tel1 · tel2 · tel3" (importação base fria). */
export function splitLeadTelefones(lead: Lead): [string, string, string] {
  const raw = lead.telefone?.trim() ?? "";
  if (!raw) return ["", "", ""];
  const parts = raw.split(/\s*·\s*/).map((s) => s.trim()).filter(Boolean);
  return [parts[0] ?? "", parts[1] ?? "", parts[2] ?? ""];
}

export function leadToWizardPrefill(lead: Lead): LeadWizardPrefill {
  const d = lead.dadosConsignado;
  const [t1, t2, t3] = splitLeadTelefones(lead);
  const cpf = lead.cpf ? normalizeCpf(lead.cpf) : "";
  let salarioBruto = "";
  if (d?.salarioBrutoReferencia != null && Number.isFinite(d.salarioBrutoReferencia) && d.salarioBrutoReferencia > 0) {
    salarioBruto = d.salarioBrutoReferencia.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return {
    nome: lead.nome,
    cpfDigits: cpf.length === 11 ? cpf : "",
    telefone: t1,
    telefone2: t2,
    telefone3: t3,
    email: lead.email ?? "",
    cidade: d?.cidade ?? "",
    estado: d?.estado ?? "",
    observacoes: lead.notasImportacao ?? "",
    dataNascimento: d?.dataNascimento ?? "",
    dataDespachoBeneficio: toDateInputValue(d?.dataDespachoBeneficio),
    matriculaNb: d?.nb ?? "",
    beneficiarioTipo: d ? "APOSENTADO_PENSIONISTA_INSS" : "",
    cartaoBeneficio: true,
    salarioBruto,
    canalOrigem: lead.origem ?? "",
  };
}
