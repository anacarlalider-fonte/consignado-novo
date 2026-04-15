/**
 * Cálculos consignado: margens a partir do salário e valores liberados por coeficiente (banco/prazo).
 */
import type { NewClient } from "../data/mock-data";

export type CoeficientesConsignado = {
  coef35: number;
  coefRmc: number;
  coefRcc: number;
};

export const COEFICIENTES_PADRAO: CoeficientesConsignado = {
  coef35: 0.023728,
  coefRmc: 0.023,
  coefRcc: 0.023,
};

const MARGEM_PCT35 = 0.35;
const MARGEM_RMC = 0.05;
const MARGEM_RCC = 0.05;

export function roundMoney2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Interpreta coeficiente digitado (vírgula ou ponto). */
export function parseCoeficienteInput(s: string): number {
  const t = s.trim().replace(/\s/g, "").replace(",", ".");
  if (!t) return NaN;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : NaN;
}

export type ResultadoConsignadoSalario = {
  margemPct35: number;
  margemRmc: number;
  margemRcc: number;
  vlrLiberado35: number;
  vlrLiberadoRmc: number;
  vlrLiberadoRcc: number;
  totalLiberado: number;
};

/**
 * Margem 35% = salário × 0,35 · RMC/RCC = salário × 0,05.
 * Vlr liberado = margem ÷ coeficiente (cada linha usa o coeficiente correspondente).
 * Total = soma dos três valores liberados.
 */
export function calcularConsignadoPorSalario(
  salario: number,
  coefs: CoeficientesConsignado = COEFICIENTES_PADRAO
): ResultadoConsignadoSalario {
  if (!Number.isFinite(salario) || salario <= 0) {
    return {
      margemPct35: 0,
      margemRmc: 0,
      margemRcc: 0,
      vlrLiberado35: 0,
      vlrLiberadoRmc: 0,
      vlrLiberadoRcc: 0,
      totalLiberado: 0,
    };
  }
  const m35 = roundMoney2(salario * MARGEM_PCT35);
  const mRmc = roundMoney2(salario * MARGEM_RMC);
  const mRcc = roundMoney2(salario * MARGEM_RCC);
  const div = (margem: number, c: number) =>
    c > 0 && Number.isFinite(c) ? roundMoney2(margem / c) : 0;
  const v35 = div(m35, coefs.coef35);
  const vRmc = div(mRmc, coefs.coefRmc);
  const vRcc = div(mRcc, coefs.coefRcc);
  const total = roundMoney2(v35 + vRmc + vRcc);
  return {
    margemPct35: m35,
    margemRmc: mRmc,
    margemRcc: mRcc,
    vlrLiberado35: v35,
    vlrLiberadoRmc: vRmc,
    vlrLiberadoRcc: vRcc,
    totalLiberado: total,
  };
}

/**
 * Na importação CSV: preenche margens, valores liberados e total quando ainda estão vazios (undefined).
 * Usa coeficientes padrão; não altera células já preenchidas na planilha.
 */
export function applyCalculoConsignadoCompleto(
  nc: NewClient,
  coefs: CoeficientesConsignado = COEFICIENTES_PADRAO
): NewClient {
  const s = nc.salarioBrutoReferencia;
  if (s === undefined || !Number.isFinite(s) || s <= 0) return nc;
  const out = { ...nc };
  if (out.margemPct35 === undefined) out.margemPct35 = roundMoney2(s * MARGEM_PCT35);
  if (out.margemRmc === undefined) out.margemRmc = roundMoney2(s * MARGEM_RMC);
  if (out.margemRcc === undefined) out.margemRcc = roundMoney2(s * MARGEM_RCC);
  const m35 = out.margemPct35 ?? 0;
  const mRmc = out.margemRmc ?? 0;
  const mRcc = out.margemRcc ?? 0;
  if (out.vlrLiberado35 === undefined && coefs.coef35 > 0) out.vlrLiberado35 = roundMoney2(m35 / coefs.coef35);
  if (out.vlrLiberadoRmc === undefined && coefs.coefRmc > 0) out.vlrLiberadoRmc = roundMoney2(mRmc / coefs.coefRmc);
  if (out.vlrLiberadoRcc === undefined && coefs.coefRcc > 0) out.vlrLiberadoRcc = roundMoney2(mRcc / coefs.coefRcc);
  if (out.totalLiberado === undefined) {
    const v35 = out.vlrLiberado35 ?? 0;
    const vRmc = out.vlrLiberadoRmc ?? 0;
    const vRcc = out.vlrLiberadoRcc ?? 0;
    out.totalLiberado = roundMoney2(v35 + vRmc + vRcc);
  }
  return out;
}

/** @deprecated use applyCalculoConsignadoCompleto */
export function applyMargensAutomaticasDesdeSalario(nc: NewClient): NewClient {
  return applyCalculoConsignadoCompleto(nc, COEFICIENTES_PADRAO);
}
