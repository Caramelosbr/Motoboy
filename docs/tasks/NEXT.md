# Próxima etapa — modelo de tarefa

> Preencha um bloco por etapa. Uma etapa = um micro-passo autorizado = um commit.
> Copie este modelo, não o apague. Sem autorização explícita, não altere arquivos.

## Situação

- **DEC-020.3B-2A/2B/2C — CONCLUÍDAS** (resolução, diff resolvido e publicação na application; commits `48fe21b`, `5591fe4`, `c1bf21b`).
- **DEC-019.1 — CONCLUÍDA.** Scaffold isolado de `functions/` (Node 22, TypeScript, esbuild): bundle em `functions/lib/index.js`, núcleo de `src/` inlinado, `firebase-admin`/`firebase-functions` externos, `firebase.json` mínimo, `.gitignore`, scripts e auditoria de metafile. Sem callables/rules/App Check/UI/deploy. Baseline do web intacta (397 testes).
- **DEC-019.2 — CANDIDATA (ainda NÃO autorizada).** `application/server` (casos de uso autoritativos como contratos) + **ports de persistência transacional** (interfaces). **Sem Firebase, sem callable, sem deploy.** Só desenho abaixo; aguarda autorização explícita.

---

## Identificação (candidata — NÃO autorizada)

- **Etapa:** DEC-019.2 — `application/server` + ports de persistência transacional
- **Depende de:** DEC-019 (desenho), DEC-019.1 (scaffold) e o núcleo compartilhado em `src/` (domain/shared).
- **Autorizada em:** _(pendente — não iniciar)_ — implementar somente após autorização explícita.

## Objetivo (candidata)

Definir na camada **application/server** os **contratos** dos casos de uso autoritativos (executados só pelas Functions) e as **ports de persistência transacional** (interfaces), com **fakes** e **testes** — **sem** implementação Firebase/Admin, **sem** callable e **sem** deploy. É a fronteira que as Functions implementarão depois; o servidor é a autoridade de escrita, o cliente não é fronteira de segurança.

## Escopo candidato (a confirmar na autorização)

- **Criar (server, application):** casos de uso autoritativos como contratos/tipos + orquestração pura (ex.: publicação/reativação da tabela e/ou núcleo financeiro autoritativo — recorte exato a definir na autorização), dependendo **apenas de interfaces**.
- **Criar (ports):** ports de **persistência transacional** (interface de transação/batch, leitura consistente, escrita atômica do ponteiro/versões) — neutras, sem Firestore/Admin.
- **Criar (testing):** fakes das ports transacionais (memória; sem relógio/aleatório), **não** exportados pelo barrel de produção.
- **Criar (testes):** sucesso, concorrência (`expectedRevision`/`expectedActiveVersionId`), idempotência, atomicidade (tudo-ou-nada), rejeição/invalid.
- **Alterar (só exports):** barrel(s) de application do recorte escolhido.
- **NÃO tocar:** `functions/src` (handlers), Firebase/Admin real, `firestore.rules`, App Check, UI, deploy, `package*` da raiz, `docs/architecture`, `src/` fora do recorte.

## Contrato / critérios (candidata)

- Application depende de **interfaces** (nunca de implementação); domínio permanece puro; sem ciclos; sem default export.
- Ports transacionais expressam **atomicidade** e **controle de concorrência** (revision/ponteiro) sem conhecer Firestore.
- Fakes só em `testing/`, não exportados; result discriminado; sem exceções de negócio.
- Nenhuma escrita real, nenhum SDK, nenhum id gerado fora da autoridade; `npm run check` (raiz) e o `check` das `functions` continuam verdes.

## Fora de escopo (não fazer)

- Firebase/Admin real, callables/handlers, `firestore.rules`, App Check, Emulator run, deploy; UI; reestruturação `apps/` + `packages/core`.

## Registro da etapa concluída (DEC-019.1)

- **DEC-019.1 — CONCLUÍDA.** `functions/`: `package.json`/`package-lock.json` próprios (Node 22), `tsconfig.json` independente, `src/index.ts` (importa o núcleo via `../../src/…`, prova o inlining; SDK externo), `build.mjs` (esbuild CJS, externals `firebase-admin(/*)`/`firebase-functions(/*)`, metafile + auditoria), `.gitignore` (`lib/`, `node_modules/`); `firebase.json` com bloco `functions` mínimo. Sem callables/rules/App Check/UI/deploy.
- **Commit:** `feat: adiciona scaffold isolado das functions com Node 22 e esbuild`.

## Registro arquitetural

- Nova decisão arquitetural: **Não** (implementa o desenho da DEC-019). Recortes/decisões pontuais da DEC-019.2 — se divergirem do desenho — apresentar antes e registrar em `docs/architecture/DECISIONS.md`.
