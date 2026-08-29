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