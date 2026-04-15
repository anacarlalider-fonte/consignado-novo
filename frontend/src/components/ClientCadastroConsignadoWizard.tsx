import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../state/auth-context";
import {
  normalizeCpf,
  percentualMargemConsignado,
  type BeneficiarioTipoConsignado,
  type ClienteDocumentoAnexo,
  type NewClient,
} from "../data/mock-data";
import {
  COEFICIENTES_PADRAO,
  calcularConsignadoPorSalario,
  parseCoeficienteInput,
  type CoeficientesConsignado,
} from "../utils/consignado-calculo";
import type { LeadWizardPrefill } from "../utils/lead-to-client";

const LS_COEF = "crm_consignado_coeficientes";

function formatCoefInput(n: number): string {
  const s = n.toFixed(8).replace(/\.?0+$/, "");
  return s.replace(".", ",");
}

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

const DOC_TIPOS = [
  { value: "RG", label: "RG" },
  { value: "CNH", label: "CNH" },
  { value: "RNE", label: "RNE / RNM" },
  { value: "PASSAPORTE", label: "Passaporte" },
];

const BENEF_TIPOS: { value: BeneficiarioTipoConsignado; label: string }[] = [
  { value: "APOSENTADO_PENSIONISTA_INSS", label: "Aposentado / pensionista INSS" },
  { value: "SERVIDOR_PUBLICO_ATIVO", label: "Servidor público ativo" },
  { value: "SERVIDOR_PUBLICO_APOSENTADO", label: "Servidor público aposentado" },
  { value: "PENSIONISTA", label: "Pensionista (outros regimes)" },
  { value: "OUTRO", label: "Outro" },
];

const CANAIS_ORIGEM = [
  "Indicação",
  "Instagram / redes sociais",
  "Passagem / loja",
  "Site",
  "WhatsApp",
  "Telemarketing",
  "Parceiro",
  "Base fria (CSV)",
  "Outro",
];

const TIPOS_DOC_UPLOAD = [
  "RG — frente",
  "RG — verso",
  "CNH — frente",
  "Selfie / biometria",
  "Contracheque (últimos 3 meses)",
  "Extrato INSS / benefício",
  "Comprovante de residência",
  "Termo de posse (servidor)",
  "Outro",
];

type Props = {
  onCancel: () => void;
  onSubmit: (payload: NewClient) => Promise<void>;
  existingCpfs: Set<string>;
  /** Preenchimento ao converter lead da base fria em cliente (demais etapas manualmente). */
  initialPrefill?: LeadWizardPrefill | null;
};

function fmtCpfMask(d: string) {
  const x = d.replace(/\D/g, "").slice(0, 11);
  if (x.length <= 3) return x;
  if (x.length <= 6) return `${x.slice(0, 3)}.${x.slice(3)}`;
  if (x.length <= 9) return `${x.slice(0, 3)}.${x.slice(3, 6)}.${x.slice(6)}`;
  return `${x.slice(0, 3)}.${x.slice(3, 6)}.${x.slice(6, 9)}-${x.slice(9)}`;
}

function ageFromBirth(iso: string): number | null {
  if (!iso) return null;
  const d = new Date(iso + "T12:00:00");
  if (Number.isNaN(d.getTime())) return null;
  const t = new Date();
  let age = t.getFullYear() - d.getFullYear();
  const m = t.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < d.getDate())) age--;
  return age;
}

