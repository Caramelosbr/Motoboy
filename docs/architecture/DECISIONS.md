# Decisões de Arquitetura — Projeto Motoboy

Este documento registra decisões técnicas aprovadas para evitar mudanças de direção sem análise.

Cada nova decisão deverá informar:

- Status.
- Contexto.
- Decisão.
- Motivo.
- Consequências.
- Data.

---

## DEC-001 — Utilizar Vite sem React

**Status:** Aprovada  
**Data:** 28/08/2026

### Contexto

O projeto atual utiliza HTML, CSS e JavaScript. Adicionar React agora aumentaria o tamanho e o risco da migração.

### Decisão

Continuar utilizando Vite com TypeScript e DOM nativo.

### Motivo

Vite resolve módulos, dependências e build sem exigir a reconstrução completa da interface.

### Consequências

- O projeto não utilizará React nesta fase.
- As telas serão organizadas em templates e controladores TypeScript.
- React só poderá ser considerado futuramente mediante nova análise.

---

## DEC-002 — Migração progressiva

**Status:** Aprovada  
**Data:** 28/08/2026

### Contexto

O `index.html` concentra milhares de linhas e possui regras de negócio importantes.

### Decisão

Migrar uma funcionalidade por vez, preservando o funcionamento atual.

### Motivo

Uma reescrita completa teria alto risco de quebrar cálculos, rotas, clientes e registros financeiros.

### Consequências

- O código legado continuará existindo temporariamente.
- Cada etapa terá um commit separado.
- O legado só será removido depois que sua substituição estiver testada.

---

## DEC-003 — Clean Architecture por funcionalidade

**Status:** Aprovada  
**Data:** 28/08/2026

### Decisão

Organizar cada funcionalidade nas camadas:

- Domain.
- Application.
- Infrastructure.
- Presentation.

### Regras

- Domain não conhece Firebase, DOM ou localStorage.
- Application depende de interfaces.
- Infrastructure implementa Firebase e armazenamento.
- Presentation controla telas e eventos.

### Consequências

Cada funcionalidade poderá ser testada e modificada isoladamente.

---

## DEC-004 — Firebase como infraestrutura

**Status:** Aprovada  
**Data:** 28/08/2026

### Decisão

Utilizar:

- Firebase Authentication para identidade.
- Firestore para os dados dos usuários.
- Firebase Emulator Suite para testes.
- Cloud Functions somente para operações privilegiadas.

### Consequências

O domínio não poderá importar diretamente bibliotecas do Firebase.

---

## DEC-005 — Separação dos dados pelo UID

**Status:** Aprovada  
**Data:** 28/08/2026

### Decisão

Cada motoboy terá seus dados dentro da própria subárvore:

`users/{uid}/...`

### Consequências

- Um usuário não poderá consultar dados de outro.
- Cache local também deverá ser separado pelo UID.
- Nenhum e-mail ou UID será fixado no código.

---

## DEC-006 — Firestore será a fonte oficial

**Status:** Aprovada para a arquitetura final  
**Data:** 28/08/2026

### Decisão

Depois da migração, o Firestore será a fonte oficial dos registros autenticados.

O armazenamento local será utilizado somente como:

- Cache.
- Estado temporário da interface.
- Fila de sincronização controlada.

### Consequências

Nenhuma funcionalidade financeira poderá depender exclusivamente do localStorage na versão comercial.

---

## DEC-007 — Integridade financeira

**Status:** Aprovada para implementação futura  
**Data:** 28/08/2026

### Decisão

- Valores monetários serão armazenados em centavos.
- Registros financeiros não serão apagados definitivamente.
- Exclusões serão cancelamentos auditáveis.
- Operações relacionadas deverão ser transacionais.
- Totais mensais serão resultados derivados.

### Consequências

Será necessária uma migração controlada dos registros existentes.

---

## DEC-008 — Pontes globais são temporárias

**Status:** Aprovada  
**Data:** 28/08/2026

### Decisão

As funções `window.__motoboy...` serão mantidas somente durante a migração.

