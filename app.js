const INITIAL_DATA = [
  { pedido: 897, cliente: "THIAGO HENRIQUE MARTINS", vendedor: "ANA CAROLINE CAMPOS NORANHA FERREIRA", faturar: 16000, diasAberto: 1064, urgencia: "CRITICO" },
  { pedido: 466, cliente: "MARCIO ROBERTO BERTUCINI", vendedor: "DIEINE ALVES GUIMARAES MOLLHOFF", faturar: 2000, diasAberto: 1368, urgencia: "CRITICO" },
  { pedido: 467, cliente: "ANA CAROLINA TOMADON GUIRELLI", vendedor: "ANA CAROLINE CAMPOS NORANHA FERREIRA", faturar: 340, diasAberto: 1368, urgencia: "CRITICO" },
  { pedido: 469, cliente: "SUZETT DE CASSIA SECHI MARRA", vendedor: "ANA CAROLINE CAMPOS NORANHA FERREIRA", faturar: 3260, diasAberto: 1368, urgencia: "CRITICO" },
  { pedido: 494, cliente: "ESTER DA SILVA", vendedor: "ANA CAROLINE CAMPOS NORANHA FERREIRA", faturar: 3190, diasAberto: 1337, urgencia: "CRITICO" },
  { pedido: 1001, cliente: "ANICE NALIN DE OLIVEIRA", vendedor: "ANA CAROLINE CAMPOS NORANHA FERREIRA", faturar: 7051, diasAberto: 972, urgencia: "CRITICO" },
  { pedido: 1685, cliente: "0 CLIMA LTDA", vendedor: "SIMONE FERREIRA DA SILVA BOSSO", faturar: 20960, diasAberto: 179, urgencia: "ATENCAO" },
  { pedido: 1105, cliente: "NEBRASKA MONTEIRO", vendedor: "ANA CAROLINE CAMPOS NORANHA FERREIRA", faturar: 8487, diasAberto: 849, urgencia: "CRITICO" },
  { pedido: 1428, cliente: "GREICE KELLI DOS SANTOS DE SOUZA", vendedor: "GISLENE ROSA DA SILVA", faturar: 12990, diasAberto: 543, urgencia: "CRITICO" },
  { pedido: 1276, cliente: "BRUNO RODA DOS SANTOS", vendedor: "DIEINE ALVES GUIMARAES MOLLHOFF", faturar: 800, diasAberto: 695, urgencia: "CRITICO" },
  { pedido: 1818, cliente: "INGRID MENOTTI NEHUES", vendedor: "SIMONE FERREIRA DA SILVA BOSSO", faturar: 9298, diasAberto: 53, urgencia: "RECENTE" },
  { pedido: 1411, cliente: "LARISSA DE SOUZA FERRAZ", vendedor: "SIMONE FERREIRA DA SILVA BOSSO", faturar: 44900, diasAberto: 541, urgencia: "CRITICO" },
  { pedido: 1376, cliente: "THIAGO LOPES CHAVES", vendedor: "SIMONE FERREIRA DA SILVA BOSSO", faturar: 6290, diasAberto: 601, urgencia: "CRITICO" },
  { pedido: 1192, cliente: "NEBRASKA MONTEIRO", vendedor: "GISLENE ROSA DA SILVA", faturar: 1180, diasAberto: 906, urgencia: "CRITICO" },
  { pedido: 1012, cliente: "ALBERTO ERASMO DINIZ DIAS", vendedor: "GISLENE ROSA DA SILVA", faturar: 6900, diasAberto: 966, urgencia: "CRITICO" },
  { pedido: 1253, cliente: "MARCIA SESTITO", vendedor: "ANA CAROLINE CAMPOS NORANHA FERREIRA", faturar: 8706, diasAberto: 721, urgencia: "CRITICO" },
  { pedido: 1535, cliente: "MARCIO ROBERTO BERTUCINI", vendedor: "ANA CAROLINE CAMPOS NORANHA FERREIRA", faturar: 650, diasAberto: 325, urgencia: "CRITICO" },
  { pedido: 1384, cliente: "J. S. TREINAMENTO EM DESENVOLVIMENTO", vendedor: "ANA CAROLINE CAMPOS NORANHA FERREIRA", faturar: 13550, diasAberto: 567, urgencia: "CRITICO" },
  { pedido: 1393, cliente: "FEBRACIS SAO PAULO TREINAM. EM DESENV.", vendedor: "ANA CAROLINE CAMPOS NORANHA FERREIRA", faturar: 16412, diasAberto: 567, urgencia: "CRITICO" },
  { pedido: 1548, cliente: "EMILENE APARECIDA PRADO", vendedor: "ANA CAROLINE CAMPOS NORANHA FERREIRA", faturar: 20000, diasAberto: 322, urgencia: "CRITICO" }
];

const STORAGE_KEY = "crm_kato_atendimentos_v1";
const STAGE_DEFAULT = "Novo";

const state = {
  pedidos: [],
  selectedId: null
};

const el = {
  tb: document.getElementById("tbPedidos"),
  busca: document.getElementById("fBusca"),
  vendedor: document.getElementById("fVendedor"),
  urgencia: document.getElementById("fUrgencia"),
  etapa: document.getElementById("fEtapa"),
  kpiPedidos: document.getElementById("kpiPedidos"),
  kpiFaturar: document.getElementById("kpiFaturar"),
  kpiCriticos: document.getElementById("kpiCriticos"),
  kpiSemRetorno: document.getElementById("kpiSemRetorno"),
  dialog: document.getElementById("dlgAtendimento"),
  titulo: document.getElementById("dlgTitulo"),
  mEtapa: document.getElementById("mEtapa"),
  mUltimoContato: document.getElementById("mUltimoContato"),
  mProximoFollowup: document.getElementById("mProximoFollowup"),
  mObs: document.getElementById("mObs"),
  form: document.getElementById("frmAtendimento"),
  btnCancelar: document.getElementById("btnCancelar"),
  btnReset: document.getElementById("btnReset")
};

