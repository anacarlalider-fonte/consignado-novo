import { useState } from "react";
import type { Opportunity } from "../data/mock-data";

const STORAGE_KEY = "crm-kato-pipeline-labels-v1";
const SLA_KEY = "crm-kato-pipeline-sla-v1";

const DEFAULTS: Record<Opportunity["etapa"], string> = {
  Prospeccao: "Prospecção",
  Diagnostico: "Diagnóstico",
  Proposta: "Proposta",
  Negociacao: "Negociação",
  Fechado: "Fechado",
  Perdido: "Perdido"
};

const DEFAULT_SLA: Record<string, number> = {
  Prospeccao: 3,
  Diagnostico: 5,
  Proposta: 7,
  Negociacao: 10,
};

function load(): Record<Opportunity["etapa"], string> {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { ...DEFAULTS };
  try {
    const parsed = JSON.parse(raw) as Partial<Record<Opportunity["etapa"], string>>;
    return {
      Prospeccao: parsed.Prospeccao || DEFAULTS.Prospeccao,
      Diagnostico: parsed.Diagnostico || DEFAULTS.Diagnostico,
      Proposta: parsed.Proposta || DEFAULTS.Proposta,
      Negociacao: parsed.Negociacao || DEFAULTS.Negociacao,
      Fechado: parsed.Fechado || DEFAULTS.Fechado,
      Perdido: parsed.Perdido || DEFAULTS.Perdido
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function loadSla(): Record<string, number> {
  const raw = localStorage.getItem(SLA_KEY);
  if (!raw) return { ...DEFAULT_SLA };
  try { return { ...DEFAULT_SLA, ...JSON.parse(raw) }; } catch { return { ...DEFAULT_SLA }; }
}

export function usePipelineLabels() {
  const [labels, setLabels] = useState<Record<Opportunity["etapa"], string>>(load);
  const [sla, setSla] = useState<Record<string, number>>(loadSla);

  function renameStage(stage: Opportunity["etapa"], newLabel: string) {
    const trimmed = newLabel.trim();
    if (!trimmed) return;
    const next = { ...labels, [stage]: trimmed };
    setLabels(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function updateSla(stage: string, days: number) {
    const next = { ...sla, [stage]: days };
    setSla(next);
    localStorage.setItem(SLA_KEY, JSON.stringify(next));
  }

  function resetLabels() {
    setLabels({ ...DEFAULTS });
    localStorage.removeItem(STORAGE_KEY);
  }

  return { labels, sla, renameStage, updateSla, resetLabels };
}