### Consequências

- Não criar novas regras de negócio nessas pontes.
- Remover cada ponte quando a respectiva funcionalidade deixar o monólito.
- A arquitetura final não dependerá de variáveis globais.

---

## DEC-009 — Alterações pequenas e verificáveis

**Status:** Aprovada  
**Data:** 28/08/2026

### Decisão

Cada etapa deve:

- Possuir objetivo único.
- Apresentar o Git diff.
- Executar typecheck e build.
- Ter critérios de aceitação.
- Ser salva em commit separado.
- Não realizar deploy sem autorização.

### Consequências

Nenhum agente deverá implementar todo o plano de migração de uma vez.

---

## DEC-010 — Mecanismo temporário de carregamento do painel legado

**Status:** Aprovada
**Data:** 29/08/2026

### Contexto

O JavaScript do painel vivia inline no `index.html` e era executado antes da autenticação. A Etapa 1A o extraiu para `src/legacy/panel.js` a fim de permitir, na Etapa 1B, controlar quando ele inicializa. O scan de strict mode (node --check em módulo; ausência de `this` de topo, `with`, `document.write`, octais e globais implícitas) passou sem bloqueadores, viabilizando um módulo ES.

### Decisão

- `src/legacy/panel.js` é um **módulo temporário** durante a migração; será removido na Etapa 10.
- `bootstrapPanel()` é o **ponto explícito e único de inicialização** do código legado.
- `window.setView` é mantido **temporariamente**, exclusivamente por causa do `onclick` legado remanescente no HTML.
- **Nenhuma nova regra de negócio** poderá ser adicionada ao módulo legado.
- A **Etapa 1B** criará uma **única entrada autenticada** que chamará `bootstrapPanel()` apenas para usuário autenticado e verificado, uma vez.
- No **logout**, a Etapa 1B deverá **desmontar completamente o painel ou recarregar a página após o `signOut`**; apenas sobrepor o login **não** será considerado proteção suficiente.
- Se o módulo ES vier a ser incompatível com strict mode, esta decisão deverá ser **revisada** antes de recorrer a script clássico (`public/legacy`). Scan atual: compatível.

### Consequências

- Na Etapa 1A, `bootstrapPanel()` é chamado de forma **incondicional** em `src/main.ts` (comportamento idêntico ao anterior).
- A proteção real da inicialização depende da Etapa 1B (ainda não autorizada).
- O contrato de pontes `window.__motoboy*` / `window.__applyRemote*` é preservado.

---

## DEC-011 — Camada compartilhada de notificações

**Status:** Aprovada
**Data:** 29/08/2026

### Contexto

O app usa diálogos nativos do navegador (`alert`) para sucesso, validação e erro. Eles têm aparência branca fora do tema, bloqueiam o fluxo e não seguem a acessibilidade do produto.

### Decisão

- Criar uma **camada compartilhada de UI** em `src/shared/presentation/notifications/` (Etapa 1D).
- **Diálogos nativos do navegador não serão usados** (`alert`/`confirm`/`prompt`).
- **Toast** será usado para **sucesso, informação, aviso e erro NÃO bloqueante**.
- **Validações específicas de campo** devem migrar para **mensagens inline** quando cada feature for extraída (não agora).
- **Confirmações destrutivas** continuarão no **modal atual** (`requestDeleteConfirmation`) por enquanto.
- Um **`confirmDialog` baseado em Promise** só será criado quando houver **migração real** das confirmações.
- **Nenhuma API será exposta em `window`** (o componente é um módulo ES importado por `main.ts` e pelo módulo legado).
- O **componente compartilhado não pode conter regras de negócio**.

### Consequências

- 1D-A cria apenas o `showToast` (sem substituir nenhum `alert` ainda).
- As substituições de `alert` por toast virão em etapas seguintes (1D-B+).
- O modal de confirmação e a eventual API assíncrona ficam para uma etapa futura autorizada.

---

## DEC-012 — Firestore como fonte oficial dos dados financeiros e persistência do `fsId`

