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