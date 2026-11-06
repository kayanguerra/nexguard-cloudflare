# NexGuard — Cloudflare Pages

Pasta independente; a versão Vercel não foi modificada. Não contém chaves, .env ou .dev.vars reais.
Visual e frontend preservados. As rotas /api/config e /api/request agora usam Pages Functions, env bindings, Web Crypto e Request/Response nativos. Nenhum banco de dados ou painel foi adicionado.

## Subir ao GitHub
Envie o conteúdo desta pasta para um NOVO repositório, preservando o da Vercel para evitar publicar essa adaptação acidentalmente nela.
Não envie node_modules, dist, .wrangler, .env ou .dev.vars.
O arquivo .dev.vars.example é somente um modelo vazio.
As funções ficam em functions/; server/ e config/ devem permanecer na origem.

## Criar no Cloudflare Pages
1. Workers & Pages → Create application → Pages → Connect to Git (os nomes podem variar).
2. Conecte o novo repositório.
3. Framework: None. Build: npm run build. Output: dist. Root: raiz do repositório.
4. Use Node 22 ou superior para o build.
5. O nome inicial em wrangler.toml é nexguard-cloudflare; se escolher outro nome no Pages, ajuste esse campo antes de publicar.
6. Não publique somente a pasta dist pelo upload manual do painel: esse método não envia a pasta functions. Use integração Git ou Wrangler.

## Variáveis do projeto
Em Settings → Variables and Secrets, no ambiente Production:
- RESEND_API_KEY: Secret; reutilize a chave atual, sem publicá-la no GitHub.
- TURNSTILE_SECRET_KEY: Secret; reutilize a chave atual.
- TURNSTILE_SITE_KEY: chave pública do widget.
- MAIL_FROM: NexGuard <formularios@site.nexguardtech.com.br>
- MAIL_TO: contato@nexguardtech.com.br
- MAIL_TO_CONFIRMED: true
- ALLOWED_ORIGINS: https://ENDERECO-REAL.pages.dev (sem barra final).
- TURNSTILE_HOSTNAMES: ENDERECO-REAL.pages.dev (sem protocolo).
Substitua ENDERECO-REAL pelo endereço fornecido pelo Pages. Não use literalmente esse marcador.
Não há credenciais configuradas automaticamente. Refaça o deployment após cadastrar variáveis.
No Turnstile, adicione o hostname exato .pages.dev ao widget existente.
Previews só devem receber as chaves se houver intenção de aceitar envios; para isso, configure também origens e hostnames exatos, sem curingas.

## Conectar o domínio depois do teste
1. Validar o site pelo endereço .pages.dev: navegação, orçamento, suporte e Checkup.
2. Confirmar que duas mensagens reais chegaram na caixa de atendimento.
3. Pages → Custom domains → adicionar nexguardtech.com.br e, se desejado, www.nexguardtech.com.br.
4. Para permitir ambos, ALLOWED_ORIGINS deve listar https://nexguardtech.com.br,https://www.nexguardtech.com.br e o endereço .pages.dev, separados por vírgula.
5. TURNSTILE_HOSTNAMES deve listar esses hosts sem protocolo; cadastre-os no widget Turnstile.
6. Preserve os registros de e-mail existentes (MX, Microsoft 365, DKIM e CNAMEs do Resend).
7. Só encerre a hospedagem anterior após validar o domínio final. O domínio canônico da página continua nexguardtech.com.br.

## Testar localmente
npm install
npm run check
npm test
npm run build
Para teste com o runtime Cloudflare: copie .dev.vars.example para .dev.vars e preencha localmente, depois npm run dev.
Abra http://localhost:8788. Cadastre localhost e 127.0.0.1 no Turnstile.
O desenvolvimento local usa .dev.vars; não carrega automaticamente o .env da versão Vercel.

## Consumo e segurança
_routes.json limita Functions a /api/*; páginas, imagens, CSS e JS continuam estáticos.
Cabeçalhos de segurança são gerados em _headers para estáticos e aplicados nas respostas das funções.
Validação, Turnstile com hostname/action, honeypot, limite de corpo, origem, timeouts e idempotência preservados.
Não há logs com conteúdo de formulários ou chaves.
Resend confirmar aceitação não equivale a confirmação de entrega; conferir eventos no Resend e a caixa destinatária.
Preços continuam ocultos e dependem de aprovação em config/business.cjs.
Nenhuma mudança de DNS, publicação ou envio real foi feita por esta preparação.

Referências:
https://developers.cloudflare.com/pages/functions/
https://developers.cloudflare.com/pages/functions/routing/
https://developers.cloudflare.com/pages/functions/wrangler-configuration/

## Verificação realizada
- npm run check: aprovado.
- npm test: 9 testes aprovados com provedores simulados.
- npm run build: aprovado; preços preliminares ocultos.
- Wrangler 4.158.0: compilação das Pages Functions aprovada.
- Runtime Cloudflare local: HTML/CSS 200; config sem credenciais retorna ready=false; envio sem configuração retorna 503; método inválido retorna 405; cabeçalhos de segurança aplicados.
- HTML comparado com o projeto original: idêntico.
- Nenhum e-mail real enviado, deploy criado ou DNS alterado nesta preparação.
