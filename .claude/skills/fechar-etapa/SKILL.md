---
name: fechar-etapa
description: Fechar uma etapa já implementada e autorizada do projeto Motoboy — verificações pré-commit, commit e push com staging explícito, e verificações pós-push. Use quando o usuário disser que a etapa está validada e autorizada para commit/push. Protocolo econômico: sem narração, relatório final de 8 linhas.
---

# Fechar etapa (protocolo econômico)

Só use com **autorização explícita** de commit/push para esta etapa. Sem ela, pare.

## Regras de economia (obrigatórias)

- **Proibida narração contínua.** Nada de comentar cada comando ou repetir o pedido. Silêncio até o relatório.
- Agrupe as verificações em poucos comandos.

## Ordem obrigatória

1. Pré-commit: `git status --short`, `git diff --check`, `npm run check`. Confirme baseline de testes e build verde.
2. **Staging explícito**, um `git add <caminho>` por arquivo autorizado. **Nunca** `git add -A`, `git add .` nem diretório genérico.
3. Confira o índice: `git diff --cached --name-only`, `--stat`, `--check`. Exatamente os caminhos autorizados; nada de application/parser/package*/docs/architecture/Firebase/index.html indevidos.
4. Se o worktree já contiver o commit desta etapa (feito fora da sessão) **já publicado em `origin/main`**, não recrie nem reescreva histórico: apenas verifique e reporte. Reescrita/`--force` só com autorização explícita.
5. Commit com a **mensagem exata** autorizada. Depois `git push origin main`.
6. Pós-push: `git status --short`, `git log -1 --oneline`, `git rev-parse HEAD`, `git show --stat HEAD`, `git fetch origin` e comparar HEAD com `origin/main`.
7. Não faça deploy. Não inicie a próxima etapa.

## Relatório final — no máximo 8 linhas, exatamente estes rótulos

```
STATUS: <commit criado/publicado ou já presente; worktree limpo>
ARQUIVOS: <arquivos no commit — só os autorizados>
TESTES: <arquivos e testes; build; baseline mantida>
ESCOPO: <intactos: application, parser, package*, docs/architecture, Firebase, index.html>
RISCO: <riscos reais ou "nenhum">
DECISÃO: Nova decisão arquitetural: Sim/Não
COMMIT: <hash completo + mensagem + HEAD == origin/main>
PRÓXIMO: <a próxima etapa, ainda não autorizada>
```

Nada além dessas 8 linhas no fechamento.
