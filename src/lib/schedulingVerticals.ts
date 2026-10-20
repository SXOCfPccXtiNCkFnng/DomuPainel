/**
 * Ramos que funcionam com agenda (serviço com duração + horário + lembrete):
 * lava rápido (automotivo) e saúde e beleza (barbearia, salão, manicure,
 * estética, clínicas, dentistas...). Mesma agenda, mesma atendente; muda só
 * o vocabulário — tudo que é "do ramo" fica aqui.
 */

export type SchedulingVertical = 'automotivo' | 'saude';

export function schedulingVerticalOf(segment: string | null | undefined): SchedulingVertical | null {
  return segment === 'automotivo' || segment === 'saude' ? segment : null;
}

export function isSchedulingSegment(segment: string | null | undefined): boolean {
  return schedulingVerticalOf(segment) !== null;
}

export type SchedulingCopy = {
  /** "um lava rápido e estética automotiva" — completa "atende os clientes da X, ___". */
  businessDescription: string;
  /** O que a atendente pergunta além de serviço/dia/horário/nome (o carro), ou null. */
  item: { label: string; ask: string; toolDescription: string } | null;
  /** "pergunte se pode ajudar com ___" ao recusar assunto fora do ramo. */
  helpWith: string;
  /** Exemplos de informação que costuma faltar nos dados (não inventar). */
  unknownExamples: string;
  /** Sem preços: por que o valor é passado pela equipe. */
  priceHidden: string;
  /** Situações que vão para a equipe, além de reclamação e pedido de pessoa. */
  complaintExamples: string;
  /** Regras extras do ramo no prompt (ex.: saúde não dá diagnóstico). */
  extraRules: string[];
  reminderEmoji: string;
  greetingEmoji: string;
  casualGreetingLine: string;
  // Tela
  capacityTitle: string;
  capacityHint: string;
  capacityUnit: string;
  capacityExample: (n: number) => string;
  servicePlaceholder: string;
  serviceSuggestions: { name: string; duration_minutes: number; price: string; description: string }[];
  assistantIntro: string;
  aboutPlaceholder: string;
  addressPlaceholder: string;
  extraInfoPlaceholder: string;
  greetingPlaceholder: (assistant: string, company: string) => string;
  promoPlaceholder: string;
  companyPlaceholder: string;
  contactsSubtitle: string;
  dashboardSubtitle: string;
};

