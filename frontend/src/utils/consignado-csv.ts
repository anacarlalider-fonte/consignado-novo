/**
 * Parser: planilha consignado + legado. Linhas com CPF válido trazem todos os campos mapeados;
 * importação na UI não descarta linhas só por avisos (ver LeadColdImporter / ClientImporter).
 */
import { mergeImportedNewClient, normalizeCpf, normalizeNb, type NewClient } from "../data/mock-data";
import { applyCalculoConsignadoCompleto } from "./consignado-calculo";

export const IMPORT_PREVIEW_MAX_ROWS = 500;

export const LEGACY_COLUMNS: Array<{ key: keyof NewClient; label: string; required: boolean }> = [
  { key: "nome", label: "nome", required: true },
  { key: "telefone", label: "telefone", required: true },
  { key: "telefone2", label: "telefone2", required: false },
  { key: "telefone3", label: "telefone3", required: false },
  { key: "email", label: "email", required: false },
  { key: "cep", label: "cep", required: false },
  { key: "endereco", label: "endereco", required: false },
  { key: "numero", label: "numero", required: false },
  { key: "complemento", label: "complemento", required: false },
  { key: "bairro", label: "bairro", required: false },
  { key: "cidade", label: "cidade", required: false },
  { key: "estado", label: "estado", required: false },
  { key: "observacoes", label: "observacoes", required: false },
];

export const CONSIGNADO_COL_MAP: Record<string, string> = {
  cpf: "cpf",
  nb: "nb",
  matricula: "nb",
  matriculabeneficio: "nb",
  matriculabenef: "nb",
  matriculanb: "nb",
  nbbeneficio: "nb",
  nome: "nome",
  nomecompleto: "nome",
  nomedocliente: "nome",
  nomecliente: "nome",
  nomebeneficiario: "nome",
  nomesegurado: "nome",
  nomepessoa: "nome",
  nome_pessoa: "nome",
  nomecompletodobeneficiario: "nome",
  nome_do_cliente: "nome",
  nomedobeneficiario: "nome",
  cliente: "nome",
  nm: "nome",
  nomeconsignado: "nome",
  datanasc: "dataNasc",
  datanascimento: "dataNasc",
  ddb: "ddb",
  datadespacho: "ddb",
  datadespachobeneficio: "ddb",
  datadespachodobeneficio: "ddb",
  idade: "idade",
  especie: "especie",
  especiedobeneficio: "especie",
  especiebeneficio: "especie",
  especiebenef: "especie",
  tipobeneficio: "especie",
  tipodebeneficio: "especie",
  codigobeneficio: "especie",
  espbenef: "especie",
  espben: "especie",
  espbeneficio: "especie",
  valorsalario: "valorSalario",
  valordosalario: "valorSalario",
  salario: "valorSalario",
  salariobruto: "valorSalario",
  salariobeneficio: "valorSalario",
  valorbeneficio: "valorSalario",
  vlrbeneficio: "valorSalario",
  renda: "valorSalario",
  rendamensal: "valorSalario",
  rendabeneficio: "valorSalario",
  vlrsalario: "valorSalario",
  valorremuneracao: "valorSalario",
  remuneracao: "valorSalario",
  vlrbruto: "valorSalario",
  salariobase: "valorSalario",
  vrbruto: "valorSalario",
  valorsalariobruto: "valorSalario",
  proventos: "valorSalario",
  proventosmensais: "valorSalario",
  "margem35%": "margem35",
  margem35: "margem35",
  margemrmc: "margemRmc",
  margemrcc: "margemRcc",
  "vlrliberado35%": "vlrLiberado35",
  vlrliberado35: "vlrLiberado35",
  vlrliberadormc: "vlrLiberadoRmc",
  vlrliberadorcc: "vlrLiberadoRcc",
  total: "total",
  cidade: "cidade",
  estado: "estado",
  uf: "uf",
  telefone1: "telefone",
  telefone: "telefone",
  telefone2: "telefone2",
  telefone3: "telefone3",
  ddd: "ddd",
};

