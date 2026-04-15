import { useMemo, useRef, useState } from "react";
import { normalizeCpf, type NewClient } from "../data/mock-data";
import {
  parseCSV,
  mergeConsignadoRowsByCpf,
  parsedRowsForCpfMerge,
  downloadMergedConsignadoBaseCsv,
  IMPORT_PREVIEW_MAX_ROWS,
  type ParsedRow,
  LEGACY_COLUMNS,
  downloadConsignadoTemplate,
} from "../utils/consignado-csv";
import { useCRM } from "../state/crm-context";
import { useToast } from "../state/toast-context";
import { MergedConsignadoPreviewTable } from "./MergedConsignadoPreviewTable";

const LEGACY_HEADER = LEGACY_COLUMNS.map((c) => c.label).join(";");
const LEGACY_TEMPLATE_ROWS = [
  "Maria Silva;(18) 99999-0001;;;maria@exemplo.com;17500-000;Rua das Flores;42;Apto 3;Centro;Marilia;SP;Cliente VIP",
  "Joao Pereira;(11) 98888-1234;(11) 97777-0000;;;Av. Brasil;100;;;Sao Paulo;SP;",
];
const LEGACY_TEMPLATE_CSV = [LEGACY_HEADER, ...LEGACY_TEMPLATE_ROWS].join("\n");

