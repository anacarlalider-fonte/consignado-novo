import { useState } from "react";
import { apiPost } from "../services/api";
import { useToast } from "../state/toast-context";

type ImportResult = { imported: number };
type FollowupResult = { processed: number; flagged: number };

export function IntegrationsPage() {
  const { pushToast } = useToast();
  const [csvUrl, setCsvUrl] = useState("");
  const [sheetName, setSheetName] = useState("Pedidos");
  const [loading, setLoading] = useState(false);

  async function importOrders() {
    setLoading(true);
    try {
      const data = await apiPost<ImportResult>("/integrations/google-sheets/import-orders", { csvUrl, sheetName });
      pushToast("success", `Importacao concluida: ${data.imported} registros processados.`);
    } catch {
      pushToast("error", "Falha na importacao. Verifique URL e permissao.");
    } finally {
      setLoading(false);
    }
  }

  async function runFollowupSweep() {
    setLoading(true);
    try {
      const data = await apiPost<FollowupResult>("/automation/followups/run", {});
      pushToast("success", `Automacao executada: ${data.flagged} pedidos sinalizados de ${data.processed}.`);
    } catch {
      pushToast("error", "Falha na automacao de follow-up.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="stack">
      <section>
        <h2>Integracoes</h2>
        <p>Conecte Google Sheets e execute automacoes operacionais.</p>
      </section>
      <section className="stack">
        <h3>Importar pedidos do Google Sheets (CSV publico)</h3>
        <input
          placeholder="https://docs.google.com/spreadsheets/d/.../export?format=csv&gid=0"
          value={csvUrl}
          onChange={(e) => setCsvUrl(e.target.value)}
        />
        <input placeholder="Nome da aba" value={sheetName} onChange={(e) => setSheetName(e.target.value)} />
        <div className="actions">
          <button type="button" onClick={importOrders} disabled={loading || !csvUrl}>
            Importar pedidos
          </button>
          <button type="button" onClick={runFollowupSweep} disabled={loading}>
            Rodar automacao de follow-up
          </button>
        </div>
      </section>
    </div>
  );
}
