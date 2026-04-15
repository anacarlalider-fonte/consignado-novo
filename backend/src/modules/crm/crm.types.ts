export type LeadStatus = "Novo" | "Em contato" | "Qualificado" | "Perdido";
export type OpportunityStage = "Prospeccao" | "Diagnostico" | "Proposta" | "Negociacao" | "Fechado";
export type OrderUrgency = "CRITICO" | "ATENCAO" | "RECENTE";
export type OrderStage = "Novo" | "Contato iniciado" | "Negociacao" | "Aguardando pagamento" | "Concluido";

export type LeadItem = {
  id: string;
  nome: string;
  origem: string;
  responsavel: string;
  score: number;
  status: LeadStatus;
};

export type OpportunityItem = {
  id: string;
  titulo: string;
  cliente: string;
  vendedor: string;
  valor: number;
  etapa: OpportunityStage;
};

export type OrderItem = {
  pedido: number;
  cliente: string;
  vendedor: string;
  aFaturar: number;
  diasAberto: number;
  urgencia: OrderUrgency;
  etapaCRM: OrderStage;
  proximoFollowup?: string;
};
