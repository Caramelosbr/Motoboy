# Próxima etapa — modelo de tarefa

> Preencha um bloco por etapa. Uma etapa = um micro-passo autorizado = um commit.
> Copie este modelo, não o apague. Sem autorização explícita, não altere arquivos.

## Situação

- **DEC-020.3B-2A/2B/2C — CONCLUÍDAS** (resolução, diff resolvido e publicação na application; commits `48fe21b`, `5591fe4`, `c1bf21b`).
- **DEC-019.1 — CONCLUÍDA** (scaffold isolado de `functions/`, Node 22 + esbuild; commit `050b9b7`).
- **DEC-019.2 — CONCLUÍDA.** `publishPricingTable` server-side em `functions/src/pricing/` (reprocessa parser/resolução/diff; `requestHash`=SHA-256 por porta injetada; idempotência antes da concorrência; IDs novos determinísticos; ports + fakes; 13 testes). Sem firebase-admin, callable, Auth/App Check, Rules, UI ou deploy.
- **DEC-019.3A — CANDIDATA (ainda NÃO autorizada).** Adapter **Admin/Firestore transacional** das ports + **mapeadores** + **testes no Emulator**. **Sem callable, Rules, App Check ou deploy.** Só desenho abaixo; aguarda autorização explícita.

---

## Identificação (candidata — NÃO autorizada)

- **Etapa:** DEC-019.3A — adapter Admin/Firestore transacional + mapeadores + testes no Emulator
- **Depende de:** DEC-019.2 (ports `PricingActiveTableReader`/`PricingPublishTransaction`/`PricingIdGenerator`/`RequestHasher`) e DEC-020 (modelo Firestore).
- **Autorizada em:** _(pendente — não iniciar)_ — implementar somente após autorização explícita.

## Objetivo (candidata)

Implementar em `functions/src/` os **adapters Admin/Firestore** que satisfazem as ports transacionais da DEC-019.2 — leitura consistente da tabela ativa por `uid`, **commit atômico** (transação/batch) com **idempotência antes da concorrência**, geração de IDs e digest — mais os **mapeadores** domínio↔documento, validados por **testes no Firestore Emulator**. **Sem** handler callable, **sem** `firestore.rules`, **sem** App Check, **sem** deploy.

## Escopo candidato (a confirmar na autorização) — `functions/src/…`

- **Criar (adapters):** `PricingActiveTableReaderAdmin` (lê `pricingConfig/active` + `areas` da versão ativa por `uid`), `PricingPublishTransactionAdmin` (transação Admin: valida idempotência por `idempotencyKey`+`requestHash` **antes** da concorrência `expectedActiveVersionId`/`expectedRevision`; cria versão+áreas+ativação; troca ponteiro e incrementa `revision`; tudo-ou-nada), `PricingIdGeneratorAdmin` (IDs de área — determinísticos por semente, coerentes com retries).
- **Criar (mapeadores):** domínio↔Firestore (`PricingArea`↔doc de área; versão; ativação; ponteiro), com `amountCents` inteiro e sem perda/coerção.
- **Criar (testes Emulator):** sucesso, idempotência (duplo commit → 1 versão, mesmos ids), concorrência (`revision`/ponteiro divergentes → sem escrita), atomicidade (falha no meio → nada persiste), mapeamento round-trip.
- **Criar/alterar (config de teste):** setup do Firestore Emulator para os testes de integração (host/porta, projeto de teste), isolado; **sem** afetar a suíte web.
- **Talvez alterar (só exports):** barrel do server para expor os adapters (não os fakes).
- **NÃO tocar:** handler callable, `firestore.rules`, `firestore.indexes.json`, App Check, deploy, `src/` (só importado), `docs/architecture`, `package*` da raiz.

## Contrato / critérios (candidata)

- Adapters implementam **exatamente** as interfaces da DEC-019.2 (substituíveis pelos fakes nos testes de unidade); o use-case `publishPricingTable` **não muda**.
- **Idempotência antes da concorrência** também no adapter real; retries não duplicam versões/áreas nem geram IDs diferentes; `requestHash` SHA-256 persistido (nunca o JSON).
- Escrita **exclusivamente** por transação/batch Admin; **nenhuma** escrita parcial; leitura consistente por `uid`.
- Emulator isolado; a suíte web (raiz) segue **20/397**; `functions` typecheck/build/auditoria verdes; testes Emulator num script próprio (podem exigir Java/emulador — documentar e não quebrar o `check` padrão quando o Emulator não estiver disponível).

## Fora de escopo (não fazer)

- Handler/gateway **callable**, `firestore.rules`, App Check, deploy; `reactivatePricingTable`; UI; núcleo financeiro autoritativo; reestruturação `apps/` + `packages/core`.

## Registro da etapa concluída (DEC-019.2)

- **DEC-019.2 — CONCLUÍDA.** `functions/src/pricing/`: use-case `publishPricingTable` (reprocessa parser→resolução→diff; ignora proposta do cliente), ports `PricingActiveTableReader`/`PricingIdGenerator`/`RequestHasher`/`PricingPublishTransaction`, `Sha256RequestHasher` (`node:crypto`), fakes (não exportados) e 13 testes; `vitest` próprio das functions + `vitest.config.ts` na raiz excluindo `functions/**`. Idempotência antes da concorrência; IDs determinísticos; `requestHash`=SHA-256.
- **Commit:** `feat: adiciona publishPricingTable server-side com idempotencia e concorrencia`.

## Registro arquitetural

- Nova decisão arquitetural: **Não** (implementa DEC-019 + DEC-020). Decisões pontuais da DEC-019.3A (forma dos docs Firestore, execução do Emulator no CI) — se divergirem do desenho — apresentar antes e registrar em `docs/architecture/DECISIONS.md`.
