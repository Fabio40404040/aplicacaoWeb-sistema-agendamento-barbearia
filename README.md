# FRS Barbearia

Web app de agendamento para barbearia, preparado para funcionar inteiramente na Cloudflare:

- **Frontend:** Cloudflare Workers Static Assets
- **Backend/API:** Cloudflare Worker
- **Banco de dados:** Cloudflare D1
- **Painel administrativo:** sessão protegida por cookie `HttpOnly`

## Funcionalidades

- consulta de serviços e horários disponíveis;
- agendamento com nome e WhatsApp;
- proteção contra dois clientes reservarem o mesmo período;
- painel para agenda, serviços, promoções, bloqueios e fila de espera;
- login administrativo sem senha exposta no código público;
- banco D1 com migrations versionadas.

## Organização do projeto

```text
src/                         frontend e painel
backend/worker/index.js      backend e API da Cloudflare
backend/migrations/          estrutura e atualizações do banco D1
wrangler.jsonc               configuração da Cloudflare
```

## Executar localmente

Requisitos: Node.js 20 ou mais recente.

```bash
npm install
npm run dev
```

O comando compila o frontend, cria/atualiza o banco D1 local, inicia a aplicação completa e abre o Google Chrome. Enquanto estiver aberto, alterações em HTML, CSS e JavaScript serão atualizadas automaticamente. A configuração local fica em `.dev.vars`, arquivo ignorado pelo Git.

- Site: `http://localhost:8787/`
- Painel: `http://localhost:8787/painel.html`
- E-mail local: `admin@frsbarbearia.com`
- Senha da demonstração: `frsbarbearia`

## Publicar na Cloudflare

1. Autentique o Wrangler:

```bash
npx wrangler login
```

2. Crie o banco D1:

```bash
npx wrangler d1 create frs-barbearia-db
```

3. Copie o `database_id` retornado para `wrangler.jsonc`, substituindo o UUID de exemplo.

4. Para o portfólio, cadastre a mesma senha exibida na tela (`frsbarbearia`) e um segredo longo. O valor do segredo não é salvo no Git:

```bash
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put SESSION_SECRET
```

5. Crie as tabelas no D1 remoto e publique:

```bash
npm run db:migrate:remote
npm run deploy
```

O endereço `*.workers.dev` informado pela Cloudflare já permite testar o projeto. Depois, o domínio comprado no Registro.br pode ser adicionado como domínio personalizado na Cloudflare.

## Antes de usar com um cliente real

- remova o bloco `.demo-access` e o valor preenchido no campo de senha em `painel.html`;
- troque `ADMIN_PASSWORD` por uma senha forte e exclusiva na Cloudflare;
- não envie `.dev.vars` para o GitHub;
- configure o domínio e confirme os dados da empresa;
- faça uma política de privacidade, pois nome e telefone são dados pessoais;
- faça exportações periódicas dos agendamentos.

## Comandos

```bash
npm run dev                # aplicação completa local
npm run dev:server         # aplicação completa sem abrir o navegador
npm run dev:frontend       # somente a interface, sem API
npm run build              # gera o frontend de produção
npm run db:migrate:local   # aplica migrations no D1 local
npm run db:migrate:remote  # aplica migrations no D1 remoto
npm run deploy             # compila e publica na Cloudflare
```
