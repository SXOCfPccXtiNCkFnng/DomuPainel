# Domu Tech — Plataforma de Automação para Corretores e Imobiliárias

## Contexto da empresa

A Domu Tech é uma agência digital (site: https://domutech.digital/), com atuação inicial em São Roque/SP, oferecendo hoje serviços de marketing digital, geração de leads, criação de sites e automação para pequenas e médias empresas de diversos segmentos.

Este documento descreve uma nova linha de produto: uma plataforma própria (SaaS) de automação de WhatsApp voltada, num primeiro momento, para corretores de imóveis e imobiliárias — com potencial de expansão futura para outros segmentos (clínicas, salões, hotéis, restaurantes, automotivo, comércio) sob o mesmo portal da Domu Tech.

---

## Origem da ideia / problema a resolver

Corretores de imóveis hoje fazem divulgação de imóveis manualmente pelo WhatsApp: selecionam uma lista de contatos, escolhem um imóvel, copiam a mensagem e enviam um a um. Isso consome muito tempo e, principalmente, faz o número de WhatsApp do corretor ser bloqueado ou limitado pela plataforma, porque esse tipo de disparo manual/repetitivo é identificado como comportamento de spam.

A proposta central é resolver esse problema pela raiz, usando a infraestrutura oficial de mensageria da própria Meta (dona do WhatsApp) para empresas — em vez de qualquer ferramenta de disparo não oficial (do tipo automação via WhatsApp Web, "aquecedor de chip" etc., que apenas atrasam o bloqueio, não o eliminam).

---

## Visão geral do produto

Uma plataforma que permite ao corretor/imobiliária automatizar a divulgação de imóveis pelo WhatsApp de forma organizada, segmentada e dentro das regras oficiais, encontrar automaticamente os clientes certos para cada imóvel, e futuramente usar IA para atender, qualificar e acompanhar esses clientes — tudo sem risco de bloqueio do número.

---

## Funcionalidade principal: disparo inteligente de imóveis

O corretor cadastra seus imóveis na plataforma e cria campanhas de divulgação. Exemplo de imóvel cadastrado:

> Apartamento no Jardim Europa — 3 quartos, 2 vagas, 85m², R$ 450.000

Ao criar uma campanha, o corretor escolhe:
- Qual imóvel divulgar;
- Público-alvo (região, faixa de preço, tipo de imóvel, perfil/interesse do cliente);
- Quantidade de contatos;
- Data e horário do disparo.

O sistema identifica os contatos elegíveis (com base no perfil de interesse cadastrado) e realiza o envio de forma controlada, evitando o modelo de "mandar pra todo mundo indiscriminadamente". A plataforma gerencia automaticamente:
- Consentimento dos contatos (opt-in) para receber mensagens daquele número — pré-requisito indispensável, não apenas uma boa prática;
- Contatos que pediram para não receber mais mensagens;
- Frequência de envio por contato;
- Histórico de campanhas e quais imóveis cada contato já recebeu;
- Taxa de resposta e qualidade das campanhas;
- Bloqueios/denúncias;
- Limites de envio da conta (que crescem gradualmente conforme a reputação da conta se mantém boa — contas novas começam com um limite diário conservador de contatos únicos, e esse limite sobe automaticamente com o tempo e o bom comportamento, nunca é ilimitado desde o primeiro dia);
- Uso de mensagens padronizadas e pré-aprovadas para cada tipo de campanha (não é permitido texto livre em massa).

---

## Segmentação de contatos

O corretor organiza os clientes com atributos de interesse, por exemplo:

> João — Interesse: apartamento; Região: Campolim; Faixa: R$ 400–500 mil; 3 quartos; 2 vagas

> Maria — Interesse: casa em condomínio; Região: Sorocaba; Faixa: R$ 800 mil–1 milhão

Ao cadastrar um novo imóvel, o corretor pode filtrar e enviar apenas para quem tem perfil compatível ("enviar para interessados em apartamentos de até R$ 500 mil em Sorocaba"), tornando a campanha relevante em vez de disparar o mesmo imóvel para toda a agenda.

---

## Atendimento automático via IA

Depois do disparo, a IA responde automaticamente a perguntas recorrentes do cliente, consultando os dados cadastrados dos imóveis:
- "Tem mais fotos?"
- "Aceita financiamento?"
- "Tem apartamento de 3 quartos até 500 mil?" → a IA busca entre os imóveis cadastrados e apresenta opções compatíveis.

---

## IA de qualificação de leads (evolução futura)

A IA conversa com o cliente em linguagem natural para entender o que ele procura — por exemplo, a partir de "Estou procurando um apartamento para minha família, até uns 600 mil, preciso de 3 quartos e quero ficar próximo ao centro", a IA extrai tipo de imóvel, valor, quartos e localização, busca imóveis compatíveis no catálogo e, se houver interesse real, transfere a conversa para o corretor humano continuar o atendimento.

---

## Follow-up automático

Acompanhamento automatizado de leads ao longo do tempo, por exemplo:
- Dia 1: envia o imóvel;
- Cliente demonstra interesse;
- Dia 2: envia informações adicionais;
- Dia 4: pergunta se gostaria de agendar uma visita;
- Dia 7: apresenta outro imóvel semelhante.

O corretor não precisa lembrar manualmente de dar retorno a cada lead.

---

## Gestão de imóveis

A plataforma funciona também como um pequeno sistema de gestão imobiliária. Cada imóvel tem: fotos, valor, endereço/região, quartos, banheiros, vagas, área, condomínio, características, descrição, status (disponível/vendido/reservado) e código do imóvel. Esses dados alimentam tanto os anúncios quanto o atendimento da IA.

---

## CRM de clientes

Funil simples de acompanhamento: Novo lead → Interessado → Imóvel enviado → Visita agendada → Negociação → Venda. O corretor sabe exatamente em que estágio está cada cliente.

---

## Agendamento de visitas

Quando o cliente manifesta interesse em visitar o imóvel, o sistema apresenta horários disponíveis e realiza o agendamento; o corretor é notificado e a visita fica registrada.

---

## Relatórios

Acompanhamento de resultados por campanha, por exemplo:

> Campanha: Apartamento Jardim Europa — 500 contatos elegíveis, 500 enviados, 327 entregues, 86 respostas, 24 interessados, 8 visitas agendadas, 2 negociações.

Isso permite entender quais imóveis e campanhas realmente geram resultado.

---

## Requisitos de conformidade (o "não cair" é o diferencial central)

Este é o ponto que diferencia o produto de concorrentes que vendem listas de contatos e ferramentas de disparo não oficiais (que reproduzem o mesmo risco de bloqueio que motivou a ideia):

- Toda a mensageria roda sobre a infraestrutura oficial de mensagens comerciais da própria Meta, não sobre automação não oficial.
- O corretor mantém o número de WhatsApp que já usa hoje, junto com o aplicativo que já usa normalmente no celular — a plataforma se conecta a esse mesmo número por cima, sem exigir a compra de um número novo nem a perda do uso pessoal do app (modalidade de "coexistência" entre app e automação no mesmo número).
- Só é permitido enviar campanha para contatos que deram consentimento explícito para receber mensagens daquele número — consentimento não pode ser presumido, comprado ou herdado de uma lista antiga sem confirmação.
- Toda mensagem de divulgação em massa usa um modelo de texto pré-aprovado, não texto livre.
- O volume de envio começa conservador e cresce automaticamente conforme a conta mantém boa reputação (taxa de bloqueio/denúncia baixa, boas respostas) — não é um limite fixo escolhido pela plataforma, é controlado pela própria Meta.
- A plataforma monitora continuamente a "saúde"/reputação de cada conta conectada, para agir antes que vire um problema de bloqueio.

---

## Modelo de onboarding do cliente

Fluxo pensado para ser simples para um público leigo em tecnologia (corretor autônomo, não tem perfil técnico):
1. O corretor clica em "Conectar meu WhatsApp" dentro da plataforma.
2. Faz login com a conta de negócio dele (poucos cliques, sem burocracia pesada para uso inicial).
3. Confirma que quer manter o app do celular funcionando junto com a automação (mantém o número e o app que já usa).
4. Pronto — a plataforma sincroniza o histórico e já libera o uso.

Não há necessidade de comprar chip/número novo, nem de processos técnicos manuais da parte do cliente. Verificações documentais mais formais da empresa dele só entram em jogo se o volume de envio dele crescer muito (não é necessário para o uso inicial/leve).

---

## Modelo de negócio

Estrutura de cobrança pensada em três partes, para se adaptar ao volume real de cada cliente (que varia e não é conhecido de antemão):
1. Mensalidade fixa — cobre acesso à plataforma (painel, CRM, IA, suporte), independente do volume de disparo.
2. Um pacote de mensagens de campanha incluso na mensalidade (volume conservador).
3. Cobrança por mensagem excedente ao pacote, escalando naturalmente com o uso real de cada cliente.

Planos vão de um nível de entrada mais simples (uso leve, poucos disparos semanais) até planos maiores para imobiliárias com volume alto e múltiplos corretores.

---

## Estratégia de lançamento

Começar pelo segmento imobiliário, porque já existe um problema concreto identificado, contato direto com corretores (via rede de um corretor amigo que relatou o problema de bloqueio), e uma via natural para conseguir os primeiros usuários através dessa rede. A mesma estrutura de produto pode, no futuro, deixar de ser exclusiva do setor imobiliário: o portal da Domu Tech pode oferecer o mesmo tipo de automação para outros segmentos (clínicas, salões, hotéis, restaurantes, automotivo, comércio em geral), cada um com automações específicas ao seu contexto.

---

## Arquitetura Técnica & Especificação de Interface (Portal DOMU SaaS)

Para operacionalizar a visão acima com máxima nitidez visual e performance, o Portal DOMU foi estruturado com as seguintes tecnologias e convenções:

### Stack de Desenvolvimento
- **Framework Principal**: Next.js 14+ (App Router, React Client/Server Components, TypeScript).
- **Estilização & UI System**: TailwindCSS + Google Fonts **Plus Jakarta Sans** (tipografia moderna e legível para dashboards densos de CRM).
- **Gerenciamento de Fila de Disparo**: Redis + BullMQ (processamento assíncrono de envios respeitando o rate limit da Meta API de 5 msgs/s).
- **Interface Responsiva de Tela Cheia**: Layout fluido `w-full` ocupando 100% da largura útil do monitor, sem travamentos de margem.

### Módulos Principais do Portal
1. **Dashboard Principal (`/`)**: Visão geral executiva com métricas de entrega, taxa de resposta, funil de vendas em 4 etapas e atalhos de automação.
2. **Central de Disparos (`/disparos`)**: Painel minimalista com tabela fluida de campanhas, busca instantânea, barra de progresso ativa da fila BullMQ e atalho para criar nova campanha.
3. **Central de Atendimento 1:1 (`/atendimento`)**: Interface inspirada no **WhatsApp Web** em tela ampla (`h-[calc(100vh-10rem)]`), com lista de conversas recentes, chat interativo com balões de mensagem e painel lateral de CRM com perfil do lead e ações rápidas do corretor.
4. **Catálogo de Imóveis & Leads (`/imoveis`)**: Visualização de lançamentos imobiliários com indicador de leads compatíveis e modal de **Cadastro Manual de Imóveis (`NovoImovelModal`)** para adicionar novos empreendimentos em segundos sem depender de integrações complexas.
5. **Templates de Mensagens (`/templates`)**: Gerenciador de modelos de disparo com o **Criador/Editor de Templates (`CriarTemplateModal`)**, atalhos de variáveis dinâmicas (`{{nome}}`, `{{imovel}}`, `{{valor}}`, `{{bairro}}`) e preview ao vivo no celular.
6. **Relatórios de Análise (`/relatorios`)**: Dashboard gerencial com **Gráfico de Linha / Tendência com Eixo Y de Valores à Esquerda**, datas formatadas no rodapé (`22/08` a `28/08`) e tooltip interativo de hover.
7. **Assinatura & Planos (`/assinatura`)**: Gestão do plano ativo (*Plano Pro Imobiliário • R$ 497/mês*), gauges de consumo de disparos/atendentes e tabela comparativa de upgrades.
8. **Configurações & Coexistência (`/configuracoes`)**: Painel de credenciais da Meta Cloud API (WABA ID, Phone Number ID, Access Token) e monitor da Coexistência com WhatsApp Business App.

---

## Repositório & Versionamento Oficial
Todo o código-fonte deste projeto é mantido e versionado no repositório oficial do GitHub:
- **URL**: `https://github.com/SXOCfPccXTiNCkFnng/DomuPainel.git`
- **Branch Principal**: `main`

---

## Resumo da proposta

Uma plataforma que permite ao corretor automatizar a divulgação de imóveis pelo WhatsApp, encontrar automaticamente os clientes certos para cada imóvel, manter o número e o WhatsApp que ele já usa no dia a dia, e futuramente usar IA para atender, qualificar e acompanhar esses clientes — tudo dentro das regras oficiais da Meta, para nunca correr o risco de bloqueio que hoje é o principal problema do processo manual.
