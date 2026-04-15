import * as pdfjsLib from "pdfjs-dist";
// Worker URL bundled by Vite — version always matches pdfjs-dist
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

type TextItem = { str: string; transform: number[] };

/** Rebuild reading order: sort by Y (top→bottom in PDF space), then X, group into lines. */
function textItemsToLines(items: TextItem[]): string[] {
  if (items.length === 0) return [];
  const sorted = [...items].sort((a, b) => {
    const ay = a.transform[5] ?? 0;
    const by = b.transform[5] ?? 0;
    if (Math.abs(ay - by) > 3) return by - ay;
    const ax = a.transform[4] ?? 0;
    const bx = b.transform[4] ?? 0;
    return ax - bx;
  });

  const lines: string[] = [];
  let buf: string[] = [];
  let lastY: number | null = null;
  const yTol = 4;

  for (const it of sorted) {
    const y = it.transform[5] ?? 0;
    if (lastY !== null && Math.abs(y - lastY) > yTol) {
      lines.push(buf.join(" ").replace(/\s+/g, " ").trim());
      buf = [];
    }
    const s = (it.str ?? "").trim();
    if (s) buf.push(s);
    lastY = y;
  }
  if (buf.length) lines.push(buf.join(" ").replace(/\s+/g, " ").trim());
  return lines.filter(Boolean);
}

/**
 * pdf.js often outputs one long line per page; o parser do relatório espera uma linha lógica por campo.
 * Insert newlines before known field starts (same structure as copy-paste from Chrome).
 */
export function injectKatoFieldLineBreaks(raw: string): string {
  let s = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  s = s.replace(/([^\n])\s*(?=Nome:\s*\d)/gi, "$1\n");
  s = s.replace(/([^\n])\s*(?=Endere[çc]o:)/gi, "$1\n");
  s = s.replace(/([^\n])\s*(?=Bairro:)/gi, "$1\n");
  s = s.replace(/([^\n])\s*(?=CNPJ:)/gi, "$1\n");
  s = s.replace(/([^\n])\s*(?=IE:)/gi, "$1\n");
  return s;
}

export async function extractTextFromPdfBuffer(data: ArrayBuffer): Promise<string> {
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(data), verbosity: 0 }).promise;
  const pageTexts: string[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items = content.items as TextItem[];
    const lines = textItemsToLines(items);
    pageTexts.push(lines.join("\n"));
  }

  const joined = pageTexts.join("\n");
  return injectKatoFieldLineBreaks(joined);
}
