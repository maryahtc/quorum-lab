# Quorum Lab · Solicitação de planejamento

Aplicação pública, hospedada no Netlify, para o cirurgião-dentista solicitar um planejamento ao Quorum Lab.

Ela faz quatro coisas: recebe o formulário, coleta a documentação, gera um PDF-resumo e envia tudo por e-mail ao Quorum.
**Não há banco de dados, login, painel nem CRM.** A gestão continua no ADAX LAB: depois da triagem, o trabalho é cadastrado lá manualmente.

| Rota | Conteúdo |
|---|---|
| `/solicitar` | Formulário em 7 etapas (módulo independente em `src/features/solicitar`) |
| `/termos` | Termos de Prestação de Serviço (**rascunho**) |
| `/privacidade` | Política de Privacidade (**rascunho**) |
| `/` | Redireciona para `/solicitar` (temporário, veja *Site institucional*) |
| `/interno/entrega` | Ferramenta interna: PDF técnico de entrega do planejamento (veja abaixo) |

---

## Como funciona

```
Navegador (/solicitar)
  1. POST /api/upload-urls ── valida arquivos, anti-spam, rate limit
                              → código QL-AAMMDD-XXXXX + URLs assinadas (15 min) + ticket HMAC
  2. PUT direto no Cloudflare R2 (privado), com barra de progresso
     (os arquivos não passam pela Function, que aceita no máximo 6 MB)
  3. POST /api/submit ─────── confere ticket, existência, tamanho e assinatura real de cada arquivo
                              recalcula o valor no servidor
                              gera o PDF (pdf-lib)
                              anexa o que couber no limite; o resto vai por link privado de 7 dias
                              e-mail ao Quorum (Resend) → e-mail de confirmação ao dentista
```

**Anexos.** O PDF vai **sempre** anexado. Os demais arquivos entram por ordem de prioridade (foto → STL superior → STL inferior → tomografia) enquanto o total couber em `ATTACHMENT_MAX_MB` (padrão 15 MB, cerca de 20 MB depois da codificação base64).
O que não couber vai como **link privado** no corpo do e-mail, e o e-mail indica, arquivo por arquivo, se ele está anexado ou por link.

**Falhas.** Nada falha em silêncio. Se o envio falhar, o solicitante vê o erro e um botão "Tentar novamente", que retoma de onde parou sem reenviar os arquivos.
O código da solicitação serve de chave de idempotência no Resend, então uma nova tentativa não gera e-mail duplicado.

## Regras de negócio: um único arquivo

Tudo fica em **`src/shared/config.ts`**, usado pelo navegador e pelo servidor:

- **Preços:** Smile Design, enceramento por elemento e PerioGuide "a partir de".
- **Documentação por serviço:** `"obrigatorio"` ou `"opcional"`. Por exemplo, para tornar o STL inferior obrigatório no enceramento:
  ```ts
  smile_enceramento: { documentos: { foto: "obrigatorio", stl_superior: "obrigatorio", stl_inferior: "obrigatorio" } }
  ```
- **Formatos e tamanho máximo por arquivo:** foto 25 MB, STL 150 MB, tomografia 1 GB.
- **Textos fixos:** aviso de envio e nota do PerioGuide.

Regras do odontograma:
- Todos os serviços pedem **dentes do Smile Design**.
- Serviços com enceramento pedem também **dentes que serão encerados**. Só esses dentes são cobrados (R$ 80 por elemento).
- A pergunta sobre resinas mostra apenas os dentes já incluídos no planejamento.

---

## Configuração (passo a passo)

### 1. Netlify

1. Conecte este repositório no Netlify. O build e as Functions já estão configurados em `netlify.toml`.
2. Cadastre as variáveis de ambiente listadas em `.env.example`, em *Site configuration → Environment variables*.
3. Gere o `UPLOAD_SIGNING_SECRET` com `openssl rand -hex 32`.

### 2. Cloudflare R2 (armazenamento temporário)

1. No Cloudflare, abra **R2 → Create bucket** e crie o bucket `quorum-solicitacoes`. **Não** ative o acesso público nem um domínio público.
2. Em **R2 → Manage API tokens**, crie um token com a permissão *Object Read & Write* restrita a esse bucket. Copie o *Access Key ID*, o *Secret Access Key* e o *Account ID*.
3. Em **Bucket → Settings → Object lifecycle rules**, crie as regras que fazem a exclusão automática:
   - prefixo `tmp/` → *Delete objects* após **7 dias**;
   - *Abort incomplete multipart uploads* após **1 dia**.