**Status:** Aprovada
**Data:** 30/08/2026

### Contexto

A auditoria de persistência e sincronização (ver `CURRENT_STATE.md`, seções 9 a 12) confirmou que abastecimentos, manutenções e entradas manuais gravam no Firestore por ponte, mas o vínculo entre o registro local e o documento remoto (`fsId`) podia se perder: o `saveLocalState()` rodava de forma síncrona **antes** do retorno do `addDoc`, e o `fsId` recebido depois só era escrito em memória, nunca re-persistido. Isso causa registros "não sincronizados", possível duplicação ao recarregar e atualizações/exclusões que não encontram o documento remoto.

A Etapa 2A corrige **somente** essa perda de vínculo para **novos** registros. Ela **não** resolve toda a diferença entre celular e computador (carga inicial, conflitos, offline e `onSnapshot` seguem fora de escopo).

### Decisão

Direção arquitetural registrada (parte já aprovada em decisões anteriores, consolidada aqui):

- O **Firestore será a única fonte oficial** dos dados financeiros.
- O `localStorage` financeiro atual é **transitório** e será eliminado após a migração.
- O `localStorage` ficará **somente para preferências não financeiras**.
- O **estado da interface** será mantido em memória e alimentado pelos repositórios.
- **Cada feature terá repository próprio.**
- Dados serão isolados por `users/{uid}/...`.
- **IDs do Firestore serão a identidade oficial** dos registros.
- `createdAt` e `updatedAt` usarão **timestamp do servidor**.
- `effectiveDate` representará a **data real do lançamento** (distinta do carimbo de criação).
- Estados de **loading, sincronizando, offline e erro** deverão ser visíveis.
- Os **dados fictícios serão apagados** antes de usuários reais; **não haverá migração** dos dados fictícios.
- A **persistência offline permanente do Firestore** será decidida posteriormente, considerando dispositivo confiável.
- `controlStartMonth` será criado por usuário na etapa de **perfil/onboarding**.
- Esta **etapa de `fsId` é transitória** e **não** transforma o `localStorage` em fonte oficial.

### Escopo aplicado nesta etapa (2A)

- Correção aplicada **apenas a novos registros** de abastecimentos, manutenções e entradas manuais.
- Após a criação remota concluir com sucesso: valida que o ID é uma string não vazia, **reencontra o registro no estado atual** e confirma que ele ainda existe antes de definir o `fsId`, e só então executa `saveLocalState()`.
- **Não** cria segundo documento remoto, **não** altera valores financeiros, **não** altera a identidade das rotas (que já usa ID estável), **não** corrige registros antigos sem `fsId` e **não** reconcilia duplicatas existentes.
- Em falha remota (Promise rejeitada ou `id` inválido) o `fsId` **não** é persistido; o cache local é mantido.

### Nota técnica de identidade local

Os VMs legados (`refuels`, `maintenances`, `entradas`) **não possuem um campo de ID local persistente**; sua identidade em memória é a própria referência do objeto no array. Nesta etapa a reassociação após o retorno remoto é feita reencontrando o registro **no array vivo** (`indexOf` na variável de módulo, que os hooks `__applyRemote*` podem reatribuir) e confirmando que ele ainda existe, em vez de introduzir um novo campo de identidade local — o que seria uma mudança de forma de dado fora do escopo autorizado. A adoção de um ID local estável persistente (alinhado a "IDs do Firestore serão a identidade oficial") fica para uma etapa futura da estratégia de sincronização (Etapa 5).

### Consequências

- Novos lançamentos passam a manter o `fsId` após recarregar a página, reduzindo o risco de duplicação e de operações que não encontram o documento remoto.
- A diferença total entre dispositivos **permanece em aberto**: carga inicial, conflitos, offline e `onSnapshot` continuam fora de escopo e serão tratados na Etapa 5.
- Nenhuma mudança de schema do Firestore, regras, coleções ou dados foi feita nesta etapa.

---

