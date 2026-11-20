# Geoportal Municipal de Carolina - MA | WebGIS Interativo

> **Criado e Desenvolvido por:** **Richard Oliveira Jardim**  
> *Sistema de Informações Geográficas (WebGIS) Ambiental e Territorial*

---

## 👨‍💻 Autor & Créditos

- **Autor:** Richard Oliveira Jardim
- **Especialidade:** Geotecnologias & WebGIS
- **Município Alvo:** Carolina - Maranhão (Código IBGE: 2102804)
- **Ano:** 2026

---

## 🗺️ Camadas Vetoriais Disponíveis

O Geoportal integra todas as camadas originais da pasta, otimizadas para carregamento web instantâneo e renderização acelerada por GPU / HTML5 Canvas:

| Camada | Fonte Original | Feições | Área Total (ha) | Descrição |
| :--- | :--- | :---: | :---: | :--- |
| **Limite Municipal** | `Geoportal_Carolina.geojson` | 1 | 626.760,1 ha | Malha municipal oficial de Carolina - MA (IBGE 2102804, 6.267,6 km²). |
| **Vegetação Nativa** | `MA_Carolina_VEGETACAO_NATIVA.gpkg` | 1.643 | 297.223,9 ha | Remanescentes de vegetação nativa do Cerrado e transição amazônica. |
| **Área Consolidada** | `MA_Carolina_AREA_CONSOLIDADA.gpkg` | 1.894 | 206.698,9 ha | Áreas de ocupação antrópica e agropecuária consolidada pré-2008. |
| **Área de Preservação (APP)** | `MA_Carolina_APP.gpkg` | 4.683 | 37.437,5 ha | APPs de cursos d'água, nascentes, olhos d'água e bordas de chapada. |
| **Hidrografia** | `MA_Carolina_HIDROGRAFIA.gpkg` | 1.880 | 12.608,7 ha | Cursos d'água naturais, rios, lagos e reservatórios artificiais. |
| **Atrativos Ecoturísticos** | `data/pontos_turisticos.geojson` | 9 | Pontos Notáveis | Complexo Pedra Caída, Cachoeiras do Itapecuru, São Romão, Prata, Morro do Chapéu, Poço Azul, Portal da Chapada e Parque Nacional. |

---

## 🛰️ Mapas de Fundo (Basemaps)

O Geoportal conta com 4 opções de mapas de fundo de alta qualidade, selecionáveis pelo painel lateral com miniaturas visuais:

1. **Satélite de Alta Resolução (Esri World Imagery)**: Ortoimagens de satélite de alta definição com sobreposição opcional de vias e referências toponímicas.
2. **OpenStreetMap Padrão (OSM)**: Cartografia mundial colaborativa com malha viária, hidrografia e povoados detalhados.
3. **CartoDB Dark Matter (Tema Escuro / Minimalista)**: Fundo escuro de alto contraste, ideal para destaque das feições ambientais e análise técnica.
4. **Topográfico / Relevo (Esri World Topo)**: Relevo sombreado e altimetria, essencial para visualização da geomorfologia das Chapadas das Mesas.

---

## ⚡ Funcionalidades do WebGIS

- **Painel de Controle Flutuante & Retrátil**:
  - Ativação/desativação individual de cada camada com botões rápidos "Todas" / "Nenhuma".
  - Controle deslizante de **Opacidade (Transparency Slider)** em tempo real para cada camada.
  - Botão de **Zoom para a Camada (Enquadrar)**.
  - Indicadores de contagem de feições e área calculada.
- **Identificador de Feições (Popups Interativos)**:
  - Clique em qualquer polígono para ver Código do Imóvel (CAR), Tema, Condição Cadastral, Área em Hectares (ha) e em Metros Quadrados (m²).
  - Botão para **Copiar o Código CAR** com 1 clique e botão para aproximar o zoom na geometria.
  - **Emissão de Ficha Técnica / Relatório Ambiental em PDF**: Gera documento oficial A4 formatado para impressão ou salvar em PDF com carimbo digital e assinatura técnica de Richard Oliveira Jardim.
- **Importação de Camadas do Usuário (KML / GeoJSON)**:
  - Botão no cabeçalho ou **arraste e solte** qualquer arquivo `.kml` ou `.geojson` diretamente sobre o mapa!
  - O sistema renderiza a propriedade importada com contorno destacado em roxo/fuchsia, calcula a área em hectares e enquadra no mapa para cruzamento com o CAR.
