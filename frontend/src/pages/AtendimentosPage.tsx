import { useMemo, useState } from "react";
import { useCRM } from "../state/crm-context";

export function AtendimentosPage() {
  const { orders, updateOrder } = useCRM();
  const [etapa, setEtapa] = useState("");

  const rows = useMemo(
    () => orders.filter((o) => !etapa || o.etapaCRM === etapa).sort((a, b) => b.diasAberto - a.diasAberto),
    [orders, etapa]
  );

  return (
    <div className="stack">
      <section>
        <h2>Atendimentos</h2>
        <p>Fila operacional para registrar andamento e contato com clientes.</p>
        <div className="filters-row">
          <select value={etapa} onChange={(e) => setEtapa(e.target.value)}>
            <option value="">Todas as etapas</option>
            <option value="Novo">Novo</option>
            <option value="Contato iniciado">Contato iniciado</option>
            <option value="Negociacao">Negociacao</option>
            <option value="Aguardando pagamento">Aguardando pagamento</option>
            <option value="Concluido">Concluido</option>
          </select>
        </div>
      </section>

      <section>
        <table className="table">
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Cliente</th>
              <th>Vendedor</th>
              <th>Urgencia</th>
              <th>Dias aberto</th>
              <th>Etapa</th>
              <th>Acao rapida</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.pedido}>
                <td>{item.pedido}</td>
                <td>{item.cliente}</td>
                <td>{item.vendedor}</td>
                <td>{item.urgencia}</td>
                <td>{item.diasAberto}</td>
                <td>{item.etapaCRM}</td>
                <td>
                  <button onClick={() => updateOrder(item.pedido, { etapaCRM: "Contato iniciado" })}>
                    Marcar contato
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