4. Em **Bucket → Settings → CORS policy**, cole a política abaixo, ajustando os domínios:
   ```json
   [
     {
       "AllowedOrigins": ["https://SEU-SITE.netlify.app", "https://SEU-DOMINIO.com.br"],
       "AllowedMethods": ["PUT"],
       "AllowedHeaders": ["content-type"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

> O `FILE_RETENTION_DAYS` precisa ser igual ao prazo da regra de ciclo de vida. O valor máximo é 7, que é o limite das URLs assinadas.

### 3. Resend (e-mail)

#### Antes de ter o domínio (testes)
- Use `MAIL_FROM="Quorum Lab <onboarding@resend.dev>"`.
- Use em `QUORUM_INBOX_EMAIL` o **mesmo e-mail da conta Resend**. Sem domínio verificado, o Resend só entrega para esse endereço.
- Nesse modo, a confirmação ao dentista não é entregue. A aplicação trata isso normalmente: o envio ao Quorum é concluído e a tela final mostra só o código.

#### Quando o domínio estiver definido
1. No Resend, abra **Domains → Add domain**. Recomendado: o subdomínio de envio padrão do Resend, por exemplo `quorumlab.com.br`. Escolha a região **São Paulo (sa-east-1)** se estiver disponível.
2. O Resend mostra os registros DNS exatos do domínio. **Use sempre os valores mostrados no painel.** O formato é este:

| Tipo | Nome (host) | Valor | Observação |
|---|---|---|---|
| MX | `send` | `feedback-smtp.<região>.amazonses.com` (prioridade 10) | retorno de bounces |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | SPF |
| TXT | `resend._domainkey` | `p=MIGfMA0G…` (chave longa gerada pelo Resend) | DKIM |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@SEU-DOMINIO.com.br` | DMARC (recomendado) |

3. Crie os registros no provedor de DNS (Registro.br, Cloudflare, GoDaddy…) e clique em **Verify** no Resend. A propagação costuma levar de minutos a algumas horas.
4. Em **API Keys**, crie uma chave com permissão *Sending access* restrita ao domínio e use-a em `RESEND_API_KEY`.
5. Atualize no Netlify:
   - `MAIL_FROM="Quorum Lab <solicitacoes@SEU-DOMINIO.com.br>"`
   - `QUORUM_INBOX_EMAIL`
   - `QUORUM_REPLY_TO` (opcional)

   Depois faça um novo deploy.

> Se o domínio já tiver um SPF próprio (Google Workspace, por exemplo), não crie um segundo SPF na raiz. O SPF do Resend fica no subdomínio `send`, então não há conflito.

### 4. Cloudflare Turnstile (anti-spam)

1. No Cloudflare, abra **Turnstile → Add widget**. Informe os domínios do site e use o modo **Managed**.
2. Copie a *Site Key* para `VITE_TURNSTILE_SITE_KEY` e a *Secret Key* para `TURNSTILE_SECRET_KEY`.
3. Sem essas chaves, a verificação fica desativada, o que só é aceitável em testes. Um aviso aparece no log da Function.

---

## Segurança

- **Arquivos:** validação de extensão, MIME e **assinatura real** (primeiros bytes de JPG, PNG, HEIC, STL e ZIP), no navegador e no servidor.
- **Limites de tamanho:** por arquivo, conferidos no navegador e novamente no servidor (HEAD no storage).
- **Nomes sanitizados:** sem acentos, espaços ou barras, com prefixo pelo código da solicitação, numa pasta com sufixo aleatório imprevisível.
- **Bucket privado:** upload com URL assinada de 15 min; download com URL assinada de no máximo 7 dias. Não existe URL pública permanente.
- **Exclusão automática:** regra de ciclo de vida do R2 (7 dias). Também remove uploads abandonados.
- **Ticket assinado (HMAC):** amarra os arquivos ao código da solicitação e expira em 3 h. Ninguém consegue apontar para arquivos de outra pessoa.
- **Anti-spam:** Turnstile, campo armadilha (honeypot) e tempo mínimo de preenchimento.
- **Rate limit:** nativo do Netlify, 6 requisições por minuto por IP em cada Function.
- **Outras proteções:** bloqueio de origem cruzada nas APIs e cabeçalhos de segurança (CSP, HSTS, `X-Frame-Options`…) em `netlify.toml`.
- **Logs sem dados clínicos;** credenciais apenas em variáveis de ambiente.
- **Valor estimado:** sempre **recalculado no servidor**.

---

## ⚠ Antes do lançamento público