function brl(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function toInputDate(value) {
  if (!value) return "";
  const [d, m, y] = value.split("/");
  if (!d || !m || !y) return value;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function fromInputDate(value) {
  if (!value) return "";
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

function urgencyTag(urg) {
  if (urg === "CRITICO") return "<span class='tag urg-critico'>Critico</span>";
  if (urg === "ATENCAO") return "<span class='tag urg-atencao'>Atencao</span>";
  return "<span class='tag urg-recente'>Recente</span>";
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.pedidos));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    state.pedidos = INITIAL_DATA.map((p) => ({
      ...p,
      etapaCRM: STAGE_DEFAULT,
      ultimoContato: "",
      proximoFollowup: "",
      observacoes: ""
    }));
    return;
  }

  try {
    state.pedidos = JSON.parse(raw);
  } catch (_e) {
    state.pedidos = INITIAL_DATA.map((p) => ({
      ...p,
      etapaCRM: STAGE_DEFAULT,
      ultimoContato: "",
      proximoFollowup: "",
      observacoes: ""
    }));
  }
}

function buildVendedorFilter() {
  const vendedores = [...new Set(state.pedidos.map((p) => p.vendedor))].sort();
  el.vendedor.innerHTML = "<option value=''>Vendedor: todos</option>";
  vendedores.forEach((v) => {
    const option = document.createElement("option");
    option.value = v;
    option.textContent = v;
    el.vendedor.appendChild(option);
  });
}

function getFiltered() {
  const busca = el.busca.value.trim().toUpperCase();
  return state.pedidos.filter((p) => {
    const okBusca = !busca || p.cliente.includes(busca) || String(p.pedido).includes(busca);
    const okVendedor = !el.vendedor.value || p.vendedor === el.vendedor.value;
    const okUrg = !el.urgencia.value || p.urgencia === el.urgencia.value;
    const okEtapa = !el.etapa.value || p.etapaCRM === el.etapa.value;
    return okBusca && okVendedor && okUrg && okEtapa;
  });
}

function renderKPIs(list) {
  const totalFaturar = list.reduce((sum, p) => sum + Number(p.faturar || 0), 0);
  const criticos = list.filter((p) => p.urgencia === "CRITICO").length;
  const semRetorno = list.filter((p) => !p.ultimoContato).length;
  el.kpiPedidos.textContent = String(list.length);
  el.kpiFaturar.textContent = brl(totalFaturar);
  el.kpiCriticos.textContent = String(criticos);
  el.kpiSemRetorno.textContent = String(semRetorno);
}

function renderTable() {
  const list = getFiltered();
  renderKPIs(list);
  el.tb.innerHTML = "";
  list
    .sort((a, b) => b.diasAberto - a.diasAberto)
    .forEach((p) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${p.pedido}</td>
        <td>${p.cliente}</td>
        <td>${p.vendedor}</td>
        <td>${brl(p.faturar)}</td>
        <td>${p.diasAberto}</td>
        <td>${urgencyTag(p.urgencia)}</td>
        <td>${p.etapaCRM}</td>
        <td>${p.ultimoContato || "-"}</td>
        <td>${p.proximoFollowup || "-"}</td>
        <td><button data-pedido="${p.pedido}">Registrar</button></td>
      `;
      el.tb.appendChild(tr);
    });
}

function openModal(pedidoId) {
  const pedido = state.pedidos.find((p) => p.pedido === pedidoId);
  if (!pedido) return;
  state.selectedId = pedidoId;
  el.titulo.textContent = `Pedido ${pedido.pedido} - ${pedido.cliente}`;
  el.mEtapa.value = pedido.etapaCRM || STAGE_DEFAULT;
  el.mUltimoContato.value = toInputDate(pedido.ultimoContato);
  el.mProximoFollowup.value = toInputDate(pedido.proximoFollowup);
  el.mObs.value = pedido.observacoes || "";
  el.dialog.showModal();
}

function bindEvents() {
  [el.busca, el.vendedor, el.urgencia, el.etapa].forEach((f) => {
    f.addEventListener("input", renderTable);
    f.addEventListener("change", renderTable);
  });

  el.tb.addEventListener("click", (ev) => {
    const btn = ev.target.closest("button[data-pedido]");
    if (!btn) return;
    openModal(Number(btn.dataset.pedido));
  });

  el.btnCancelar.addEventListener("click", () => el.dialog.close());

  el.form.addEventListener("submit", () => {
    const pedido = state.pedidos.find((p) => p.pedido === state.selectedId);
    if (!pedido) return;
    pedido.etapaCRM = el.mEtapa.value;
    pedido.ultimoContato = fromInputDate(el.mUltimoContato.value);
    pedido.proximoFollowup = fromInputDate(el.mProximoFollowup.value);
    pedido.observacoes = el.mObs.value.trim();
    saveState();
    renderTable();
  });

  el.btnReset.addEventListener("click", () => {
    const ok = window.confirm("Deseja resetar todas as atualizacoes de atendimento?");
    if (!ok) return;
    localStorage.removeItem(STORAGE_KEY);
    loadState();
    buildVendedorFilter();
    renderTable();
  });
}

function init() {
  loadState();
  buildVendedorFilter();
  bindEvents();
  renderTable();
}

init();
