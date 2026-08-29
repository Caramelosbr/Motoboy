# Estado Atual do Projeto Motoboy

**Data da auditoria:** 28/08/2026  
**Status:** Diagnóstico inicial concluído  
**Objetivo deste documento:** Registrar a situação real do projeto antes da separação do monólito e da migração progressiva para Clean Architecture.

> Este documento representa uma fotografia do código na data da auditoria. Antes de executar qualquer mudança, o agente deve conferir se o código atual ainda corresponde a estas informações.

---

## 1. Visão geral

O projeto Motoboy é uma aplicação web mobile-first voltada para gestão operacional e financeira de motoboys.

As funcionalidades atuais incluem:

- Dashboard financeiro.
- Entradas e despesas.
- Abastecimentos.
- Manutenções e gastos da moto.
- Planejamento e confirmação de rotas.
- Histórico de rotas.
- Clientes e contas a receber.
- Registro de recebimentos.
- Controle de quilometragem e consumo.
- Autenticação por Firebase.
- Cadastro e verificação de e-mail.
- Recuperação de senha.
- Integração com Firestore.
- Google Routes API com fallback de roteamento.

O sistema começou como um único `index.html` e está passando por uma migração gradual para Vite, TypeScript, Firebase e Clean Architecture.

---

## 2. Tecnologias atuais

- HTML.
- CSS.
- JavaScript.
- TypeScript parcial.
- Vite.
- Firebase Authentication.
- Cloud Firestore.
- Chart.js.
- Google Routes API.
- OSRM como fallback de roteamento.
- localStorage como armazenamento legado.
- Firebase Hosting planejado.

Não existe React ou outro framework de interface.

---

## 3. Dimensão atual do código

Na fotografia analisada:

- O `index.html` possui aproximadamente 4.613 linhas.
- Aproximadamente 1.000 linhas são CSS embutido.
- Aproximadamente 750 linhas são estrutura HTML.
- Aproximadamente 2.836 linhas são JavaScript embutido.
- O diretório `src` possui aproximadamente 3.000 linhas distribuídas em 29 arquivos.
- A tela de autenticação possui aproximadamente 566 linhas de TypeScript.
- O CSS da autenticação possui aproximadamente 825 linhas.

O `index.html` ainda concentra:

- Estado global.
- Leitura e gravação do localStorage.
- Regras financeiras.
- Regras de rotas.
- Manipulação do DOM.
- Renderizações.
- Eventos.
- Integração com gráficos.
- Integração com as pontes do Firestore.

---

## 4. Build atual

O build de produção foi executado com Vite 8.2.2.

Resultado observado:

- 46 módulos transformados.
- Build concluído com sucesso.
- HTML final: aproximadamente 225 KB.
- CSS da autenticação: aproximadamente 12 KB.
- JavaScript final: aproximadamente 578 KB.
- Imagem da cidade: aproximadamente 50 KB.

O Vite apresentou aviso porque o bundle JavaScript ultrapassou 500 KB.

O build passar confirma que o código pode ser transformado pelo Vite, mas não garante que a tipagem TypeScript esteja correta.

---

## 5. Configuração do TypeScript

Existe um `tsconfig.json` com configuração estrita, incluindo:

- `strict`.
- `noUnusedLocals`.
- `noUnusedParameters`.
- `isolatedModules`.
- `noEmit`.
- `allowJs`.

Entretanto, na versão analisada:

- O pacote `typescript` não está registrado no `package.json`.
- Não existe script `typecheck`.
- Não existe script `check`.
- O Vite transforma arquivos `.ts`, mas não realiza verificação completa de tipos.

Os arquivos `tsc`, `tsc.cmd` e `tsc.ps1` encontrados em `node_modules/.bin` são arquivos gerados por dependências e não devem ser adicionados ao Git.

---

## 6. Ordem atual de inicialização

A inicialização acontece aproximadamente nesta ordem:

1. O navegador carrega o `index.html`.
2. O Chart.js é carregado.
3. O JavaScript embutido no HTML é executado.
4. O estado global é criado.
5. O localStorage é lido.
6. As funções de renderização são executadas.
7. O dashboard é montado.
8. `/src/config/firebase.js` é carregado.
9. `/src/main.ts` é carregado.
10. As pontes `window.__motoboy...` são instaladas.
11. A tela de login é colocada sobre o dashboard.
12. O Firebase verifica a sessão.

Consequência:

O dashboard e os dados locais são inicializados antes da confirmação da autenticação. O login funciona visualmente como uma cobertura, mas ainda não é a barreira responsável por inicializar ou impedir a inicialização do painel.

---

## 7. Autenticação

A autenticação atual utiliza Firebase Authentication com:

- E-mail e senha.
- Sessão persistente.
- Cadastro.
- Nome do usuário.
- Recuperação de senha.
- Verificação de e-mail.
- Reenvio da verificação.
- Logout.
- Mensagens genéricas para credenciais incorretas.

Pontos positivos:

- A senha não é armazenada no localStorage.
- Erros de login não revelam diretamente se um e-mail existe.
- Existe prevenção visual de múltiplos envios.
- O login é responsivo.
- Existem labels e mensagens acessíveis.
- A sessão persistente é configurada.

Problemas atuais:

- `auth/application/auth-service.ts` importa Firebase diretamente.
- A camada application conhece a implementação concreta do Firebase.
- Não existe uma interface `AuthRepository`.
- Não existe uma implementação separada `FirebaseAuthRepository`.
- O arquivo de apresentação concentra login, cadastro e verificação.
- O fluxo “Já verifiquei” pode remover a tela sem executar novamente todo o bootstrap autenticado.
- Os links de Termos de Uso e Política de Privacidade ainda são placeholders.
- Não existe consulta ao perfil para verificar plano, suspensão ou estado comercial da conta.
- O Firebase Authentication controla a identidade, mas não existe ainda um perfil completo do usuário no Firestore.

---

## 8. Regras atuais do Firestore

As regras analisadas isolam os documentos pelo caminho:

`users/{uid}/...`

O usuário autenticado somente pode acessar a própria subárvore.

Ponto positivo:

- Um usuário não pode consultar diretamente a subárvore de outro UID.

Pontos pendentes:

- As regras verificam autenticação, mas não exigem necessariamente e-mail verificado.
- O proprietário possui escrita ampla no próprio documento de perfil.
- Campos administrativos futuros, como `status`, `plan` e `role`, não podem ser controlados exclusivamente pelo frontend.
- Não existem validações de formato dos documentos.
- Não existem testes automatizados das regras no Firebase Emulator Suite.
- O arquivo indicado em `firebase.json` deve ser confirmado como `firestore.rules`.
- Nenhuma mudança nas regras deve ser publicada sem teste no emulador e autorização.

---

## 9. Armazenamento local

A chave legada principal é:

`motoboy-front-etapa1-v2-clean`

Existe também uma marca de proprietário:

`motoboy-owner-uid`

O sistema atual tenta impedir a mistura entre usuários comparando o UID atual com o UID salvo.

Problemas:

- A chave principal dos dados não contém o UID.
- O isolamento depende de uma segunda chave.
- Se a chave do proprietário desaparecer e os dados permanecerem, outra conta pode adotá-los.
- Se o localStorage falhar, o código continua sem garantir isolamento.
- No primeiro login, os dados antigos podem ser marcados como pertencentes ao usuário, mas isso não garante sua migração para o Firestore.
- Uma carga vazia do Firestore pode substituir abastecimentos ou manutenções locais.
- Clientes, contas, recebimentos e dados da moto continuam locais.
- Limpar os dados do navegador ainda pode apagar informações que não foram migradas.

A arquitetura futura deve usar:

`motoboy:state:{uid}`

ou eliminar o estado financeiro permanente do localStorage depois que o Firestore for a fonte oficial.

---

## 10. Integração entre o monólito e o Firestore

A integração é feita por pontes globais temporárias:

- `window.__motoboyAbastecimentos`.
- `window.__motoboyManutencoes`.
- `window.__motoboyEntradas`.
- `window.__motoboyRotas`.
- `window.__motoboyRoute`.
- `window.__applyRemoteAbastecimentos`.
- `window.__applyRemoteManutencoes`.
- `window.__applyRemoteEntradas`.
- `window.__applyRemoteRotas`.

Esse padrão é uma camada anticorrupção temporária para permitir a migração progressiva.

Ele não deve ser usado como arquitetura final.

Problemas encontrados:

- Erros de gravação são ignorados silenciosamente.
- A interface local pode informar sucesso antes da confirmação remota.
- Não existe indicador de sincronização.
- Não existe fila de operações pendentes.
- Não existe retry controlado.
- Não existe resolução de conflitos.
- Não existe idempotência para todas as inclusões.
- Os métodos `observe()` existem nos repositórios, mas não são usados no bootstrap.
- O sistema usa carregamento único com `list()`.
- Firestore e localStorage podem divergir.