## DEC-013 — Modelo financeiro normalizado

**Status:** Aprovada (desenho) — implementação não iniciada
**Data:** 30/08/2026

### Contexto

Clientes, contas a receber e recebimentos vivem no monólito e no `localStorage`, sem sincronização entre aparelhos e com valores em ponto flutuante. A Etapa 3A auditou o modelo atual e definiu o desenho de destino. Esta decisão registra **apenas o desenho aprovado**; nada foi implementado, publicado ou migrado.

### Decisão

- O financeiro passa a viver em **quatro coleções por usuário**, sob `users/{uid}/`:
  - `clients/{clientId}`
  - `receivables/{receivableId}`
  - `payments/{paymentId}`
  - `incomeEntries/{entryId}`
- **Firestore é a fonte oficial** dos dados financeiros autenticados.
- **Valores monetários em centavos inteiros** (`int`), nunca float.
- **`effectiveDate`** (data real do lançamento, `AAAA-MM-DD`) é **separado** de `createdAt`/`updatedAt` (que usam `serverTimestamp`).
- **`remainingCents` é calculado** (`amountCents - paidCents`) e **nunca persistido**.
- **`clientId` é a única identidade** do cliente. **Nomes duplicados são permitidos**; o nome nunca é usado como chave de relacionamento. Campos opcionais de diferenciação (`phone`, `nickname`, `notes`) podem existir; a UI pode alertar sobre nomes semelhantes, mas **não funde históricos** automaticamente. Renomear não gera cascata.

### Invariante de Receivable

- `status == 'cancelled'` ⇒ `paidCents == 0`.
- Quando **não** cancelado:
  - `open` ⇒ `paidCents == 0`;
  - `partial` ⇒ `0 < paidCents < amountCents`;
  - `paid` ⇒ `paidCents == amountCents`.
- Sempre: `0 ≤ paidCents ≤ amountCents`.

### Estado de implementação

- Decisão arquitetural **aprovada**. As coleções, o código e os índices **ainda não existem**; nenhum documento foi criado; nenhum deploy foi feito.

### Consequências

- Um repositório por coleção (encaixe direto na Clean Architecture já usada nas features atuais).
- O `localStorage` financeiro será eliminado no cutover (ver DEC-017); até lá, o comportamento atual permanece intacto.

---

## DEC-014 — IncomeEntry como única fonte do faturamento

**Status:** Aprovada (desenho) — implementação não iniciada
**Data:** 30/08/2026

### Contexto

Hoje a receita é somada a partir de um array `entradas` que mistura entradas manuais, rota paga na hora e recebimentos — com risco de dupla contagem. A Etapa 3A definiu uma fonte única.

### Decisão

- **Gráficos, totais e faturamento leem somente `incomeEntries`.**
- Toda receita de rota segue a mesma cadeia: **Route Service → Receivable → Payment → IncomeEntry**. **Não existe atalho `route_cash`.**
- **`Receivable` e pagamento pendente não entram no faturamento.**
- Valores de `incomeEntry` são **sempre positivos**; o sinal é dado por **`direction: 'credit' | 'debit'`** (líquido = `Σ credit − Σ debit`).
- **Todo `IncomeEntry` é imutável, inclusive o de origem manual.** O modelo **não** possui `cancelledAt` nem `updatedAt`.
- **Correção ou cancelamento gera um novo lançamento compensatório** (`debit`/`credit`), nunca edição ou exclusão.

### Estado de implementação

- Decisão **aprovada**. Nenhuma coleção `incomeEntries`, consulta de gráfico ou lançamento existe ainda; os gráficos atuais continuam lendo o modelo legado até o cutover.

### Consequências

- Faturamento sem dupla contagem, auditável e reconstruível a partir dos lançamentos.

---

## DEC-015 — Operações financeiras atômicas no servidor

**Status:** Aprovada (desenho) — implementação e deploy não realizados
**Data:** 30/08/2026

### Contexto

As operações financeiras compostas (rateio, confirmação/cancelamento de rota, estorno) precisam de atomicidade e de validação que o cliente não pode garantir sozinho.