export const SCHEDULING_COPY: Record<SchedulingVertical, SchedulingCopy> = {
  automotivo: {
    businessDescription: 'um lava rápido e estética automotiva',
    item: {
      label: 'carro',
      ask: 'o modelo do carro',
      toolDescription: 'Modelo do carro (e placa/cor, se o cliente disse).',
    },
    helpWith: 'o carro',
    unknownExamples: 'estacionamento, leva e traz, marcas de produto, garantia, tempo de espera',
    priceHidden: 'o valor depende do carro e do estado dele e é passado pela equipe',
    complaintExamples: 'Reclamação, problema com o carro, pedido de reembolso',
    extraRules: [],
    reminderEmoji: ' 🚗',
    greetingEmoji: ' 🚗',
    casualGreetingLine: 'Bora deixar esse carro brilhando?',
    capacityTitle: 'Atender mais de um carro ao mesmo tempo',
    capacityHint: 'Ligue se você tem mais de um box ou equipe. Desligado, a agenda aceita um carro por vez.',
    capacityUnit: 'carros',
    capacityExample: (n) =>
      `Exemplo com ${n}: às 9h cabem ${n} carros. Um polimento de 4h ocupa uma vaga das 9h às 13h, e as outras ${n - 1} continuam livres para outros serviços.`,
    servicePlaceholder: 'Ex.: Lavagem completa',
    serviceSuggestions: [
      { name: 'Lavagem simples', duration_minutes: 30, price: '40', description: '' },
      { name: 'Lavagem completa', duration_minutes: 60, price: '70', description: 'Externa + interna e aspiração' },
      { name: 'Higienização interna', duration_minutes: 180, price: '250', description: '' },
      { name: 'Polimento', duration_minutes: 240, price: '350', description: '' },
    ],
    assistantIntro:
      'A atendente responde seus clientes no WhatsApp como alguém da equipe, focada no lava rápido. Você ajusta o jeito dela e o que ela sabe; as regras de atendimento (não inventar preço, só oferecer horário livre, confirmar antes de marcar) ficam sempre ligadas.',
    aboutPlaceholder: 'Ex.: Lava rápido e estética automotiva há 8 anos, especialistas em polimento e vitrificação.',
    addressPlaceholder: 'Ex.: Av. Brasil, 1200 — Centro, Campinas (ao lado do posto)',
    extraInfoPlaceholder: `Ex.:
- Não lavamos motor.
- Em dia de chuva, remarcamos sem custo.
- Carro muito sujo (barro, pelo de pet) pode ter valor adicional.
- Temos sala de espera com café e Wi-Fi.`,
    greetingPlaceholder: (assistant, company) =>
      `Ex.: Oi! Aqui é ${assistant}, da ${company}. Seu carro merece um trato hoje? Como posso te ajudar?`,
    promoPlaceholder: 'Ex.: Lavagem completa + cera por R$ 70,00, de segunda a quarta. Não vale para caminhonete.',
    companyPlaceholder: 'Ex.: Brilho Car Estética Automotiva',
    contactsSubtitle: 'Importação e listas por serviço, veículo e frequência de visita',
    dashboardSubtitle: 'Disparos, respostas, clientes e lavagens agendadas',
  },
  saude: {
    businessDescription: 'um negócio de saúde e beleza (o tipo de atendimento está em "Sobre" nos DADOS)',
    item: null,
    helpWith: 'algum serviço ou horário',
    unknownExamples: 'estacionamento, convênio, marcas de produto, garantia, tempo de espera, quem é o profissional',
    priceHidden: 'o valor depende da avaliação e é passado pela equipe',
    complaintExamples: 'Reclamação, problema com um atendimento, incômodo ou reação depois de um procedimento, pedido de reembolso',
    extraRules: [
      'Você não é profissional de saúde nem de estética: não dê diagnóstico, não indique tratamento, remédio ou cuidado, não diga se um procedimento é indicado para a pessoa e não prometa resultado. Isso é com o profissional, no atendimento ou na avaliação.',
      'Dor forte, sangramento, inchaço, reação alérgica ou qualquer sinal de urgência: diga com cuidado para procurar atendimento de urgência agora (SAMU 192 se for grave) e use chamar_equipe.',
      'Não pergunte sobre doenças, remédios, exames, gravidez ou outras informações de saúde. Se o cliente contar algo assim, não repita nem comente; se for importante para o atendimento, diga que o profissional vai conversar sobre isso.',
      'Se a descrição do serviço ou as informações nos DADOS disserem que precisa de avaliação antes, ofereça marcar a avaliação.',
      'Não comente a aparência do cliente nem sugira serviço por causa dela.',
    ],
    reminderEmoji: '',
    greetingEmoji: ' ✨',
    casualGreetingLine: 'Bora marcar seu horário?',
    capacityTitle: 'Atender mais de um cliente ao mesmo tempo',
    capacityHint:
      'Ligue se você tem mais de uma cadeira, sala ou profissional atendendo ao mesmo tempo. Desligado, a agenda aceita um cliente por vez.',
    capacityUnit: 'clientes',
    capacityExample: (n) =>
      `Exemplo com ${n}: às 9h cabem ${n} clientes. Um atendimento de 2h ocupa uma vaga das 9h às 11h, e as outras ${n - 1} continuam livres para outros serviços.`,
    servicePlaceholder: 'Ex.: Corte masculino, Manicure, Limpeza de pele, Avaliação odontológica',
    serviceSuggestions: [],
    assistantIntro:
      'A atendente responde seus clientes no WhatsApp como alguém da equipe: apresenta os serviços, marca horários e confirma antes de agendar. Você ajusta o jeito dela e o que ela sabe; as regras (não inventar preço, só oferecer horário livre, não dar orientação de saúde) ficam sempre ligadas.',
    aboutPlaceholder:
      'Ex.: Barbearia no Centro há 10 anos, especialista em corte e barba. (Ou: clínica de estética facial, consultório odontológico, salão de beleza...)',
    addressPlaceholder: 'Ex.: Rua XV de Novembro, 300 — sala 12, Centro, Campinas',
    extraInfoPlaceholder: `Ex.:
- Tolerância de 10 minutos de atraso; depois disso, remarcamos.
- Cancelamento com pelo menos 2 horas de antecedência.
- Atendemos crianças a partir de 5 anos.
- Primeira consulta é sempre uma avaliação.`,
    greetingPlaceholder: (assistant, company) =>
      `Ex.: Oi! Aqui é ${assistant}, da ${company}. Quer marcar um horário? Me conta qual serviço você procura.`,
    promoPlaceholder: 'Ex.: Corte + barba por R$ 60,00, de terça a quinta.',
    companyPlaceholder: 'Ex.: Barbearia Navalha de Ouro',
    contactsSubtitle: 'Importação e listas por serviço e frequência de visita',
    dashboardSubtitle: 'Disparos, respostas, clientes e horários marcados',
  },
};

export function schedulingCopyFor(segment: string | null | undefined): SchedulingCopy {
  return SCHEDULING_COPY[schedulingVerticalOf(segment) || 'automotivo'];
}
