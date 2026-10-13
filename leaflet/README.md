# Bacias que abastecem Rio Preto — geoportal (Leaflet)

Versão escrita à mão (Leaflet 1.9, JavaScript puro, sem build) do geoportal das 7 ottobacias de nível 5 que abastecem a região de São José do Rio Preto (SP). Complementa a versão gerada pelo qgis2web.

Projeto pessoal de portfólio, feito somente com **dados públicos**. Não representa o SeMAE nem qualquer órgão público.

## O que tem
- **Uso do solo** MapBiomas Coleção 10 (30 m) com alternância **1985 / 2024**, opacidade e legenda recolhível
- **Painel de análise** com panorama regional, detalhe por bacia (bacia inteira e faixa de APP de 30 m) e por estação
- **Estações CETESB** coloridas pela classe do IQA (mediana 2018–2021), séries históricas por parâmetro e evolução do uso do solo na **bacia de contribuição** (delimitada com Copernicus DEM 30 m)
- Ottobacias nível 5 e 6, rios principais, municípios, ETEs e captações outorgadas (20 superficiais e 1.002 subterrâneas; sem nomes de usuários)
- Busca de estações, bacias e rios, e de endereços (Nominatim/OpenStreetMap)
- Layout responsivo: painel lateral no computador e painel inferior no celular

## Estrutura
```
index.html      página e painéis
css/style.css   estilos (claro/escuro automático)
js/app.js       mapa, camadas, painéis e busca
js/charts.js    gráficos SVG sem dependências
data/*.geojson  dados já processados (EPSG:4326)
img/uso_*.png   uso do solo 1985 e 2024 (PNG indexado)
```
Para rodar localmente: `python -m http.server 8000` dentro da pasta e abrir `http://localhost:8000`.

## Como interpretar
- Resultados são **associações**, não causalidade (13 estações com dados, algumas sob influência de esgoto, água até 2021).
- A rede de monitoramento não mede agrotóxicos: ausência de sinal para a cana não é evidência de ausência de efeito.
- Das 1.022 outorgas, só cerca de metade é para abastecimento público.

## Fontes
MapBiomas (Col. 10) · ANA/SNIRH (BHO 2017, ETEs 2019, indicadores de qualidade da água CETESB) · DAEE/ANA (outorgas 2016) · IBGE · Esri World Imagery · © OpenStreetMap · © CARTO

## Autor
Leonardo Pelais — [LinkedIn](https://www.linkedin.com/in/leonardo-pelais) · [GitHub](https://github.com/leonardopelais). Código sob licença MIT; os dados seguem os termos das respectivas fontes.
