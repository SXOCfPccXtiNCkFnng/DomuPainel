import { Tenant, Campaign, HSMTemplate, Property, Lead, QueueLog } from '@/types';

export const mockTenants: Tenant[] = [
  {
    id: 'tenant-1',
    name: 'Imobiliária Prime Living',
    slug: 'prime-living',
    segment: 'imobiliario',
    whatsappNumber: '+55 16 99876-5432',
    whatsappQualityRating: 'GREEN',
    coexistenceStatus: 'CONNECTED',
    lastMobileCheckinDaysAgo: 3,
  },
  {
    id: 'tenant-2',
    name: 'DOMU Tech HQ',
    slug: 'domu-hq',
    segment: 'geral',
    whatsappNumber: '+55 16 99123-4567',
    whatsappQualityRating: 'GREEN',
    coexistenceStatus: 'CONNECTED',
    lastMobileCheckinDaysAgo: 1,
  }
];

export const mockTemplates: HSMTemplate[] = [
  {
    id: 'tpl-1',
    name: 'lancamento_imobiliario_vip',
    category: 'MARKETING',
    language: 'pt_BR',
    status: 'APPROVED',
    bodyText: 'Olá {{nome}}! Acabamos de lançar o {{imovel}} em {{bairro}}. Unidades a partir de R$ {{valor}}. Gostaria de agendar uma visita exclusiva esta semana?',
    variables: ['nome', 'imovel', 'bairro', 'valor']
  },
  {
    id: 'tpl-2',
    name: 'lembrete_visita_imovel',
    category: 'UTILITY',
    language: 'pt_BR',
    status: 'APPROVED',
    bodyText: 'Olá {{nome}}, confirmando sua visita ao imóvel {{imovel}} amanhã às {{horario}} com o corretor {{corretor}}. Podemos confirmar?',
    variables: ['nome', 'imovel', 'horario', 'corretor']
  },
  {
    id: 'tpl-3',
    name: 'oportunidade_queda_preco',
    category: 'MARKETING',
    language: 'pt_BR',
    status: 'APPROVED',
    bodyText: 'Atenção {{nome}}! O imóvel {{imovel}} teve uma redução exclusiva de valor! Preço atualizado: R$ {{valor}}. Clique para conversar com nossa equipe.',
    variables: ['nome', 'imovel', 'valor']
  }
];

export const mockCampaigns: Campaign[] = [
  {
    id: 'camp-101',
    title: 'Disparo Lançamento Residencial Jardinópolis',
    segment: 'imobiliario',
    templateId: 'tpl-1',
    templateName: 'lancamento_imobiliario_vip',
    status: 'SENDING',
    totalRecipients: 450,
    sentCount: 312,
    deliveredCount: 298,
    readCount: 215,
    failedCount: 2,
    createdAt: '2026-08-27 14:30'
  },
  {
    id: 'camp-100',
    title: 'Lembretes de Visitas Fim de Semana',
    segment: 'imobiliario',
    templateId: 'tpl-2',
    templateName: 'lembrete_visita_imovel',
    status: 'COMPLETED',
    totalRecipients: 84,
    sentCount: 84,
    deliveredCount: 84,
    readCount: 79,
    failedCount: 0,
    createdAt: '2026-08-26 09:00'
  },
  {
    id: 'camp-99',
    title: 'Alerta Oportunidade Alto da Boa Vista',
    segment: 'imobiliario',
    templateId: 'tpl-3',
    templateName: 'oportunidade_queda_preco',
    status: 'COMPLETED',
    totalRecipients: 320,
    sentCount: 320,
    deliveredCount: 318,
    readCount: 264,
    failedCount: 2,
    createdAt: '2026-08-24 16:15'
  }
];

export const mockProperties: Property[] = [
  {
    id: 'prop-1',
    code: 'DOM-304',
    title: 'Residencial Horizon Tower - 3 Suítes',
    type: 'Apartamento',
    neighborhood: 'Alto da Boa Vista',
    city: 'Ribeirão Preto',
    price: 890000,
    bedrooms: 3,
    bathrooms: 4,
    areaSqMeter: 128,
    imageUrl: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600&auto=format&fit=crop&q=80',
    status: 'Lançamento',
    matchingLeadsCount: 142
  },
  {
    id: 'prop-2',
    code: 'DOM-118',
    title: 'Casa em Condomínio Fechado Alphaville',
    type: 'Casa',
    neighborhood: 'Bonfim Paulista',
    city: 'Ribeirão Preto',
    price: 1650000,
    bedrooms: 4,
    bathrooms: 5,
    areaSqMeter: 310,
    imageUrl: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&auto=format&fit=crop&q=80',
    status: 'Disponível',
    matchingLeadsCount: 89
  },
  {
    id: 'prop-3',
    code: 'DOM-502',
    title: 'Studio Compact Moderno com Varanda Grill',
    type: 'Apartamento',
    neighborhood: 'Jardim Botânico',
    city: 'Ribeirão Preto',
    price: 340000,
    bedrooms: 1,
    bathrooms: 1,
    areaSqMeter: 48,
    imageUrl: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600&auto=format&fit=crop&q=80',
    status: 'Disponível',
    matchingLeadsCount: 215
  }
];

export const mockLeads: Lead[] = [
  {
    id: 'lead-1',
    name: 'Carlos Eduardo Silva',
    phone: '+55 16 99788-1122',
    email: 'carlos.silva@email.com',
    interestSegment: 'Imobiliário',
    interestPropertyType: 'Apartamento 3 suítes',
    budgetMax: 950000,
    lastContactAt: 'Há 2 horas',
    status: 'VISITA_AGENDADA'
  },
  {
    id: 'lead-2',
    name: 'Mariana Oliveira Souza',
    phone: '+55 16 99655-4433',
    email: 'mariana.souza@email.com',
    interestSegment: 'Imobiliário',
    interestPropertyType: 'Casa Alphaville',
    budgetMax: 1800000,
    lastContactAt: 'Ontem',
    status: 'PROPOSTA'
  },
  {
    id: 'lead-3',
    name: 'Roberto Fernando Mendes',
    phone: '+55 16 99144-8899',
    email: 'roberto.mendes@email.com',
    interestSegment: 'Imobiliário',
    interestPropertyType: 'Studio investimento',
    budgetMax: 400000,
    lastContactAt: 'Há 3 dias',
    status: 'NOVO'
  }
];

export const mockQueueLogs: QueueLog[] = [
  {
    id: 'q-1',
    timestamp: '14:32:05',
    recipientPhone: '+55 16 99788-1122',
    recipientName: 'Carlos Eduardo Silva',
    status: 'READ',
    details: 'Disparo aceito pela Cloud API da Meta -> Entregue e Lido'
  },
  {
    id: 'q-2',
    timestamp: '14:32:01',
    recipientPhone: '+55 16 99655-4433',
    recipientName: 'Mariana Oliveira Souza',
    status: 'DELIVERED',
    details: 'Disparo enviado via BullMQ Queue #102 -> Entregue'
  },
  {
    id: 'q-3',
    timestamp: '14:31:58',
    recipientPhone: '+55 16 99144-8899',
    recipientName: 'Roberto Fernando Mendes',
    status: 'SENT',
    details: 'Disparo processado com sucesso'
  }
];