### Decisão

- As seguintes operações serão **Cloud Functions callable transacionais** (Admin SDK):
  - `recordClientPayment`
  - `confirmRoute`
  - `cancelRoute`
  - `reversePayment`
  - `cancelReceivable`
  - `createManualIncome`
  - `reverseManualIncome`
- Operações compostas usam **`runTransaction`** (todas as leituras, validações, updates e creates na mesma transação).
- Rateio **FIFO** (conta aberta mais antiga primeiro) com **`MAX_FIFO = 100`**.
- **`MAX_FIFO` é um limite operacional deliberado do produto**, justificado por **latência** (transação curta), **contenção** (menos locks concorrentes), **tamanho do documento `Payment`** (array `allocations` enxuto), **volume previsível de leituras/atualizações** e **previsibilidade operacional** — **não** por um suposto teto fixo de 500 writes por transação. A consulta usa `limit(MAX_FIFO + 1)` e **rejeita a operação inteira** quando houver mais de 100 recebíveis elegíveis; **nunca** faz rateio parcial silencioso.
- **O cliente não escreve diretamente em `incomeEntries`** (nem em `payments`, `receivables.paidCents`/`status`).
- **`cancelRoute` nunca estorna pagamentos automaticamente.** Ele **rejeita** se algum receivable da rota possuir `paidCents > 0`; o pagamento precisa ser revertido **explicitamente** (`reversePayment`) antes, e só então `cancelRoute` cancela os recebíveis abertos.

### Precisão transacional de cancelRoute

- A **transação começa antes da consulta**.
- A consulta filtra **`sourceType == 'route'` e `sourceId == routeId`**.
- **Leitura, validação de `paidCents`, cancelamento dos recebíveis e atualização da rota ocorrem dentro da mesma transação.**
- **Não pode existir janela de concorrência** entre a validação e a escrita.

### Estado de implementação

- Decisão **aprovada**. **Nenhuma Cloud Function foi implementada nem publicada**; o projeto ainda não possui `functions/`; nenhuma callable existe. Depende de configuração de billing/deploy em etapa futura autorizada.

### Consequências

- Invariantes financeiras garantidas fora do cliente; será necessário índice composto para o FIFO (registrado como implementação futura, sem alterar índices agora).

---

## DEC-016 — Idempotência, reversão e imutabilidade

**Status:** Aprovada (desenho) — implementação não iniciada
**Data:** 30/08/2026

### Decisão

- **`Payment` é totalmente imutável.** O pagamento original **não recebe nenhum campo de retro-referência de reversão**; a ligação existe apenas do lado da reversão, via `reversesPaymentId`.
- **Reversão de pagamento** é um **novo `Payment`**:
  - `kind = 'reversal'`;
  - `amountCents` **positivo**;
  - `reversesPaymentId` = id do pagamento original;
  - **mesmas `allocations`** do original;
  - **ID determinístico `rev_{originalPaymentId}`** — sua existência **impede uma segunda reversão**.
- **`IncomeEntry` da reversão:** `direction = 'debit'`, `amountCents` positivo, **ID `inc_rev_{originalPaymentId}`**.
- **Entrada manual:**
  - criação via callable (`createManualIncome`), **ID determinístico `minc_{idempotencyKey}`**;
  - reversão via `reverseManualIncome`, **ID `revinc_{originalIncomeEntryId}`** (a existência do id impede segunda reversão).
