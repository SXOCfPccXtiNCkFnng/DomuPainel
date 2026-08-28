# WhatsApp Cloud API: Coexistence & Guia Anti-Ban (DOMU Tech)

Este documento descreve as diretrizes técnicas e operacionais para disparos de alta performance via WhatsApp, prevenindo bloqueios ("bans") e permitindo o uso simultâneo do aplicativo móvel com a API Oficial (Coexistência).

---

## 1. Por que ocorrem os Bloqueios ("Bans")?

### APIs Não Oficiais (Baileys / Web Scraping / Wrappers Web)
- **Como funcionam**: Emulam o WhatsApp Web através do navegador headless ou conexão WebSocket.
- **Motivo do ban**: O algoritmo do Meta detecta facilmente comportamento não-humano (fingerprint do navegador, envio paralelo simultâneo, ausência de digitação real, padrões de IP).
- **Risco**: Risco **altíssimo** de banimento permanente do número de telefone em poucos disparos.

### API Oficial Meta (WhatsApp Cloud API)
- **Como funciona**: Conexão direta via HTTPS/REST autenticada com servidores oficiais do Meta.
- **Segurança de Ban de Protocolo**: **Zero risco de banimento de protocolo por usar a API**.
- **O que monitorar**: O Meta avalia a **Qualidade da Conta (Quality Rating)** com base no comportamento dos receptores (se marcarem como SPAM ou bloquearem o número).

---

## 2. WhatsApp Coexistence (Coexistência Móvel + Cloud API)

O **Coexistence (Coex)** é o recurso oficial lançado pelo Meta que permite a um número utilizar ao mesmo tempo:
1. **Aplicativo WhatsApp Business (Mobile)**: Para atendimentos manuais 1 a 1, catálogo e histórico mantidos no celular.
2. **WhatsApp Cloud API (DOMU Portal SaaS)**: Para automações de disparo, campanhas em massa, webhooks e integração com CRM.

### Requisitos e Regras do Coexistence
* **Preservação de Conta**: Durante o processo de onboarding, **NÃO exclua a conta do WhatsApp Business no celular**.
* **Embedded Signup**: O vinculo deve ser realizado via fluxo de *Embedded Signup* oficial da Meta.
* **Atividade Mínima**: É obrigatório abrir o aplicativo WhatsApp Business no dispositivo móvel **pelo menos 1 vez a cada 13-14 dias** para manter a sincronização e a sessão ativas.
* **Sincronização**: Mensagens enviadas no app aparecem no painel da API (eco) e vice-versa.

---

## 3. Blueprint Anti-Ban & Gestão de Qualidade

Para garantir que o número da agência ou cliente mantenha **Quality Rating VERDE (Alta Qualidade)**:

### 1. Sistema de Templates Pré-Aprovados (HSM)
* Disparos iniciados pela empresa (após a janela de 24h sem resposta do cliente) exigem **Templates Aprovados pelo Meta**.
* O template deve conter nome claro da marca, personalização de variáveis (`{{1}}`, `{{2}}`) e contexto relevante.

### 2. Warm-Up de Conta (Aquecimento Gradual)
* **Semana 1**: 20 a 50 mensagens por dia (foco em contatos que interagem).
* **Semana 2**: 100 a 250 mensagens por dia.
* **Semana 3+**: Escala progressiva automática pelo Meta (Tiers: 250 -> 1k -> 10k -> 100k -> Ilimitado por 24h).

### 3. Opt-in e Botão de Descadastro
* Enviar mensagens apenas para usuários que deram consentimento prévio (formulário de lead imobiliário, cadastro no site, opt-in WhatsApp).
* Incluir botão rápido no template de disparo: `[Não quero receber]` ou resposta `SAIR` para remover automaticamente do funil de disparos.

### 4. Controle de Vazão & Cadência (Rate Limiting)
* Mesmo usando a API Oficial, os disparos no módulo BullMQ/Redis devem ser espaçados em lotes (ex: 5 a 15 disparos por segundo no máximo) para evitar picos de denúncias simultâneas de usuários no mesmo minuto.

---

## 4. Passo a Passo para Ativação do Coexistence (Meta Cloud API)

1. **Conta de Negócios Meta (Meta Business Suite)**: Ter a BM (Business Manager) verificada ou em processo de verificação.
2. **Número de Telefone Ativo**: Manter a linha móvel com WhatsApp Business instalado no celular.
3. **Fluxo de Embedded Signup**: Vincular o número via formulário do Meta selecionando *"Manter conta existente do WhatsApp Business App"*.
4. **Verificação por SMS/Voz**: Inserir o código de confirmação no sistema.
5. **Configuração de Webhooks e Tokens**: Salvar `PHONE_NUMBER_ID`, `WABA_ID` e `ACCESS_TOKEN` no portal DOMU.
