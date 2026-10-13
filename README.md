# Bacias que abastecem Rio Preto — geoportal

Mapa web interativo do **uso do solo (MapBiomas 2024)** e da **qualidade da água (CETESB, 2018–2021)** nas 7 ottobacias de nível 5 que abastecem a região de São José do Rio Preto (SP).

Projeto pessoal de portfólio, feito somente com **dados públicos**. Não representa o SeMAE nem qualquer órgão público.

## O que tem no mapa
- Uso do solo 2024 (MapBiomas Coleção 10, 30 m) com legenda
- Ottobacias nível 5 (nomeadas) e nível 6 (camada opcional)
- Rios principais, limite de São José do Rio Preto e municípios
- 16 estações de qualidade da água dentro das bacias (13 com dados): clique para ver IQA, E. coli, fósforo, turbidez, OD, DBO e o uso do solo da bacia de contribuição em 2021
- ETEs (ANA, 2019) e captações de abastecimento público (outorgas estaduais, 2016) — sem nomes de usuários
- Busca por endereço, medição de distâncias e mapas de base (satélite Esri e OpenStreetMap)

## Como interpretar
- Resultados são **associações**, não causalidade (n = 13 estações, algumas sob influência de esgoto, dados de água até 2021).
- A rede de monitoramento não mede agrotóxicos: **ausência de sinal para a cana não é evidência de ausência de efeito**.
- Em destaque na análise: urbanização × E. coli (ρ = 0,68; p = 0,010) e vegetação nativa em APP × IQA (ρ = 0,58; p = 0,039).

## Fontes dos dados
| Dado | Fonte |
|---|---|
| Uso do solo | MapBiomas, Coleção 10 (https://brasil.mapbiomas.org/) |
| Ottobacias, trechos de drenagem (BHO 2017) | ANA / SNIRH |
| Qualidade da água | CETESB, via indicadores de qualidade do SNIRH/ANA (1978–2021) |
| ETEs (2019) | ANA / SNIRH |
| Outorgas de abastecimento público (2016) | DAEE/ANA, via SNIRH |
| Limites municipais e estaduais | IBGE |
| Mapas de base | Esri World Imagery; © OpenStreetMap contributors |

## Como foi feito
QGIS 3.44 (processamento, estatística espacial, estilos) → exportação com o plugin qgis2web (Leaflet) → ajustes manuais de legenda, popups e créditos. Imagem do uso do solo reduzida para web; contornos simplificados a ~33 m.

## Autor
Leonardo Pelais — [LinkedIn](https://www.linkedin.com/in/leonardo-pelais) · [GitHub](https://github.com/leonardopelais)

Código/páginas sob licença MIT; os dados seguem os termos das respectivas fontes.
