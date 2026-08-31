export type TenantSegment = 'imobiliario' | 'ecommerce' | 'saude' | 'juridico' | 'marketing_apenas' | 'geral';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  segment: TenantSegment;
  logoUrl?: string;
  whatsappNumber: string;
  whatsappQualityRating: 'GREEN' | 'YELLOW' | 'RED';
  coexistenceStatus: 'CONNECTED' | 'DISCONNECTED' | 'NEEDS_CHECKIN';
  lastMobileCheckinDaysAgo: number;
}

export interface HSMTemplate {
  id: string;
  name: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  language: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  bodyText: string;
  variables: string[];
}

export type Template = HSMTemplate;

export interface Campaign {
  id: string;
  title: string;
  segment: TenantSegment;
  templateId: string;
  templateName: string;
  status: 'DRAFT' | 'QUEUED' | 'SENDING' | 'COMPLETED' | 'PAUSED';
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  scheduledAt?: string;
  createdAt: string;
}

export interface QueueLog {
  id: string;
  timestamp: string;
  recipientPhone: string;
  recipientName: string;
  status: 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  details: string;
}

export interface Property {
  id: string;
  title: string;
  type: 'Apartamento' | 'Casa' | 'Cobertura' | 'Lote' | 'Comercial';
  neighborhood: string;
  city: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  areaSqMeter: number;
  imageUrl: string;
  code: string;
  status: 'Disponível' | 'Reservado' | 'Lançamento' | 'Vendido';
  matchingLeadsCount: number;
  filteredLeadsCount?: number;
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string;
  interestSegment: string;
  interestPropertyType: string;
  budgetMax: number;
  lastContactAt: string;
  status: 'NOVO' | 'EM_ATENDIMENTO' | 'VISITA_AGENDADA' | 'PROPOSTA' | 'FECHADO';
}
