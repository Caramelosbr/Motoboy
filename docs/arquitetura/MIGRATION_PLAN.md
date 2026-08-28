# Plano de Migração para Clean Architecture

**Projeto:** Motoboy  
**Status:** Proposto — aguardando execução por etapas  
**Estratégia:** Migração progressiva utilizando Strangler Pattern  
**Regra principal:** Nenhuma etapa poderá reconstruir todo o sistema ou alterar várias funcionalidades simultaneamente.

---

## 1. Objetivo

Transformar o projeto atual em uma aplicação organizada, segura, testável e preparada para múltiplos motoboys, preservando:

- O visual aprovado.
- As funcionalidades existentes.
- Os cálculos atuais.
- Os registros dos usuários.
- A compatibilidade com celular.
- A integração Firebase existente.
- O histórico financeiro e operacional.

---

## 2. Objetivos arquiteturais

A arquitetura final deverá:

- Manter o `index.html` como uma casca mínima.
- Inicializar o painel somente após uma sessão válida.
- Separar apresentação, aplicação, domínio e infraestrutura.
- Remover dependências diretas de Firebase das camadas internas.
- Eliminar gradualmente variáveis globais.
- Utilizar Firestore como fonte oficial dos dados multiusuário.
- Tratar armazenamento local como cache ou fila controlada.
- Isolar dados diretamente pelo UID.
- Permitir testes sem conexão com Firebase real.
- Proteger operações financeiras.
- Permitir crescimento para planos, assinaturas e administração.

---

## 3. Fora do escopo inicial

Não deverão ser implementados durante as primeiras etapas:

- React.
- Novo redesign.
- Aplicativo nativo.
- Pagamentos de assinatura.
- Painel administrativo completo.
- Troca do Firebase.
- Reescrita completa.
- Migração simultânea de todas as funcionalidades.
- Deploy automático em produção.

---

## 4. Princípios obrigatórios

- Um problema por etapa.
- Um commit por objetivo.
- Nenhum deploy sem autorização.
- Nenhuma exclusão destrutiva.
- Nenhuma mudança de schema sem plano de migração.
- Nenhuma alteração visual não solicitada.
- Todo código novo deverá ter responsabilidade clara.
- Domain não pode conhecer Firebase, DOM ou localStorage.
- Application depende de interfaces.
- Infrastructure implementa interfaces.
- Presentation controla HTML, CSS e eventos.
- Erros de persistência devem chegar à interface.
- O Git diff deve ser apresentado antes do commit.
- O build e o typecheck devem passar antes da conclusão.
- Alterações existentes do usuário devem ser preservadas.

---

## 5. Arquitetura de destino

Estrutura recomendada:

```text
src/
├── app/
│   ├── bootstrap.ts
│   ├── app-router.ts
│   ├── session-controller.ts
│   └── dependencies.ts
│
├── features/
│   ├── auth/
│   │   ├── domain/
│   │   ├── application/
│   │   ├── infrastructure/
│   │   └── presentation/
│   ├── dashboard/
│   ├── abastecimentos/
│   ├── manutencoes/
│   ├── clientes/
│   ├── faturamento/
│   ├── rotas/
│   ├── moto/
│   └── mapa/
│
├── infrastructure/
│   ├── firebase/
│   ├── storage/
│   └── monitoring/
│
├── shared/
│   ├── currency/
│   ├── dates/
│   ├── errors/
│   ├── validation/
│   └── components/
│
├── legacy/
│   └── panel.js
│
├── styles/
│   ├── tokens.css
│   ├── global.css
│   └── legacy.css
│
└── main.ts
```

Durante a migração, `legacy` poderá existir temporariamente. Nenhum código novo de negócio deverá ser acrescentado ao monólito.

---

# ETAPAS DA MIGRAÇÃO

## Etapa 0 — Linha de base e segurança do desenvolvimento

### Objetivo

Garantir que o projeto possua comandos confiáveis de validação antes de mover código.

### Ações

- Confirmar que o worktree está limpo.
- Criar uma branch de migração.
- Adicionar `typescript` em `devDependencies`.
- Adicionar script `typecheck`.
- Adicionar script `check`.
- Confirmar que `package-lock.json` foi atualizado corretamente.
- Executar a verificação TypeScript.
- Corrigir apenas erros de tipagem necessários para criar a linha de base.
- Executar o build.
- Documentar um checklist manual das sete telas.
- Não alterar regras de negócio.
- Não alterar layout.
- Não alterar Firebase.

