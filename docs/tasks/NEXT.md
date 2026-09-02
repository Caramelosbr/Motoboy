# Próxima etapa — modelo de tarefa

> Preencha um bloco por etapa. Uma etapa = um micro-passo autorizado = um commit.
> Copie este modelo, não o apague. Sem autorização explícita, não altere arquivos.

## Identificação

- **Etapa:** DEC-0XX.Y — <título curto>
- **Depende de:** <etapa anterior / commit>
- **Autorizada em:** <data> — <somente o que está escrito abaixo>

## Escopo autorizado (exato)

- **Criar:** `<caminho>` …
- **Alterar:** `<caminho>` …
- **NÃO tocar:** src/ fora dos caminhos, package*, Firebase/Functions/rules, index.html, docs/architecture, application, UI, deploy.

## Contrato

- API pública / tipos / estados esperados.
- Invariantes e códigos de erro previsíveis.
- Pureza: domínio sem Firebase/DOM/relógio/aleatório/rede/globals.

## Ordem obrigatória

1. Ler o código atual e `git status` antes de alterar.
2. Implementar somente o escopo acima.
3. `npm run check` + `git diff --check`.
4. Relatório de 8 linhas (ver skills) e aguardar autorização.

## Fora de escopo (não fazer)

- <listar o que fica para a próxima etapa>

## Registro arquitetural

- Nova decisão arquitetural: Sim/Não. Se sim, qual registro em `docs/architecture/DECISIONS.md`.