const LEMIT_COL_MAP: Record<string, string> = {
  cpf: "cpf",
  ddd: "ddd",
  telefone: "telefoneNumero",
  tipotelefone: "tipoTelefone",
  tipotelefo: "tipoTelefone",
  ranking: "ranking",
  score: "scoreLemit",
};

export const LEMIT_TEMPLATE_HEADER = "CPF;DDD;Telefone;TipoTelefone;Ranking;Score";
export const LEMIT_TEMPLATE_ROW = "12345678901;11;999999999;Móvel;1;95";

export function downloadLemitTemplate() {
  const bom = "\uFEFF";
  const blob = new Blob([bom + [LEMIT_TEMPLATE_HEADER, LEMIT_TEMPLATE_ROW].join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "modelo_lemit_telefones.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export const CONSIGNADO_TEMPLATE_HEADER =
  "CPF;NB;NOME;DATA NASC;DDB;IDADE;ESPÉCIE;VALOR SALÁRIO;MARGEM 35%;MARGEM RMC;MARGEM RCC;VLR LIBERADO 35%;VLR LIBERADO RMC;VLR LIBERADO RCC;TOTAL;CIDADE;ESTADO;UF;TELEFONE 1;TELEFONE 2;TELEFONE 3";
export const CONSIGNADO_TEMPLATE_ROW =
  "12345678901;0001234567890;Maria da Silva;01/01/1960;15/03/2010;65;Aposentadoria;3500,00;1225,00;500,00;300,00;5000,00;2000,00;1000,00;8000,00;Marília;São Paulo;SP;(14) 99999-0001;(14) 98888-0002;(14) 97777-0003";

export function downloadConsignadoTemplate() {
  const bom = "\uFEFF";
  const blob = new Blob([bom + [CONSIGNADO_TEMPLATE_HEADER, CONSIGNADO_TEMPLATE_ROW].join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "modelo_importacao_consignado.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function detectSep(line: string): ";" | "," {
  return line.split(";").length >= line.split(",").length ? ";" : ",";
}

export function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQ = !inQ;
      }
    } else if (c === sep && !inQ) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur.trim());
  return out.map((cell) => cell.replace(/^"|"$/g, "").trim());
}

export function normalizeHeader(h: string) {
  return h
    .trim()
    .replace(/^\uFEFF/, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/r\$/gi, "")
    .replace(/\s+/g, "");
}

export function headerToKey(h: string): string {
  return normalizeHeader(h).replace(/\s+/g, "");
}

export type ParsedRow = {
  rowNum: number;
  data: Partial<NewClient>;
  errors: string[];
  valid: boolean;
  mode: "legacy" | "consignado";
};

function parseMoneyBr(s: string): number | undefined {
  const t = s.trim().replace(/\s/g, "").replace(/R\$/gi, "");
  if (!t) return undefined;
  if (/^\d+$/.test(t)) {
    const n = Number(t);
    return Number.isFinite(n) ? n : undefined;
  }
  if (/^\d{1,3}(,\d{3})*\.\d{1,2}$/.test(t)) {
    const n = Number(t.replace(/,/g, ""));
    return Number.isFinite(n) ? n : undefined;
  }
  if (/^\d+\.\d{1,2}$/.test(t) && !t.includes(",")) {
    const n = Number(t);
    return Number.isFinite(n) ? n : undefined;
  }
  if (/^\d+\.\d{3}$/.test(t) && !t.includes(",")) {
    const n = Number(t.replace(/\./g, ""));
    return Number.isFinite(n) ? n : undefined;
  }
  if (t.includes(",") || /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) {
    const n = Number(t.replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  const n = Number(t.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

export { applyMargensAutomaticasDesdeSalario, applyCalculoConsignadoCompleto } from "./consignado-calculo";

function parseIntSafe(s: string): number | undefined {
  const n = parseInt(s.replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : undefined;
}

function parseDateBrToIso(s: string): string | undefined {
  const t = s.trim();
  if (!t) return undefined;
  const m = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    let y = parseInt(m[3], 10);
    if (y < 100) y += 2000;
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  return undefined;
}

function getCell(cells: string[], colIndex: Record<string, number>, field: string): string {
  const i = colIndex[field];
  if (i === undefined) return "";
  return (cells[i] ?? "").trim().replace(/^"|"$/g, "");
}

function buildNomeColumnIndices(rawHeaders: string[]): number[] {
  const out: number[] = [];
  rawHeaders.forEach((h, i) => {
    const k = headerToKey(h);
    if (CONSIGNADO_COL_MAP[k] === "nome") out.push(i);
  });
  return out;
}

function pickNomeFromCells(cells: string[], nomeColumnIndices: number[]): string {
  for (const i of nomeColumnIndices) {
    const s = (cells[i] ?? "").trim().replace(/^"|"$/g, "");
    if (s.length >= 2) return s.slice(0, 150);
  }
  return "";
}

function buildValorSalarioColumnIndices(rawHeaders: string[]): number[] {
  const out: number[] = [];
  rawHeaders.forEach((h, i) => {
    const k = headerToKey(h);
    if (CONSIGNADO_COL_MAP[k] === "valorSalario") out.push(i);
  });
  return out;
}

function inferValorSalarioColumnIndices(rawHeaders: string[]): number[] {
  const out: number[] = [];
  rawHeaders.forEach((h, i) => {
    const n = normalizeHeader(h);
    if (n.includes("margem") || n.includes("liberad") || n.includes("vlrliber")) return;
    if (n.includes("totalliber") || n.includes("totalmargem")) return;
    if (n.includes("salari") || n.includes("provento")) {
      out.push(i);
      return;
    }
    if (n.includes("renda") && !n.includes("margem")) {
      out.push(i);
      return;
    }
    if (n.includes("rendimentobruto") || n.includes("rendimentobruta")) {
      out.push(i);
      return;
    }
    if (n.includes("remuneracao") && !n.includes("margem")) {
      out.push(i);
      return;
    }
    if (n.includes("valor") && (n.includes("benef") || n.includes("salari"))) {
      out.push(i);
    }
  });
  return out;
}

function mergeValorSalarioColumnIndices(rawHeaders: string[]): number[] {
  const a = buildValorSalarioColumnIndices(rawHeaders);
  const b = inferValorSalarioColumnIndices(rawHeaders);
  const seen = new Set<number>();
  const merged: number[] = [];
  for (const idx of [...a, ...b]) {
    if (!seen.has(idx)) {
      seen.add(idx);
      merged.push(idx);
    }
  }
  merged.sort((x, y) => x - y);
  return merged;
}

function pickValorSalarioFromCells(cells: string[], indices: number[]): number | undefined {
  for (const i of indices) {
    const raw = (cells[i] ?? "").trim().replace(/^"|"$/g, "");
    const v = parseMoneyBr(raw);
    if (v !== undefined) return v;
  }
  return undefined;
}

function buildEspecieColumnIndices(rawHeaders: string[]): number[] {
  const out: number[] = [];
  rawHeaders.forEach((h, i) => {
    const k = headerToKey(h);
    if (CONSIGNADO_COL_MAP[k] === "especie") out.push(i);
  });
  return out;
}

function inferEspecieColumnIndices(rawHeaders: string[]): number[] {
  const out: number[] = [];
  rawHeaders.forEach((h, i) => {
    const n = normalizeHeader(h);
    if (n.includes("espec")) out.push(i);
  });
  return out;
}

function mergeEspecieColumnIndices(rawHeaders: string[]): number[] {
  const a = buildEspecieColumnIndices(rawHeaders);
  const b = inferEspecieColumnIndices(rawHeaders);
  const seen = new Set<number>();
  const merged: number[] = [];
  for (const idx of [...a, ...b]) {
    if (!seen.has(idx)) {
      seen.add(idx);
      merged.push(idx);
    }
  }
  merged.sort((x, y) => x - y);
  return merged;
}

function pickEspecieFromCells(cells: string[], indices: number[]): string {
  for (const i of indices) {
    const raw = (cells[i] ?? "").trim().replace(/^"|"$/g, "");
    if (raw.length >= 1) return raw.slice(0, 200);
  }
  return "";
}

function buildConsignadoColIndex(rawHeaders: string[]): Record<string, number> {
  const idx: Record<string, number> = {};
  rawHeaders.forEach((h, i) => {
    const k = headerToKey(h);
    const field = CONSIGNADO_COL_MAP[k];
    if (field && idx[field] === undefined) idx[field] = i;
  });
  return idx;
}

function hasConsignadoNomeColumn(rawHeaders: string[]): boolean {
  const keys = rawHeaders.map(headerToKey);
  return Object.entries(CONSIGNADO_COL_MAP).some(([key, field]) => field === "nome" && keys.includes(key));
}

function buildLemitColIndex(rawHeaders: string[]): Record<string, number> {
  const idx: Record<string, number> = {};
  rawHeaders.forEach((h, i) => {
    const k = headerToKey(h);
    const field = LEMIT_COL_MAP[k];
    if (field) idx[field] = i;
  });
  return idx;
}

export function combineLemitPhone(dddRaw: string, telefoneRaw: string): string {
  const d = dddRaw.replace(/\D/g, "").slice(0, 3);
  const t = telefoneRaw.replace(/\D/g, "");
  if (t.length < 8) return "";
  const digits = `${d}${t}`.replace(/\D/g, "");
  if (digits.length < 10) return "";
  const dd = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (rest.length === 8) return `(${dd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  if (rest.length === 9) return `(${dd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
  return `(${dd}) ${rest}`;
}

function isLemitHeaders(rawHeaders: string[]): boolean {
  const keys = rawHeaders.map(headerToKey);
  return keys.includes("cpf") && keys.includes("ddd") && keys.includes("telefone");
}

function isConsignadoStrictHeaders(rawHeaders: string[]): boolean {
  const keys = rawHeaders.map(headerToKey);
  return keys.includes("cpf") && hasConsignadoNomeColumn(rawHeaders);
}

function isConsignadoComplementHeaders(rawHeaders: string[]): boolean {
  const keys = rawHeaders.map(headerToKey);
  return keys.includes("cpf") && !hasConsignadoNomeColumn(rawHeaders);
}

function rowToConsignadoNewClient(
  cells: string[],
  colIndex: Record<string, number>,
  rowNum: number,
  complementOnly = false,
  nomeColumnIndices: number[] = [],
  valorSalarioColumnIndices: number[] = [],
  especieColumnIndices: number[] = []
): { data: NewClient; errors: string[] } {
  const errors: string[] = [];
  const nome =
    pickNomeFromCells(cells, nomeColumnIndices) || getCell(cells, colIndex, "nome").slice(0, 150);
  const cpf = normalizeCpf(getCell(cells, colIndex, "cpf"));
  if (cpf.length !== 11) errors.push("CPF deve ter 11 dígitos");

  const nb = normalizeNb(getCell(cells, colIndex, "nb"));
  const dddRaw = getCell(cells, colIndex, "ddd");

  function telComDdd(tel: string): string {
    const t = tel.trim();
    if (!t) return "";
    const digits = t.replace(/\D/g, "");
    if (digits.length >= 10) return t;
    const dddDigits = dddRaw.replace(/\D/g, "").slice(0, 3);
    if (dddDigits.length >= 2 && digits.length >= 8) {
      const c = combineLemitPhone(dddRaw, t);
      return c || t;
    }
    return t;
  }
  const dataNasc = parseDateBrToIso(getCell(cells, colIndex, "dataNasc"));
  const ddb = getCell(cells, colIndex, "ddb");
  const idadeStr = getCell(cells, colIndex, "idade");
  const idadeRef = parseIntSafe(idadeStr);
  const especie =
    pickEspecieFromCells(cells, especieColumnIndices) || getCell(cells, colIndex, "especie");
  const valorSalario =
    pickValorSalarioFromCells(cells, valorSalarioColumnIndices) ??
    parseMoneyBr(getCell(cells, colIndex, "valorSalario"));
  const margem35 = parseMoneyBr(getCell(cells, colIndex, "margem35"));
  const margemRmc = parseMoneyBr(getCell(cells, colIndex, "margemRmc"));
  const margemRcc = parseMoneyBr(getCell(cells, colIndex, "margemRcc"));
  const vlrLiberado35 = parseMoneyBr(getCell(cells, colIndex, "vlrLiberado35"));
  const vlrLiberadoRmc = parseMoneyBr(getCell(cells, colIndex, "vlrLiberadoRmc"));
  const vlrLiberadoRcc = parseMoneyBr(getCell(cells, colIndex, "vlrLiberadoRcc"));
  const totalLiberado = parseMoneyBr(getCell(cells, colIndex, "total"));
  const cidade = getCell(cells, colIndex, "cidade");
  const estadoNome = getCell(cells, colIndex, "estado").trim();
  const ufRaw = getCell(cells, colIndex, "uf").trim();
  const uf = ufRaw.slice(0, 2).toUpperCase();
  const estado = uf.length === 2 ? uf : estadoNome;

  const tel1 = telComDdd(getCell(cells, colIndex, "telefone"));
  const tel2 = telComDdd(getCell(cells, colIndex, "telefone2"));
  const tel3 = telComDdd(getCell(cells, colIndex, "telefone3"));

  const importTag = complementOnly
    ? `Complemento LEMIT linha ${rowNum} · ${new Date().toLocaleString("pt-BR")}`
    : `Importação CSV linha ${rowNum} · ${new Date().toLocaleString("pt-BR")}`;
  const data: NewClient = {
    nome: nome.length >= 2 ? nome : "—",
    telefone: tel1,
    telefone2: tel2 || undefined,
    telefone3: tel3 || undefined,
    email: "",
    endereco: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade,
    estado,
    cep: "",
    observacoes: importTag,
    cpf,
    dataNascimento: dataNasc,
    matriculaNb: nb,
    beneficiarioTipo: "APOSENTADO_PENSIONISTA_INSS",
    cartaoBeneficio: true,
    salarioBrutoReferencia: valorSalario ?? 0,
    margemDisponivelInformada: totalLiberado ?? vlrLiberado35,
    percentualMargemAplicado: 35,
    dataUltimaConsultaMargem: new Date().toISOString().slice(0, 16),
    dataDespachoBeneficio: ddb ? parseDateBrToIso(ddb) ?? ddb : undefined,
    idadeRef,
    especieBeneficio: especie || undefined,
    margemPct35: margem35,
    margemRmc,
    margemRcc,
    vlrLiberado35,
    vlrLiberadoRmc,
    vlrLiberadoRcc,
    totalLiberado,
    canalOrigem: complementOnly ? "Importação CSV (complemento LEMIT)" : "Importação CSV (planilha consignado)",
    lgpdConsentimento: true,
    lgpdConsentimentoEm: new Date().toISOString(),
    lgpdOperadorNome: "Importação em lote",
  };

  return { data: applyCalculoConsignadoCompleto(data), errors };
}

type LemitRawRow = {
  cpf: string;
  phoneDisplay: string;
  ranking: number;
  score: number;
  rowNum: number;
  tipoTelefone: string;
};

function rowToLemitConsolidated(
  cpf: string,
  tel1: string,
  tel2: string,
  tel3: string,
  rowLabel: string,
  lemitBlocoOrganizado: string,
  telefonesExtras: string[]
): { data: NewClient; errors: string[] } {
  const errors: string[] = [];
  if (cpf.length !== 11) errors.push("CPF deve ter 11 dígitos");
  const digitsOk = (s: string) => s.replace(/\D/g, "").length >= 8;
  if (![tel1, tel2, tel3].some(digitsOk)) errors.push("Nenhum telefone válido (DDD + Telefone)");

  const importTag = `LEMIT ${rowLabel} · ${new Date().toLocaleString("pt-BR")}`;
  const obsParts = [importTag, lemitBlocoOrganizado];
  if (telefonesExtras.length > 0) {
    obsParts.push(`Telefones adicionais (além dos 3 principais): ${telefonesExtras.join(" · ")}`);
  }
  const data: NewClient = {
    nome: "—",
    telefone: tel1,
    telefone2: tel2 || undefined,
    telefone3: tel3 || undefined,
    email: "",
    endereco: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
    cep: "",
    observacoes: obsParts.filter((x) => x && x.trim()).join("\n\n"),
    cpf,
    beneficiarioTipo: "APOSENTADO_PENSIONISTA_INSS",
    cartaoBeneficio: true,
    salarioBrutoReferencia: 0,
    margemDisponivelInformada: 0,
    percentualMargemAplicado: 35,
    dataUltimaConsultaMargem: new Date().toISOString().slice(0, 16),
    canalOrigem: "Importação CSV (LEMIT)",
    lgpdConsentimento: true,
    lgpdConsentimentoEm: new Date().toISOString(),
    lgpdOperadorNome: "Importação em lote",
  };

  return { data, errors };
}

function parseLemitCsv(lines: string[], sep: string, rawHeaders: string[]): ParsedRow[] {
  const colIndex = buildLemitColIndex(rawHeaders);
  const rawRows: LemitRawRow[] = [];

  lines.slice(1).forEach((line, i) => {
    const cells = splitCsvLine(line, sep);
    const rowNum = i + 2;
    const cpf = normalizeCpf(getCell(cells, colIndex, "cpf"));
    const ddd = getCell(cells, colIndex, "ddd");
    const telNum = getCell(cells, colIndex, "telefoneNumero");
    const phoneDisplay = combineLemitPhone(ddd, telNum);
    const rankingStr = getCell(cells, colIndex, "ranking");
    const scoreStr = getCell(cells, colIndex, "scoreLemit");
    const tipoTelefone = getCell(cells, colIndex, "tipoTelefone");
    const ranking = Number(rankingStr.replace(",", "."));
    const score = Number(scoreStr.replace(",", "."));
    rawRows.push({
      cpf,
      phoneDisplay,
      ranking: Number.isFinite(ranking) ? ranking : 999,
      score: Number.isFinite(score) ? score : 0,
      rowNum,
      tipoTelefone,
    });
  });

  const byCpf = new Map<string, LemitRawRow[]>();
  for (const r of rawRows) {
    if (r.cpf.length !== 11) continue;
    if (!byCpf.has(r.cpf)) byCpf.set(r.cpf, []);
    byCpf.get(r.cpf)!.push(r);
  }

  const out: ParsedRow[] = [];
  let block = 0;
  for (const [cpf, list] of byCpf) {
    block++;
    const porLinhaArquivo = [...list].sort((a, b) => a.rowNum - b.rowNum);
    const lemitBlocoOrganizado = [
      "Detalhe LEMIT (todas as linhas deste CPF):",
      ...porLinhaArquivo.map((item) => {
        const tel = item.phoneDisplay?.trim() || "(sem número válido)";
        const tipo = item.tipoTelefone?.trim();
        return `· Linha ${item.rowNum}: ${tel} · Score ${item.score} · Rank ${item.ranking}${tipo ? ` · ${tipo}` : ""}`;
      }),
    ].join("\n");

    const sortedForPick = [...list].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.ranking - b.ranking;
    });

    const uniqPhones: string[] = [];
    const seen = new Set<string>();
    for (const r of sortedForPick) {
      const digits = r.phoneDisplay.replace(/\D/g, "");
      if (digits.length < 8) continue;
      if (seen.has(digits)) continue;
      seen.add(digits);
      uniqPhones.push(r.phoneDisplay);
    }

    if (uniqPhones.length === 0) {
      const firstRow = list[0]?.rowNum ?? block;
      const { data, errors } = rowToLemitConsolidated(
        cpf,
        "",
        "",
        "",
        `bloco ${block} (linhas LEMIT)`,
        lemitBlocoOrganizado,
        []
      );
      out.push({
        rowNum: firstRow,
        data,
        errors,
        valid: false,
        mode: "consignado",
      });
      continue;
    }

    const top3 = [uniqPhones[0] ?? "", uniqPhones[1] ?? "", uniqPhones[2] ?? ""];
    const telefonesExtras = uniqPhones.slice(3);

    const { data, errors } = rowToLemitConsolidated(
      cpf,
      top3[0]!,
      top3[1]!,
      top3[2]!,
      `bloco ${block} (linhas LEMIT)`,
      lemitBlocoOrganizado,
      telefonesExtras
    );
    out.push({
      rowNum: list[0]!.rowNum,
      data,
      errors,
      valid: errors.length === 0,
      mode: "consignado",
    });
  }

  return out;
}

function csvDataLine(cells: string[]): string {
  return cells
    .map((c) => {
      const s = String(c ?? "");
      if (/[;\n\r"]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    })
    .join(";");
}

function isoOrRawToBrDate(s: string | undefined): string {
  if (!s) return "";
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return s;
}

function fmtMoney(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return "";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function mergedClientsToConsignadoCsv(rows: NewClient[]): string {
  const out: string[] = [CONSIGNADO_TEMPLATE_HEADER];
  for (const nc of rows) {
    const uf = (nc.estado || "").trim().slice(0, 2).toUpperCase();
    const line = csvDataLine([
      nc.cpf ?? "",
      nc.matriculaNb ?? "",
      nc.nome ?? "",
      isoOrRawToBrDate(nc.dataNascimento),
      isoOrRawToBrDate(nc.dataDespachoBeneficio),
      nc.idadeRef != null && Number.isFinite(nc.idadeRef) ? String(nc.idadeRef) : "",
      nc.especieBeneficio ?? "",
      fmtMoney(nc.salarioBrutoReferencia),
      fmtMoney(nc.margemPct35),
      fmtMoney(nc.margemRmc),
      fmtMoney(nc.margemRcc),
      fmtMoney(nc.vlrLiberado35),
      fmtMoney(nc.vlrLiberadoRmc),
      fmtMoney(nc.vlrLiberadoRcc),
      fmtMoney(nc.totalLiberado),
      nc.cidade ?? "",
      nc.estado ?? "",
      uf,
      nc.telefone ?? "",
      nc.telefone2 ?? "",
      nc.telefone3 ?? "",
    ]);
    out.push(line);
  }
  return out.join("\n");
}

export function downloadMergedConsignadoBaseCsv(rows: NewClient[], filename = "base_consignado_organizada.csv") {
  const bom = "\uFEFF";
  const blob = new Blob([bom + mergedClientsToConsignadoCsv(rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function withImportValidationNotes(nc: NewClient, r: ParsedRow): NewClient {
  if (r.valid || !r.errors.length) return nc;
  const tag = `Linha ${r.rowNum} (pendências): ${r.errors.join("; ")}`;
  const prev = nc.observacoes?.trim() ?? "";
  return { ...nc, observacoes: prev ? `${prev}\n\n${tag}` : tag };
}

export function parsedRowsForCpfMerge(rows: ParsedRow[]): ParsedRow[] {
  return rows.filter((r) => r.mode === "consignado");
}

export function mergeConsignadoRowsByCpf(rowsA: ParsedRow[], rowsB: ParsedRow[]): NewClient[] {
  const map = new Map<string, NewClient>();

  function absorb(r: ParsedRow) {
    if (r.mode !== "consignado") return;
    const raw = r.data as NewClient;
    const cpf = normalizeCpf(raw.cpf);
    if (cpf.length !== 11) return;
    let inc = withImportValidationNotes(raw, r);
    const existing = map.get(cpf);
    map.set(cpf, existing ? mergeImportedNewClient(existing, inc) : inc);
  }

  for (const r of rowsA) absorb(r);
  for (const r of rowsB) absorb(r);
  return [...map.values()].map((nc) => applyCalculoConsignadoCompleto(nc));
}

export function parseCSV(text: string): ParsedRow[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((l) => l.trim());

  if (lines.length < 2) return [];

  const sep = detectSep(lines[0]);
  const rawHeaders = splitCsvLine(lines[0], sep);

  if (isLemitHeaders(rawHeaders)) {
    return parseLemitCsv(lines, sep, rawHeaders);
  }

  if (isConsignadoComplementHeaders(rawHeaders)) {
    const colIndex = buildConsignadoColIndex(rawHeaders);
    const nomeIndices = buildNomeColumnIndices(rawHeaders);
    const valorSalarioIndices = mergeValorSalarioColumnIndices(rawHeaders);
    const especieIndices = mergeEspecieColumnIndices(rawHeaders);
    return lines.slice(1).map((line, i) => {
      const cells = splitCsvLine(line, sep);
      const rowNum = i + 2;
      const { data, errors } = rowToConsignadoNewClient(
        cells,
        colIndex,
        rowNum,
        true,
        nomeIndices,
        valorSalarioIndices,
        especieIndices
      );
      return {
        rowNum,
        data,
        errors,
        valid: errors.length === 0,
        mode: "consignado" as const,
      };
    });
  }

  if (isConsignadoStrictHeaders(rawHeaders)) {
    const colIndex = buildConsignadoColIndex(rawHeaders);
    const nomeIndices = buildNomeColumnIndices(rawHeaders);
    const valorSalarioIndices = mergeValorSalarioColumnIndices(rawHeaders);
    const especieIndices = mergeEspecieColumnIndices(rawHeaders);
    return lines.slice(1).map((line, i) => {
      const cells = splitCsvLine(line, sep);
      const rowNum = i + 2;
      const { data, errors } = rowToConsignadoNewClient(
        cells,
        colIndex,
        rowNum,
        false,
        nomeIndices,
        valorSalarioIndices,
        especieIndices
      );
      return {
        rowNum,
        data,
        errors,
        valid: errors.length === 0,
        mode: "consignado" as const,
      };
    });
  }

  const colIndexLegacy: Record<string, number> = {};
  const normHeaders = rawHeaders.map(normalizeHeader);
  LEGACY_COLUMNS.forEach((col) => {
    const idx = normHeaders.indexOf(normalizeHeader(col.label));
    if (idx !== -1) colIndexLegacy[col.key] = idx;
  });

  return lines.slice(1).map((line, i) => {
    const cells = splitCsvLine(line, sep);
    const data: Partial<NewClient> = {};
    LEGACY_COLUMNS.forEach((col) => {
      const idx = colIndexLegacy[col.key];
      (data as Record<string, string>)[col.key] = idx !== undefined ? (cells[idx] ?? "") : "";
    });
    const errors: string[] = [];
    if (!data.nome || data.nome.length < 2) errors.push("nome obrigatório (min 2 caracteres)");
    const t1 = data.telefone?.trim() ?? "";
    const t2 = (data.telefone2 as string | undefined)?.trim() ?? "";
    const t3 = (data.telefone3 as string | undefined)?.trim() ?? "";
    const anyPhone = [t1, t2, t3].some((t) => t.replace(/\D/g, "").length >= 8);
    if (!anyPhone) errors.push("pelo menos um telefone com min 8 dígitos (telefone, telefone2 ou telefone3)");
    return {
      rowNum: i + 2,
      data,
      errors,
      valid: errors.length === 0,
      mode: "legacy" as const,
    };
  });
}