### Scripts esperados

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "check": "npm run typecheck && npm run build"
  }
}
```

### Critérios de aceitação

- `npm install` funciona em uma instalação nova.
- `npm run typecheck` passa.
- `npm run build` passa.
- As sete telas continuam abrindo.
- Nenhum cálculo ou visual foi alterado.
- `node_modules` e `dist` permanecem fora do Git.

### Commit sugerido

`chore: configura validacao TypeScript e linha de base`

---

## Etapa 1 — Bootstrap protegido pela autenticação

### Objetivo

Impedir que o painel leia e renderize dados antes da confirmação da sessão.

### Estratégia

O JavaScript legado será extraído mecanicamente para um módulo temporário. Ele não deverá ser convertido ou reorganizado completamente nesta etapa.

### Ações

- Extrair o JavaScript embutido para `src/legacy/panel.js`.
- Manter a lógica original sem refatoração de negócio.
- Remover dependências de eventos inline necessárias para o módulo funcionar.
- Criar uma função ou importação controlada de bootstrap do painel.
- Fazer `main.ts` aguardar o estado da autenticação.
- Inicializar o painel somente para usuário autorizado.
- Garantir que usuário sem sessão permaneça no login.
- Garantir que logout descarte a visualização autenticada.
- Centralizar a entrada autenticada em uma única função.
- Corrigir o fluxo “Já verifiquei” para executar o bootstrap completo.
- Não alterar ainda a sincronização dos dados.
- Não alterar o CSS nessa etapa.

### Critérios de aceitação

- Usuário sem sessão não executa o bootstrap do painel.
- O localStorage financeiro não é lido antes da autenticação.
- Usuário autenticado acessa o painel.
- Atualizar a página mantém uma sessão válida.
- Usuário não verificado não acessa o painel.
- “Já verifiquei” carrega o painel e os dados.
- Logout retorna ao login sem deixar uma tela vazia.
- Login, cadastro e recuperação continuam funcionando.
- Build e typecheck passam.

### Commit sugerido

`refactor: protege inicializacao do painel pela sessao`

---

## Etapa 2 — Clean Architecture da autenticação

### Objetivo

Retirar o Firebase da camada application e dividir responsabilidades da autenticação.

### Estrutura esperada

```text
features/auth/
├── domain/
│   ├── authenticated-user.ts
│   ├── auth-session.ts
│   └── auth-repository.ts
├── application/
│   ├── sign-in.ts
│   ├── sign-up.ts
│   ├── sign-out.ts
│   ├── recover-password.ts
│   ├── resend-verification.ts
│   └── observe-session.ts
├── infrastructure/
│   └── firebase-auth-repository.ts
└── presentation/
    ├── login/
    ├── register/
    └── verification/
