# Avaliação: GitHub Actions com IA

Repositório: https://github.com/leonardoalvesferraz0704-png/trabalho-laboratorio-

Nenhum segredo aparece neste arquivo, nos logs ou nos comentários. Os segredos COPILOT_PAT, CLOUDFLARE_API_TOKEN e CLOUDFLARE_ACCOUNT_ID ficam só em Settings > Secrets and variables > Actions.

## Tarefa 1: evidências

Workflow: .github/workflows/ci.yml (job verificar, com as verificações de segredo versionado, migrações D1 em SQLite local e HTML válido).

- Execução verde: https://github.com/leonardoalvesferraz0704-png/trabalho-laboratorio-/actions/runs/38572878462
- Execução vermelha (CREATE TABLE com erro de sintaxe proposital): https://github.com/leonardoalvesferraz0704-png/trabalho-laboratorio-/actions/runs/38744275376

Linha do log que mostra o erro, no passo que aplica as migrações em SQLite:

`Parse error near line 1: near ",": syntax error`

Depois da falha proposital, corrigi a migração e o workflow voltou a ficar verde.

## Tarefa 1: por que testar a migração em SQLite

O D1 é baseado em SQLite, então um SQLite local aponta erros de sintaxe em segundos, a cada commit, antes de qualquer comando tocar o banco remoto, que é compartilhado e onde uma migração errada não se desfaz com facilidade.

## Tarefa 2: main protegida pelo status check

Ruleset "proteger-main", ativo, que exige pull request e o status check verificar, sem bypass.

- PR #1, bloqueado e depois liberado (e mergeado): https://github.com/leonardoalvesferraz0704-png/trabalho-laboratorio-/pull/1
- Saída do push direto na main, recusado:

`! [remote rejected] main -> main (push declined due to repository rule violations)`

`error: failed to push some refs to 'https://github.com/leonardoalvesferraz0704-png/trabalho-laboratorio-.git'`

## Tarefa 3: revisão de PR por IA

Workflow: .github/workflows/revisao-ia.yml (gatilho pull_request com opened e synchronize; monta o prompt com o diff, chama actions/ai-inference@v3 e comenta no PR com gh pr comment).

- PR #2, que adicionou o workflow (commit de merge ae9c96e): https://github.com/leonardoalvesferraz0704-png/trabalho-laboratorio-/pull/2
- PR #3, com a Function vulnerável e os comentários da IA (commit de merge b5753be): https://github.com/leonardoalvesferraz0704-png/trabalho-laboratorio-/pull/3

**Item a: SQL vulnerável.** O primeiro comentário do bot no PR #3 apontou Severidade ALTA em functions/api/notas.js:4, porque o parâmetro aluno era interpolado na consulta, com o exemplo ' OR '1'='1', e sugeriu WHERE aluno = ? com .bind(nome).

**Item b: correção.** Troquei por prepare("SELECT * FROM notas WHERE aluno = ?").bind(nome) no mesmo PR (evento synchronize). O segundo comentário reconheceu o prepare().bind() e não achou mais SQL injection, mas trouxe um achado novo: HIGH 9/10 de Broken Access Control, porque a Function não exige sessão nem autorização.

**Item c: permissão removida.** Removi pull-requests: write (commits 763845a..281886c). O passo "Comenta no PR" falhou, e os passos anteriores, inclusive o da IA, passaram.

