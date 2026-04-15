import { useMemo, useRef, useState } from "react";
import { normalizeCpf, type LeadDadosConsignado, type NewClient, type NewLead } from "../data/mock-data";
import {
  parseCSV,
  mergeConsignadoRowsByCpf,
  parsedRowsForCpfMerge,
  downloadMergedConsignadoBaseCsv,
  IMPORT_PREVIEW_MAX_ROWS,
  type ParsedRow,
  downloadConsignadoTemplate,
} from "../utils/consignado-csv";
import { MergedConsignadoPreviewTable } from "./MergedConsignadoPreviewTable";
import { useCRM } from "../state/crm-context";
import { useAuth } from "../state/auth-context";
import { useToast } from "../state/toast-context";

const ORIGEM_FRIA = "Base fria (CSV)";

function formatPhonesForLead(nc: NewClient): string {
  const parts: string[] = [];
  for (const t of [nc.telefone, nc.telefone2, nc.telefone3]) {
    if (t && t.replace(/\D/g, "").length >= 8) parts.push(t.trim());
  }
  return parts.join(" · ");
}

function scoreFromCold(nc: NewClient): number {
  const t = nc.totalLiberado ?? 0;
  if (!Number.isFinite(t) || t <= 0) return 28;
  return Math.min(55, Math.max(22, Math.round(22 + t / 4000)));
}