```

### Ações

- Criar a interface `AuthRepository`.
- Criar tipos neutros do domínio.
- Criar casos de uso separados.
- Mover chamadas do Firebase para `FirebaseAuthRepository`.
- Injetar o repositório nos casos de uso.
- Separar login, cadastro e verificação.
- Preservar as mensagens genéricas de segurança.
- Manter a sessão persistente.
- Manter acessibilidade e responsividade.
- Não modificar ainda o design.
- Substituir links falsos de termos por uma decisão explícita: documento real ou funcionalidade temporariamente desabilitada.

### Critérios de aceitação

- Nenhum arquivo de `domain` importa Firebase.
- Nenhum caso de uso importa Firebase.
- Somente `infrastructure` conhece `firebase/auth`.
- A apresentação chama casos de uso.
- Login, cadastro, recuperação, verificação e logout funcionam.
- Os erros não revelam existência de e-mail.
- Testes unitários podem usar um repositório falso.

### Commit sugerido

`refactor: separa autenticacao em camadas`

---

## Etapa 3 — Regras e testes de segurança do Firestore

### Objetivo

Garantir isolamento real entre usuários e preparar campos administrativos.

### Ações

- Configurar Firebase Emulator Suite.
- Criar testes automatizados para as regras.
- Validar acesso somente ao próprio UID.
- Decidir se e-mail verificado será obrigatório também nas regras.
- Proteger campos administrativos.
- Definir quais campos o usuário pode editar no próprio perfil.
- Impedir que o frontend transforme o usuário em administrador.
- Impedir alteração própria de plano ou estado comercial.
- Validar formatos básicos dos documentos.
- Não publicar as regras antes da aprovação.

### Casos mínimos de teste

- Usuário não autenticado não lê documentos.
- Usuário não autenticado não grava documentos.
- Usuário A lê os próprios documentos.
- Usuário A grava nos próprios documentos.
- Usuário A não lê documentos do usuário B.
- Usuário A não altera documentos do usuário B.
- Usuário comum não altera `role`.
- Usuário comum não altera `plan`.
- Usuário comum não altera `status`.
- Se aprovado, usuário não verificado não acessa os dados.

### Critérios de aceitação

- Todos os testes do emulador passam.
- Nenhum teste utiliza produção.
- O diff das regras é apresentado.
- Nenhum deploy é executado sem autorização.

### Commit sugerido

`test: adiciona cobertura das regras do Firestore`

---

## Etapa 4 — Isolamento local por UID

### Objetivo

Eliminar o risco de mistura de dados locais entre contas.

### Ações

- Criar uma interface de armazenamento local.
- Criar chave diretamente ligada ao UID.
- Substituir a chave global gradualmente.
- Definir uma migração não destrutiva da chave antiga.
- Manter uma cópia de segurança temporária durante a migração.
- Criar um marcador de versão da migração.
- Não permitir adoção silenciosa de dados quando o proprietário for desconhecido.
- Tratar falhas do localStorage.
- Não apagar dados antigos até confirmar a migração.

### Formato sugerido

`motoboy:state:{uid}`

### Critérios de aceitação

- Usuário A nunca carrega cache do usuário B.
- Trocar de conta não mistura dados.
- Falha do localStorage é informada.
- Migração antiga pode ser revertida.
- Dados existentes não são apagados automaticamente.
- Testes cobrem dois UIDs diferentes.

### Commit sugerido

`refactor: isola armazenamento local por usuario`

---

## Etapa 5 — Estratégia de sincronização

### Objetivo

Evitar perda, duplicação e reaparecimento de registros.

### Decisão necessária

Definir o Firestore como fonte oficial dos dados autenticados.

O localStorage deverá funcionar somente como:

- Cache identificado pelo UID.
- Estado temporário de interface.
- Fila de operações pendentes, caso o modo offline seja mantido.

### Ações

- Gerar IDs estáveis antes da gravação.
- Usar operações idempotentes.
- Persistir o ID imediatamente.
- Criar estados de sincronização:
  - `pending`.
  - `synced`.
  - `failed`.
- Não ignorar erros.
- Mostrar erro ou estado pendente ao usuário.
- Implementar retry controlado.
- Impedir que carga remota apague registros locais pendentes.
- Impedir duplicação de registros já enviados.
- Definir política de conflito.
- Usar `observe()` de maneira controlada ou remover os métodos não utilizados.
- Criar testes de sincronização.

### Cenários obrigatórios

- Criar online.
- Criar offline.
- Fechar e abrir antes de sincronizar.
- Reconectar.
- Editar um registro pendente.
- Excluir um registro pendente.
- Falhar durante exclusão remota.
- Acessar em dois dispositivos.
- Carregar Firestore vazio com cache local existente.

### Critérios de aceitação

- Um registro aparece uma única vez.
- Nenhum registro local pendente é sobrescrito.
- Uma exclusão remota com falha não é apresentada como concluída.
- O usuário visualiza o estado da sincronização.
- IDs continuam iguais entre cache e Firestore.

### Commits sugeridos

Esta etapa deve ser dividida por funcionalidade:

- `refactor: estabiliza sincronizacao de abastecimentos`
- `refactor: estabiliza sincronizacao de manutencoes`
- `refactor: estabiliza sincronizacao de entradas`
- `refactor: estabiliza sincronizacao de rotas`

---

## Etapa 6 — Separação do CSS

### Objetivo

Remover o CSS embutido do `index.html` sem alterar o visual.

### Estrutura sugerida

```text
src/styles/
├── tokens.css
├── global.css
├── layout.css
├── components.css
├── mobile.css
└── legacy.css
```

### Ações

- Mover primeiro todo o CSS para `legacy.css`.
- Confirmar que o visual não mudou.
- Depois separar tokens, layout e componentes.
- Remover estilos inline gradualmente.
- Preservar safe areas do iPhone.
- Preservar responsividade.
- Preservar tamanhos mínimos de toque.
- Não redesenhar telas.

### Critérios de aceitação

- Comparação visual antes e depois aprovada.
- Nenhuma rolagem horizontal.
- Login continua responsivo.
- Todas as sete telas mantêm o visual.
- Modais continuam funcionando.
- Nenhuma regra CSS fica duplicada.
- O `index.html` perde o bloco de aproximadamente 1.000 linhas de CSS.

### Commits sugeridos

- `refactor: extrai estilos legados do index`
- `refactor: organiza estilos compartilhados`

---

## Etapa 7 — Separação do HTML e da apresentação

### Objetivo

Transformar o `index.html` em uma casca mínima.

### Estrutura sugerida

```text
features/
└── nome-da-feature/
    └── presentation/
        ├── nome-view.html
        ├── nome-view.css
        └── nome-controller.ts
