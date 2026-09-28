# Testes de falha

Todos os testes foram executados na implantação de produção, em `https://trabalho-laboratorio.pages.dev`, com o banco D1 `oauth-sessions-leonardo`. Valores sensíveis (cookies, `code`, `state`, `code_challenge` e URLs de retorno com valores transitórios) não foram registrados e aparecem como [REMOVIDO] quando necessário.

## Caso 1: retorno sem cookie temporário

- **Preparação:** em uma janela comum, iniciei o login com GitHub em `/oauth/login/github` e parei na página do provedor, sem autorizar. Copiei a URL de autorização e abri uma janela privativa, que não possuía o cookie `__Host-oauth-tx`.
- **Pedido enviado:** na janela privativa, colei a URL de autorização e concluí o login no GitHub. O navegador enviou `GET /oauth/callback/github?code=[REMOVIDO]&state=[REMOVIDO]` sem o cookie temporário.
- **Resultado esperado:** a rota de retorno recusa a resposta e não cria sessão.
- **Resultado observado:** a rota respondeu com status `400` e a mensagem `Transação ausente`. Em seguida, consultei `/api/me` na mesma janela privativa e a resposta foi `Não autenticado`. Nenhuma sessão foi criada.

## Caso 2: state alterado

- **Preparação:** em uma janela comum, iniciei outro login com GitHub em `/oauth/login/github` e parei na página de autorização, antes de autorizar. Na barra de endereço, troquei um único caractere do valor do parâmetro `state`.
- **Pedido enviado:** com a URL modificada, autorizei o acesso no GitHub. O navegador enviou `GET /oauth/callback/github?code=[REMOVIDO]&state=[REMOVIDO]` com o `state` diferente do original. A URL modificada não foi guardada.
- **Resultado esperado:** a rota de retorno recusa a resposta antes de trocar o código.
- **Resultado observado:** a rota respondeu com status `400` e a mensagem `State inválido`. O login não foi concluído e nenhuma sessão foi criada.

## Caso 3: reutilização da transação

- **Preparação:** com o painel Network aberto e Preserve log ativado, concluí um login com GitHub com sucesso. Depois, localizei a requisição `github?code=...` da rota de retorno e usei Copy URL.
- **Pedido enviado:** abri a URL copiada em uma nova aba, repetindo `GET /oauth/callback/github?code=[REMOVIDO]&state=[REMOVIDO]`.
- **Resultado esperado:** a transação já foi removida e a repetição falha.
- **Resultado observado:** a rota respondeu com status `400` e a mensagem `Transação ausente`. A transação já havia sido consumida no primeiro retorno, então a repetição foi recusada e nenhuma nova sessão foi criada.

## Caso 4: sessão expirada

- **Preparação:** com uma sessão ativa no navegador, abri o console do banco D1 `oauth-sessions-leonardo`.
- **Pedido enviado:** executei no console `UPDATE sessions SET expires_at = 0;`. Depois, recarreguei a página e consultei `GET /api/me`.
- **Resultado esperado:** `/api/me` responde 401.
- **Resultado observado:** o console D1 informou `This query successfully executed.`. Em seguida, `GET /api/me` respondeu com status `401`.

## Caso 5: origem inválida na saída

- **Preparação:** com uma sessão válida aberta em `https://trabalho-laboratorio.pages.dev`, abri uma aba com `https://example.com` e usei o console do navegador dessa aba.
- **Pedido enviado:** executei `fetch("https://trabalho-laboratorio.pages.dev/oauth/logout", { method: "POST", credentials: "include" });` a partir de `https://example.com`. O comando foi executado quatro vezes, com o mesmo resultado em todas.
- **Resultado esperado:** a rota recusa a operação e a sessão original permanece válida.
- **Resultado observado:** o console mostrou `POST .../oauth/logout` com `403 (Forbidden)`, acompanhado de um erro de CORS emitido pelo navegador. Ao voltar para a aba do projeto e consultar `/api/me`, a resposta continuou mostrando o perfil da sessão ativa.

## Caso 6: reutilização do cookie revogado

- **Preparação:** em uma sessão exclusiva do laboratório, copiei temporariamente o valor do cookie `__Host-session` pelas ferramentas de desenvolvimento e o colei apenas na linha de comando, sem apertar Enter. Depois, executei o logout pelo botão Sair e confirmei que `/api/me` passou a responder 401. Como cookies com prefixo `__Host-` não podem ser recriados manualmente no navegador, enviei o valor antigo diretamente no cabeçalho `Cookie` com o `curl`.
- **Pedido enviado:** `curl -i https://trabalho-laboratorio.pages.dev/api/me -H "Cookie: __Host-session=[REMOVIDO]"`.
- **Resultado esperado:** como a linha da sessão foi removida do D1 no logout, a resposta é 401.
- **Resultado observado:** a resposta foi `HTTP/1.1 401 Unauthorized`, com o corpo `Não autenticado`. A cópia do valor do cookie foi apagada depois do teste.