---

## 11. Problema do `fsId`

Ao criar abastecimentos, manutenções ou entradas:

1. O registro é criado localmente.
2. O estado local é salvo.
3. O Firestore é chamado em segundo plano.
4. O Firestore retorna um ID.
5. Esse ID é colocado no objeto em memória.

Depois do retorno do ID, o localStorage não é necessariamente salvo novamente.

Consequências possíveis:

- O ID remoto desaparece ao atualizar a página.
- Uma entrada pode ser considerada “não sincronizada”.
- Uma entrada local pode ser somada à mesma entrada carregada do Firestore.
- Atualizações posteriores podem não localizar o documento remoto.
- Exclusões posteriores podem acontecer somente localmente.

---

## 12. Comportamento offline atual

O código afirma manter o cache local em falhas de internet, mas não existe uma estratégia offline completa.

Situações possíveis:

- Uma inclusão offline pode ficar apenas local.
- Não existe garantia de envio posterior.
- Uma consulta remota pode substituir dados locais não sincronizados.
- Uma exclusão local pode falhar remotamente.
- Um registro excluído pode reaparecer depois.
- Uma atualização local pode ser revertida pelo próximo carregamento remoto.
- O usuário não recebe informação clara sobre a falha.

O aplicativo não deve ser anunciado como offline-first enquanto esse fluxo não estiver implementado e testado.

---

## 13. Situação das funcionalidades

| Funcionalidade | localStorage | Firestore | Clean Architecture | Observação |
|---|---:|---:|---:|---|
| Autenticação | Não | Firebase Auth | Parcial | Application depende do Firebase |
| Abastecimentos | Sim | Sim | Parcial | Sincronização frágil |
| Manutenções | Sim | Sim | Parcial | Sincronização frágil |
| Entradas manuais | Sim | Sim | Parcial | Pode duplicar sem fsId persistido |
| Histórico de rotas | Sim | Sim | Parcial | Usa ID estável |
| Entradas geradas por rota | Sim | Não | Não | Permanecem locais |
| Clientes | Sim | Não | Não | Está no monólito |
| Contas a receber | Sim | Não | Não | Está no monólito |
| Recebimentos | Sim | Não | Não | Está no monólito |
| Dados da moto | Sim | Não | Não | Está no monólito |
| Dashboard | Derivado | Parcial | Não | Calculado a partir de fontes mistas |
| Mapa e roteamento | Não | API externa | Quase completa | Possui porta e provider |

---

## 14. Rotas e financeiro

Ao confirmar uma rota, o sistema pode gerar:

- Histórico da rota.
- Entrada recebida na hora.
- Conta pendente do cliente.
- Alteração do faturamento.
- Alteração do dashboard.

Atualmente essas mudanças não formam uma única operação transacional.

Ao cancelar uma rota, o sistema altera vários arrays locais e remove o histórico remoto separadamente.

Riscos:

- A rota pode ser salva sem o lançamento financeiro correspondente.
- O lançamento pode existir sem a rota.
- O cancelamento pode ser concluído parcialmente.
- Dois dispositivos podem calcular resultados diferentes.

Clientes, contas, recebimentos e rotas precisam ser tratados por casos de uso coordenados antes de o sistema ser vendido.

---

## 15. Integridade financeira

Situação atual:

- Valores são armazenados como números decimais.
- Alguns registros podem ser apagados definitivamente.
- A data de criação depende do relógio do aparelho.
- O motivo da última edição é salvo, mas o histórico completo pode ser perdido.
- Não existe `schemaVersion`.
- Não existe trilha de auditoria remota completa.
- Não existe cancelamento financeiro padronizado.
- Não existe migração formal de schema.

Direção recomendada:

- Armazenar dinheiro em centavos.
- Utilizar horário do servidor.
- Usar cancelamento ou soft delete.
- Registrar eventos de auditoria.
- Usar transações ou batched writes em operações relacionadas.
- Criar estratégia de migração antes de alterar documentos existentes.

---

## 16. Mapa e API externa

O módulo de mapa apresenta uma separação adequada:

- O domínio define `RoutingProvider`.
- A infraestrutura implementa `GoogleRoutesProvider`.
- O painel consome uma abstração.

