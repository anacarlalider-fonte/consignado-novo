import type { NewClient } from "../data/mock-data";

function fmtBrDate(iso: string | undefined): string {
  if (!iso) return "—";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return iso;
}

function money(n: number | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Pré-visualização do resultado da junção por CPF (equivalente a PROCV no Excel):
 * dados da base + telefones da 2ª planilha em **uma** linha por cliente.
 */
export function MergedConsignadoPreviewTable({ rows }: { rows: NewClient[] }) {
  return (
    <div className="importer-table-wrap" style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
      <table className="table importer-table" style={{ fontSize: 12, minWidth: 1600 }}>
        <thead>
          <tr>
            <th>#</th>
            <th>CPF</th>
            <th>Nome</th>
            <th>NB</th>
            <th>Data nasc.</th>
            <th>Idade</th>
            <th>Espécie</th>
            <th>Telefone 1</th>
            <th>Telefone 2</th>
            <th>Telefone 3</th>
            <th>Valor salário</th>
            <th>Margem 35%</th>
            <th>Margem RMC</th>
            <th>Margem RCC</th>
            <th>Vlr lib. 35%</th>
            <th>Vlr lib. RMC</th>
            <th>Vlr lib. RCC</th>
            <th>Total</th>
            <th>Cidade</th>
            <th>UF</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((data, i) => {
            const uf = (data.estado || "").trim().slice(0, 2).toUpperCase();
            return (
              <tr key={`${data.cpf}-${i}`}>
                <td>{i + 1}</td>
                <td style={{ fontFamily: "ui-monospace, monospace", whiteSpace: "nowrap" }}>{data.cpf || "—"}</td>
                <td style={{ maxWidth: 180 }}>{data.nome || "—"}</td>
                <td style={{ whiteSpace: "nowrap" }}>{data.matriculaNb || "—"}</td>
                <td>{fmtBrDate(data.dataNascimento)}</td>
                <td>{data.idadeRef != null ? String(data.idadeRef) : "—"}</td>
                <td style={{ maxWidth: 120 }}>{data.especieBeneficio || "—"}</td>
                <td style={{ maxWidth: 130 }}>{data.telefone || "—"}</td>
                <td style={{ maxWidth: 130 }}>{data.telefone2 || "—"}</td>
                <td style={{ maxWidth: 130 }}>{data.telefone3 || "—"}</td>
                <td>{money(data.salarioBrutoReferencia)}</td>
                <td>{money(data.margemPct35)}</td>
                <td>{money(data.margemRmc)}</td>
                <td>{money(data.margemRcc)}</td>
                <td>{money(data.vlrLiberado35)}</td>
                <td>{money(data.vlrLiberadoRmc)}</td>
                <td>{money(data.vlrLiberadoRcc)}</td>
                <td>{money(data.totalLiberado)}</td>
                <td>{data.cidade || "—"}</td>
                <td>{uf.length === 2 ? uf : data.estado || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
