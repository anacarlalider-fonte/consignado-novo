// v3
/**
 * Importador do "Relatório de Cliente Analítico" exportado pelo ERP de origem.
 *
 * Formato esperado (5 linhas por cliente):
 *   Nome: [ID] [NOME] Abreviatura/Fantasia: [FANTASIA]
 *   Endereço: [RUA] , [NÚMERO] [COMPLEMENTO] Cidade: [CIDADE]
 *   Bairro: [BAIRRO] CEP:[CEP] CEP: [CEP] Fone/FAX: [TELEFONE]
 *   CNPJ: [CNPJ] CPF: [CPF] E-mail: [EMAIL]
 *   IE: [IE] RG: [RG] Contato: Classificação: [CLASS]
 */

import { useRef, useState } from "react";
import type { NewClient } from "../data/mock-data";
import { useCRM } from "../state/crm-context";
import { useToast } from "../state/toast-context";
import { extractTextFromPdfBuffer, injectKatoFieldLineBreaks } from "../utils/extract-pdf-text";

/* ─── CEP → UF ──────────────────────────────────────────────────────────── */

function cepToUF(cep: string): string {
  const n = parseInt(cep.replace(/\D/g, "").slice(0, 5), 10);
  if (n >= 1000 && n <= 19999) return "SP";
  if (n >= 20000 && n <= 28999) return "RJ";
  if (n >= 29000 && n <= 29999) return "ES";
  if (n >= 30000 && n <= 39999) return "MG";
  if (n >= 40000 && n <= 48999) return "BA";
  if (n >= 49000 && n <= 49999) return "SE";
  if (n >= 50000 && n <= 56999) return "PE";
  if (n >= 57000 && n <= 57999) return "AL";
  if (n >= 58000 && n <= 58999) return "PB";
  if (n >= 59000 && n <= 59999) return "RN";
  if (n >= 60000 && n <= 63999) return "CE";
  if (n >= 64000 && n <= 64999) return "PI";
  if (n >= 65000 && n <= 65999) return "MA";
  if (n >= 66000 && n <= 68899) return "PA";
  if (n >= 68900 && n <= 68999) return "AP";
  if (n >= 69000 && n <= 69899) return "AM";
  if (n >= 69900 && n <= 69999) return "AC";
  if (n >= 70000 && n <= 72799) return "DF";
  if (n >= 72800 && n <= 73699) return "GO";
  if (n >= 73700 && n <= 76799) return "GO";
  if (n >= 76800 && n <= 76999) return "RO";
  if (n >= 77000 && n <= 77999) return "TO";
  if (n >= 78000 && n <= 78999) return "MT";
  if (n >= 79000 && n <= 79999) return "MS";
  if (n >= 80000 && n <= 87999) return "PR";
  if (n >= 88000 && n <= 89999) return "SC";
  if (n >= 90000 && n <= 99999) return "RS";
  if (n >= 69300 && n <= 69399) return "RR";
  return "";
}

/* ─── Parser ─────────────────────────────────────────────────────────────── */

type ParseResult = {
  rowNum: number;
  data: NewClient;
  errors: string[];
  valid: boolean;
};

const SKIP_PATTERNS = [
  /^RELAT[ÓO]RIO DE CLIENTE/i,
  /^KATO MOVEIS/i,
  /^Cidade:\s*Regi[ãa]o:/i,
  /^--\s*\d+\s*of\s*\d+\s*--/,
];

function isSkipLine(line: string): boolean {
  return SKIP_PATTERNS.some((p) => p.test(line));
}

