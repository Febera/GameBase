# GameBase

Descoberta de jogos de PC para um grupo de amigos. Dados da IGDB, GamerPower e IsThereAnyDeal.
Sem login, sem landing page: o site abre direto nas listas.

> O nome e a marca ficam em `apps/web/src/components/layout/Logo.tsx`, no `<title>` de
> `apps/web/index.html` e no ícone `apps/web/public/favicon.svg`.

## Estrutura

```
apps/api        Backend Fastify: proxy das APIs externas, cache e regras
apps/web        Frontend React + Vite + Tailwind
packages/shared Tipos compartilhados entre os dois (contrato da API)
```

## Pré-requisitos

- Node.js 24 LTS (funciona do 22 ao 24; o arquivo `.node-version` indica 24)
- npm 10 ou mais novo
- Client ID e Client Secret de um app em https://dev.twitch.tv/console/apps
- API Key da IsThereAnyDeal (https://isthereanydeal.com/apps/my/), para "Grandes ofertas"
- Um banco Postgres no Neon (URLs pooled e direta), para separar grátis, demos e pagos

## Como rodar

```bash
npm install
cp apps/api/.env.example apps/api/.env
# edite apps/api/.env e preencha TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, ITAD_API_KEY,
# DATABASE_URL e DATABASE_DIRECT_URL
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:3333 (teste com http://localhost:3333/api/health)

O arquivo `.npmrc` liga `legacy-peer-deps` para contornar um bug do npm 10 ao resolver
dependências opcionais do Vite 8. Não remova enquanto usar npm 10.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Sobe API e frontend juntos |
| `npm run dev:api` / `npm run dev:web` | Sobe só um dos lados |
| `npm test` | Roda os testes do backend e do frontend |
| `npm run typecheck` | Verifica os tipos nos dois projetos |
| `npm run build` | Gera `apps/api/dist` e `apps/web/dist` |
| `npm run migrate -w @rj/api` | Aplica as migrações do banco (o servidor também aplica sozinho ao subir) |

Os testes do banco rodam contra um Postgres de verdade e são pulados sem a variável
`TEST_DATABASE_URL`. Para rodá-los, aponte para um banco **descartável** (as tabelas são
apagadas a cada teste), por exemplo um branch `test` no Neon:

```bash
TEST_DATABASE_URL="postgresql://..." npm test -w @rj/api
```

## API

| Rota | Descrição |
|---|---|
| `GET /api/health` | Verifica se o servidor está no ar |
| `GET /api/giveaways` | Jogos de PC grátis por tempo limitado (GamerPower) |
| `GET /api/offers/:id` | Página de uma oferta pelo ID da IsThereAnyDeal (traz `igdbId` quando o jogo existe na IGDB) |
| `GET /api/deals` | Jogos com 75% ou mais de desconto, preços em reais (IsThereAnyDeal) |
| `GET /api/search` | Busca com filtros (veja abaixo) |
| `GET /api/search/suggest?q=` | Sugestões para o autocomplete (a partir de 2 letras) |
| `GET /api/search/facets` | Gêneros e lojas para montar os filtros |
| `GET /api/recommendations` | Placar de recomendações do grupo |
| `GET /api/recommendations/events` | Placar ao vivo (Server-Sent Events): avisa cada recomendação ou voto |
| `GET /api/recommendations/:id` | Se o jogo está no placar e como você votou |
| `POST /api/recommendations/:id` | Recomenda o jogo (ou apoia, se já está no placar) |
| `PUT`/`DELETE /api/recommendations/:id/votes/up\|remove` | Liga/desliga apoio ou pedido de remoção |
| `GET /api/games/:id` | Página do jogo: detalhes, mídia, jogadores, preços por loja e similares (404 se não existe, 403 se oculto pelo filtro) |
| `GET /api/games/new-popular?category=free\|demo\|paid` | Jogos de PC lançados nos últimos 90 dias, por popularidade, com preço da Steam |

Todas as listas aceitam `offset`, `limit` (até 50) e `adult` (`hide`, padrão, ou `show`).
As listas da home também aceitam `sort` (`reviews`, padrão; `discount`; `value`; `release`) e
`order` (`desc`, padrão, ou `asc`).
As divisões de "Novos populares" também devolvem `pending`: quantos jogos ainda estão sendo
verificados na Steam.

Erros sempre vêm como `{ "error": "...", "message": "..." }`:
400 para parâmetros inválidos, 502 quando uma API externa falha,
503 quando falta configuração (por exemplo, `ITAD_API_KEY`).

## Filtro de conteúdo sexual

Ligado por padrão, aplicado no servidor antes de qualquer lista sair. Cada pessoa pode
desligar em **Opções** (ícone de engrenagem); a escolha fica salva no navegador.

| Fonte | Como o jogo é identificado |
|---|---|
| IGDB | Tema "Erotic" ou palavra-chave "eroge" (IDs buscados pelo slug) |
| IsThereAnyDeal | Campo `mature` do jogo; com o filtro ligado, a própria ITAD já os exclui |
| GamerPower | Pelo jogo correspondente na IGDB; sem correspondência, pela busca de título na ITAD |
| Steam | Descritores de conteúdo 3 (sexual explícito) e 4 (nudez ou temas sexuais como foco); o 1 fica de fora |

O critério é "foco em conteúdo sexual": jogos mainstream com cenas pontuais continuam aparecendo.

## Como funcionam as seções da home

- **Destaque do grupo** (topo): a arte do 1º do placar de recomendações na largura toda, com nome, gêneros, selos, preço, votos e "Ver jogo". Um seletor ao lado percorre o top 5 sozinho a cada 8 s (pausa com o mouse ou o foco; parado com "reduzir movimento"). Placar vazio: convite para a primeira recomendação. Erro no servidor: o destaque some e o resto da home segue.
- **Atalhos**: as buscas rápidas da barra do topo, como blocos grandes.
- Cada seção tem ícone, subtítulo, total ("Ver todos") e uma **ilustração de traço** ao fundo, estática e na cor da seção (grátis e ofertas dividem uma só, com presentes, cupons e etiquetas de desconto; calendário; controles; gráfico com estrelas), desenhada em SVG no próprio código. No destaque, um jogo sem arte larga na IGDB ganha a ilustração de um pódio.
- **Grátis por tempo limitado** (carrossel de cupons, 25 jogos): cada jogo vira um cupom com capa, loja, valor original e prazo ("Acaba hoje", "Acaba em 3 dias", "Até 05/11"); o cabeçalho avisa quantos acabam na semana. primeiro os jogos pagos com 100% de
  desconto na IsThereAnyDeal, do preço original mais alto para o mais baixo; depois os giveaways
  do GamerPower, por popularidade. O mesmo jogo aparece uma vez só. Os títulos do GamerPower são
  limpos ("Tunic (Epic Games) Giveaway" → "Tunic") e associados à IGDB para usar a capa vertical.
- **Grandes ofertas** (carrossel, 25 jogos): **todas** as ofertas de 70% a 99% de desconto na
  região Brasil (até 4.000 por consulta), só jogos completos. Cada oferta abre a página do jogo;
  se ele não existe na IGDB, abre uma página própria da oferta (`/oferta/:id`), com preços,
  histórico e avaliações da IsThereAnyDeal. A lista é aquecida quando o servidor sobe e, depois,
  recarregada em segundo plano sem ninguém esperar. Maior desconto primeiro, nota da IGDB no empate. Links e preços aparecem exatamente
  como a IsThereAnyDeal fornece, como pedem os termos de uso dela.
- **Novos populares grátis / com demo / pagos** (grades de 5 × 4, 20 jogos; em "grátis", o 1º ocupa 2 × 2): até 400 jogos
  populares lançados nos últimos 90 dias são divididos pelos dados da loja Steam. Pagos que têm
  demo aparecem só em "com demo". Jogos fora da Steam não entram em nenhuma das três.

Os créditos das fontes ficam numa linha no rodapé.

**Ordem.** A home sempre mostra do mais avaliado para o menos (avaliações da Steam; enquanto um
jogo não foi verificado, as da IGDB). Nas listas completas, o controle no canto superior direito
troca entre **Avaliações**, **Desconto** (em "Grátis por tempo limitado", **Valor original**) e
**Lançamento**; clicar na opção escolhida inverte a ordem. A ordem fica na URL.

**Cada card abre uma página do GameBase**: o jogo, quando ele existe na IGDB, ou a página da
oferta. Na página, um jogo de graça por tempo limitado ganha a linha "Resgatar" no topo do bloco
de compra.

**Duplicatas e edições.** Registros com o mesmo nome e edições do mesmo jogo (Enhanced, Legacy,
Definitive, Remastered, Complete, GOTY…) viram uma entrada só: a que tem imagem e mais
avaliações. Se ela não tem preço e uma edição tem, o preço vem da edição (ex.: GTA V usa o preço
do GTA V Enhanced). Jogos pagos que continuam sem preço saem das listas da home; na busca
aparecem com "Preço indisponível".

## Página do jogo

Layout inspirado no redesign da Steam do Figma de referência, com as cores do GameBase.

- **Topo:** visualizador grande de mídia (trailers primeiro, depois screenshots) com faixa de
  miniaturas; ao lado, arte, resumo, avaliações da Steam em barra (% positivas, pela
  IsThereAnyDeal), nota da IGDB e da crítica, datas, empresas e gêneros.
- **Histórico de preços:** uma aba encaixada atrás do bloco de compra, com o menor preço dos
  últimos 12 meses e o menor de todos os tempos (loja e data). Quando o preço de agora é o
  menor da história, a aba fica dourada, com brilho e faíscas.
- **Onde comprar:** logo abaixo da mídia, uma linha por loja, a mais barata em destaque, e o
  aviso de demo grátis. Jogo grátis vira "Jogar na Steam".
- **Fundo:** a arte do jogo no topo, na largura toda, sumindo até a cor da página.
- **Para jogar junto:** painel lateral com ícones e números (online, coop online, mesmo PC,
  tela dividida), pelos modos multijogador de PC da IGDB. Abaixo, a ficha (modos, perspectiva, temas).
- **Jogos parecidos:** similares de PC com preço da Steam, sem os marcados como adultos.
- O trailer só carrega o player do YouTube ao clicar; screenshots abrem em tela cheia.

Cache: dados da IGDB por 6 horas, preços e avaliações por 30 minutos.

## Visual e movimento

- Fundo #181818 (claro: #f4f4f5), bordas com 0,3rem de raio, barra do topo na largura toda com a
  busca no centro. Nas páginas de jogo e oferta, a barra fica translúcida e desfocada sobre a
  arte do jogo; nas demais, sólida (#0f0f0f).
- Cards com hover no estilo da biblioteca da Steam: a capa levanta, cresce e inclina na direção
  do mouse, e um reflexo de vidro atravessa a capa uma vez, com uma borda fina translúcida.
  A área do link fica parada, para o cursor não "escapar".
- Cores: barra do topo #0f0f0f, destaque azul #0ab2ef, ofertas e avaliações positivas #a1cd44,
  mistas #e1d417, negativas #f70000; botões de compra brancos com texto preto.
- Notas da IGDB e da crítica na escala de 1 a 10.
- Páginas, listas, painéis e sugestões entram com transições curtas (180–380 ms, ease-out);
  esqueletos de carregamento com brilho; botões "afundam" ao clicar.
- Quem ativa "reduzir movimento" no sistema recebe o site sem inclinação nem brilhos.

## Busca

- **Barra do topo:** o botão **"Filtros"** dentro do campo abre a busca com a barra lateral de
  filtros. Com o campo vazio e focado, abre o painel de **buscas rápidas** (Coop online para 4+,
  8+ jogadores online, Grátis para jogar, Pagos com demo grátis, Lançamentos recentes, Mais bem
  avaliados) e o atalho "Abrir busca avançada". Digitando, aparecem sugestões de jogos a partir
  de 2 letras. Tudo navegável pelas setas e Enter; nada é destacado sem você escolher.
- **Filtros na barra lateral** (página de busca): jogadores online (pelo menos N, "online" ou
  "coop online", e opção de incluir jogos sem informação), preço (grátis / pago com demo / pago
  sem demo), lojas (seleção múltipla), gêneros, ano de lançamento e nota mínima.
  Nas categorias com caixas de seleção, **nada marcado = tudo marcado** (sem filtro); o cabeçalho
  mostra "Todas" nesse caso, e marcar todas as opções limpa o filtro sozinho. Filtros ativos aparecem como chips removíveis.
- **Resultados** em lista (padrão) ou grade de capas, com abas de ordenação (Relevância, Mais
  populares, Mais bem avaliados, Lançamentos) e rolagem infinita. O card da lista segue o modelo
  da loja: título grande e data por extenso no alto; avaliação em texto colorido e selo de
  jogadores na base, alinhados com o preço; à direita, "Promoção até 31/10" (pela
  IsThereAnyDeal) sobre o bloco de desconto e preço; sem preço, "Preço indisponível" no mesmo espaço.
- **Duplicatas** ficam escondidas; a caixa "Mostrar duplicatas e edições separadas" as traz de volta.
- **Tudo fica na URL** com nomes em português, então dá para mandar o link para os amigos:
  `/busca?jogadores=6&modo=coop&lojas=steam,epic&preco=gratis`.

Limites conhecidos:

- A busca trabalha sobre os **500 primeiros resultados** da IGDB para cada combinação de
  filtros (o máximo por consulta). Filtros mais específicos encontram jogos fora desse corte.
- **Faixas de preço** vêm da loja Steam: jogos fora da Steam não aparecem com esse filtro, e na
  primeira vez alguns jogos ainda estão sendo verificados (a página avisa e se atualiza sozinha).
- **Lojas** vêm dos vínculos cadastrados na IGDB; a cobertura de Epic, itch.io e outras é menor
  que a da Steam.

## Recomendações do grupo

- O placar é **ao vivo**: recomendações e votos de qualquer pessoa aparecem na hora, sem recarregar.
- O **top 5 é um pódio em escada** (1º à esquerda, no degrau mais alto) sobre um fundo dourado
  animado, que some até a cor da página. Cada jogo mostra preço, selo **DEMO** (quando tem demo
  grátis na Steam) e selo de jogadores; fora do top 5, a linha é título · DEMO · jogadores.
- Na página do jogo, **"Recomendar para geral"** coloca o jogo no placar, já com o seu apoio.
  Se ele já está lá, o botão vira "Apoiar".
- No placar, o **top 5** aparece em destaque e o resto em lista, do mais apoiado para o menos
  (no empate, o recomendado há mais tempo). A página se atualiza sozinha a cada 30 s.
- **Um voto de cada tipo por IP e por jogo**: apoio e pedido de remoção; clicar de novo desfaz.
- Com **5 pedidos de remoção**, o jogo sai do placar com todos os votos. Pode ser recomendado de
  novo depois, começando do zero. O último pedido pede confirmação.
- O IP nunca é guardado: só um hash dele com o segredo `IP_HASH_SALT`. Defina esse segredo no
  `.env` e no Render, e não mude depois, ou os votos antigos deixam de ser reconhecidos.
- Pessoas na mesma rede (mesmo Wi-Fi, ou operadoras que compartilham IP) contam como um voto só.
- Com o filtro de conteúdo ligado, jogos adultos não aparecem no placar, mas continuam contando.
- Limite de 60 ações a cada 10 minutos por IP, contra cliques em sequência.

## Sincronização com a Steam

A loja da Steam não tem API oficial para isso e aceita poucas consultas (cerca de 200 a cada
5 minutos). Por isso:

1. O servidor descobre o App ID da Steam de cada jogo pela IGDB e guarda o vínculo no banco
   (tabela `igdb_steam`): a IGDB só é consultada de novo para jogos novos. Vínculos valem 30 dias;
   "sem Steam" é conferido de novo em 7.
2. O que falta ou venceu de cada jogo entra numa fila, e cada dado vence no seu ritmo:
   - **preço**: 12 horas, atualizado **em lote** (até 50 jogos por consulta);
   - **avaliações**: 7 dias (Steam; se não vierem, pela IsThereAnyDeal);
   - **detalhes** (grátis, demo, conteúdo adulto): 7 dias, numa consulta completa que também
     traz preço e avaliações.
3. A fila faz uma consulta a cada 1,6 s, em segundo plano, e tudo vai para o banco.
4. As listas usam o que já está no banco; a home se atualiza sozinha a cada 30 s enquanto
   houver jogos pendentes.

A fila tem duas prioridades: jogos que alguém está vendo agora passam na frente; as listas
grandes (até 4 mil ofertas) entram na fila lenta. As ofertas não gastam consultas com preço,
que já vem da IsThereAnyDeal; da Steam só interessam avaliações e conteúdo adulto.

"Mais bem avaliados" junta duas fontes de candidatos: os mais avaliados da IGDB e os jogos da
Steam já guardados no banco com 500+ avaliações, ordenados pela média bayesiana direto no
Postgres. Os filtros da busca valem para os dois.

As listas pesadas (ofertas, giveaways, novos populares) também ficam salvas no banco (tabela
`cache_snapshots`): quando o servidor acorda da hibernação, serve a última versão na hora e
recarrega em segundo plano.

Se a Steam pedir para desacelerar, a fila pausa 2 minutos e continua.

## Progresso

- [x] Etapa 1: fundação, barra do topo, tema, "Novos populares"
- [x] Filtro de conteúdo sexual e painel "Opções"
- [x] Etapa 2: giveaways (GamerPower) e grandes ofertas (IsThereAnyDeal)
- [x] Etapa 3: grátis / com demo / pagos (dados da Steam + banco Neon), preços, grades
- [x] Ajustes: 100% de desconto em "Grátis", carrosséis com 25 jogos, créditos no rodapé
- [x] Etapa 4: página do jogo e jogos similares
- [x] Página do jogo refeita no layout de referência (Figma)
- [x] Etapa 5: busca, autocomplete e filtros (incluindo lojas, com seleção múltipla)
- [x] Ajustes: ofertas a partir de 70%, menores preços com data, faixas de preço na busca
- [x] Etapa 6: recomendações globais com votos
- [x] Redesign: GameBase, fundo neutro, movimento, histórico de preços, páginas de oferta
- [x] Ordenação das listas, avaliações da Steam, duplicatas/edições, card da busca, placar ao vivo
- [x] Buscas rápidas e botão Filtros na barra, novo card da busca, barra translúcida na página do jogo
- [x] Recomendações em pódio de escada, com preço, DEMO e jogadores
- [x] Desempenho: vínculos IGDB → Steam no banco, prazos por dado, preços em lote, ranking no Postgres, listas salvas, multiquery da IGDB
- [x] Busca: título pelos filtros, ilustração, barra de ordenação fixa, filtros em chips, selo do grupo, posição em "Mais bem avaliados", hover com vidro e estado vazio que sugere o filtro a tirar
- [x] Home: destaque do placar do grupo, atalhos, cabeçalhos com ícone, cupons, grade com destaque, ilustrações de fundo e grão

Resumo das decisões e do contexto do projeto: [`CONTEXTO.md`](CONTEXTO.md).
- [ ] Etapa 7: deploy (Cloudflare Pages + Render + Neon)
