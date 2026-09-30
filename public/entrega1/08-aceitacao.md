# Critérios de aceitação

- [x] o site é servido pelo endereço pages.dev atribuído à equipe;
  Observação: `https://trabalho-laboratorio.pages.dev`.
- [x] os arquivos estáticos e as Functions compartilham a mesma origem;
  Observação: a página, `/oauth/*` e `/api/*` respondem no mesmo domínio `pages.dev`, sem CORS entre eles.
- [x] o projeto foi publicado por integração com GitHub;
  Observação: projeto Pages conectado ao repositório, com implantação de produção na ramificação `main`.
- [x] a equipe não instalou nem executou Node.js, npm, npx ou Wrangler;
- [x] cada provedor usa uma URL de retorno própria e exata;
  Observação: `/oauth/callback/google` e `/oauth/callback/github`.
- [x] os pedidos de autorização usam código e PKCE S256;
  Observação: conferido nos cabeçalhos das evidências 05 e 06.
- [x] a Function apresenta o Client Secret correto somente na troca de tokens;
- [x] o retorno recusa uma transação ausente, expirada, alterada ou reutilizada;
  Observação: ausente, alterada e reutilizada foram testadas nos casos 1, 2 e 3 do arquivo 07.
- [x] o id_token do Google só produz uma sessão depois da validação criptográfica e semântica;
- [x] o access_token do GitHub é usado somente para consultar /user e a autorização é revogada antes da criação da sessão;
- [x] o cookie de sessão é opaco, Secure, HttpOnly, SameSite=Strict e não possui Domain;
- [x] o D1 guarda o resumo do cookie, não seu valor bruto;
- [x] /api/me devolve somente o perfil necessário;
- [x] o logout confere Origin, remove a sessão e expira o cookie;
  Observação: uma chamada de outra origem foi recusada com 403 (caso 5 do arquivo 07).
- [x] um cookie revogado não restaura a sessão;
  Observação: o cookie antigo foi recusado com 401 (caso 6 do arquivo 07).
- [x] tokens e segredos não aparecem no HTML, nas URLs salvas, no armazenamento Web ou nos registros;
- [x] a dupla consegue explicar por que os arquivos estáticos permanecem públicos;
  Observação: tudo o que fica em `public` é servido por URL a qualquer visitante. A sessão protege apenas as rotas dinâmicas que validam o cookie.
- [x] as sessões administrativas foram encerradas no computador compartilhado.

## Assinatura

- Leonardo Alves Ferraz
- Guilherme Cracco Lichtenfels

Data: 28/09/2026