function parseText(rawText: string): ParseResult[] {
  const results: ParseResult[] = [];

  const lines = rawText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.trim());

  const dataLines = lines.filter((l) => l.length > 0 && !isSkipLine(l));

  let rowNum = 0;
  let i = 0;

  while (i < dataLines.length) {
    const line1 = dataLines[i];

    if (!/^Nome:\s*\d/i.test(line1)) {
      i++;
      continue;
    }

    const line2 = dataLines[i + 1] ?? "";
    const line3 = dataLines[i + 2] ?? "";
    const line4 = dataLines[i + 3] ?? "";
    i += 5; // 5 lines per client block (including IE/RG line)
    rowNum++;

    const errors: string[] = [];

    /* Line 1: Nome */
    const nomeMatch = line1.match(/^Nome:\s*\d+\s+(.+?)\s+Abreviatura\/Fantasia:/i);
    const nome = nomeMatch ? nomeMatch[1].trim() : "";
    if (!nome) errors.push("nome não encontrado");

    /* Line 2: Endereço */
    let endereco = "", numero = "", complemento = "", cidade = "";
    const endMatch = line2.match(/^Endere[çc]o:\s*(.*?)\s*,\s*([\d\w/-]*)\s*(.*?)\s*Cidade:\s*(.+)$/i);
    if (endMatch) {
      endereco    = endMatch[1].trim();
      numero      = endMatch[2].trim();
      complemento = endMatch[3].trim();
      cidade      = endMatch[4].trim();
    }

    /* Line 3: Bairro, CEP, Fone */
    let bairro = "", cep = "", telefone = "";
    const bairroMatch = line3.match(/^Bairro:\s*(.+?)\s+CEP:(\d+)\s+CEP:\s*\d+\s+Fone\/FAX:\s*(.*)$/i);
    if (bairroMatch) {
      bairro   = bairroMatch[1].trim();
      cep      = bairroMatch[2].trim();
      telefone = bairroMatch[3].trim().replace(/\s+/g, " ").split(/(?<=\d)\s*(?=\()/)[0].trim();
    } else {
      // Handle case where Fone/FAX is empty
      const bairroMatch2 = line3.match(/^Bairro:\s*(.+?)\s+CEP:(\d+)\s+CEP:\s*\d+\s+Fone\/FAX:\s*$/i);
      if (bairroMatch2) {
        bairro = bairroMatch2[1].trim();
        cep    = bairroMatch2[2].trim();
      }
    }

    const estado = cep ? cepToUF(cep) : "";

    /* Line 4: E-mail */
    let email = "";
    const emailMatch = line4.match(/E-mail:\s*(\S+@\S+)/i);
    if (emailMatch) {
      email = emailMatch[1].trim();
    }

    results.push({
      rowNum,
      data: { nome, telefone, email, endereco, numero, complemento, bairro, cidade, estado, cep, observacoes: "" },
      errors,
      valid: errors.length === 0,
    });
  }

  return results;
}

/* ─── Component ─────────────────────────────────────────────────────────── */

