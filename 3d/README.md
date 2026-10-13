# Geoportal 3D: bacias que abastecem São José do Rio Preto

Versão 3D (MapLibre GL JS) do geoportal de uso do solo (MapBiomas) e qualidade da água (CETESB) nas 7 ottobacias nível 5 que abastecem a região de Rio Preto (SP).

- Relevo 3D com exagero ajustável (tiles Terrarium, AWS Open Data) e sombreamento
- Uso do solo 1985/2024 projetado sobre o terreno
- Colunas 3D por estação: altura proporcional a log10(E. coli), cor pela classe do IQA
- Câmeras (inclinada, planta, rasante), giro automático, altitude sob o cursor
- Clique em bacia ou estação para ver uso do solo e parâmetros de água

Sem build: abra `index.html` por um servidor estático (`python -m http.server`). Requer WebGL.

Dados públicos: MapBiomas Col. 10, ANA/SNIRH, CETESB, IBGE. Resultados são associações, não causalidade; a rede não mede agrotóxicos; dados de água até 2021.

Autor: Leonardo Pelais. Licença MIT.