```

### Decisão técnica recomendada

Como o projeto usa Vite sem React, templates HTML podem ser importados com `?raw` ou criados por funções de view.

Uma única abordagem deve ser escolhida e documentada. Não misturar várias estratégias sem necessidade.

### Ações

- Criar o container principal `#app`.
- Separar cada view.
- Separar modais.
- Separar controladores de eventos.
- Remover `onclick` inline.
- Evitar consultas globais ao DOM.
- Usar elementos restritos ao container da feature.
- Preservar labels e atributos de acessibilidade.
- Não migrar regras de negócio junto com a extração visual.

### Resultado esperado do `index.html`

```html
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
```

### Critérios de aceitação

- `index.html` possui somente a estrutura essencial.
- Nenhuma regra de negócio permanece no HTML.
- Nenhum CSS significativo permanece no HTML.
- Nenhum evento inline permanece.
- Todas as telas e modais funcionam.
- O visual permanece aprovado.
- Build e typecheck passam.

### Commits sugeridos

Dividir por tela ou grupo pequeno:

- `refactor: extrai estrutura do dashboard`
- `refactor: extrai tela de abastecimentos`
- `refactor: extrai tela de manutencoes`
- `refactor: extrai tela de clientes`
- `refactor: extrai telas de rotas`

---

## Etapa 8 — Migração das funcionalidades

### Ordem recomendada

1. Abastecimentos.
2. Manutenções.
3. Clientes.
4. Contas a receber.
5. Recebimentos.
6. Faturamento.
7. Rotas.
8. Dados da moto.
9. Dashboard.

Clientes e financeiro devem ser migrados antes de fechar Rotas, porque confirmar e cancelar uma rota pode criar ou remover efeitos financeiros.

### Regras para cada feature

Cada feature deverá possuir:

- Entidades ou tipos do domínio.
- Interfaces de repositório.
- Casos de uso.
- Implementação Firestore.
- Implementação local, se necessária.
- Controlador de apresentação.
- View.
- Testes de domínio.
- Testes dos casos de uso.
- Critérios de aceitação próprios.

### Processo por feature

1. Documentar o comportamento atual.
2. Criar testes.
3. Criar domínio.
4. Criar casos de uso.
5. Adaptar o repositório.
6. Conectar a apresentação.
7. Comparar resultados com o legado.
8. Desativar somente o trecho legado substituído.
9. Remover a ponte global correspondente.
10. Executar build, typecheck e testes.

---

## Etapa 9 — Integridade financeira

### Objetivo

Preparar os registros financeiros para uso comercial.

### Ações

- Criar tipo de dinheiro em centavos.
- Criar conversões de exibição.
- Definir `schemaVersion`.
- Criar migração para documentos existentes.
- Utilizar timestamp do servidor.
- Substituir exclusão financeira por cancelamento.
- Criar `deletedAt`, `deletedBy` e `deleteReason`.
- Criar eventos de auditoria.
- Guardar histórico de edições importantes.
- Usar transações em operações relacionadas.
- Garantir que resumos mensais sejam derivados.
- Não utilizar o dashboard como fonte de verdade.

