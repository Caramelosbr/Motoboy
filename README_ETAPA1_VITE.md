# Etapa 1 — Vite sem mudança visual

Esta etapa altera somente o ambiente de desenvolvimento. O HTML, o CSS e a lógica atual do aplicativo continuam dentro de `index.html` para reduzir o risco de regressão.

## Pré-requisito

O Vite 8 exige Node.js 20.19 ou mais recente, ou Node.js 22.12 ou mais recente.

Confira a versão instalada:

```powershell
node --version
```

## Instalação

Dentro da pasta do projeto:

```powershell
npm install
```

## Desenvolvimento

```powershell
npm run dev
```

Abra o endereço mostrado no terminal, normalmente:

```text
http://localhost:5173/
```

O Live Server não será necessário nesse projeto.

Para testar no celular conectado à mesma rede Wi-Fi:

```powershell
npm run dev -- --host
```

Use no celular o endereço de rede exibido pelo Vite.

## Verificação de produção

```powershell
npm run build
npm run preview
```

O build de produção será criado em `dist/`. Não execute `firebase deploy` nesta etapa; a configuração do Hosting será revisada separadamente antes da primeira publicação pelo Vite.

## Arquivos modificados nesta etapa

- `index.html`: carrega a inicialização do Firebase pelo Vite.
- `src/config/firebase.js`: configuração modular do Firebase.
- `package.json` e `package-lock.json`: dependências e comandos do projeto.
- `vite.config.js`: build em `dist/` e portas locais.
- `.gitignore`: impede o envio de dependências e builds para o GitHub.

## Próxima etapa

Depois que esta versão for validada visualmente, o próximo commit criará a estrutura de autenticação. O código antigo será migrado gradualmente, sem conversão completa de uma só vez.
