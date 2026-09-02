# Próxima etapa — modelo de tarefa

> Preencha um bloco por etapa. Uma etapa = um micro-passo autorizado = um commit.
> Copie este modelo, não o apague. Sem autorização explícita, não altere arquivos.

## Situação

- **DEC-020.3B-2B — CONCLUÍDA.** `diffResolvedPricingTable` (diff resolvido puro: reusa `areaId`, alias explícito visível, sem publicar). Domínio puro; 387 testes verdes.
- **DEC-020.3B-2C — CANDIDATA (ainda NÃO autorizada).** Application + publicação: gateway callable, concorrência (`activeVersionId` + `revision`), idempotência, snapshot. Só desenho abaixo; aguarda autorização explícita antes de qualquer arquivo.

---

## Identificação (registro da etapa concluída)

- **Etapa:** DEC-020.3B-2B — diff resolvido (proposta resolvida × tabela ativa) — **CONCLUÍDA**
- **Depende de:** DEC-020.3B-2A (`resolvePricingProposal`, commit `48fe21b`) e DEC-020.3B-1.
- **Commit:** `feat: adiciona diff resolvido da importacao de pricing`.
- **Próxima candidata:** DEC-020.3B-2C — publicação/gateway callable (ver "Situação"; NÃO autorizada).

## Objetivo

Gerar o **diff final** entre a `ResolvedPricingProposal` (saída da 3B-2A) e a **tabela ativa** (`PricingArea[]`), **reaproveitando os IDs existentes** e **sem publicar nem gravar nada**. Apenas descreve a mudança para revisão humana; a publicação atômica fica na callable autoritativa (fora desta etapa).

## Escopo autorizado (exato) — 3 caminhos

- **Criar:** `src/features/pricing/domain/resolve-pricing-diff.ts`
- **Criar:** `src/features/pricing/domain/resolve-pricing-diff.test.ts`
- **Alterar (só exports):** `src/features/pricing/domain/index.ts`
- **NÃO tocar:** demais `src/` (parser, `pricing-table-diff.ts`, `resolve-pricing-proposal.ts`, 3B-1), `package*`, Firebase/Functions/rules, `index.html`, `docs/architecture`, application, UI, deploy.

## Contrato

Função pura, sem I/O, no domínio:

```
diffResolvedPricingTable({
  currentAreas: readonly PricingArea[];   // snapshot da versão ativa
  proposal: ResolvedPricingProposal;      // vinda da 3B-2A (nunca reconstruída aqui)
}): ResolvedPricingDiffResult
```

- **Result discriminado** `{ ok:false, code, message, detail? } | { ok:true, ... }`. Sem exceções de negócio.
- **Defesa de fronteira (não confiar no TS):** revalidar estruturalmente a `proposal` (nomes normalizados únicos, `amountCents>0`, aliases canônicos/limites, `≤ MAX_PRICING_AREAS`) e a `currentAreas` (via `validatePricingArea`, IDs únicos). Proposta/tabela inválida → erro, sem diff.
- **Matching e identidade:** casar cada item resolvido com a área ativa via `matchPricingArea` (exato, por nome/alias). **Match único → reusa `areaId`**; sem match → **novo (sem id inventado)**; match incerto (várias áreas, ou alias de uma e nome de outra) → **conflito**.
- **Categorias:** `new` (sem id), `changed` (mesmo id, muda `amountCents` **e/ou** aliases), `unchanged`, `removed` (área ativa não casada), `conflicts`.
- **Aliases:** combinar o alias explícito da proposta com a metadata existente da área — **nenhuma metadata existente (aliases/type) é removida em silêncio**; toda adição/mudança de alias aparece explicitamente no item `changed` (ex.: `aliasesAdded`, `aliasesResult`). Aliases resultantes respeitam limites e não colidem com nomes/aliases de terceiros.
- **Proveniência/exclusões:** preservar `analysisKey` e `excludedLines` da proposta no resultado (informativo); não reintroduzir linhas excluídas.
- **`canPublish`:** `true` somente sem conflitos e sem erro (espelha `pricing-table-diff.ts`). Ordenação determinística das categorias.
- **Fora do diff:** concorrência (`activeVersionId` + `revision`) é comparada na aplicação/publicação, **não** aqui; esta etapa é pura sobre um snapshot recebido.

## Ordem obrigatória

1. Ler `resolve-pricing-proposal.ts`, `pricing-table-diff.ts`, `match-pricing-area.ts`, `pricing-area.ts` e `git status` antes de alterar.
2. Implementar só os 3 caminhos. Domínio puro (sem Firebase/DOM/relógio/aleatório/rede/globals; sem default export; sem ciclos).
3. `npm run typecheck` + `npm run test` + `npm run build` (ou `npm run check`) e `git diff --check`.
4. Confirmar que o módulo novo não entra no bundle sem uso; relatório de 8 linhas e aguardar autorização.

## Testes obrigatórios

- Reuso de ID: item resolvido casa área ativa por nome/alias → `changed`/`unchanged` com o **mesmo `areaId`**.
- `changed` por preço; `changed` por alias adicionado (metadata antiga preservada, adição visível no diff).
- `new` sem id; `removed` para área ativa não casada; `unchanged` idêntico.
- `conflicts` para match ambíguo (nome de uma área + alias de outra, ou várias áreas).
- Defesa de fronteira: `proposal` estruturalmente inválida e `currentAreas` inválida/IDs duplicados → erro (sem diff).
- Nenhuma metadata de alias existente é descartada silenciosamente.
- Determinismo: ordenação estável; entradas não mutadas.
- Lista real: proposta resolvida de 53 itens × tabela ativa fictícia → categorias coerentes, IDs preservados, `excludedLines` vazio, sem id inventado.
- Segurança conceitual: nenhum dado publicado/gravado; nenhum `activeVersionId`/`revision`/`createdAt` inventado; sem `id` criado para itens novos.

## Critérios de aceite

- Função pura e determinística; result discriminado; sem exceções de negócio.
- IDs existentes preservados; itens novos sem id; conflitos nunca resolvidos automaticamente.
- Aliases/type existentes nunca removidos em silêncio; mudanças de alias explícitas no diff.
- Nada publicado/gravado; escopo restrito aos 3 caminhos; `npm run check` e `git diff --check` verdes.

## Fora de escopo (não fazer)

- Publicação/callable/gateway, concorrência (`activeVersionId`+`revision`), Functions, repository, UI, cutover, busca multiprovedor, alterar `pricing-table-diff.ts` existente.

## Registro arquitetural

- Nova decisão arquitetural: **Não** (detalhe de implementação sob a DEC-020). Se algo estrutural surgir, apresentar antes e registrar em `docs/architecture/DECISIONS.md`.