- Execução com o erro de permissão (revisao-ia #6, commit 281886c): https://github.com/leonardoalvesferraz0704-png/trabalho-laboratorio-/actions/runs/38758288765

Linhas do log do passo que falhou:

`GraphQL: Resource not accessible by integration (addComment)`

`Error: Process completed with exit code 1`

Restaurei com git revert (commit 7d66333): o diff contra a main ficou vazio e o revisao-ia voltou a ficar verde (revisao-ia #7). O terceiro comentário do bot disse que nenhuma vulnerabilidade foi confirmada no diff.

**Item d: crítica à IA.**

- Irrelevante: nos dois primeiros comentários, a IA sugere registrar os achados em SECURITY-REVIEW.md e criar um commit. Nenhuma instrução do prompt pediu isso, e o workflow só comenta no PR (com contents: read), sem commitar nada.
- Inconsistente: para o mesmo código corrigido, o segundo comentário disse HIGH com confiança 9/10 (falta de autenticação) e o terceiro disse que nada foi confirmado. A confiança numérica não é calibrada. Também há trechos colados ("fora dele.Nenhum achado..."), uma tabela Markdown vazia ou quebrada e opções em inglês no segundo comentário, apesar de o prompt pedir português.
- Observação honesta: o achado de acesso sem autenticação é legítimo, porque o projeto tem infraestrutura de sessão (_shared/cookies.js e oauth/*) e o notas.js não a usa. Não o registro como erro da IA.

## Tarefa 4: migrações D1 depois do merge

Workflow: .github/workflows/migrar.yml (push na main com paths: migrations/**; job migrar; segredos da Cloudflare passados por env). Adicionado no PR #4: https://github.com/leonardoalvesferraz0704-png/trabalho-laboratorio-/pull/4

- PR #5, com migrations/0002_adiciona_coluna.sql (ALTER TABLE notas ADD COLUMN nota_final INTEGER;), que passou pelo CI e pela revisão da IA antes do merge: https://github.com/leonardoalvesferraz0704-png/trabalho-laboratorio-/pull/5
- Execução do migrar no merge do PR #5 (migrar #1, commit 49e67ab, sucesso): https://github.com/leonardoalvesferraz0704-png/trabalho-laboratorio-/actions/runs/38793738032

No log do passo "Aplica as migracoes no D1", a lista de migrações pendentes mostrou 0001_inicial.sql e 0002_adiciona_coluna.sql, e a tabela final mostrou as duas com status de sucesso.

Saída de npx wrangler d1 execute oauth-sessions-leonardo --remote --command "PRAGMA table_info(notas)":

| cid | name | type | notnull | dflt_value | pk |
|---|---|---|---|---|---|
| 0 | id | INTEGER | 0 | null | 1 |
| 1 | aluno | TEXT | 1 | null | 0 |
| 2 | nota | REAL | 0 | null | 0 |
| 3 | nota_final | INTEGER | 0 | null | 0 |

**Merge que não toca migrations/.** O PR #6 só adicionou NOTAS-PROVA.md: https://github.com/leonardoalvesferraz0704-png/trabalho-laboratorio-/pull/6

Depois desse merge (commit 8dfb505) rodou o ci #31, mas o workflow migrar não foi disparado: a lista de execuções do migrar continuou com uma só execução, a #1 do PR #5.

O bônus (resumo por IA no $GITHUB_STEP_SUMMARY) não foi feito.

## Perguntas

**1. O ci.yml roda duas vezes quando faço push numa ramificação com PR aberto. Por quê, e qual das duas execuções o status check da main considera?**

O ci.yml tem dois gatilhos, push e pull_request. Num push em ramificação com PR aberto, os dois disparam: o push valida o commit da ramificação, e o pull_request valida o PR (o resultado da combinação com a main). Os dois publicam o mesmo job, verificar, e a regra da main exige esse nome. No PR #4, as duas execuções apareceram marcadas como Required, então as duas precisam estar verdes para liberar o merge. A do pull_request é a mais relevante, porque testa o código como ele ficará depois do merge.

**2. Por que um PR vindo de um fork não consegue usar secrets.COPILOT_PAT? Qual ataque essa regra impede?**

Em PRs de forks, o GitHub não entrega os segredos do repositório de destino ao workflow, e o GITHUB_TOKEN fica só de leitura. A regra impede que um estranho abra um PR que altere o workflow (por exemplo, com um passo que imprime ou envia o segredo para um servidor dele) e roube o COPILOT_PAT quando o workflow rodar. Sem ela, qualquer pessoa conseguiria exfiltrar segredos apenas abrindo um PR.

**3. Por que o workflow da Tarefa 3 declara permissions em vez de usar as permissões padrão do GITHUB_TOKEN?**

Para aplicar o princípio do menor privilégio: o GITHUB_TOKEN recebe só contents: read e pull-requests: write, que é o necessário para ler o código e comentar no PR. Se o workflow ou uma dependência (como o pacote instalado com npm install -g) for comprometido, o estrago fica limitado a essas permissões. No item 3 da Tarefa 3, ao remover pull-requests: write, o passo "Comenta no PR" falhou com "Resource not accessible by integration", o que mostra que a declaração é de fato aplicada.

**4. A revisão da IA pode substituir o status check da Tarefa 2? Justifique com o que observei no item 4 da Tarefa 3.**

Não. Para o mesmo código corrigido, um comentário da IA disse HIGH com confiança 9/10 e o comentário seguinte disse que nenhuma vulnerabilidade foi confirmada, então a saída não é reprodutível nem calibrada. A IA também sugeriu ações irrelevantes (registrar os achados em SECURITY-REVIEW.md e criar um commit, que nenhuma instrução do prompt pediu) e trouxe formatação quebrada. Além disso, o workflow da IA só comenta no PR e não bloqueia o merge, enquanto o status check verificar é determinístico e bloqueou o merge quando o erro de sintaxe SQL apareceu. A IA serve como apoio à revisão, mas o bloqueio precisa vir de uma verificação objetiva.

## Observações sobre o enunciado

- **actions/ai-inference: @v1 vs @v3.** O PDF usa o @v1, que ainda executava o código antigo do GitHub Models e falhou com "API error: TypeError: Cannot use 'in' operator to search for 'choices' in OK" (endpoint https://models.github.ai/inference, modelo openai/gpt-4o). O @v3 (29/jul/2026, Latest) removeu o GitHub Models e usa só o Copilot CLI (npm install -g @github/copilot, com COPILOT_GITHUB_TOKEN: ${{ secrets.COPILOT_PAT }}). Por isso o workflow não usa models: read nem token: COPILOT_PAT, e o plano B do PDF não se aplica.
- **Erro do modelo gpt-4.1.** Com o @v3, a depuração ("Enable debug logging") mostrou: Copilot CLI stderr: Error: Model "gpt-4.1" from --model flag is not available. O gpt-4.1 é o padrão da action e não está liberado na minha conta. Correção: model: "" (o README diz que vazio deixa o CLI escolher o padrão), no commit "ci: deixa o Copilot CLI escolher o modelo (gpt-4.1 indisponivel na conta)".
- **Indentação e with: do YAML.** Ao copiar o PDF, a indentação do YAML se perdeu e o "with:" da Tarefa 4 veio colado na linha de "uses: actions/setup-node@v6". Reescrevi os arquivos completos, com o "with:" em linha separada.
- **Valores por env:, não direto no run:.** Em vez de usar ${{ }} direto em run:, passo os valores por env: (BASE_REF, PR_NUMBER, RESPONSE_FILE, GH_TOKEN e os segredos da Cloudflare), o que evita que o conteúdo de uma expressão seja interpretado como comando pelo shell.
- **migrar.yml.** O job se chama migrar (no PDF é aplicar), tem permissions: contents: read e roda npx wrangler (sem --yes; o npx instalou o wrangler sozinho, como mostra o log).
- **Estado do banco remoto.** O migrations list --remote mostrou 0001_inicial.sql como pendente, e a tabela notas não existia no D1 remoto (oauth_transactions e sessions já existiam, criadas fora das migrações). Como os três CREATE TABLE da 0001 usam IF NOT EXISTS, a primeira execução do migrar aplicou a 0001 sem erro e criou a notas, e em seguida aplicou a 0002.
- **Filtro paths.** O migrar.yml não está no próprio filtro (migrations/**), então o merge do PR que o criou não o executou.
- **NOTAS-PROVA.md.** Arquivo temporário criado só para o merge que não toca migrations/ (PR #6).
