/**
 * Pessoas que não fazem mais parte do time comercial como vendedoras.
 * Usado para: não recriar no seed, desativar no localStorage e limpar vínculos antigos no CRM.
 */
const DEPRECATED: string[] = [
  "karen kato",
  "gislene rosa",
  "gislene",
  "rafael",
  "rafaeli",
];

const SET = new Set(DEPRECATED);

export function isDeprecatedSellerName(name: string): boolean {
  const n = name.trim().toLowerCase();
  return SET.has(n);
}