- **Geolocalização em Tempo Real (GPS de Campo)**:
  - Botão de mira na barra flutuante que ativa o GPS do dispositivo e exibe a localização exata do usuário com margem de precisão.
- **Tabela de Atributos Dinâmica**:
  - Alternância entre todas as camadas vetoriais.
  - Busca textual rápida e paginação fluida.
  - Ao clicar em uma linha da tabela, o mapa centraliza automaticamente na feição e abre seus detalhes.
  - **Exportação dos dados para CSV** (compatível com Excel) e **GeoJSON**.
- **Filtros e Consulta Espacial**:
  - Filtro por Código CAR, por Tema ambiental, por Condição cadastral e por Área Mínima (ha).
  - Zoom automático nos resultados filtrados.
- **Dashboard de Estatísticas Ambientais**:
  - Resumo de indicadores municipais.
  - Gráfico Donut de composição do uso do solo de Carolina.
  - Gráfico de barras da situação cadastral dos imóveis.
- **Ferramentas de Medição**:
  - Régua de medição de distância geodésica (metros / quilômetros).
  - Medição de área de polígonos irregulares (hectares / m² / km²).
- **Captura e Impressão**:
  - Exportação de imagem PNG do mapa em alta resolução para relatórios técnicos.
- **Barra de Coordenadas**:
  - Latitude e Longitude do cursor em tempo real + Nível de Zoom + Datum SIRGAS 2000 / EPSG:4326.

---

## 🚀 Como Executar

### Opção 1 (Recomendada - 1 Clique):
Dê um duplo clique no arquivo **`iniciar_geoportal.bat`**. O servidor HTTP local será iniciado e o Geoportal abrirá automaticamente no seu navegador padrão em `http://localhost:8080`.

### Opção 2 (Direto no Navegador):
Dê um duplo clique diretamente no arquivo **`index.html`**. O Geoportal possui um sistema híbrido de carregamento que funciona tanto via servidor local quanto diretamente via arquivo local (`file:///`).

---

## 📁 Estrutura de Arquivos

```
Geoportal_Carolina/
│
├── index.html                  # Interface principal do Geoportal
├── iniciar_geoportal.bat       # Inicializador automático do servidor local
├── README.md                   # Documentação do projeto
│
├── css/
│   └── style.css               # Estilos modernos e responsivos (UI Glassmorphism)
│
├── js/
│   └── app.js                  # Lógica do WebGIS, Leaflet Canvas, Filtros e Medições
│
├── data/
│   ├── limite_municipal.geojson & .js
│   ├── vegetacao_nativa.geojson & .js
│   ├── area_consolidada.geojson & .js
│   ├── app.geojson & .js
│   ├── hidrografia.geojson & .js
│   ├── summary.json & .js
│
├── Geoportal_Carolina.geojson  # Arquivo original
├── MA_Carolina_APP.gpkg        # Arquivo original
├── MA_Carolina_AREA_CONSOLIDADA.gpkg # Arquivo original
├── MA_Carolina_HIDROGRAFIA.gpkg      # Arquivo original
└── MA_Carolina_VEGETACAO_NATIVA.gpkg # Arquivo original
```

---

## 🌐 Como Publicar na Web (Gratuito e Acessível para Qualquer Pessoa)

### Método 1: GitHub Pages (Padrão da Indústria)
1. Crie uma conta no [GitHub](https://github.com) (se ainda não tiver) e crie um novo repositório chamado `geoportal-carolina` (público).
2. Suba todos os arquivos desta pasta para o repositório (pelo GitHub Desktop ou git push).
3. No repositório, vá em **Settings** > **Pages**.
4. Em **Branch**, selecione `main` (ou `master`) e a pasta `/(root)`. Clique em **Save**.
5. Em cerca de 1 a 2 minutos, o Geoportal estará online em:  
   `https://seu-usuario.github.io/geoportal-carolina`

### Método 2: Vercel ou Netlify (Arrastar e Soltar)
1. Acesse [Vercel](https://vercel.com) ou [Netlify](https://netlify.com) e faça login gratuito.
2. Arraste a pasta `Geoportal_Carolina` para a área de deploy.
3. O link HTTPS é gerado na hora (ex: `https://geoportal-carolina.vercel.app`), com carregamento ultrarrápido global.