- **`idempotencyKey`** validado antes de formar qualquer caminho do Firestore, com **`^[A-Za-z0-9_-]{1,64}$`** (letras, números, `-`, `_`; sem barra, espaço ou caractere especial).
- **`requestHash` calculado no servidor** (JSON canônico com ordem de chaves estável). **Mesma chave + mesmo pedido → retorna o resultado anterior**; **mesma chave + pedido diferente → conflito** (`already-exists`/`failed-precondition`).
- **`serviceId` no formato `svc_{UUIDv4}`**, criado **uma única vez** ao adicionar o serviço à rota, estável ao reordenar/editar, **nunca** derivado do índice visual e **nunca** regenerado no `confirmRoute`. Regex: `^svc_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`.
- **`routeId` e `serviceId` são validados** (tipo, tamanho, ausência de barra) **antes de formar caminhos** determinísticos (`rt_{routeId}_{serviceId}`, `pay_{routeId}_{serviceId}`, `inc_pay_{routeId}_{serviceId}`).
- **`confirmRoute` usa `confirmationHash`** (servidor) para detectar payload diferente sob os mesmos ids: **IDs determinísticos sozinhos não substituem a comparação do hash**.

### Estado de implementação

- Decisão **aprovada**. Nenhuma dessas Functions, ids ou hashes existe ainda no código.

### Consequências

- Reenvio e duplo clique são seguros; auditoria completa; nada é editado ou apagado.

---

## DEC-017 — Construção paralela e cutover único

**Status:** Aprovada (desenho) — cutover e reset não executados
**Data:** 30/08/2026

### Decisão

- O **novo núcleo financeiro é construído em paralelo** (`shared/currency`, `customers`, `receivables`, `payments`, `income`, Cloud Functions, regras e testes), **sem nenhuma ligação parcial com o painel legado**.
- **Nenhum sistema financeiro híbrido na interface**: não substituir só `clientes[]` deixando contas/recebimentos ainda locais.
- **Sem migração dos dados fictícios atuais.**
- **Cutover único e controlado**, na ordem:
  1. **dry-run** do reset fictício;
  2. **relatório** do que seria apagado;
  3. **autorização** explícita;
  4. **reset** dos dados fictícios;
  5. **ativação das novas bridges**;
  6. **remoção do `localStorage` financeiro**.
- **Nenhuma escrita direta do cliente em `incomeEntries`** — apenas leitura (todas as escritas por Functions/Admin).

### Estado de implementação

- Decisão **aprovada**. **O reset dos dados fictícios ainda não foi executado**; nenhuma bridge nova foi ativada; o `localStorage` financeiro segue em uso pelo painel legado. O cutover será uma etapa própria, autorizada, com dry-run e confirmação.

### Consequências

- Transição de percepção atômica; risco isolado; possibilidade de rollback antes do cutover.

---

## DEC-018 — Política online, confirmação do servidor e sincronização

**Status:** Aprovada (desenho) — implementação e App Check não configurados
**Data:** 30/08/2026

### Decisão

- **Toda gravação financeira exige confirmação do servidor** antes de exibir sucesso.
- **Callables financeiras são online-only.** **Entradas manuais também são online-only.**
- **CRUD de clientes** pode continuar direto no Firestore, mas **só mostra sucesso após o acknowledgement do servidor**.
- **Estados de sincronização visíveis:** `salvando`, `salvo`, `offline`, `erro`.
- **Dados pendentes nunca entram no faturamento definitivo** (o `onSnapshot` ignora `metadata.hasPendingWrites` e leituras `fromCache` em totais definitivos).
- **Fuso oficial do MVP: `America/Sao_Paulo`.**
- **A data de reversão** (`reversePayment`/`reverseManualIncome`) é **calculada pelo servidor no dia real do estorno** (America/Sao_Paulo); **o cliente não escolhe nem adultera** essa data. `createdAt` sempre `serverTimestamp`. Correção retroativa será decisão separada.
- **App Check obrigatório antes de usuários reais.** As Functions de segunda geração usarão **`enforceAppCheck: true`** quando a etapa for autorizada.
- **Leituras podem usar cache** com indicação de estado, mas **cache não é confirmação financeira**.

### Estado de implementação

- Decisão **aprovada**. **App Check ainda não está configurado**; os estados de sincronização e as callables **ainda não existem**; nada foi publicado. O comportamento atual do painel permanece inalterado até o cutover (DEC-017).

### Consequências

- Faturamento nunca conta escrita pendente; convergência celular↔computador via Firestore + listeners.