function downloadTemplateLegacy() {
  const bom = "\uFEFF";
  const blob = new Blob([bom + LEGACY_TEMPLATE_CSV], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "modelo_importacao_clientes.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/* ─── component ─────────────────────────────────────────────────────────── */
type ImportMode = "single" | "twoFiles";

export function ClientImporter({ onDone }: { onDone?: () => void }) {
  const { addClientsBatch, upsertClientsBatch } = useCRM();
  const { pushToast } = useToast();

  const [importMode, setImportMode] = useState<ImportMode>("single");
  const fileRef = useRef<HTMLInputElement>(null);
  const fileRefA = useRef<HTMLInputElement>(null);
  const fileRefB = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [rowsA, setRowsA] = useState<ParsedRow[] | null>(null);
  const [rowsB, setRowsB] = useState<ParsedRow[] | null>(null);
  const [fileNameA, setFileNameA] = useState("");
  const [fileNameB, setFileNameB] = useState("");
  const [mergeExistingSingle, setMergeExistingSingle] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isParsingCsv, setIsParsingCsv] = useState(false);
  const [detectedMode, setDetectedMode] = useState<"legacy" | "consignado" | null>(null);

  const mergedTwoFiles = useMemo(() => {
    if (!rowsA || !rowsB) return null;
    const va = parsedRowsForCpfMerge(rowsA);
    const vb = parsedRowsForCpfMerge(rowsB);
    if (va.length === 0 && vb.length === 0) return [];
    return mergeConsignadoRowsByCpf(va, vb);
  }, [rowsA, rowsB]);

  function readCsvFile(file: File, onParsed: (parsed: ParsedRow[], name: string) => void) {
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
          onParsed(parsed, file.name);
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

  function handleFile(file: File) {
    readCsvFile(file, (parsed, name) => {
      setFileName(name);
      setDetectedMode(parsed[0]?.mode ?? null);
      setRows(parsed);
    });
  }

  function handleFileA(file: File) {
    readCsvFile(file, (parsed, name) => {
      setFileNameA(name);
      setRowsA(parsed);
    });
  }

  function handleFileB(file: File) {
    readCsvFile(file, (parsed, name) => {
      setFileNameB(name);
      setRowsB(parsed);
    });
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  function switchMode(next: ImportMode) {
    setImportMode(next);
    setRows(null);
    setFileName("");
    setRowsA(null);
    setRowsB(null);
    setFileNameA("");
    setFileNameB("");
    setDetectedMode(null);
    setMergeExistingSingle(false);
  }

  async function handleImport() {
    try {
      setIsImporting(true);
      if (importMode === "twoFiles") {
        if (!rowsA || !rowsB) {
          pushToast("error", "Selecione os dois arquivos (base e complemento).");
          return;
        }
        const modeA = rowsA[0]?.mode;
        const modeB = rowsB[0]?.mode;
        if (modeA !== "consignado" || modeB !== "consignado") {
          pushToast("error", "O modo dois arquivos exige CSV no formato consignado (coluna CPF) nos dois.");
          return;
        }
        const merged = mergeConsignadoRowsByCpf(parsedRowsForCpfMerge(rowsA), parsedRowsForCpfMerge(rowsB));
        if (merged.length === 0) {
          pushToast("error", "Nenhuma linha válida após juntar os arquivos.");
          return;
        }
        const { added, merged: upd } = await upsertClientsBatch(merged);
        pushToast("success", `${added} novo(s), ${upd} mesclado(s) na base (CPF).`);
        setRowsA(null);
        setRowsB(null);
        setFileNameA("");
        setFileNameB("");
        onDone?.();
        return;
      }
      if (!rows) return;
      const mode = rows[0]?.mode;
      let batch: NewClient[];
      if (mode === "consignado") {
        const list = rows.filter(
          (r) => r.mode === "consignado" && normalizeCpf((r.data as NewClient).cpf).length === 11
        );
        if (list.length === 0) {
          pushToast("error", "Nenhuma linha com CPF válido (11 dígitos).");
          return;
        }
        batch = list.map((r) => {
          const nc = { ...(r.data as NewClient) };
          if (r.errors.length > 0) {
            const tag = `Linha ${r.rowNum} (importação): ${r.errors.join("; ")}`;
            nc.observacoes = nc.observacoes?.trim() ? `${nc.observacoes}\n\n${tag}` : tag;
          }
          return nc;
        });
      } else {
        batch = rows.filter((r) => r.valid).map((r) => r.data as NewClient);
        if (batch.length === 0) {
          pushToast("error", "Nenhuma linha válida para importar.");
          return;
        }
      }
      if (mergeExistingSingle) {
        const { added, merged: upd } = await upsertClientsBatch(batch);
        pushToast("success", `${added} novo(s), ${upd} atualizado(s) por CPF.`);
      } else {
        const count = await addClientsBatch(batch);
        pushToast("success", `${count} cliente(s) importado(s).`);
      }
      setRows(null);
      setFileName("");
      setDetectedMode(null);
      onDone?.();
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Falha ao importar clientes.");
    } finally {
      setIsImporting(false);
    }
  }

  function handleCancel() {
    if (importMode === "twoFiles") {
      setRowsA(null);
      setRowsB(null);
      setFileNameA("");
      setFileNameB("");
    } else {
      setRows(null);
      setFileName("");
      setDetectedMode(null);
    }
  }

  const validCount = rows ? rows.filter((r) => r.valid).length : 0;
  const errorCount = rows ? rows.filter((r) => !r.valid).length : 0;
  const errA = rowsA ? rowsA.filter((r) => !r.valid).length : 0;
  const errB = rowsB ? rowsB.filter((r) => !r.valid).length : 0;
  const validA = rowsA ? rowsA.filter((r) => r.valid).length : 0;
  const validB = rowsB ? rowsB.filter((r) => r.valid).length : 0;

  const mergedCount = mergedTwoFiles?.length ?? 0;
  const showTwoPreview = importMode === "twoFiles" && rowsA && rowsB && mergedTwoFiles !== null && mergedCount > 0;
  const showSinglePreview = importMode === "single" && rows;
  const previewRowsSingle = rows && rows.length > IMPORT_PREVIEW_MAX_ROWS ? rows.slice(0, IMPORT_PREVIEW_MAX_ROWS) : rows;
  const previewMerged =
    mergedTwoFiles && mergedTwoFiles.length > IMPORT_PREVIEW_MAX_ROWS
      ? mergedTwoFiles.slice(0, IMPORT_PREVIEW_MAX_ROWS)
      : mergedTwoFiles;

  return (
    <div className="importer-wrap">
      <div style={{ marginBottom: 16, display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
        <span style={{ fontWeight: 600 }}>Modo:</span>
        <label style={{ cursor: "pointer" }}>
          <input
            type="radio"
            name="importMode"
            checked={importMode === "single"}
            onChange={() => switchMode("single")}
          />{" "}
          Um arquivo
        </label>
        <label style={{ cursor: "pointer" }}>
          <input
            type="radio"
            name="importMode"
            checked={importMode === "twoFiles"}
            onChange={() => switchMode("twoFiles")}
          />{" "}
          Dois arquivos (PROCV: clientes + telefones)
        </label>
      </div>

      {importMode === "single" ? (
        <>
          <div className="importer-step-row">
            <div className="importer-step">
              <span className="importer-step-num">1</span>
              <div>
                <strong>Baixe o modelo</strong>
                <p>
                  <strong>Consignado (margem / NB):</strong> CPF, NB, NOME, 3 telefones, margens…
                </p>
                <button type="button" className="cta-lead ripple-btn" onClick={downloadConsignadoTemplate} style={{ marginBottom: 8 }}>
                  Modelo planilha consignado (.csv)
                </button>
                <p style={{ marginTop: 8, fontSize: 13, opacity: 0.9 }}>
                  <strong>Ou formato antigo</strong> (nome + telefone + endereço):
                </p>
                <button type="button" className="btn-ghost" onClick={downloadTemplateLegacy}>
                  Modelo legado (.csv)
                </button>
              </div>
            </div>

            <div className="importer-divider" />

            <div className="importer-step">
              <span className="importer-step-num">2</span>
              <div style={{ width: "100%" }}>
                <strong>Selecione ou arraste o arquivo</strong>
                <div
                  className={`drop-zone ${isDragging ? "drop-zone-active" : ""}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={onDrop}
                  onClick={() => !isParsingCsv && fileRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && !isParsingCsv && fileRef.current?.click()}
                  style={isParsingCsv ? { opacity: 0.65, pointerEvents: "none" } : undefined}
                >
                  <span className="drop-icon">📂</span>
                  {isParsingCsv ? (
                    <span>Processando arquivo… (bases grandes podem levar alguns segundos)</span>
                  ) : fileName ? (
                    <span>
                      <strong>{fileName}</strong>
                    </span>
                  ) : (
                    <span>Clique ou arraste o arquivo .csv aqui</span>
                  )}
                  <small>Separador: ponto e vírgula ( ; ) · UTF-8 · detecção automática do formato</small>
                </div>
                <label style={{ display: "block", marginTop: 10, fontSize: 13, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={mergeExistingSingle}
                    onChange={(e) => setMergeExistingSingle(e.target.checked)}
                  />{" "}
                  Mesclar com cadastro existente (mesmo CPF) — use ao importar só a 2ª parte depois da base
                </label>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  style={{ display: "none" }}
                  onChange={onFileChange}
                />
              </div>
            </div>
          </div>

          {!rows && (
            <div className="importer-legend">
              <strong>Formato consignado (21 colunas):</strong>
              <p style={{ fontSize: 13, margin: "8px 0", lineHeight: 1.5 }}>
                CPF · NB · NOME · DATA NASC · DDD · IDADE · ESPÉCIE · VALOR SALÁRIO · MARGEM 35% · MARGEM RMC · MARGEM RCC · VLR
                LIBERADO 35% · VLR LIBERADO RMC · VLR LIBERADO RCC · TOTAL · CIDADE · ESTADO · UF · TELEFONE 1 · TELEFONE 2 · TELEFONE 3
                (DDD pode ser repetido na linha; telefones só com 8–9 dígitos são unidos ao DDD)
              </p>
              <small>Valores monetários: use vírgula decimal (ex.: 3500,00). Datas: dd/mm/aaaa.</small>
            </div>
          )}
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
            Uma planilha tem os <strong>dados do cliente</strong> (nome, margens, cidade…). A outra tem só os <strong>telefones</strong> (CPF
            igual). O CRM localiza pelo CPF e <strong>junta tudo numa linha só</strong>. Abaixo aparece <strong>uma única tabela</strong> com o
            resultado completo — é isso que será gravado no cadastro. Detalhes extras do LEMIT ficam nas observações do cliente.
          </div>
          <div className="importer-step-row">
            <div className="importer-step">
              <span className="importer-step-num">1</span>
              <div style={{ width: "100%" }}>
                <strong>Planilha — dados do cliente</strong>
                <small style={{ display: "block", marginTop: 4, opacity: 0.85 }}>
                  CPF, nome, NB, margens, valores, cidade… (pode vir sem telefone)
                </small>
                <div
                  className="drop-zone"
                  onClick={() => !isParsingCsv && fileRefA.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && !isParsingCsv && fileRefA.current?.click()}
                  style={isParsingCsv ? { opacity: 0.65, pointerEvents: "none" } : undefined}
                >
                  <span className="drop-icon">📄</span>
                  {isParsingCsv ? (
                    <span>Processando…</span>
                  ) : fileNameA ? (
                    <strong>{fileNameA}</strong>
                  ) : (
                    <span>CSV com CPF, NOME, margens…</span>
                  )}
                </div>
                <input
                  ref={fileRefA}
                  type="file"
                  accept=".csv,text/csv"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileA(f);
                    e.target.value = "";
                  }}
                />
                {rowsA && (
                  <small style={{ display: "block", marginTop: 6 }}>
                    {validA} válida(s){errA > 0 ? ` · ${errA} com erro` : ""}
                  </small>
                )}
              </div>
            </div>
            <div className="importer-divider" />
            <div className="importer-step">
              <span className="importer-step-num">2</span>
              <div style={{ width: "100%" }}>
                <strong>Planilha — só telefones</strong>
                <small style={{ display: "block", marginTop: 4, opacity: 0.85 }}>
                  CPF + telefones (LEMIT ou colunas TELEFONE 1/2/3)
                </small>
                <div
                  className="drop-zone"
                  onClick={() => !isParsingCsv && fileRefB.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && !isParsingCsv && fileRefB.current?.click()}
                  style={isParsingCsv ? { opacity: 0.65, pointerEvents: "none" } : undefined}
                >
                  <span className="drop-icon">📱</span>
                  {isParsingCsv ? (
                    <span>Processando…</span>
                  ) : fileNameB ? (
                    <strong>{fileNameB}</strong>
                  ) : (
                    <span>CSV com CPF + telefones (pode omitir NOME)</span>
                  )}
                </div>
                <input
                  ref={fileRefB}
                  type="file"
                  accept=".csv,text/csv"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileB(f);
                    e.target.value = "";
                  }}
                />
                {rowsB && (
                  <small style={{ display: "block", marginTop: 6 }}>
                    {validB} válida(s){errB > 0 ? ` · ${errB} com erro` : ""}
                  </small>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {showSinglePreview && rows && (
        <div className="importer-preview">
          <div className="importer-preview-header">
            <div>
              <h4>
                Pré-visualização · {rows.length} linha(s) · formato{" "}
                <strong>{detectedMode === "consignado" ? "consignado" : "legado"}</strong>
              </h4>
              <p>
                <span className="badge-ok">{validCount} válidas</span>
                {errorCount > 0 && <span className="badge-err">{errorCount} com erro</span>}
                {errorCount > 0 && <span> — linhas com erro não serão importadas</span>}
              </p>
              {rows && rows.length > IMPORT_PREVIEW_MAX_ROWS && (
                <p style={{ fontSize: 13, marginTop: 8, color: "var(--muted, #64748b)" }}>
                  Mostrando as primeiras {IMPORT_PREVIEW_MAX_ROWS} de {rows.length} linhas na tabela. A importação envia{" "}
                  <strong>todas</strong> as linhas válidas.
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
                disabled={isImporting || validCount === 0}
              >
                {isImporting ? "Importando..." : mergeExistingSingle ? `Mesclar ${validCount} linha(s)` : `Importar ${validCount} cliente(s)`}
              </button>
            </div>
          </div>

          <div className="importer-table-wrap">
            <table className="table importer-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>CPF / Nome</th>
                  <th>NB</th>
                  <th>Telefones</th>
                  <th>Cidade / UF</th>
                  <th>Salário / Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(previewRowsSingle ?? rows).map((row) => (
                  <tr key={row.rowNum} className={row.valid ? "" : "row-err"}>
                    <td>{row.rowNum}</td>
                    <td>
                      {row.mode === "consignado" ? (
                        <>
                          <small style={{ opacity: 0.8 }}>{(row.data as NewClient).cpf || "—"}</small>
                          <br />
                          <strong>{row.data.nome || "—"}</strong>
                        </>
                      ) : (
                        <strong>{row.data.nome || "—"}</strong>
                      )}
                    </td>
                    <td>{row.mode === "consignado" ? (row.data as NewClient).matriculaNb || "—" : "—"}</td>
                    <td style={{ fontSize: 12, maxWidth: 200 }}>
                      {[
                        row.data.telefone,
                        (row.data as NewClient).telefone2,
                        (row.data as NewClient).telefone3,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </td>
                    <td>
                      {[row.data.cidade, row.data.estado].filter(Boolean).join(" / ") || "—"}
                    </td>
                    <td>
                      {row.mode === "consignado" ? (
                        <>
                          {(row.data as NewClient).salarioBrutoReferencia != null
                            ? `R$ ${Number((row.data as NewClient).salarioBrutoReferencia).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                            : "—"}
                          <br />
                          <small>
                            Total:{" "}
                            {(row.data as NewClient).totalLiberado != null
                              ? `R$ ${Number((row.data as NewClient).totalLiberado).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                              : "—"}
                          </small>
                        </>
                      ) : (
                        [row.data.endereco, row.data.numero].filter(Boolean).join(", ") || "—"
                      )}
                    </td>
                    <td>
                      {row.valid ? (
                        <span className="badge-ok">✓ OK</span>
                      ) : (
                        <span className="badge-err" title={row.errors.join(", ")}>
                          ✕ {row.errors.join("; ")}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showTwoPreview && mergedTwoFiles && (
        <div className="importer-preview">
          <div className="importer-preview-header">
            <div>
              <h4>Resultado único (PROCV por CPF) · {mergedCount} cliente(s)</h4>
              <p style={{ fontSize: 13 }}>
                Planilha dados: {validA} linha(s) válida(s) · Planilha telefones: {validB} · <strong>CPFs únicos na tela:</strong>{" "}
                {mergedCount}
              </p>
              <p style={{ fontSize: 13, marginTop: 8, color: "var(--muted, #64748b)" }}>
                Esta é a <strong>única tabela</strong> com cliente + telefones juntos (role horizontal se precisar). Pode baixar o mesmo
                conteúdo em CSV antes de importar.
              </p>
              {mergedCount > IMPORT_PREVIEW_MAX_ROWS && (
                <p style={{ fontSize: 13, marginTop: 8, color: "var(--muted, #64748b)" }}>
                  Mostrando as primeiras {IMPORT_PREVIEW_MAX_ROWS} de {mergedCount} cliente(s) na tabela. A importação grava{" "}
                  <strong>todos</strong>.
                </p>
              )}
            </div>
            <div className="importer-preview-actions">
              <button type="button" className="btn-ghost" onClick={handleCancel}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => mergedTwoFiles && downloadMergedConsignadoBaseCsv(mergedTwoFiles)}
                disabled={mergedCount === 0}
              >
                Baixar base única (.csv)
              </button>
              <button
                type="button"
                className="cta-lead ripple-btn"
                onClick={() => void handleImport()}
                disabled={isImporting || mergedCount === 0}
              >
                {isImporting ? "Importando..." : `Importar ${mergedCount} cliente(s) mesclado(s)`}
              </button>
            </div>
          </div>

          <MergedConsignadoPreviewTable rows={(previewMerged ?? mergedTwoFiles) ?? []} />
        </div>
      )}
    </div>
  );
}
