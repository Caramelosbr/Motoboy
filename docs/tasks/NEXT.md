# Próxima etapa — modelo de tarefa

> Preencha um bloco por etapa. Uma etapa = um micro-passo autorizado = um commit.
> Copie este modelo, não o apague. Sem autorização explícita, não altere arquivos.

## Situação

- **DEC-020.3B-2A — CONCLUÍDA** (`resolvePricingProposal`, commit `48fe21b`).
- **DEC-020.3B-2B — CONCLUÍDA** (`diffResolvedPricingTable`, commit `5591fe4`).
- **DEC-020.3B-2C — CONCLUÍDA** (porta `PricingPublishGateway` + `publishResolvedPricingTable` + fake; 397 testes verdes).
- **PRÓXIMA CANDIDATA — Scaffold das Functions (DEC-019), ainda NÃO autorizada.** Só o esqueleto de build; **sem callables, sem rules, sem App Check, sem deploy**. Só desenho abaixo; aguarda autorização explícita antes de qualquer arquivo.

---

## Identificação (candidata — NÃO autorizada)

- **Etapa:** Scaffold das Functions conforme DEC-019 (esqueleto de build)
- **Depende de:** DEC-019 (aprovada como desenho) e o núcleo compartilhado em `src/` (domain/application).
- **Autorizada em:** _(pendente — não iniciar)_ — implementar somente após autorização explícita.

## Objetivo (candidata)

Criar apenas o **esqueleto de build** das Cloud Functions em `functions/`, que **importa e inlina** o núcleo compartilhado de `src/` (nunca duplica domínio/moeda/validações), compila com esbuild para `functions/lib/index.js` e resolve em typecheck/bundle. **Nenhuma lógica autoritativa, callable, regra do Firestore, App Check ou deploy** nesta etapa.

## Escopo autorizado (a confirmar na autorização) — candidatos

- **Criar:** `functions/package.json`, `functions/package-lock.json` (deps externas: `firebase-admin`, `firebase-functions`).
- **Criar:** `functions/tsconfig.json` (contexto Node 22, independente; tipando só `functions/src/**` + módulos de `src/` efetivamente importados).
- **Criar:** `functions/src/index.ts` (entrypoint mínimo que importa o núcleo via `../../src/…` e o expõe/registra o mínimo, sem handlers callable).
- **Criar:** config de build esbuild (`bundle:true`, `platform:'node'`, `target:'node22'`, outfile `functions/lib/index.js`, externals `firebase-admin(/*)`/`firebase-functions(/*)`); CJS×ESM **confirmado na implementação, não presumido**.
- **Talvez alterar:** `firebase.json` (apenas `source: functions` + codebase + `predeploy` de build) — **somente se autorizado explicitamente**, pois é infraestrutura.
- **NÃO tocar agível sem autorização:** `firestore.rules`, callables, App Check, deploy, `src/` (a não ser imports resolvendo), `index.html`, `docs/architecture`, `package*` da raiz.

## Contrato / critérios (candidata)

- O núcleo de `src/` é **inlinado** no bundle (não por o CLI seguir imports fora de `functions/`); `../../src/…` a partir de `functions/src/index.ts`.
- `firebase-admin`/`firebase-functions` permanecem **externals**; sem duplicar domínio/FIFO/moeda; sem servidor no bundle do navegador.
- Build gera `functions/lib/index.js`; `functions/lib` e `functions/node_modules` **não versionados** (`.gitignore` se necessário).
- **Sem** callables, rules, App Check, Emulator run ou deploy. Nada autoritativo ainda.
- Baseline do web intacta: `npm run check` da raiz continua verde; nenhuma regressão em `src/`.

## Fora de escopo (candidata scaffold)

- Callables autoritativas, `firestore.rules`, App Check, Emulator run, deploy; geração de IDs; lógica de negócio no servidor; reestruturação `apps/` + `packages/core`.

## Registro da etapa concluída (3B-2C)

- **DEC-020.3B-2C — CONCLUÍDA.** Porta de comando `PricingPublishGateway` + caso de uso `publishResolvedPricingTable` (pré-validação defensiva; `published` só com ack durável; `conflict`/`error`/`offline`/`invalid_payload`; idempotência de duplo clique) + `FakePricingPublishGateway` (só em `testing/`, não exportado). 10 testes do caso de uso; núcleo do web intacto; sem Firebase/Functions/UI/deploy; cliente não é fronteira de segurança (servidor revalida).
- **Commit:** `feat: adiciona caso de uso de publicacao de pricing`.

## Registro arquitetural

- Nova decisão arquitetural: **Não** (detalhe de implementação sob a DEC-020/DEC-019). Se surgir mudança estrutural (ex.: escolha CJS×ESM, `firebase.json`), apresentar antes e registrar em `docs/architecture/DECISIONS.md`.