function notasFrom(nc: NewClient): string | undefined {
  const parts: string[] = [];
  if (nc.matriculaNb) parts.push(`NB ${nc.matriculaNb}`);
  if (nc.totalLiberado != null && nc.totalLiberado > 0)
    parts.push(`Total liberado R$ ${nc.totalLiberado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
  if (nc.cidade) parts.push(`${nc.cidade}/${nc.estado || ""}`);
  const head = parts.join(" · ");
  const obs = nc.observacoes?.trim();
  if (head && obs) return `${head}\n\n${obs}`;
  if (obs) return obs;
  return head || undefined;
}

/** Lead a partir da linha parseada: importa mesmo com avisos; pendências vão para notas. */
function coldLeadFromParsedRow(r: ParsedRow, responsavel: string): NewLead {
  const nc = r.data as NewClient;
  const lead = newClientToColdLead(nc, responsavel);
  if (r.errors.length > 0) {
    const tag = `Linha ${r.rowNum} (parser): ${r.errors.join("; ")}`;
    lead.notasImportacao = lead.notasImportacao ? `${lead.notasImportacao}\n\n${tag}` : tag;
  }
  return lead;
}

export function newClientToColdLead(nc: NewClient, responsavel: string): NewLead {
  const cpf = normalizeCpf(nc.cpf);
  let nome = nc.nome?.trim() ?? "";
  if (nome.length < 2 || nome === "—") {
    nome =
      cpf.length === 11
        ? `Prospect ${cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}`
        : "Lead importado";
  }
  const dadosConsignado: LeadDadosConsignado = {
    nb: nc.matriculaNb,
    dataNascimento: nc.dataNascimento,
    dataDespachoBeneficio: nc.dataDespachoBeneficio,
    idadeRef: nc.idadeRef,
    especieBeneficio: nc.especieBeneficio,
    salarioBrutoReferencia: nc.salarioBrutoReferencia,
    margemPct35: nc.margemPct35,
    margemRmc: nc.margemRmc,
    margemRcc: nc.margemRcc,
    vlrLiberado35: nc.vlrLiberado35,
    vlrLiberadoRmc: nc.vlrLiberadoRmc,
    vlrLiberadoRcc: nc.vlrLiberadoRcc,
    totalLiberado: nc.totalLiberado,
    cidade: nc.cidade,
    estado: nc.estado,
  };
  return {
    nome: nome.slice(0, 150),
    telefone: formatPhonesForLead(nc) || undefined,
    email: nc.email?.trim() || undefined,
    cpf: cpf.length === 11 ? cpf : undefined,
    notasImportacao: notasFrom(nc),
    dadosConsignado,
    origem: ORIGEM_FRIA,
    responsavel,
    score: scoreFromCold(nc),
    status: "Novo",
  };
}

type ImportMode = "single" | "twoFiles";

/** Importação da planilha consignado como leads (base fria no funil). */
export function LeadColdImporter({ onDone }: { onDone?: () => void }) {
  const { addLeadsBatch } = useCRM();
  const { currentSellerName, isGestora } = useAuth();
  const { pushToast } = useToast();

  const defaultResp = isGestora ? "Nao definido" : currentSellerName || "Nao definido";
  const [responsavel, setResponsavel] = useState(defaultResp);

  const [importMode, setImportMode] = useState<ImportMode>("single");
  const fileRef = useRef<HTMLInputElement>(null);
  const fileRefA = useRef<HTMLInputElement>(null);
  const fileRefB = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [rowsA, setRowsA] = useState<ParsedRow[] | null>(null);
  const [rowsB, setRowsB] = useState<ParsedRow[] | null>(null);
  const [fileNameA, setFileNameA] = useState("");
  const [fileNameB, setFileNameB] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [isParsingCsv, setIsParsingCsv] = useState(false);

  const mergedTwoFiles = useMemo(() => {
    if (!rowsA || !rowsB) return null;
    const va = parsedRowsForCpfMerge(rowsA);
    const vb = parsedRowsForCpfMerge(rowsB);
    if (va.length === 0 && vb.length === 0) return [];
    return mergeConsignadoRowsByCpf(va, vb);
  }, [rowsA, rowsB]);

  const mergedWidePreviewRows = useMemo(() => {
    if (!mergedTwoFiles?.length) return [];
    return mergedTwoFiles.length > IMPORT_PREVIEW_MAX_ROWS
      ? mergedTwoFiles.slice(0, IMPORT_PREVIEW_MAX_ROWS)
      : mergedTwoFiles;
  }, [mergedTwoFiles]);

  function readCsv(file: File, onParsed: (parsed: ParsedRow[]) => void) {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      pushToast("error", "Selecione um arquivo .csv");
      return;
    }
    setIsParsingCsv(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      window.setTimeout(() => {
        try {
          const parsed = parseCSV(text);
          if (parsed.length === 0) {
            pushToast("error", "Arquivo vazio ou sem linhas de dados.");
            return;
          }
          if (parsed[0]?.mode !== "consignado") {
            pushToast("error", "Para base fria use o CSV no formato consignado (coluna CPF).");
            return;
          }
          onParsed(parsed);
        } catch {
          pushToast("error", "Não foi possível analisar o CSV. Verifique o formato e o encoding (UTF-8).");
        } finally {
          setIsParsingCsv(false);
        }
      }, 0);
    };
    reader.onerror = () => {
      setIsParsingCsv(false);
      pushToast("error", "Não foi possível ler o arquivo.");
    };
    reader.readAsText(file, "UTF-8");
  }

  function switchMode(next: ImportMode) {
    setImportMode(next);
    setRows(null);
    setFileName("");
    setRowsA(null);
    setRowsB(null);
    setFileNameA("");
    setFileNameB("");
  }

  async function handleImport() {
    const resp = responsavel.trim() || defaultResp;
    try {
      setIsImporting(true);
      if (importMode === "twoFiles") {
        if (!rowsA || !rowsB) {
          pushToast("error", "Selecione os dois arquivos.");
          return;
        }
        if (rowsA[0]?.mode !== "consignado" || rowsB[0]?.mode !== "consignado") {
          pushToast("error", "Ambos os arquivos devem ser consignado (CPF).");
          return;
        }
        const merged = mergeConsignadoRowsByCpf(parsedRowsForCpfMerge(rowsA), parsedRowsForCpfMerge(rowsB));
        if (merged.length === 0) {
          pushToast("error", "Nenhum CPF com 11 dígitos após mesclar os arquivos.");
          return;
        }
        const payloads = merged.map((nc) => newClientToColdLead(nc, resp));
        const n = await addLeadsBatch(payloads);
        pushToast("success", `${n} lead(s) da base fria importado(s).`);
        setRowsA(null);
        setRowsB(null);
        setFileNameA("");
        setFileNameB("");
        onDone?.();
        return;
      }
      if (!rows) return;
      if (rows[0]?.mode !== "consignado") {
        pushToast("error", "Use CSV consignado (CPF) para base fria.");
        return;
      }
      const consignado = rows.filter((r) => r.mode === "consignado");
      const importaveis = consignado.filter((r) => normalizeCpf((r.data as NewClient).cpf).length === 11);
      if (importaveis.length === 0) {
        pushToast("error", "Nenhuma linha com CPF válido (11 dígitos). Verifique a coluna CPF.");
        return;
      }
      const payloads = importaveis.map((r) => coldLeadFromParsedRow(r, resp));
      const n = await addLeadsBatch(payloads);
      const comAviso = importaveis.filter((r) => r.errors.length > 0).length;
      pushToast(
        "success",
        `${n} lead(s) importado(s) (CPF duplicado ignorado).${comAviso > 0 ? ` ${comAviso} com avisos nas notas.` : ""}`
      );
      setRows(null);
      setFileName("");
      onDone?.();
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Falha ao importar leads.");
    } finally {
      setIsImporting(false);
    }
  }

  function handleCancel() {
    switchMode(importMode);
  }

  const importableCount =
    rows && rows[0]?.mode === "consignado"
      ? rows.filter((r) => r.mode === "consignado" && normalizeCpf((r.data as NewClient).cpf).length === 11).length
      : rows
        ? rows.filter((r) => r.valid).length
        : 0;
  const mergedCount = mergedTwoFiles?.length ?? 0;
  const showTwoPreview = importMode === "twoFiles" && rowsA && rowsB && mergedTwoFiles !== null && mergedCount > 0;
  const showSinglePreview = importMode === "single" && rows && rows[0]?.mode === "consignado";

  const singlePreviewRows = useMemo(() => {
    if (!rows) return [];
    const list = rows.filter(
      (r) => r.mode === "consignado" && normalizeCpf((r.data as NewClient).cpf).length === 11
    );
    return list.length > IMPORT_PREVIEW_MAX_ROWS ? list.slice(0, IMPORT_PREVIEW_MAX_ROWS) : list;
  }, [rows]);

  return (
    <div className="importer-wrap">
      <p style={{ fontSize: 14, marginBottom: 12, lineHeight: 1.5 }}>
        A planilha é a mesma do consignado; os registros entram como <strong>leads</strong> (status Novo, origem &quot;{ORIGEM_FRIA}&quot;) para
        trabalhar no funil antes de cadastrar como cliente.
      </p>

      <label className="modal-field" style={{ display: "block", marginBottom: 12, maxWidth: 320 }}>
        Responsável na importação
        <input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} placeholder={defaultResp} />
      </label>

      <div style={{ marginBottom: 16, display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
        <span style={{ fontWeight: 600 }}>Modo:</span>
        <label style={{ cursor: "pointer" }}>
          <input type="radio" name="leadImportMode" checked={importMode === "single"} onChange={() => switchMode("single")} /> Um arquivo
        </label>
        <label style={{ cursor: "pointer" }}>
          <input type="radio" name="leadImportMode" checked={importMode === "twoFiles"} onChange={() => switchMode("twoFiles")} /> Dois arquivos
          (PROCV: clientes + telefones)
        </label>
      </div>

      {importMode === "single" ? (
        <>
          <div className="importer-step-row">
            <div className="importer-step">
              <span className="importer-step-num">1</span>
              <div>
                <strong>Modelo</strong>
                <p style={{ fontSize: 13 }}>Mesmo CSV de Clientes (planilha consignado).</p>
                <button type="button" className="cta-lead ripple-btn" onClick={downloadConsignadoTemplate}>
                  Baixar modelo (.csv)
                </button>
              </div>
            </div>
            <div className="importer-divider" />
            <div className="importer-step">
              <span className="importer-step-num">2</span>
              <div style={{ width: "100%" }}>
                <strong>Arquivo CSV</strong>
                <div
                  className="drop-zone"
                  onClick={() => !isParsingCsv && fileRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  style={isParsingCsv ? { opacity: 0.65, pointerEvents: "none" } : undefined}
                >
                  <span className="drop-icon">❄️</span>
                  {isParsingCsv ? (
                    <span>Processando arquivo…</span>
                  ) : fileName ? (
                    <strong>{fileName}</strong>
                  ) : (
                    <span>Clique para escolher o .csv</span>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f)
                      readCsv(f, (parsed) => {
                        setFileName(f.name);
                        setRows(parsed);
                      });
                    e.target.value = "";
                  }}
                />
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div
            style={{
              marginBottom: 16,
              padding: "12px 14px",
              borderRadius: 8,
              background: "var(--card-bg-elevated, rgba(255,255,255,0.04))",
              border: "1px solid var(--border, rgba(255,255,255,0.08))",
              fontSize: 14,
              lineHeight: 1.55,
            }}
          >
            <strong style={{ display: "block", marginBottom: 6 }}>Como PROCV no Excel</strong>
            Uma planilha com os <strong>dados do cliente</strong> e outra só com <strong>telefones</strong> (mesmo CPF). O CRM junta por CPF e
            mostra <strong>uma tabela só</strong> com tudo — é o que vira lead na base fria.
          </div>
          <div className="importer-step-row">
            <div className="importer-step">
              <span className="importer-step-num">1</span>
              <div style={{ width: "100%" }}>
                <strong>Planilha — dados do cliente</strong>
                <small style={{ display: "block", marginTop: 4, opacity: 0.85 }}>CPF, nome, margens, cidade…</small>
              <div
                className="drop-zone"
                onClick={() => !isParsingCsv && fileRefA.current?.click()}
                role="button"
                tabIndex={0}
                style={isParsingCsv ? { opacity: 0.65, pointerEvents: "none" } : undefined}
              >
                {isParsingCsv ? <span>Processando…</span> : fileNameA ? <strong>{fileNameA}</strong> : <span>CSV 1</span>}
              </div>
              <input
                ref={fileRefA}
                type="file"
                accept=".csv,text/csv"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f)
                    readCsv(f, (parsed) => {
                      setFileNameA(f.name);
                      setRowsA(parsed);
                    });
                  e.target.value = "";
                }}
              />
            </div>
          </div>
          <div className="importer-divider" />
          <div className="importer-step">
            <span className="importer-step-num">2</span>
            <div style={{ width: "100%" }}>
              <strong>Planilha — só telefones</strong>
              <small style={{ display: "block", marginTop: 4, opacity: 0.85 }}>CPF + LEMIT / telefones</small>
              <div
                className="drop-zone"
                onClick={() => !isParsingCsv && fileRefB.current?.click()}
                role="button"
                tabIndex={0}
                style={isParsingCsv ? { opacity: 0.65, pointerEvents: "none" } : undefined}
              >
                {isParsingCsv ? <span>Processando…</span> : fileNameB ? <strong>{fileNameB}</strong> : <span>CSV 2</span>}
              </div>
              <input
                ref={fileRefB}
                type="file"
                accept=".csv,text/csv"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f)
                    readCsv(f, (parsed) => {
                      setFileNameB(f.name);
                      setRowsB(parsed);
                    });
                  e.target.value = "";
                }}
              />
            </div>
          </div>
        </div>
        </>
      )}

      {showSinglePreview && rows && (
        <div className="importer-preview" style={{ marginTop: 16 }}>
          <div className="importer-preview-header">
            <div>
              <h4>Pré-visualização · {importableCount} lead(s) com CPF importável</h4>
              {importableCount > IMPORT_PREVIEW_MAX_ROWS && (
                <p style={{ fontSize: 13, marginTop: 8, color: "var(--muted, #64748b)" }}>
                  Mostrando as primeiras {IMPORT_PREVIEW_MAX_ROWS} na tabela. A importação envia <strong>todos</strong> os CPFs válidos.
                </p>
              )}
            </div>
            <div className="importer-preview-actions">
              <button type="button" className="btn-ghost" onClick={handleCancel}>
                Cancelar
              </button>
              <button
                type="button"
                className="cta-lead ripple-btn"
                onClick={() => void handleImport()}
                disabled={isImporting || importableCount === 0}
              >
                {isImporting ? "Importando..." : `Importar ${importableCount} lead(s)`}
              </button>
            </div>
          </div>
          <div className="importer-table-wrap">
            <table className="table importer-table">
              <thead>
                <tr>
                  <th>CPF</th>
                  <th>Nome</th>
                  <th>Telefone</th>
                  <th>Notas</th>
                </tr>
              </thead>
              <tbody>
                {singlePreviewRows.map((row) => {
                  const lead = coldLeadFromParsedRow(row, responsavel.trim() || defaultResp);
                  return (
                    <tr key={row.rowNum}>
                      <td style={{ fontFamily: "ui-monospace", fontSize: 12 }}>{lead.cpf || "—"}</td>
                      <td>{lead.nome}</td>
                      <td>{lead.telefone || "—"}</td>
                      <td style={{ fontSize: 12 }}>{lead.notasImportacao || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showTwoPreview && (
        <div className="importer-preview" style={{ marginTop: 16 }}>
          <div className="importer-preview-header">
            <div>
              <h4>Resultado único (PROCV por CPF) · {mergedCount} lead(s)</h4>
              <p style={{ fontSize: 13, marginTop: 8, color: "var(--muted, #64748b)" }}>
                Uma linha = dados do cliente + telefones da outra planilha. Role a tabela na horizontal para ver todas as colunas. Pode baixar
                o CSV mesclado antes de importar.
              </p>
              {mergedCount > IMPORT_PREVIEW_MAX_ROWS && (
                <p style={{ fontSize: 13, marginTop: 8, color: "var(--muted, #64748b)" }}>
                  Mostrando as primeiras {IMPORT_PREVIEW_MAX_ROWS} na tabela. A importação grava <strong>todos</strong>.
                </p>
              )}
            </div>
            <div className="importer-preview-actions">
              <button type="button" className="btn-ghost" onClick={handleCancel}>
                Cancelar
              </button>
              {mergedTwoFiles && mergedTwoFiles.length > 0 && (
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => downloadMergedConsignadoBaseCsv(mergedTwoFiles, "base_fria_organizada.csv")}
                >
                  Baixar base única (.csv)
                </button>
              )}
              <button
                type="button"
                className="cta-lead ripple-btn"
                onClick={() => void handleImport()}
                disabled={isImporting}
              >
                {isImporting ? "Importando..." : `Importar ${mergedCount} lead(s)`}
              </button>
            </div>
          </div>
          <MergedConsignadoPreviewTable rows={mergedWidePreviewRows} />
        </div>
      )}
    </div>
  );
}