export function PdfImporter({ onDone }: { onDone?: () => void }) {
  const { addClientsBatch } = useCRM();
  const { pushToast } = useToast();

  const fileRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [rows, setRows] = useState<ParseResult[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [tab, setTab] = useState<"upload" | "paste">("upload");

  async function tryReadFile(file: File) {
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".pdf")) {
      pushToast("error", "Selecione um arquivo .pdf");
      return;
    }
    setFileName(file.name);
    setIsLoading(true);

    try {
      const buf = await file.arrayBuffer();
      let parsed: ParseResult[] = [];

      // 1) pdf.js + worker do próprio pacote (Vite) + linhas por coordenada Y + quebras de campo
      try {
        const text = await extractTextFromPdfBuffer(buf);
        parsed = parseText(text);
      } catch (pdfErr) {
        console.warn("Extração PDF (pdf.js):", pdfErr);
      }

      // 2) PDFs “só texto” (raros): tentar ler como arquivo de texto
      if (parsed.length === 0) {
        let text = await readAsTextLatin1(file);
        if (text.includes("Nome:")) parsed = parseText(injectKatoFieldLineBreaks(text));
      }
      if (parsed.length === 0) {
        const text = await readAsTextUTF8(file);
        if (text.includes("Nome:")) parsed = parseText(injectKatoFieldLineBreaks(text));
      }
      if (parsed.length === 0) {
        const bytes = new Uint8Array(buf);
        const text = extractPrintableText(bytes);
        if (text.includes("Nome:")) parsed = parseText(injectKatoFieldLineBreaks(text));
      }

      if (parsed.length === 0) {
        pushToast("error", "Não foi possível extrair clientes deste PDF. Tente a aba 'Colar texto'.");
        setFileName("");
        return;
      }

      setRows(parsed);
      pushToast("success", `${parsed.length} clientes identificados!`);
    } catch (err) {
      console.error("Erro ao ler PDF:", err);
      pushToast("error", "Erro ao ler o arquivo. Tente a aba 'Colar texto'.");
      setFileName("");
    } finally {
      setIsLoading(false);
    }
  }

  function readAsTextLatin1(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string ?? "");
      reader.onerror = () => resolve("");
      reader.readAsText(file, "latin1");
    });
  }

  function readAsTextUTF8(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string ?? "");
      reader.onerror = () => resolve("");
      reader.readAsText(file, "utf-8");
    });
  }

  function extractPrintableText(bytes: Uint8Array): string {
    const chars: string[] = [];
    for (const b of bytes) {
      if (b === 10 || b === 13) chars.push("\n");
      else if (b >= 32 && b <= 126) chars.push(String.fromCharCode(b));
      else if (b >= 160 && b <= 255) chars.push(String.fromCharCode(b));
      else chars.push(" ");
    }
    return chars.join("");
  }

  function handleAnalysePaste() {
    if (!pasteText.trim()) { pushToast("error", "Cole o texto do PDF primeiro."); return; }
    const parsed = parseText(injectKatoFieldLineBreaks(pasteText));
    if (parsed.length === 0) {
      pushToast("error", "Nenhum cliente encontrado. Verifique o texto colado.");
      return;
    }
    setRows(parsed);
    pushToast("success", `${parsed.length} clientes identificados!`);
  }

  async function handleImport() {
    if (!rows) return;
    const valid = rows.filter((r) => r.valid).map((r) => r.data);
    if (valid.length === 0) { pushToast("error", "Nenhuma linha válida."); return; }
    setIsImporting(true);
    try {
      await addClientsBatch(valid);
      pushToast("success", `${valid.length} clientes importados com sucesso!`);
      setRows(null); setFileName(""); setPasteText("");
      onDone?.();
    } catch (e) {
      pushToast("error", e instanceof Error ? e.message : "Falha ao importar.");
    } finally {
      setIsImporting(false);
    }
  }

  const validCount = rows ? rows.filter((r) => r.valid).length : 0;
  const errorCount = rows ? rows.filter((r) => !r.valid).length : 0;

  return (
    <div className="importer-wrap">
      {/* ── method tabs ── */}
      <div className="pdf-method-tabs">
        <button type="button" className={`pdf-method-btn ${tab === "upload" ? "active" : ""}`} onClick={() => setTab("upload")}>
          📂 Subir o arquivo PDF
        </button>
        <button type="button" className={`pdf-method-btn ${tab === "paste" ? "active" : ""}`} onClick={() => setTab("paste")}>
          📋 Colar o texto
        </button>
      </div>

      {/* ── upload ── */}
      {tab === "upload" && (
        <div>
          <div
            className={`drop-zone ${isDragging ? "drop-zone-active" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) void tryReadFile(f); }}
            onClick={() => fileRef.current?.click()}
            role="button" tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}
          >
            <span className="drop-icon">📄</span>
            {isLoading
              ? <span style={{ color: "var(--primary)" }}>Lendo PDF, aguarde...</span>
              : fileName
                ? <span><strong>{fileName}</strong></span>
                : <span>Clique ou arraste o PDF "Cadastro de Clientes" aqui</span>
            }
            <small>PDF digital gerado pelo sistema ERP de origem</small>
          </div>
          <input ref={fileRef} type="file" accept=".pdf,application/pdf" style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void tryReadFile(f); e.target.value = ""; }}
          />
          <div className="importer-legend" style={{ marginTop: 12 }}>
            <strong>Se o arquivo não for reconhecido:</strong>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>
              Abra o PDF no Chrome/Edge → pressione <kbd>Ctrl+A</kbd> para selecionar tudo →
              <kbd>Ctrl+C</kbd> para copiar → use a aba <strong>"Colar o texto"</strong> ao lado.
            </p>
          </div>
        </div>
      )}

      {/* ── paste ── */}
      {tab === "paste" && (
        <div style={{ display: "grid", gap: 10 }}>
          <div className="importer-legend">
            <strong>Como copiar o texto do PDF:</strong>
            <ol style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 13, color: "var(--muted)", lineHeight: 1.8 }}>
              <li>Abra o PDF no Chrome ou Edge (duplo clique no arquivo)</li>
              <li>Pressione <kbd>Ctrl+A</kbd> para selecionar todo o texto</li>
              <li>Pressione <kbd>Ctrl+C</kbd> para copiar</li>
              <li>Clique na área abaixo e pressione <kbd>Ctrl+V</kbd> para colar</li>
            </ol>
          </div>
          <textarea
            style={{ minHeight: 160, fontFamily: "monospace", fontSize: 12 }}
            placeholder="Cole aqui o texto copiado do PDF..."
            value={pasteText}
            onChange={(e) => { setPasteText(e.target.value); setRows(null); }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button type="button" className="cta-lead ripple-btn" onClick={handleAnalysePaste}>
              Analisar texto
            </button>
          </div>
        </div>
      )}

      {/* ── preview ── */}
      {rows && (
        <div className="importer-preview">
          <div className="importer-preview-header">
            <div>
              <h4>
                {validCount} cliente{validCount !== 1 ? "s" : ""} prontos para importar
                {errorCount > 0 && <span style={{ color: "var(--danger)", marginLeft: 8 }}>· {errorCount} com problema</span>}
              </h4>
              <p>Confira os dados antes de confirmar</p>
            </div>
            <div className="importer-preview-actions">
              <button type="button" className="btn-ghost" onClick={() => { setRows(null); setFileName(""); }}>
                Cancelar
              </button>
              <button
                type="button"
                className="cta-lead ripple-btn"
                onClick={() => void handleImport()}
                disabled={isImporting || validCount === 0}
              >
                {isImporting ? "Importando..." : `Importar ${validCount} clientes`}
              </button>
            </div>
          </div>

          <div className="importer-table-wrap">
            <table className="table importer-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Nome</th>
                  <th>Telefone</th>
                  <th>E-mail</th>
                  <th>Endereço</th>
                  <th>Bairro</th>
                  <th>Cidade / UF</th>
                  <th>CEP</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.rowNum} className={row.valid ? "" : "row-err"}>
                    <td>{row.rowNum}</td>
                    <td><strong>{row.data.nome || <em className="empty">—</em>}</strong></td>
                    <td>{row.data.telefone || <em className="empty">—</em>}</td>
                    <td style={{ fontSize: 12 }}>{row.data.email || <em className="empty">—</em>}</td>
                    <td style={{ fontSize: 12 }}>
                      {[row.data.endereco, row.data.numero, row.data.complemento].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td style={{ fontSize: 12 }}>{row.data.bairro || "—"}</td>
                    <td>{[row.data.cidade, row.data.estado].filter(Boolean).join(" / ") || "—"}</td>
                    <td style={{ fontSize: 12 }}>{row.data.cep || "—"}</td>
                    <td>
                      {row.valid
                        ? <span className="badge-ok">✓ OK</span>
                        : <span className="badge-err" title={row.errors.join(", ")}>✕ {row.errors[0]}</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
