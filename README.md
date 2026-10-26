# AGROFIT catalog

Lista de produtos com registro **ativo** no MAPA (agrotóxicos e afins), uma entrada por número de registro, em
JSON compacto. É usada pelo caderno de aplicação do [PulveCast](https://pulvecast.com).

- `data/manifest.json`: data da última mudança (`updatedAt`), quantidade de produtos e SHA-256 de `products.json`.
  O app lê este arquivo, que tem poucos bytes, e só baixa `products.json` quando `updatedAt` é mais novo do que o da
  lista que já tem.
- `data/products.json`: `{version, source, products: [{r, b, f, a, h, c, t, e}]}`, onde `r` é o registro, `b` as
  marcas comerciais, `f` a formulação, `a` os ingredientes ativos, `h` o titular do registro, `c` a classe, `t` a
  classe toxicológica e `e` a classe ambiental.

Publicado pelo GitHub Pages em `https://renanrb.github.io/agrofit-catalog/data/`.

## Atualização

Toda segunda-feira, o workflow `weekly AGROFIT catalog` baixa o arquivo "Produto Formulado" dos dados abertos do
MAPA, reduz a lista e faz commit só quando ela mudou. Se o MAPA estiver fora do ar, se as colunas mudarem ou se vierem
menos de 1.000 produtos, o build falha e a lista publicada continua a anterior.

Localmente: `node build.mjs` (baixa do MAPA) ou `node build.mjs arquivo.csv`; testes: `node --test catalog.test.mjs`.

## Fonte e licença dos dados

Dados: **AGROFIT – Sistema de Agrotóxicos Fitossanitários**, Ministério da Agricultura e Pecuária (MAPA), portal de
dados abertos (`dados.agricultura.gov.br`), licença **Creative Commons Atribuição (CC BY)**. Esta lista é uma
derivação para facilitar a digitação: não é recomendação de uso, não substitui a bula nem o receituário agronômico, e
não indica se um produto é permitido em uma cultura.

Código: MIT.
