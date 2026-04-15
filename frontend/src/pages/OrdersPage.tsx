import { useEffect, useMemo, useState } from "react";
import { useCRM } from "../state/crm-context";
import { useAuth } from "../state/auth-context";
import { useToast } from "../state/toast-context";
import { Pagination } from "../components/Pagination";
import { downloadCsv } from "../utils/csv";
import { isValidFollowupDate } from "../utils/validation";
import { RegisterContactModal } from "../components/RegisterContactModal";
import type { Order } from "../data/mock-data";

function brl(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function OrdersPage() {
  const { orders: rawOrders, updateOrder, isLoading } = useCRM();
  const { isGestora, currentSellerName } = useAuth();
  const { pushToast } = useToast();

  const allOrders = useMemo(() => {
    if (isGestora) return rawOrders;
    return rawOrders.filter((o) => o.vendedor === currentSellerName);
  }, [rawOrders, isGestora, currentSellerName]);
  const [urgencia, setUrgencia] = useState("");
  const [page, setPage] = useState(1);
  const [savingPedido, setSavingPedido] = useState<number | null>(null);
  const [registeringOrder, setRegisteringOrder] = useState<Order | null>(null);

  const orders = useMemo(() => {
    return allOrders.filter((order) => !urgencia || order.urgencia === urgencia);
  }, [allOrders, urgencia]);
  useEffect(() => setPage(1), [urgencia]);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(orders.length / pageSize));
  const visible = orders.slice((page - 1) * pageSize, page * pageSize);

  function exportCsv() {
    downloadCsv(
      "pedidos_realsynk.csv",
      ["Pedido", "Cliente", "Vendedor", "AFaturar", "DiasAberto", "Urgencia", "EtapaCRM", "ProximoFollowup"],
      orders.map((o) => [o.pedido, o.cliente, o.vendedor, o.aFaturar, o.diasAberto, o.urgencia, o.etapaCRM, o.proximoFollowup ?? ""])
    );
    pushToast("success", "CSV de pedidos exportado.");
  }

  return (
    <div className="stack">
      <section>
        <h2>Pedidos em aberto</h2>
        <p>Operacao de atendimento com prioridade por urgencia e follow-up.</p>
        <div className="filters-row">
          <select value={urgencia} onChange={(e) => setUrgencia(e.target.value)}>
            <option value="">Todas as urgencias</option>
            <option value="CRITICO">Critico</option>
            <option value="ATENCAO">Atencao</option>
            <option value="RECENTE">Recente</option>
          </select>
          <button type="button" onClick={exportCsv}>
            Exportar CSV
          </button>
        </div>
      </section>

      <section>
        {isLoading ? (
          <div className="skeleton-table">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div key={idx} className="skeleton-row" />
            ))}
          </div>
        ) : (
          <table className="table">
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Cliente</th>
              <th>Vendedor</th>
              <th>A Faturar</th>
              <th>Dias em Aberto</th>
              <th>Urgencia</th>
              <th>Etapa CRM</th>
              <th>Proximo follow-up</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((order) => (
              <tr key={order.pedido}>
                <td>{order.pedido}</td>
                <td>{order.cliente}</td>
                <td>{order.vendedor}</td>
                <td>{brl(order.aFaturar)}</td>
                <td>{order.diasAberto}</td>
                <td>{order.urgencia}</td>
                <td>
                  <select
                    value={order.etapaCRM}
                    disabled={savingPedido === order.pedido}
                    onChange={(e) => {
                      setSavingPedido(order.pedido);
                      void updateOrder(order.pedido, {
                        etapaCRM: e.target.value as
                          | "Novo"
                          | "Contato iniciado"
                          | "Negociacao"
                          | "Aguardando pagamento"
                          | "Concluido"
                      })
                        .then(() => pushToast("success", "Etapa atualizada."))
                        .catch(() => pushToast("error", "Falha ao atualizar etapa."))
                        .finally(() => setSavingPedido(null));
                    }}
                  >
                    <option value="Novo">Novo</option>
                    <option value="Contato iniciado">Contato iniciado</option>
                    <option value="Negociacao">Negociacao</option>
                    <option value="Aguardando pagamento">Aguardando pagamento</option>
                    <option value="Concluido">Concluido</option>
                  </select>
                </td>
                <td>
                  <input
                    value={order.proximoFollowup ?? ""}
                    placeholder="dd/mm/aaaa"
                    disabled={savingPedido === order.pedido}
                    onBlur={(e) => {
                      const value = e.target.value.trim();
                      if (value && !isValidFollowupDate(value)) {
                        pushToast("error", "Data invalida. Use dd/mm/aaaa.");
                        return;
                      }
                      setSavingPedido(order.pedido);
                      void updateOrder(order.pedido, { proximoFollowup: value })
                        .then(() => pushToast("success", "Follow-up atualizado."))
                        .catch(() => pushToast("error", "Falha ao salvar follow-up."))
                        .finally(() => setSavingPedido(null));
                    }}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="cta-lead ripple-btn"
                    style={{ padding: "6px 12px", fontSize: 12, whiteSpace: "nowrap" }}
                    onClick={() => setRegisteringOrder(order)}
                  >
                    Registrar contato
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        )}
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </section>

      {registeringOrder && (
        <RegisterContactModal
          refType="order"
          refId={String(registeringOrder.pedido)}
          cliente={registeringOrder.cliente}
          vendedor={registeringOrder.vendedor}
          onClose={() => setRegisteringOrder(null)}
          onSaved={(saved) => {
            if (saved.proximoRetorno) {
              void updateOrder(registeringOrder.pedido, { proximoFollowup: saved.proximoRetorno });
            }
            setRegisteringOrder(null);
          }}
        />
      )}
    </div>
  );
}