export function ClientCadastroConsignadoWizard({
  onCancel,
  onSubmit,
  existingCpfs,
  initialPrefill = null,
}: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [nome, setNome] = useState(() => initialPrefill?.nome ?? "");
  const [cpf, setCpf] = useState(() =>
    initialPrefill?.cpfDigits && initialPrefill.cpfDigits.length === 11 ? fmtCpfMask(initialPrefill.cpfDigits) : ""
  );
  const [dataNascimento, setDataNascimento] = useState(() => initialPrefill?.dataNascimento ?? "");
  const [sexo, setSexo] = useState<"" | "M" | "F" | "OUTRO">("");
  const [nomeMae, setNomeMae] = useState("");
  const [naturalidadeUf, setNaturalidadeUf] = useState("");

  const [docTipo, setDocTipo] = useState("RG");
  const [docNumero, setDocNumero] = useState("");
  const [docOrgao, setDocOrgao] = useState("");
  const [docDataEmissao, setDocDataEmissao] = useState("");
  const [docUfEmissao, setDocUfEmissao] = useState("");

  const [telefone, setTelefone] = useState(() => initialPrefill?.telefone ?? "");
  const [telefone2, setTelefone2] = useState(() => initialPrefill?.telefone2 ?? "");
  const [telefone3, setTelefone3] = useState(() => initialPrefill?.telefone3 ?? "");
  const [email, setEmail] = useState(() => initialPrefill?.email ?? "");
  const [endereco, setEndereco] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState(() => initialPrefill?.cidade ?? "");
  const [estado, setEstado] = useState(() => initialPrefill?.estado ?? "");
  const [cep, setCep] = useState("");

  const [beneficiarioTipo, setBeneficiarioTipo] = useState<BeneficiarioTipoConsignado>(
    () => initialPrefill?.beneficiarioTipo ?? ""
  );
  const [matriculaNb, setMatriculaNb] = useState(() => initialPrefill?.matriculaNb ?? "");
  const [dataDespachoBeneficio, setDataDespachoBeneficio] = useState(
    () => initialPrefill?.dataDespachoBeneficio ?? ""
  );
  const [orgaoEmpregador, setOrgaoEmpregador] = useState("");
  const [cartaoBeneficio, setCartaoBeneficio] = useState(() => initialPrefill?.cartaoBeneficio ?? false);

  const [salarioBruto, setSalarioBruto] = useState(() => initialPrefill?.salarioBruto ?? "");
  const [margemDisponivel, setMargemDisponivel] = useState("");
  const [dataUltimaConsulta, setDataUltimaConsulta] = useState("");
  const [observacoes, setObservacoes] = useState(() => initialPrefill?.observacoes ?? "");

  const [coef35Str, setCoef35Str] = useState(() => formatCoefInput(COEFICIENTES_PADRAO.coef35));
  const [coefRmcStr, setCoefRmcStr] = useState(() => formatCoefInput(COEFICIENTES_PADRAO.coefRmc));
  const [coefRccStr, setCoefRccStr] = useState(() => formatCoefInput(COEFICIENTES_PADRAO.coefRcc));

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_COEF);
      if (!raw) return;
      const p = JSON.parse(raw) as Partial<CoeficientesConsignado>;
      if (typeof p.coef35 === "number" && p.coef35 > 0) setCoef35Str(formatCoefInput(p.coef35));
      if (typeof p.coefRmc === "number" && p.coefRmc > 0) setCoefRmcStr(formatCoefInput(p.coefRmc));
      if (typeof p.coefRcc === "number" && p.coefRcc > 0) setCoefRccStr(formatCoefInput(p.coefRcc));
    } catch {
      /* ignore */
    }
  }, []);

  const coefsEfetivos = useMemo((): CoeficientesConsignado => {
    const c35 = parseCoeficienteInput(coef35Str);
    const cRmc = parseCoeficienteInput(coefRmcStr);
    const cRcc = parseCoeficienteInput(coefRccStr);
    return {
      coef35: Number.isFinite(c35) ? c35 : COEFICIENTES_PADRAO.coef35,
      coefRmc: Number.isFinite(cRmc) ? cRmc : COEFICIENTES_PADRAO.coefRmc,
      coefRcc: Number.isFinite(cRcc) ? cRcc : COEFICIENTES_PADRAO.coefRcc,
    };
  }, [coef35Str, coefRmcStr, coefRccStr]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_COEF, JSON.stringify(coefsEfetivos));
    } catch {
      /* ignore */
    }
  }, [coefsEfetivos]);

  const simulacaoConsignado = useMemo(() => {
    const sal = Number(salarioBruto.replace(/\./g, "").replace(",", ".")) || 0;
    return calcularConsignadoPorSalario(sal, coefsEfetivos);
  }, [salarioBruto, coefsEfetivos]);

  const [documentos, setDocumentos] = useState<ClienteDocumentoAnexo[]>([]);
  const [lgpdOk, setLgpdOk] = useState(false);
  const [canalOrigem, setCanalOrigem] = useState(() => {
    const o = initialPrefill?.canalOrigem ?? "";
    return CANAIS_ORIGEM.includes(o) ? o : o ? "Outro" : "";
  });

  const pctMargem = useMemo(
    () => percentualMargemConsignado(beneficiarioTipo, cartaoBeneficio),
    [beneficiarioTipo, cartaoBeneficio]
  );

  const idade = ageFromBirth(dataNascimento);
  const cpfOk = normalizeCpf(cpf).length === 11;

  const steps = ["Identificação", "Contato", "Vínculo funcional", "Financeiro", "Documentos e LGPD"];

  function validateStep(s: number): string | null {
    if (s === 0) {
      if (nome.trim().length < 3) return "Informe o nome completo.";
      if (!cpfOk) return "CPF deve ter 11 dígitos.";
      if (existingCpfs.has(normalizeCpf(cpf))) return "Este CPF já está cadastrado.";
      if (!dataNascimento) return "Informe a data de nascimento.";
      if (idade !== null && idade < 18) return "Cliente deve ter pelo menos 18 anos.";
      if (!nomeMae.trim()) return "Nome da mãe é obrigatório para validação bancária.";
      if (!docTipo || !docNumero.trim()) return "Preencha tipo e número do documento de identidade.";
    }
    if (s === 1) {
      const anyTel = [telefone, telefone2, telefone3].some((t) => t.replace(/\D/g, "").length >= 8);
      if (!anyTel) return "Informe pelo menos um telefone válido (8+ dígitos).";
    }
    if (s === 2) {
      if (!beneficiarioTipo) return "Selecione o tipo de beneficiário.";
      if (!matriculaNb.trim()) return "Informe a matrícula / NB para consulta de margem.";
    }
    if (s === 3) {
      const sal = Number(salarioBruto.replace(/\./g, "").replace(",", "."));
      if (!salarioBruto.trim() || !Number.isFinite(sal) || sal <= 0) return "Informe o salário / benefício de referência.";
    }
    if (s === 4) {
      if (!lgpdOk) return "É necessário aceitar o tratamento de dados (LGPD).";
      if (!canalOrigem) return "Selecione o canal de origem.";
    }
    return null;
  }

  function next() {
    const err = validateStep(step);
    if (err) {
      window.alert(err);
      return;
    }
    if (step === 2 && beneficiarioTipo === "APOSENTADO_PENSIONISTA_INSS" && idade !== null && idade > 80) {
      const ok = window.confirm(
        "Atenção: alguns convênios INSS limitam idade máxima a 80 anos. Deseja continuar mesmo assim?"
      );
      if (!ok) return;
    }
    setStep((x) => Math.min(x + 1, steps.length - 1));
  }

  function back() {
    setStep((x) => Math.max(x - 1, 0));
  }

  async function submit() {
    const err = validateStep(4);
    if (err) {
      window.alert(err);
      return;
    }
    setSaving(true);
    try {
      const sal = Number(salarioBruto.replace(/\./g, "").replace(",", ".")) || 0;
      const margemInf = Number(margemDisponivel.replace(/\./g, "").replace(",", ".")) || undefined;
      const sim = calcularConsignadoPorSalario(sal, coefsEfetivos);
      const now = new Date().toISOString();
      const payload: NewClient = {
        nome: nome.trim().slice(0, 150),
        telefone: telefone.trim(),
        telefone2: telefone2.trim() || undefined,
        telefone3: telefone3.trim() || undefined,
        email: email.trim(),
        endereco: endereco.trim(),
        numero: numero.trim(),
        complemento: complemento.trim(),
        bairro: bairro.trim(),
        cidade: cidade.trim(),
        estado: estado.trim().slice(0, 2).toUpperCase(),
        cep: cep.trim(),
        observacoes: observacoes.trim(),
        cpf: normalizeCpf(cpf),
        dataNascimento,
        sexo: sexo || undefined,
        nomeMae: nomeMae.trim(),
        naturalidadeUf: naturalidadeUf || undefined,
        docTipo,
        docNumero: docNumero.trim(),
        docOrgao: docOrgao.trim() || undefined,
        docDataEmissao: docDataEmissao || undefined,
        docUfEmissao: docUfEmissao || undefined,
        beneficiarioTipo,
        matriculaNb: matriculaNb.trim(),
        dataDespachoBeneficio: dataDespachoBeneficio.trim() || undefined,
        orgaoEmpregador: orgaoEmpregador.trim() || undefined,
        cartaoBeneficio,
        salarioBrutoReferencia: sal,
        margemDisponivelInformada: margemInf,
        percentualMargemAplicado: pctMargem,
        margemPct35: sim.margemPct35,
        margemRmc: sim.margemRmc,
        margemRcc: sim.margemRcc,
        vlrLiberado35: sim.vlrLiberado35,
        vlrLiberadoRmc: sim.vlrLiberadoRmc,
        vlrLiberadoRcc: sim.vlrLiberadoRcc,
        totalLiberado: sim.totalLiberado,
        dataUltimaConsultaMargem: dataUltimaConsulta || undefined,
        documentosAnexos: documentos.length ? documentos : undefined,
        lgpdConsentimento: true,
        lgpdConsentimentoEm: now,
        lgpdOperadorNome: user?.name ?? "—",
        canalOrigem,
      };
      await onSubmit(payload);
    } finally {
      setSaving(false);
    }
  }

  function onFilePicked(tipo: string, fileList: FileList | null) {
    const f = fileList?.[0];
    if (!f) return;
    const meta: ClienteDocumentoAnexo = {
      tipo,
      nomeArquivo: f.name,
      tamanhoBytes: f.size,
      carregadoEm: new Date().toISOString(),
    };
    setDocumentos((prev) => {
      const rest = prev.filter((d) => d.tipo !== tipo);
      return [...rest, meta];
    });
  }

  return (
    <div className="cc-wizard">
      <header className="cc-wizard-head">
        <h2>Cadastro de cliente — consignado</h2>
        <nav className="cc-wizard-tabs" aria-label="Etapas do cadastro">
          {steps.map((label, i) => (
            <button
              key={label}
              type="button"
              className={i === step ? "cc-tab active" : "cc-tab"}
              onClick={() => {
                if (i < step) setStep(i);
                else {
                  for (let j = 0; j < i; j++) {
                    const e = validateStep(j);
                    if (e) {
                      window.alert(`Antes: ${e}`);
                      return;
                    }
                  }
                  setStep(i);
                }
              }}
            >
              {label}
            </button>
          ))}
        </nav>
        <p className="cc-legend">
          <span className="req">obrigatório</span> necessário para proposta ·{" "}
          <span className="opt">opcional</span> enriquece o perfil
        </p>
      </header>

      {step === 0 && (
        <section className="cc-section">
          <div className="cc-hint">
            Base de identificação — campos usados para buscar o cliente, validar CPF e cruzar dados com o banco.
          </div>
          <h3 className="cc-subtitle">Dados pessoais</h3>
          <div className="cc-grid">
            <label>
              <span>Nome completo <em className="req">obrigatório</em></span>
              <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="ex.: Maria José da Silva" maxLength={150} />
              <small className="cc-db">VARCHAR(150) NOT NULL</small>
            </label>
            <label>
              <span>CPF <em className="req">obrigatório</em></span>
              <input
                value={fmtCpfMask(cpf)}
                onChange={(e) => setCpf(e.target.value.replace(/\D/g, ""))}
                placeholder="000.000.000-00"
                inputMode="numeric"
              />
              <small>Chave primária de negócio — índice único na base</small>
              <small className="cc-db">CHAR(11) UNIQUE NOT NULL</small>
            </label>
            <label>
              <span>Data de nascimento <em className="req">obrigatório</em></span>
              <input type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} />
              <small>Necessária para idade e elegibilidade (mín. 18 anos)</small>
              {idade !== null && <small className="cc-age">Idade calculada: {idade} anos</small>}
            </label>
            <label>
              <span>Sexo <em className="opt">opcional</em></span>
              <select value={sexo} onChange={(e) => setSexo(e.target.value as typeof sexo)}>
                <option value="">—</option>
                <option value="F">Feminino</option>
                <option value="M">Masculino</option>
                <option value="OUTRO">Outro</option>
              </select>
            </label>
            <label className="cc-span2">
              <span>Nome da mãe <em className="req">obrigatório</em></span>
              <input value={nomeMae} onChange={(e) => setNomeMae(e.target.value)} placeholder="ex.: Josefa da Silva" />
              <small>Validação obrigatória nos bancos</small>
            </label>
            <label>
              <span>Naturalidade (UF) <em className="opt">opcional</em></span>
              <select value={naturalidadeUf} onChange={(e) => setNaturalidadeUf(e.target.value)}>
                <option value="">—</option>
                {UFS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </label>
          </div>

          <h3 className="cc-subtitle">Documento de identidade</h3>
          <div className="cc-grid">
            <label>
              <span>Tipo de doc. <em className="req">obrigatório</em></span>
              <select value={docTipo} onChange={(e) => setDocTipo(e.target.value)}>
                {DOC_TIPOS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Número <em className="req">obrigatório</em></span>
              <input value={docNumero} onChange={(e) => setDocNumero(e.target.value)} placeholder="ex.: 5.123.456" />
            </label>
            <label>
              <span>Órgão emissor <em className="opt">opcional</em></span>
              <input value={docOrgao} onChange={(e) => setDocOrgao(e.target.value)} placeholder="SSP/SC" />
            </label>
            <label>
              <span>Data de emissão <em className="opt">opcional</em></span>
              <input type="date" value={docDataEmissao} onChange={(e) => setDocDataEmissao(e.target.value)} />
            </label>
            <label>
              <span>UF de emissão <em className="opt">opcional</em></span>
              <select value={docUfEmissao} onChange={(e) => setDocUfEmissao(e.target.value)}>
                <option value="">—</option>
                {UFS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </label>
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="cc-section">
          <div className="cc-hint">Dados para contato e correspondência.</div>
          <div className="cc-grid">
            <label>
              <span>Telefone principal <em className="req">obrigatório</em></span>
              <input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(00) 90000-0000" />
            </label>
            <label>
              <span>Telefone 2 <em className="opt">opcional</em></span>
              <input value={telefone2} onChange={(e) => setTelefone2(e.target.value)} placeholder="Outro número" />
            </label>
            <label>
              <span>Telefone 3 <em className="opt">opcional</em></span>
              <input value={telefone3} onChange={(e) => setTelefone3(e.target.value)} placeholder="Recado / familiar" />
            </label>
            <label className="cc-span2">
              <span>E-mail <em className="opt">opcional</em></span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" />
            </label>
            <label className="cc-span2">
              <span>CEP</span>
              <input value={cep} onChange={(e) => setCep(e.target.value)} placeholder="00000-000" />
            </label>
            <label className="cc-span2">
              <span>Endereço</span>
              <input value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua, avenida..." />
            </label>
            <label>
              <span>Número</span>
              <input value={numero} onChange={(e) => setNumero(e.target.value)} />
            </label>
            <label>
              <span>Complemento</span>
              <input value={complemento} onChange={(e) => setComplemento(e.target.value)} />
            </label>
            <label>
              <span>Bairro</span>
              <input value={bairro} onChange={(e) => setBairro(e.target.value)} />
            </label>
            <label>
              <span>Cidade</span>
              <input value={cidade} onChange={(e) => setCidade(e.target.value)} />
            </label>
            <label>
              <span>UF</span>
              <input value={estado} onChange={(e) => setEstado(e.target.value)} maxLength={2} placeholder="SP" />
            </label>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="cc-section">
          <div className="cc-hint">
            Vínculo funcional — o tipo de beneficiário governa quais bancos e percentuais de margem aparecem no simulador.
          </div>
          <div className="cc-grid">
            <label className="cc-span2">
              <span>Tipo de beneficiário <em className="req">obrigatório</em></span>
              <select
                value={beneficiarioTipo}
                onChange={(e) => setBeneficiarioTipo(e.target.value as BeneficiarioTipoConsignado)}
              >
                <option value="">Selecione...</option>
                {BENEF_TIPOS.map((b) => (
                  <option key={b.value} value={b.value}>{b.label}</option>
                ))}
              </select>
              <small className="cc-db">ENUM — regras de negócio / simulador</small>
            </label>
            <label className="cc-span2">
              <span>Matrícula / NB <em className="req">obrigatório</em></span>
              <input value={matriculaNb} onChange={(e) => setMatriculaNb(e.target.value)} placeholder="Chave para consulta de margem (API bancária)" />
            </label>
            <label className="cc-span2">
              <span>Data de despacho do benefício (DDB) <em className="opt">opcional</em></span>
              <input
                type="date"
                value={dataDespachoBeneficio}
                onChange={(e) => setDataDespachoBeneficio(e.target.value)}
              />
              <small className="cc-db">Data em que o benefício foi concedido (quando constar na planilha / INSS)</small>
            </label>
            <label className="cc-span2">
              <span>Órgão / empregador <em className="opt">opcional</em></span>
              <input value={orgaoEmpregador} onChange={(e) => setOrgaoEmpregador(e.target.value)} />
            </label>
            <label className="cc-span2 cc-check">
              <input type="checkbox" checked={cartaoBeneficio} onChange={(e) => setCartaoBeneficio(e.target.checked)} />
              <span>Possui cartão benefício (ex.: INSS — margem pode ser 35% em vez de 30%)</span>
            </label>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="cc-section">
          <div className="cc-hint">
            Informe o salário: margens (35% e 5% RMC/RCC), valores liberados (margem ÷ coeficiente) e total são calculados na hora.
            Ajuste os coeficientes conforme banco e prazo — os valores são salvos neste navegador.
          </div>
          <div className="cc-grid">
            <label>
              <span>Salário / benefício bruto (referência) <em className="req">obrigatório</em></span>
              <input
                value={salarioBruto}
                onChange={(e) => setSalarioBruto(e.target.value)}
                placeholder="0,00"
                inputMode="decimal"
              />
            </label>
            <label>
              <span>Margem disponível (última consulta) <em className="opt">opcional</em></span>
              <input
                value={margemDisponivel}
                onChange={(e) => setMargemDisponivel(e.target.value)}
                placeholder="Informado pelo banco"
                inputMode="decimal"
              />
            </label>
            <label>
              <span>Data da última consulta de margem <em className="opt">opcional</em></span>
              <input type="datetime-local" value={dataUltimaConsulta} onChange={(e) => setDataUltimaConsulta(e.target.value)} />
              <small>Gravar junto aos valores para saber se a margem está atualizada</small>
            </label>

            <div className="cc-coef-block cc-span2">
              <strong className="cc-coef-title">Coeficientes (divisão da margem — variam por banco e prazo)</strong>
              <div className="cc-coef-grid">
                <label>
                  <span>35% (padrão 0,023728)</span>
                  <input
                    value={coef35Str}
                    onChange={(e) => setCoef35Str(e.target.value)}
                    placeholder="0,023728"
                    inputMode="decimal"
                    autoComplete="off"
                  />
                </label>
                <label>
                  <span>RMC (padrão 0,023)</span>
                  <input
                    value={coefRmcStr}
                    onChange={(e) => setCoefRmcStr(e.target.value)}
                    placeholder="0,023"
                    inputMode="decimal"
                    autoComplete="off"
                  />
                </label>
                <label>
                  <span>RCC (padrão 0,023)</span>
                  <input
                    value={coefRccStr}
                    onChange={(e) => setCoefRccStr(e.target.value)}
                    placeholder="0,023"
                    inputMode="decimal"
                    autoComplete="off"
                  />
                </label>
              </div>
            </div>

            <div className="cc-valores-auto cc-span2">
              <strong>Simulação automática</strong>
              <table className="cc-valores-table">
                <thead>
                  <tr>
                    <th />
                    <th>Margem</th>
                    <th>÷ Coef.</th>
                    <th>Vlr liberado</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>35%</td>
                    <td>
                      R${" "}
                      {simulacaoConsignado.margemPct35.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="cc-mono">{coefsEfetivos.coef35.toLocaleString("pt-BR", { maximumFractionDigits: 8 })}</td>
                    <td>
                      R${" "}
                      {simulacaoConsignado.vlrLiberado35.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                  <tr>
                    <td>RMC</td>
                    <td>
                      R${" "}
                      {simulacaoConsignado.margemRmc.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="cc-mono">{coefsEfetivos.coefRmc.toLocaleString("pt-BR", { maximumFractionDigits: 8 })}</td>
                    <td>
                      R${" "}
                      {simulacaoConsignado.vlrLiberadoRmc.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                  <tr>
                    <td>RCC</td>
                    <td>
                      R${" "}
                      {simulacaoConsignado.margemRcc.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="cc-mono">{coefsEfetivos.coefRcc.toLocaleString("pt-BR", { maximumFractionDigits: 8 })}</td>
                    <td>
                      R${" "}
                      {simulacaoConsignado.vlrLiberadoRcc.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}>
                      <strong>Total liberado</strong>
                      <small className="cc-foot-note">soma dos três valores liberados</small>
                    </td>
                    <td>
                      <strong>
                        R${" "}
                        {simulacaoConsignado.totalLiberado.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </strong>
                    </td>
                  </tr>
                </tfoot>
              </table>
              <small className="cc-muted-inline">
                Regra de margem: 35% = salário × 0,35 · RMC e RCC = salário × 0,05. Percentual do cadastro ({pctMargem}%) segue tipo de beneficiário + cartão para outros usos no CRM.
              </small>
            </div>
          </div>
        </section>
      )}

      {step === 4 && (
        <section className="cc-section">
          <div className="cc-hint">
            Documentos tipados permitem montar checklist de pendências por proposta. Apenas metadados são salvos neste ambiente (nome do arquivo e data).
          </div>
          <div className="cc-doc-list">
            {TIPOS_DOC_UPLOAD.map((tipo) => (
              <div key={tipo} className="cc-doc-row">
                <span>{tipo}</span>
                <input type="file" onChange={(e) => onFilePicked(tipo, e.target.files)} />
                {documentos.find((d) => d.tipo === tipo) && (
                  <small className="ok">✓ {documentos.find((d) => d.tipo === tipo)?.nomeArquivo}</small>
                )}
              </div>
            ))}
          </div>

          <h3 className="cc-subtitle">LGPD e origem</h3>
          <div className="cc-grid">
            <label className="cc-span2">
              <span>Observações <em className="opt">opcional</em></span>
              <textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={3}
                placeholder="Notas da importação, pendências internas…"
              />
            </label>
            <label className="cc-span2 cc-check">
              <input type="checkbox" checked={lgpdOk} onChange={(e) => setLgpdOk(e.target.checked)} />
              <span>
                Declaro que obtive consentimento do titular para tratamento dos dados conforme a LGPD. <em className="req">obrigatório</em>
              </span>
            </label>
            <label className="cc-span2">
              <span>Operador (auditoria)</span>
              <input readOnly value={user?.name ?? "—"} />
              <small>Registrado automaticamente com data/hora no salvamento</small>
            </label>
            <label className="cc-span2">
              <span>Canal de origem <em className="req">obrigatório</em></span>
              <select value={canalOrigem} onChange={(e) => setCanalOrigem(e.target.value)}>
                <option value="">Selecione...</option>
                {CANAIS_ORIGEM.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>
        </section>
      )}

      <footer className="cc-wizard-foot">
        <span className="cc-progress">
          {step + 1} de {steps.length} — {steps[step]}
        </span>
        <div className="cc-wizard-actions">
          <button type="button" className="btn-ghost" onClick={back} disabled={step === 0}>
            Anterior
          </button>
          {step < steps.length - 1 ? (
            <button type="button" className="cta-lead ripple-btn" onClick={next}>
              Próximo
            </button>
          ) : (
            <button type="button" className="cta-lead ripple-btn" onClick={() => void submit()} disabled={saving}>
              {saving ? "Salvando..." : "Concluir cadastro"}
            </button>
          )}
          <button type="button" className="btn-ghost" onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </footer>
    </div>
  );
}