O sistema possui fallback:

1. Google Routes API.
2. OSRM.
3. Estimativa em linha reta.

Pontos pendentes:

- A chave `VITE_GOOGLE_MAPS_API_KEY` fica disponível no navegador.
- A chave deve possuir restrição por domínio/referenciador.
- Não existe timeout explícito.
- Não existe cancelamento de requisição.
- Não existe cache de rotas.
- Erros são convertidos para `null`, sem diagnóstico técnico.

---

## 17. Arquivos duplicados ou legados

Foram identificadas duas abordagens de inicialização do Firebase:

- Arquivo legado `firebase-config.js` na raiz, usando CDN.
- Arquivo `src/config/firebase.js`, usando Firebase via npm.

O `main.ts` já importa a configuração localizada em `src`.

O arquivo legado da raiz aparenta não ser necessário, mas só deve ser removido depois de:

- Confirmar que não existe importação ativa.
- Executar busca completa no projeto.
- Executar build.
- Testar localmente.
- Apresentar o diff.

O HTML também importa diretamente `/src/config/firebase.js` e `/src/main.ts`. Como `main.ts` já importa a configuração, a primeira importação tende a ser redundante.

---

## 18. Outros pontos técnicos

- `APP_NOW` é criado uma única vez no carregamento da página.
- Se o aplicativo atravessar a meia-noite sem atualizar, algumas datas podem ficar desatualizadas.
- Existem estilos inline dentro do HTML.
- Existe pelo menos um `onclick` inline.
- Existem muitas consultas diretas com `document.getElementById`.
- Existem funções e variáveis globais.
- O botão Sair compartilha a classe de navegação `.drawer-item`.
- Ao clicar em Sair, a navegação pode remover a view ativa antes do logout.
- Se o logout falhar, a interface pode ficar em estado visual inconsistente.
- O dashboard ainda apresenta textos que informam “dados locais” embora algumas coleções já utilizem Firestore.
- Não existe uma suíte automatizada de testes.
- Não existe validação automatizada de regressão visual.

---

## 19. Pontos positivos da base atual

A aplicação não precisa ser reconstruída do zero.

Pontos aproveitáveis:

- Vite já está configurado.
- Firebase modular via npm já existe.
- TypeScript começou a ser adotado.
- As funcionalidades novas já utilizam pastas por feature.
- Domínios de abastecimentos, manutenções, faturamento e rotas já existem.
- Repositórios concretos estão separados.
- O módulo de mapa utiliza inversão de dependência.
- As pontes permitem migração progressiva.
- O visual e os fluxos de negócio já estão consolidados.
- O build de produção funciona.
- As regras atuais já possuem isolamento básico pelo UID.

---

## 20. Classificação dos riscos

### P0 — Corrigir antes da migração estrutural extensa

- Painel inicializado antes da autenticação.
- Possibilidade de perda ou duplicação na sincronização.
- Falta de persistência garantida do `fsId`.
- Dados locais globais sem namespace direto por UID.
- Erros de persistência ignorados.
- TypeScript não registrado oficialmente no projeto.

### P1 — Corrigir antes de vender para outros motoboys

- Clientes e recebimentos exclusivamente locais.
- Operações de rota e financeiro não transacionais.
- Regras sem validações de schema.
- E-mail verificado não garantido nas regras.
- Perfil sem proteção para campos administrativos.
- Exclusões financeiras definitivas.
- Valores monetários decimais.
- Falta de testes do Firestore.
- Falta de migração formal de dados.

### P2 — Evolução técnica

- Separação do CSS.
- Separação do HTML em templates.
- Remoção das pontes globais.
- Divisão do bundle.
- Cache de rotas.
- Monitoramento de erros.
- App Check.
- Otimizações de desempenho.

---

## 21. Conclusão atual

O projeto está funcional como protótipo e possui uma boa base para migração progressiva.

Entretanto, ainda não deve ser considerado um sistema multiusuário completamente seguro e sincronizado.

A estratégia recomendada é:

1. Criar uma linha de base verificável.
2. Corrigir o bootstrap da autenticação.
3. Corrigir propriedade e sincronização dos dados.
4. Separar CSS, JavaScript e HTML sem mudar comportamento.
5. Migrar cada funcionalidade para Clean Architecture.
6. Fortalecer regras e integridade financeira.
7. Remover o legado somente depois que cada substituição estiver testada.

Nenhuma reconstrução total deve ser feita.