- [ ] **Revisão jurídica** de `/termos` e `/privacidade`. Os textos estão em `src/pages/TermosPage.tsx` e `src/pages/PrivacidadePage.tsx`, e os trechos entre `[colchetes]` precisam ser preenchidos. Depois da revisão, defina `LEGAL_TEXTS_DRAFT = false` em `src/shared/config.ts`, o que remove o aviso de rascunho das páginas.
- [ ] Domínio verificado no Resend e `MAIL_FROM` atualizado.
- [ ] Turnstile configurado.
- [ ] Regras de ciclo de vida e CORS aplicadas no bucket R2.
- [ ] Teste real de ponta a ponta, com um ZIP de tomografia acima de 15 MB, para validar o envio por link.
- [ ] Logo completa (versão com nome) entregue em SVG, se for usada no cabeçalho.

## Identidade visual

A interface e o PDF seguem o **Guia de Marca Quorum Lab** (`brand/original/Guia_de_Marca_Quorum_Lab.pdf`):

- **Cores:** preto profundo `#0B0B0B` e dourado `#CDAA63`. Outros tons são apenas transparências dessas cores ou o off-white de texto.
- **Tipografia:** Cormorant Garamond Light nos títulos (substituta indicada pelo guia para a Garamond Premier Pro) e Inter Light/Regular na interface.
- **Composição:** linhas finas, numeração editorial e muito espaço negativo, sem cards coloridos nem ícones odontológicos.
- **Odontograma:** esquema FDI técnico, sem ilustração de dentes. A numeração dentária usa Inter, porque na Garamond o "11" lembra "II".
- **Símbolo Q:** usado **exatamente como fornecido**. O original está em `brand/original/q-simbolo.webp`. `npm run assets` (`scripts/build_assets.py`) só remove a margem transparente e redimensiona; nada é redesenhado.
- **PDF:** capa preta com o Q em destaque; páginas internas brancas com grid, seções numeradas e filetes dourados.
- **Fontes:** distribuídas via `@fontsource` (licença OFL). Se houver licença da Garamond Premier Pro (Adobe Fonts), basta carregá-la: ela já é a primeira opção de `--font-title`.

## Site institucional no futuro

`/solicitar` é um módulo independente. Para publicar a landing page em `/`:
1. Remova o redirect de `/` em `netlify.toml`.
2. Troque o elemento da rota `/` em `src/main.tsx` pela nova página.

O formulário não precisa de nenhuma alteração.

## Ferramenta interna · Entrega do planejamento (`/interno/entrega`)

Usada pela equipe depois que o planejamento está pronto. O fluxo é: print, frase, decisão, orientação e **gerar e baixar o PDF**.

- **Uma página só**, com 7 seções numeradas: identificação, leitura do caso, planejamento (análises com print), decisões, orientações, arquivos da entrega e resumo.
- **Prints:** colar com **Cmd/Ctrl + V** em qualquer ponto da página, arrastar e soltar, ou clicar para selecionar (JPG, PNG ou WEBP). Cada imagem colada vira uma análise. Com o foco na imagem de uma análise, colar substitui essa imagem.
- **Tudo no navegador:** o PDF é gerado localmente (`pdf-lib`, as mesmas fontes e o mesmo símbolo Q do PDF da solicitação) e baixado como `QUORUM_[CODIGO]_[PACIENTE].pdf`.
- **Não envia nada:** sem e-mail, WhatsApp, banco de dados, armazenamento, histórico ou API. O planejador anexa manualmente o PDF, os STL, os guias e os demais arquivos no e-mail ou no WhatsApp.
- Nada é salvo. Se houver conteúdo preenchido, o navegador avisa antes de fechar a aba.
- **Sem login por enquanto.** A área `/interno` tem moldura e rota próprias e um único ponto de proteção, `src/features/interno/InternoGate.tsx`, onde a autenticação entra no futuro. Em produção, ela recebe `X-Robots-Tag: noindex`.

Código: `src/features/interno/entrega/`. Os arquivos são `model.ts` (estado e regras), `pdf.ts` (layout do PDF), `images.ts` (preparo das imagens: orientação, WEBP, redução proporcional de imagens muito grandes) e os componentes da página.

## Desenvolvimento

```bash
npm install
npm run dev          # só o front-end (http://localhost:5173)
npx netlify dev      # front-end + Functions, lendo um .env local
npm test             # testes (valores, validações, PDF, fluxo das Functions)
npm run typecheck
npm run build
```

Estrutura:

```
src/shared/          regras compartilhadas (config, schema zod, preços, arquivos)
src/features/solicitar/   formulário em 7 etapas
src/features/interno/     ferramentas internas (entrega do planejamento)
src/pages/           termos, privacidade, 404
netlify/functions/   upload-urls.ts, submit.ts e _lib/ (pdf, e-mail, storage, token, turnstile)
brand/original/      arquivos oficiais da marca (não editar)
public/brand/        derivados do símbolo Q (gerados por npm run assets)
```