### Operações que exigem atomicidade

- Confirmar rota.
- Cancelar rota.
- Gerar valor a receber.
- Registrar recebimento parcial.
- Estornar recebimento.
- Alterar valor de uma rota confirmada.
- Cancelar entrada financeira ligada a uma rota.

### Critérios de aceitação

- Nenhum valor utiliza ponto flutuante como formato permanente.
- Cancelamentos mantêm histórico.
- Operações parciais não deixam o sistema inconsistente.
- Os totais podem ser recalculados a partir dos registros.
- Migração testada com cópia de dados.
- Nenhuma migração roda em produção sem backup e autorização.

---

## Etapa 10 — Remoção do legado

### Objetivo

Eliminar componentes temporários depois que todas as funcionalidades estiverem migradas.

### Ações

- Remover `src/legacy`.
- Remover pontes `window.__motoboy...`.
- Remover funções globais.
- Remover a chave global antiga do localStorage após período de migração.
- Remover arquivo Firebase antigo da raiz, se comprovadamente sem uso.
- Remover importação redundante do Firebase no HTML.
- Remover código morto.
- Remover textos desatualizados.
- Remover estilos inline.
- Dividir o bundle com imports dinâmicos.
- Carregar infraestrutura do Firestore somente quando necessária.

### Critérios de aceitação

- Nenhuma ponte global permanece.
- Nenhuma regra de negócio permanece no `index.html`.
- Nenhum arquivo legado necessário.
- Busca por nomes antigos retorna zero referências válidas.
- Bundle analisado e reduzido.
- Todos os testes passam.

### Commit sugerido

`refactor: remove infraestrutura legada do painel`

---

## Etapa 11 — Validação e liberação

### Testes obrigatórios

- Chrome no Windows.
- Edge no Windows.
- Chrome no Android.
- Safari no iPhone.
- Tela com 320 px.
- Tablet.
- Desktop.
- Retrato e paisagem.
- Teclado virtual aberto.
- Internet lenta.
- Sem internet.
- Sessão expirada.
- E-mail não verificado.
- Dois usuários no mesmo aparelho.
- Dois aparelhos com o mesmo usuário.
- Usuário tentando acessar dados de outro UID.
- Falha de escrita no Firestore.
- Falha na API de mapas.

### Segurança

- Testar regras no emulador.
- Verificar restrições da Google API.
- Verificar ausência de senha no localStorage.
- Verificar ausência de segredos no Git.
- Verificar `.gitignore`.
- Verificar acesso multiusuário.
- Monitorar App Check antes de ativar bloqueio.

### Liberação

1. Gerar build.
2. Criar ambiente de preview.
3. Testar com dados não reais.
4. Fazer backup.
5. Apresentar relatório.
6. Solicitar autorização.
7. Publicar.
8. Monitorar erros.
9. Manter plano de rollback.

---

## 6. Definição de concluído

A migração somente estará concluída quando:

- O `index.html` for uma casca mínima.
- O painel não inicializar antes da autenticação.
- Cada usuário acessar somente seus dados.
- Firestore for a fonte oficial.
- O cache local for separado pelo UID.
- Nenhum erro de persistência for ignorado.
- Não existirem duplicações após reconexão.
- Clientes e financeiro estiverem no Firestore.
- Rotas e efeitos financeiros forem consistentes.
- Regras do Firestore possuírem testes.
- Valores financeiros estiverem em centavos.
- Exclusões financeiras forem auditáveis.
- Pontes globais forem removidas.
- Build, typecheck e testes passarem.
- O funcionamento mobile estiver aprovado.
- Existir rollback para a versão anterior.

---

## 7. Regra de execução para agentes

Antes de qualquer etapa, o agente deverá responder:

1. Qual etapa será executada.
2. Quais arquivos serão alterados.
3. Quais comportamentos podem ser afetados.
4. Como os dados serão protegidos.
5. Quais testes serão executados.
6. Como desfazer a alteração.
7. Qual será o tamanho aproximado do diff.

O agente deverá aguardar aprovação antes de iniciar uma etapa que:

- Altere schema do Firestore.
- Altere regras de segurança.
- Migre dados.
- Exclua arquivos.
- Remova compatibilidade legada.
- Faça deploy.
- Altere cálculos financeiros.