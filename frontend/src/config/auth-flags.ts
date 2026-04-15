/**
 * Produção na nuvem: defina `VITE_AUTH_ENABLED=true` nas variáveis de ambiente
 * do build (Vercel). Sem isso, o app abre direto no CRM (modo local).
 */
export const AUTH_ENABLED = import.meta.env.VITE_AUTH_ENABLED === "true";
