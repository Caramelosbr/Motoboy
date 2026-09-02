---
name: executar-etapa
description: Executar UMA etapa autorizada do projeto Motoboy (um micro-passo = um commit), com protocolo econômico de tokens. Use quando o usuário autorizar a implementação de uma etapa (ex.: DEC-0XX.Y) listando caminhos e contrato. Impõe silêncio de execução e relatório final de 8 linhas.
---

# Executar etapa (protocolo econômico)

Implemente **somente** a etapa autorizada. Uma etapa = um micro-passo = um commit.

## Regras de economia (obrigatórias)

- **Proibida narração contínua.** Não descreva cada passo, não anuncie o que "vai fazer", não repita o pedido, não comente ferramentas. Trabalhe em silêncio e fale só no relatório final.
- **Sem preâmbulo e sem resumo do contexto.** Vá direto à ação.
- Agrupe verificações em poucos comandos. Não repita greps/leituras já feitas.
- Não peça confirmação para ações regulares; só pare quando o contrato exigir autorização.

## Ordem obrigatória

1. Leia `docs/tasks/NEXT.md`, `CLAUDE.md` e o código atual afetado; confira `git status`.
2. Confira o escopo: apenas os caminhos **explicitamente autorizados**. Nada em `src/` fora deles, nem `package*`, Firebase/Functions/rules, `index.html`, `docs/architecture`, application/UI/deploy — a menos que a etapa autorize.
3. Implemente só o escopo. Domínio puro (sem Firebase/DOM/relógio/aleatório/rede/globals; sem default export; sem ciclos).
4. Valide: `npm run typecheck`, `npm run test`, `npm run build` (ou `npm run check`) e `git diff --check`.
5. Confirme que só os caminhos autorizados mudaram e que o módulo novo não entra no bundle de produção sem uso.
6. **Não faça commit nem push.** Emita o relatório final e aguarde autorização.

## Relatório final — no máximo 8 linhas, exatamente estes rótulos

```
STATUS: <verde/vermelho + o que foi feito em 1 frase>
ARQUIVOS: <criados/alterados — só os autorizados>
TESTES: <arquivos e testes; delta vs baseline; build>
ESCOPO: <intactos: application, parser, package*, docs/architecture, Firebase, index.html>
RISCO: <riscos/limitações reais ou "nenhum">
DECISÃO: Nova decisão arquitetural: Sim/Não (+ registro se sim)
COMMIT: <comando git add explícito + mensagem sugerida — NÃO executado>
PRÓXIMO: <a próxima etapa, ainda não autorizada>
```

Nada além dessas 8 linhas no fechamento. Se algo bloquear, diga em STATUS e pare.
