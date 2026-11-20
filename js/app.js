/**
 * GEOPORTAL MUNICIPAL DE CAROLINA - MA
 * WebGIS Completo e Profissional
 * Motor: Leaflet 1.9.4 com HTML5 Canvas Renderer para Alta Performance
 */

(function () {
  'use strict';

  // =========================================================================
  // 1. CONFIGURAÇÕES E ESTADO GLOBAL
  // =========================================================================

  const CONFIG = {
    carolinaCenter: [-7.45295, -47.2275],
    initialZoom: 9,
    minZoom: 6,
    maxZoom: 19,
    bounds: [
      [-8.0674, -47.7504],
      [-6.8385, -46.7046]
    ],
    layerColors: {
      limite_municipal: { fill: 'rgba(0,0,0,0)', stroke: '#0f172a', weight: 2.5, dash: '6, 6' },
      vegetacao_nativa: { fill: '#2e7d32', stroke: '#1b5e20', weight: 1 },
      area_consolidada: { fill: '#e65100', stroke: '#bf360c', weight: 1 },
      app:              { fill: '#00897b', stroke: '#004d40', weight: 1 },
      hidrografia:      { fill: '#0288d1', stroke: '#01579b', weight: 1 },
      camada_importada: { fill: '#a855f7', stroke: '#7e22ce', weight: 2.5 }
    },
    layerTitles: {
      limite_municipal: 'Limite Municipal de Carolina',
      vegetacao_nativa: 'Vegetação Nativa',
      area_consolidada: 'Área Consolidada',
      app:              'Área de Preservação Permanente (APP)',
      hidrografia:      'Hidrografia',
      pontos_turisticos: 'Atrativos Ecoturísticos',
      camada_importada: 'Camada Importada pelo Usuário'
    }
  };

  const STATE = {
    map: null,
    canvasRenderer: null,
    basemaps: {},
    currentBasemap: 'satellite',
    labelsLayer: null,
    layers: {},         // Instâncias L.GeoJSON
    layerData: {},      // GeoJSON cru em memória
    layerOpacities: {
      limite_municipal: 0.9,
      vegetacao_nativa: 0.75,
      area_consolidada: 0.75,
      app: 0.8,
      hidrografia: 0.85,
      camada_importada: 0.8
    },
    layerVisibility: {
      limite_municipal: true,
      vegetacao_nativa: true,
      area_consolidada: true,
      app: true,
      hidrografia: true,
      pontos_turisticos: true,
      camada_importada: true
    },
    // Estado da medição
    measureMode: null,  // 'distance' | 'area' | null
    measurePoints: [],
    measureLayer: null,
    // Estado da tabela de atributos
    tableLayer: 'app',
    tableSearch: '',
    tablePage: 1,
    tablePageSize: 40,
    tableRows: [],
    // Gráficos
    charts: {}
  };

  // Garante que o objeto global de dados exista
  window.LAYER_DATA = window.LAYER_DATA || {};

  // =========================================================================
  // 2. INICIALIZAÇÃO DO MAPA E BASEMAPS
  // =========================================================================

  function initMap() {
    // Inicializa o Canvas Renderer de alta performance
    STATE.canvasRenderer = L.canvas({ padding: 0.5 });

    // Criação da instância do Leaflet Map
    STATE.map = L.map('map', {
      center: CONFIG.carolinaCenter,
      zoom: CONFIG.initialZoom,
      minZoom: CONFIG.minZoom,
      maxZoom: CONFIG.maxZoom,
      zoomControl: false, // Usaremos nosso controle estilizado
      preferCanvas: true
    });

    // Enquadra a extensão municipal de Carolina
    STATE.map.fitBounds(CONFIG.bounds, { padding: [20, 20] });

    // Controle de Escala métrica gráfica
    L.control.scale({
      position: 'bottomright',
      metric: true,
      imperial: false,
      maxWidth: 150
    }).addTo(STATE.map);

    // Definição dos Mapas de Fundo (Basemaps)
    STATE.basemaps.satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; Esri, Maxar, Earthstar Geographics',
      maxZoom: 19
    });

    STATE.basemaps.osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    });

    STATE.basemaps.dark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; CartoDB, OpenStreetMap contributors',
      maxZoom: 19
    });

    STATE.basemaps.topo = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; Esri, HERE, Garmin, Intermap',
      maxZoom: 19
    });

    // Camada de rótulos (Labels overlay)
    STATE.labelsLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; CartoDB',
      maxZoom: 19,
      pane: 'shadowPane'
    });

    // Adiciona o basemap inicial (Satélite) e os rótulos
    STATE.basemaps.satellite.addTo(STATE.map);
    STATE.labelsLayer.addTo(STATE.map);

    // Grupo de camadas para medição
    STATE.measureLayer = L.featureGroup().addTo(STATE.map);

    // Eventos do mouse no mapa
    setupMapEvents();
  }

  // =========================================================================
  // 3. CARREGAMENTO ASSÍNCRONO RESILIENTE DE DADOS
  // =========================================================================

  /**
   * Carrega o arquivo de camada GeoJSON de forma transparente:
   * 1. Verifica se window.LAYER_DATA[name] já foi injetado;
   * 2. Tenta fetch('data/{name}.geojson');
   * 3. Caso fetch falhe (ex: abertura direta via file:/// no Chrome),
   *    injeta uma tag <script src="data/{name}.js"> dinamicamente.
   */
  async function loadLayerData(name) {
    if (STATE.layerData[name]) {
      return STATE.layerData[name];
    }
    if (window.LAYER_DATA && window.LAYER_DATA[name]) {
      STATE.layerData[name] = window.LAYER_DATA[name];
      return STATE.layerData[name];
    }

    try {
      const response = await fetch(`data/${name}.geojson`);
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      const data = await response.json();
      STATE.layerData[name] = data;
      return data;
    } catch (err) {
      console.warn(`Fetch falhou para ${name}, tentando fallback via tag script...`, err);
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `data/${name}.js`;
        script.onload = () => {
          if (window.LAYER_DATA && window.LAYER_DATA[name]) {
            STATE.layerData[name] = window.LAYER_DATA[name];
            resolve(STATE.layerData[name]);
          } else {
            reject(new Error(`Falha ao obter window.LAYER_DATA['${name}'] via script`));
          }
        };
        script.onerror = () => reject(new Error(`Erro ao carregar script data/${name}.js`));
        document.head.appendChild(script);
      });
    }
  }

  // =========================================================================
  // 4. CRIAÇÃO E ESTILIZAÇÃO DAS CAMADAS VETORIAIS
  // =========================================================================

  function getLayerStyle(name, feature) {
    const colorCfg = CONFIG.layerColors[name] || { fill: '#3388ff', stroke: '#1565c0', weight: 1 };
    const opacity = STATE.layerOpacities[name] !== undefined ? STATE.layerOpacities[name] : 0.8;

    if (name === 'limite_municipal') {
      return {
        renderer: STATE.canvasRenderer,
        color: '#facc15',
        weight: 3.5,
        dashArray: '8, 6',
        fillColor: '#000000',
        fillOpacity: 0.04,
        opacity: opacity
      };
    }

    return {
      renderer: STATE.canvasRenderer,
      fillColor: colorCfg.fill,
      fillOpacity: opacity * 0.75,
      color: colorCfg.stroke,
      weight: colorCfg.weight || 1,
      opacity: opacity
    };
  }

  function createGeoJsonLayer(name, geojsonData) {
    if (name === 'pontos_turisticos') {
      return L.geoJSON(geojsonData, {
        pointToLayer: (feature, latlng) => {
          const p = feature.properties || {};
          const cor = p.cor || '#f59e0b';
          const icone = p.icone || 'fa-map-pin';
          const customIcon = L.divIcon({
            className: 'custom-pin-container',
            html: `<div class="custom-pin-marker" style="background: ${cor};"><i class="fa-solid ${icone}"></i></div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 32],
            popupAnchor: [0, -28]
          });
          const marker = L.marker(latlng, { icon: customIcon });
          marker.bindPopup(`
            <div class="popup-container" style="min-width: 290px; max-width: 320px;">
              ${p.imagem ? `
                <div style="width:100%; height:150px; position:relative; overflow:hidden; background:#0f172a;">
                  <img src="${p.imagem}" alt="${p.nome}" style="width:100%; height:100%; object-fit:cover; display:block; cursor:pointer;" onclick="window.open('${p.imagem}', '_blank')" title="Clique para ver a foto em alta resolução" onerror="this.parentElement.style.display='none';">
                  <div style="position:absolute; bottom:0; left:0; right:0; background:linear-gradient(transparent, rgba(0,0,0,0.85)); padding:8px 10px 4px 10px; color:#fff; display:flex; justify-content:space-between; align-items:flex-end;">
                    <span style="font-size:10px; font-weight:700; background:${cor}; padding:2px 7px; border-radius:10px; text-transform:uppercase;">${p.categoria}</span>
                    <span style="font-size:10px; opacity:0.9; font-weight:600;"><i class="fa-solid fa-mountain"></i> ${p.altitude || ''}</span>
                  </div>
                </div>
              ` : `
                <div class="popup-header" style="background: ${cor};">
                  <span><i class="fa-solid ${icone}"></i> ${p.nome}</span>
                </div>
              `}
              <div class="popup-body">
                ${p.imagem ? `<h4 style="font-size:14px; font-weight:700; color:#0f172a; margin-bottom:6px; display:flex; align-items:center; gap:6px;"><i class="fa-solid ${icone}" style="color:${cor};"></i> ${p.nome}</h4>` : ''}
                <p style="font-size:12px; color:#334155; line-height:1.45; margin-bottom:8px;">
                  ${p.descricao}
                </p>
                <div class="popup-prop-row">
                  <span class="popup-prop-label">Acesso:</span>
                  <span class="popup-prop-value" title="${p.acesso}">${p.acesso}</span>
                </div>
                ${p.credito ? `<div style="font-size:9.5px; color:#94a3b8; margin-top:6px; font-style:italic;">${p.credito}</div>` : ''}
              </div>
              <div class="popup-actions">
                <button class="btn-popup-zoom" onclick="STATE.map.setView([${latlng.lat}, ${latlng.lng}], 15)">
                  <i class="fa-solid fa-crosshairs"></i> Enquadrar Atrativo
                </button>
              </div>
            </div>
          `);
          return marker;
        }
      });
    }

    return L.geoJSON(geojsonData, {
      renderer: STATE.canvasRenderer,
      style: (feature) => getLayerStyle(name, feature),
      onEachFeature: (feature, layer) => {
        // Interações com as feições
        layer.on({
          mouseover: (e) => {
            const target = e.target;
            if (name !== 'limite_municipal') {
              target.setStyle({
                weight: 2.5,
                color: '#ffffff',
                fillOpacity: Math.min(1, STATE.layerOpacities[name] + 0.25)
              });
            }
          },
          mouseout: (e) => {
            if (name !== 'limite_municipal') {
              STATE.layers[name].resetStyle(e.target);
            }
          },
          click: (e) => {
            L.DomEvent.stopPropagation(e);
            openFeaturePopup(e.latlng, name, feature);
          }
        });
      }
    });
  }

  function openFeaturePopup(latlng, layerName, feature) {
    const props = feature.properties || {};
    const colorCfg = CONFIG.layerColors[layerName] || { fill: '#1b5e20' };
    const title = CONFIG.layerTitles[layerName] || layerName;

    const codImovel = props.cod_imovel || 'N/A';
    const tema = props.nom_tema || 'Tema não informado';
    const condicao = props.des_condic || 'Sem informação';
    const numArea = props.num_area ? Number(props.num_area).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 }) + ' ha' : 'N/A';
    const numAreaM2 = props.num_area ? (Number(props.num_area) * 10000).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + ' m²' : '';

    let contentHtml = '';
    if (layerName === 'limite_municipal') {
      contentHtml = `
        <div class="popup-container">
          <div class="popup-header" style="background: #0f172a;">
            <span><i class="fa-solid fa-landmark"></i> Município de Carolina</span>
          </div>
          <div class="popup-body">
            <div class="popup-prop-row"><span class="popup-prop-label">Código IBGE:</span><span class="popup-prop-value">${props.CD_MUN || '2102804'}</span></div>
            <div class="popup-prop-row"><span class="popup-prop-label">Estado:</span><span class="popup-prop-value">Maranhão (MA)</span></div>
            <div class="popup-prop-row"><span class="popup-prop-label">Área Oficial:</span><span class="popup-prop-value">${Number(props.AREA_KM2 || 6267.6).toLocaleString('pt-BR')} km²</span></div>
            <div class="popup-prop-row"><span class="popup-prop-label">Região:</span><span class="popup-prop-value">Sul do Maranhão / Chapada das Mesas</span></div>
          </div>
        </div>
      `;
    } else {
      contentHtml = `
        <div class="popup-container">
          <div class="popup-header" style="background: ${colorCfg.fill};">
            <span><i class="fa-solid fa-tree"></i> ${title}</span>
          </div>
          <div class="popup-body">
            <div class="popup-prop-row">
              <span class="popup-prop-label">Código CAR:</span>
              <span class="popup-prop-value" title="${codImovel}" style="color:#0369a1; font-weight:600;">${codImovel}</span>
            </div>
            <div class="popup-prop-row">
              <span class="popup-prop-label">Tema:</span>
              <span class="popup-prop-value" title="${tema}">${tema}</span>
            </div>
            <div class="popup-prop-row">
              <span class="popup-prop-label">Condição:</span>
              <span class="popup-prop-value" title="${condicao}">${condicao}</span>
            </div>
            <div class="popup-prop-row">
              <span class="popup-prop-label">Área (ha):</span>
              <span class="popup-prop-value" style="font-weight:700; color:#1b5e20;">${numArea}</span>
            </div>
            ${numAreaM2 ? `<div class="popup-prop-row"><span class="popup-prop-label">Área (m²):</span><span class="popup-prop-value">${numAreaM2}</span></div>` : ''}
          </div>
          <div class="popup-actions" style="flex-wrap: wrap;">
            <button class="btn-popup-zoom" onclick="window.zoomToFeature('${layerName}', '${props.cod_imovel || ''}')">
              <i class="fa-solid fa-crosshairs"></i> Enquadrar
            </button>
            <button class="btn-popup-zoom" onclick="navigator.clipboard.writeText('${codImovel}'); alert('Código CAR copiado para a área de transferência!');">
              <i class="fa-solid fa-copy"></i> Copiar CAR
            </button>
            <button class="btn-popup-zoom" style="background:#e8f5e9; border-color:#81c784; color:#1b5e20; width:100%; margin-top:4px;" onclick="window.generatePropertyReport('${layerName}', '${props.cod_imovel || ''}')">
              <i class="fa-solid fa-file-pdf"></i> Emitir Ficha Técnica (PDF)
            </button>
          </div>
        </div>
      `;
    }

    L.popup({ minWidth: 290, maxWidth: 350 })
      .setLatLng(latlng)
      .setContent(contentHtml)
      .openOn(STATE.map);
  }

  // Expõe função auxiliar no window para os botões do popup
  window.zoomToFeature = function (layerName, codImovel) {
    if (!STATE.layers[layerName]) return;
    STATE.layers[layerName].eachLayer((layer) => {
      if (layer.feature && layer.feature.properties && layer.feature.properties.cod_imovel === codImovel) {
        STATE.map.fitBounds(layer.getBounds(), { padding: [80, 80], maxZoom: 16 });
      }
    });
  };

  // =========================================================================
  // 5. CARREGAMENTO INICIAL DAS CAMADAS
  // =========================================================================

  async function loadAllLayers() {
    const loaderStatus = document.getElementById('loader-status');
    const order = ['limite_municipal', 'vegetacao_nativa', 'area_consolidada', 'hidrografia', 'app', 'pontos_turisticos'];

    for (let i = 0; i < order.length; i++) {
      const name = order[i];
      const title = CONFIG.layerTitles[name];
      if (loaderStatus) loaderStatus.innerText = `Carregando camada: ${title} (${i + 1}/${order.length})...`;

      try {
        const data = await loadLayerData(name);
        const lyr = createGeoJsonLayer(name, data);
        STATE.layers[name] = lyr;

        if (STATE.layerVisibility[name]) {
          lyr.addTo(STATE.map);
        }

        // Atualiza status pill no painel
        const statusEl = document.getElementById(`status-${name}`);
        if (statusEl) {
          statusEl.innerText = 'Ativo';
          statusEl.className = 'status-pill status-ready';
        }
      } catch (err) {
        console.error(`Erro ao carregar camada ${name}:`, err);
        const statusEl = document.getElementById(`status-${name}`);
        if (statusEl) {
          statusEl.innerText = 'Erro';
          statusEl.className = 'status-pill status-loading';
        }
      }
    }

    // Oculta o loader inicial suavemente
    const globalLoader = document.getElementById('global-loader');
    if (globalLoader) {
      globalLoader.classList.add('fade-out');
      setTimeout(() => globalLoader.remove(), 450);
    }

    // Inicializa a Tabela de Atributos com a primeira camada de dados
    updateAttributeTable();

    // Popula as opções do filtro
    populateFilterSelects('app');
  }

  // =========================================================================
  // 6. CONTROLES DE INTERFACE (SIDEBAR, TABS, BASEMAPS)
  // =========================================================================

  function setupUI() {
    // Alternar Sidebar
    const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
    const sidebar = document.getElementById('sidebar');
    btnToggleSidebar.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      btnToggleSidebar.classList.toggle('active');
    });

    // Abas da Sidebar
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        tabBtns.forEach((b) => b.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach((p) => p.classList.remove('active'));

        btn.classList.add('active');
        const targetTab = document.getElementById(btn.getAttribute('data-tab'));
        if (targetTab) targetTab.classList.add('active');

        // Se abrir aba de análise, renderiza os gráficos se ainda não criados
        if (btn.getAttribute('data-tab') === 'tab-analytics') {
          initCharts();
        }
      });
    });

    // Botão de Dashboard no Header (vai direto para a aba de estatísticas)
    const btnToggleDashboard = document.getElementById('btn-toggle-dashboard');
    btnToggleDashboard.addEventListener('click', () => {
      if (sidebar.classList.contains('collapsed')) {
        sidebar.classList.remove('collapsed');
        btnToggleSidebar.classList.add('active');
      }
      document.querySelector('.tab-btn[data-tab="tab-analytics"]').click();
    });

    // Botão Enquadrar Município (Home)
    document.getElementById('btn-reset-view').addEventListener('click', () => {
      STATE.map.fitBounds(CONFIG.bounds, { padding: [20, 20] });
    });

    // Botão Tela Cheia (Fullscreen)
    document.getElementById('btn-fullscreen').addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch((e) => console.log(e));
      } else {
        document.exitFullscreen().catch((e) => console.log(e));
      }
    });

    // Ferramentas de Zoom da Barra Flutuante
    document.getElementById('tool-zoom-in').addEventListener('click', () => STATE.map.zoomIn());
    document.getElementById('tool-zoom-out').addEventListener('click', () => STATE.map.zoomOut());

    // Geolocalização (GPS do Usuário)
    let userLocationMarker = null;
    let userAccuracyCircle = null;
    const btnLocate = document.getElementById('tool-locate');
    if (btnLocate) {
      btnLocate.addEventListener('click', () => {
        if (!navigator.geolocation) {
          alert('Geolocalização não é suportada pelo seu navegador.');
          return;
        }

        btnLocate.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            btnLocate.innerHTML = '<i class="fa-solid fa-crosshairs"></i>';
            btnLocate.classList.add('active');
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            const accuracy = pos.coords.accuracy;

            if (userLocationMarker) STATE.map.removeLayer(userLocationMarker);
            if (userAccuracyCircle) STATE.map.removeLayer(userAccuracyCircle);

            userAccuracyCircle = L.circle([lat, lng], {
              radius: accuracy,
              color: '#0288d1',
              fillColor: '#0288d1',
              fillOpacity: 0.15,
              weight: 1
            }).addTo(STATE.map);

            userLocationMarker = L.circleMarker([lat, lng], {
              radius: 8,
              color: '#ffffff',
              fillColor: '#0288d1',
              fillOpacity: 1,
              weight: 3
            }).addTo(STATE.map);

            userLocationMarker.bindPopup(`
              <div style="font-size:12px; padding:4px;">
                <strong style="color:#0288d1;"><i class="fa-solid fa-location-arrow"></i> Você está aqui</strong><br>
                Precisão aproximada: &plusmn;${Math.round(accuracy)} metros<br>
                Lat: ${lat.toFixed(5)}, Lon: ${lng.toFixed(5)}
              </div>
            `).openPopup();

            STATE.map.setView([lat, lng], Math.max(14, STATE.map.getZoom()));
          },
          (err) => {
            btnLocate.innerHTML = '<i class="fa-solid fa-crosshairs"></i>';
            let msg = 'Não foi possível obter sua localização.';
            if (err.code === 1) msg = 'Permissão de localização negada pelo usuário.';
            else if (err.code === 2) msg = 'Posição geográfica indisponível.';
            alert(msg);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      });
    }

    // Seletor de Basemaps
    const basemapCards = document.querySelectorAll('.basemap-card');
    basemapCards.forEach((card) => {
      card.addEventListener('click', () => {
        const selected = card.getAttribute('data-basemap');
        if (selected === STATE.currentBasemap) return;

        basemapCards.forEach((c) => c.classList.remove('active'));
        card.classList.add('active');

        // Remove o basemap atual e insere o novo
        if (STATE.basemaps[STATE.currentBasemap]) {
          STATE.map.removeLayer(STATE.basemaps[STATE.currentBasemap]);
        }
        if (STATE.basemaps[selected]) {
          STATE.basemaps[selected].addTo(STATE.map);
          STATE.basemaps[selected].bringToBack();
        }
        STATE.currentBasemap = selected;
      });
    });

    // Toggle de Rótulos do Basemap
    const chkLabels = document.getElementById('chk-basemap-labels');
    chkLabels.addEventListener('change', (e) => {
      if (e.target.checked) {
        STATE.labelsLayer.addTo(STATE.map);
      } else {
        STATE.map.removeLayer(STATE.labelsLayer);
      }
    });

    // Controles de Camadas (Toggles e Sliders)
    const layerNames = ['limite_municipal', 'vegetacao_nativa', 'area_consolidada', 'app', 'hidrografia', 'pontos_turisticos', 'camada_importada'];
    layerNames.forEach((name) => {
      // Checkbox
      const chk = document.getElementById(`chk-${name}`);
      if (chk) {
        chk.addEventListener('change', (e) => {
          STATE.layerVisibility[name] = e.target.checked;
          if (STATE.layers[name]) {
            if (e.target.checked) {
              STATE.layers[name].addTo(STATE.map);
            } else {
              STATE.map.removeLayer(STATE.layers[name]);
            }
          }
        });
      }

      // Slider de Opacidade
      const slider = document.querySelector(`.range-slider[data-layer="${name}"]`);
      if (slider) {
        slider.addEventListener('input', (e) => {
          const val = parseFloat(e.target.value);
          STATE.layerOpacities[name] = val;
          const label = slider.parentElement.querySelector('.opacity-val');
          if (label) label.innerText = Math.round(val * 100) + '%';

          if (STATE.layers[name]) {
            STATE.layers[name].setStyle((feat) => getLayerStyle(name, feat));
          }
        });
      }

      // Botão Enquadrar Camada
      const zoomBtn = document.querySelector(`.btn-zoom-layer[data-layer="${name}"]`);
      if (zoomBtn) {
        zoomBtn.addEventListener('click', () => {
          if (STATE.layers[name] && STATE.map.hasLayer(STATE.layers[name])) {
            STATE.map.fitBounds(STATE.layers[name].getBounds(), { padding: [30, 30] });
          } else if (STATE.layers[name]) {
            // Se estiver desligada, liga e enquadra
            chk.checked = true;
            STATE.layers[name].addTo(STATE.map);
            STATE.map.fitBounds(STATE.layers[name].getBounds(), { padding: [30, 30] });
          }
        });
      }
    });

    // Ativar Todas / Desativar Todas
    document.getElementById('btn-activate-all').addEventListener('click', () => {
      layerNames.forEach((name) => {
        const chk = document.getElementById(`chk-${name}`);
        if (chk && !chk.checked) {
          chk.checked = true;
          if (STATE.layers[name]) STATE.layers[name].addTo(STATE.map);
        }
      });
    });

    document.getElementById('btn-deactivate-all').addEventListener('click', () => {
      layerNames.forEach((name) => {
        if (name === 'limite_municipal') return; // Mantém o limite por contexto
        const chk = document.getElementById(`chk-${name}`);
        if (chk && chk.checked) {
          chk.checked = false;
          if (STATE.layers[name]) STATE.map.removeLayer(STATE.layers[name]);
        }
      });
    });

    // Ferramentas de Medição
    setupMeasureTools();

    // Tabela de Atributos
    setupAttributeTableUI();

    // Filtros
    setupFilters();

    // Captura do mapa
    setupPrintTool();

    // Importação de KML / GeoJSON do usuário
    setupKMLImport();
  }

  // =========================================================================
  // 7. FERRAMENTAS DE MEDIÇÃO (DISTÂNCIA E ÁREA)
  // =========================================================================

  function setupMeasureTools() {
    const btnDistance = document.getElementById('tool-measure-distance');
    const btnArea = document.getElementById('tool-measure-area');
    const btnClear = document.getElementById('tool-clear-measure');
    const box = document.getElementById('measure-box');
    const boxClose = document.getElementById('measure-close');
    const boxTitle = document.getElementById('measure-title');
    const boxResult = document.getElementById('measure-result');
    const boxHint = document.getElementById('measure-hint');

    function resetMeasure() {
      STATE.measureMode = null;
      STATE.measurePoints = [];
      STATE.measureLayer.clearLayers();
      btnDistance.classList.remove('active');
      btnArea.classList.remove('active');
      btnClear.style.display = 'none';
      box.classList.remove('active');
      STATE.map.getContainer().style.cursor = '';
    }

    boxClose.addEventListener('click', resetMeasure);
    btnClear.addEventListener('click', resetMeasure);

    btnDistance.addEventListener('click', () => {
      if (STATE.measureMode === 'distance') {
        resetMeasure();
        return;
      }
      resetMeasure();
      STATE.measureMode = 'distance';
      btnDistance.classList.add('active');
      btnClear.style.display = 'flex';
      box.classList.add('active');
      boxTitle.innerHTML = '<i class="fa-solid fa-ruler"></i> Medição de Distância';
      boxResult.innerText = '0,00 km';
      boxHint.innerText = 'Clique no mapa para traçar os pontos. Clique duplo para finalizar.';
      STATE.map.getContainer().style.cursor = 'crosshair';
    });

    btnArea.addEventListener('click', () => {
      if (STATE.measureMode === 'area') {
        resetMeasure();
        return;
      }
      resetMeasure();
      STATE.measureMode = 'area';
      btnArea.classList.add('active');
      btnClear.style.display = 'flex';
      box.classList.add('active');
      boxTitle.innerHTML = '<i class="fa-solid fa-draw-polygon"></i> Medição de Área';
      boxResult.innerText = '0,00 ha';
      boxHint.innerText = 'Clique no mapa para criar o polígono (mínimo 3 pontos). Clique duplo para finalizar.';
      STATE.map.getContainer().style.cursor = 'crosshair';
    });

    STATE.map.on('click', (e) => {
      if (!STATE.measureMode) return;

      STATE.measurePoints.push(e.latlng);
      updateMeasureDisplay();
    });

    STATE.map.on('dblclick', (e) => {
      if (!STATE.measureMode) return;
      L.DomEvent.stopPropagation(e);
      // Finaliza medição
      STATE.map.getContainer().style.cursor = '';
      boxHint.innerText = 'Medição concluída. Use a lixeira para reiniciar.';
    });

    function updateMeasureDisplay() {
      STATE.measureLayer.clearLayers();

      // Marcadores nos vértices
      STATE.measurePoints.forEach((pt) => {
        L.circleMarker(pt, {
          radius: 5,
          color: '#ffffff',
          weight: 2,
          fillColor: '#ef4444',
          fillOpacity: 1
        }).addTo(STATE.measureLayer);
      });

      if (STATE.measureMode === 'distance') {
        if (STATE.measurePoints.length > 1) {
          L.polyline(STATE.measurePoints, {
            color: '#ef4444',
            weight: 3,
            dashArray: '5, 5'
          }).addTo(STATE.measureLayer);

          let totalMeters = 0;
          for (let i = 0; i < STATE.measurePoints.length - 1; i++) {
            totalMeters += STATE.measurePoints[i].distanceTo(STATE.measurePoints[i + 1]);
          }

          if (totalMeters >= 1000) {
            boxResult.innerText = (totalMeters / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' km';
          } else {
            boxResult.innerText = totalMeters.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' m';
          }
        }
      } else if (STATE.measureMode === 'area') {
        if (STATE.measurePoints.length >= 3) {
          L.polygon(STATE.measurePoints, {
            color: '#ef4444',
            weight: 2,
            fillColor: '#ef4444',
            fillOpacity: 0.25
          }).addTo(STATE.measureLayer);

          const sqMeters = calculatePolygonArea(STATE.measurePoints);
          const hectares = sqMeters / 10000;
          const sqKm = sqMeters / 1000000;

          if (hectares >= 100) {
            boxResult.innerHTML = `${hectares.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ha <span style="font-size:11px; font-weight:normal; color:#cbd5e1;">(${sqKm.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} km²)</span>`;
          } else {
            boxResult.innerHTML = `${hectares.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ha <span style="font-size:11px; font-weight:normal; color:#cbd5e1;">(${sqMeters.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} m²)</span>`;
          }
        }
      }
    }
  }

  // Cálculo geodésico esférico de área de polígono em metros quadrados
  function calculatePolygonArea(latlngs) {
    const radius = 6378137; // Raio da Terra em metros
    if (latlngs.length < 3) return 0;
    let total = 0;
    const len = latlngs.length;
    for (let i = 0; i < len; i++) {
      const p1 = latlngs[i];
      const p2 = latlngs[(i + 1) % len];
      const rad1 = (p1.lat * Math.PI) / 180;
      const rad2 = (p2.lat * Math.PI) / 180;
      const dLon = ((p2.lng - p1.lng) * Math.PI) / 180;
      total += dLon * (2 + Math.sin(rad1) + Math.sin(rad2));
    }
    return Math.abs((total * radius * radius) / 4);
  }

  // =========================================================================
  // 8. TABELA DE ATRIBUTOS INTERATIVA E EXPORTAÇÃO
  // =========================================================================

  function setupAttributeTableUI() {
    const btnToggleTable = document.getElementById('btn-toggle-table');
    const drawer = document.getElementById('attribute-drawer');
    const btnClose = document.getElementById('btn-close-table');
    const selectLayer = document.getElementById('table-layer-select');
    const searchInput = document.getElementById('table-quick-search');

    btnToggleTable.addEventListener('click', () => {
      drawer.classList.toggle('collapsed');
      btnToggleTable.classList.toggle('active');
      if (!drawer.classList.contains('collapsed')) {
        updateAttributeTable();
      }
    });

    btnClose.addEventListener('click', () => {
      drawer.classList.add('collapsed');
      btnToggleTable.classList.remove('active');
    });

    selectLayer.addEventListener('change', (e) => {
      STATE.tableLayer = e.target.value;
      STATE.tablePage = 1;
      updateAttributeTable();
    });

    searchInput.addEventListener('input', (e) => {
      STATE.tableSearch = e.target.value.toLowerCase().trim();
      STATE.tablePage = 1;
      renderTableRows();
    });

    document.getElementById('table-page-prev').addEventListener('click', () => {
      if (STATE.tablePage > 1) {
        STATE.tablePage--;
        renderTableRows();
      }
    });

    document.getElementById('table-page-next').addEventListener('click', () => {
      const maxPage = Math.ceil(STATE.tableRows.length / STATE.tablePageSize) || 1;
      if (STATE.tablePage < maxPage) {
        STATE.tablePage++;
        renderTableRows();
      }
    });

    // Exportação CSV
    document.getElementById('btn-export-csv').addEventListener('click', exportTableToCSV);

    // Exportação GeoJSON
    document.getElementById('btn-export-geojson').addEventListener('click', exportLayerToGeoJSON);
  }

  function updateAttributeTable() {
    const layerName = STATE.tableLayer;
    const data = STATE.layerData[layerName];
    if (!data || !data.features) {
      document.getElementById('table-head').innerHTML = '';
      document.getElementById('table-body').innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">Carregando dados da camada...</td></tr>';
      return;
    }

    STATE.tableRows = data.features;
    renderTableHead();
    renderTableRows();
  }

  function renderTableHead() {
    const thead = document.getElementById('table-head');
    thead.innerHTML = `
      <tr>
        <th style="width: 40px;">#</th>
        <th>Código CAR</th>
        <th>Tema</th>
        <th>Condição Cadastral</th>
        <th style="text-align:right;">Área (ha)</th>
      </tr>
    `;
  }

  function renderTableRows() {
    const tbody = document.getElementById('table-body');
    const counterEl = document.getElementById('table-info-counter');
    const pageEl = document.getElementById('table-page-current');

    let filtered = STATE.tableRows;
    if (STATE.tableSearch) {
      filtered = filtered.filter((f) => {
        const p = f.properties || {};
        return (
          (p.cod_imovel && p.cod_imovel.toLowerCase().includes(STATE.tableSearch)) ||
          (p.nom_tema && p.nom_tema.toLowerCase().includes(STATE.tableSearch)) ||
          (p.des_condic && p.des_condic.toLowerCase().includes(STATE.tableSearch))
        );
      });
    }

    const total = filtered.length;
    const totalPages = Math.ceil(total / STATE.tablePageSize) || 1;
    if (STATE.tablePage > totalPages) STATE.tablePage = totalPages;

    const start = (STATE.tablePage - 1) * STATE.tablePageSize;
    const paged = filtered.slice(start, start + STATE.tablePageSize);

    counterEl.innerText = `Exibindo ${paged.length} de ${total.toLocaleString('pt-BR')} registros`;
    pageEl.innerText = `Pág ${STATE.tablePage} / ${totalPages}`;

    if (paged.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px; color:#94a3b8;">Nenhum registro encontrado para esta busca.</td></tr>';
      return;
    }

    let rowsHtml = '';
    paged.forEach((feat, idx) => {
      const p = feat.properties || {};
      const areaVal = p.num_area ? Number(p.num_area).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
      rowsHtml += `
        <tr data-cod="${p.cod_imovel || ''}">
          <td style="color:#94a3b8;">${start + idx + 1}</td>
          <td style="font-family:monospace; font-size:11px; color:#0369a1; font-weight:600;">${p.cod_imovel || 'N/A'}</td>
          <td>${p.nom_tema || '-'}</td>
          <td>${p.des_condic || '-'}</td>
          <td style="text-align:right; font-weight:600; color:#1b5e20;">${areaVal}</td>
        </tr>
      `;
    });

    tbody.innerHTML = rowsHtml;

    // Clique na linha da tabela: enquadra e abre popup
    tbody.querySelectorAll('tr').forEach((tr) => {
      tr.addEventListener('click', () => {
        const cod = tr.getAttribute('data-cod');
        if (!cod) return;
        tbody.querySelectorAll('tr').forEach((r) => r.classList.remove('selected'));
        tr.classList.add('selected');

        zoomToFeatureByCode(STATE.tableLayer, cod);
      });
    });
  }

  function zoomToFeatureByCode(layerName, codImovel) {
    if (!STATE.layers[layerName]) return;
    // Se a camada estiver oculta, ativa-a
    if (!STATE.map.hasLayer(STATE.layers[layerName])) {
      const chk = document.getElementById(`chk-${layerName}`);
      if (chk) chk.checked = true;
      STATE.layers[layerName].addTo(STATE.map);
    }

    STATE.layers[layerName].eachLayer((lyr) => {
      if (lyr.feature && lyr.feature.properties && lyr.feature.properties.cod_imovel === codImovel) {
        const bounds = lyr.getBounds();
        STATE.map.fitBounds(bounds, { padding: [100, 100], maxZoom: 16 });
        openFeaturePopup(bounds.getCenter(), layerName, lyr.feature);
      }
    });
  }

  function exportTableToCSV() {
    const layerName = STATE.tableLayer;
    const data = STATE.layerData[layerName];
    if (!data || !data.features || data.features.length === 0) {
      alert('Não há dados disponíveis para exportar.');
      return;
    }

    let csvContent = '\uFEFF'; // BOM para garantir acentos no Excel
    csvContent += 'COD_IMOVEL;ESTADO;MUNICIPIO;TEMA;CONDICAO;STATUS;AREA_HA\n';

    data.features.forEach((f) => {
      const p = f.properties || {};
      const row = [
        `"${p.cod_imovel || ''}"`,
        `"${p.cod_estado || 'MA'}"`,
        `"${p.municipio || 'Carolina'}"`,
        `"${p.nom_tema || ''}"`,
        `"${p.des_condic || ''}"`,
        `"${p.ind_status || ''}"`,
        `"${p.num_area || ''}"`
      ];
      csvContent += row.join(';') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Geoportal_Carolina_${layerName}_atributos.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportLayerToGeoJSON() {
    const layerName = STATE.tableLayer;
    const data = STATE.layerData[layerName];
    if (!data) {
      alert('Não há dados carregados para esta camada.');
      return;
    }
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Geoportal_Carolina_${layerName}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // =========================================================================
  // 9. FILTROS DINÂMICOS
  // =========================================================================

  function setupFilters() {
    const selectLayer = document.getElementById('filter-layer-select');
    selectLayer.addEventListener('change', (e) => {
      populateFilterSelects(e.target.value);
    });

    document.getElementById('btn-apply-filter').addEventListener('click', applyFilters);
    document.getElementById('btn-reset-filter').addEventListener('click', resetFilters);
  }

  function populateFilterSelects(layerName) {
    const summary = window.LAYER_SUMMARY && window.LAYER_SUMMARY.layers ? window.LAYER_SUMMARY.layers[layerName] : null;
    const themeSelect = document.getElementById('filter-theme-select');
    const condSelect = document.getElementById('filter-condition-select');

    themeSelect.innerHTML = '<option value="">Todos os temas</option>';
    condSelect.innerHTML = '<option value="">Todas as condições</option>';

    if (summary) {
      if (summary.temas) {
        Object.keys(summary.temas).forEach((tema) => {
          themeSelect.innerHTML += `<option value="${tema}">${tema} (${summary.temas[tema]})</option>`;
        });
      }
      if (summary.condicoes) {
        Object.keys(summary.condicoes).forEach((cond) => {
          condSelect.innerHTML += `<option value="${cond}">${cond} (${summary.condicoes[cond]})</option>`;
        });
      }
    }
  }

  function applyFilters() {
    const layerName = document.getElementById('filter-layer-select').value;
    const carCode = document.getElementById('filter-car-code').value.trim().toLowerCase();
    const theme = document.getElementById('filter-theme-select').value;
    const condition = document.getElementById('filter-condition-select').value;
    const minArea = parseFloat(document.getElementById('filter-min-area').value) || 0;

    const layer = STATE.layers[layerName];
    if (!layer) return;

    let matchCount = 0;
    const matchedBounds = L.latLngBounds([]);

    layer.eachLayer((lyr) => {
      const p = lyr.feature ? lyr.feature.properties || {} : {};
      let match = true;

      if (carCode && (!p.cod_imovel || !p.cod_imovel.toLowerCase().includes(carCode))) {
        match = false;
      }
      if (theme && p.nom_tema !== theme) {
        match = false;
      }
      if (condition && p.des_condic !== condition) {
        match = false;
      }
      if (minArea > 0 && (!p.num_area || parseFloat(p.num_area) < minArea)) {
        match = false;
      }

      if (match) {
        lyr.setStyle(getLayerStyle(layerName, lyr.feature));
        matchedBounds.extend(lyr.getBounds());
        matchCount++;
      } else {
        // Oculta feição não correspondente
        lyr.setStyle({ fillOpacity: 0, opacity: 0 });
      }
    });

    const badge = document.getElementById('filter-stats-badge');
    const counter = document.getElementById('filter-count-match');
    badge.style.display = 'block';
    counter.innerText = matchCount.toLocaleString('pt-BR');

    if (matchCount > 0 && matchedBounds.isValid()) {
      STATE.map.fitBounds(matchedBounds, { padding: [50, 50], maxZoom: 16 });
    }
  }

  function resetFilters() {
    document.getElementById('filter-car-code').value = '';
    document.getElementById('filter-theme-select').value = '';
    document.getElementById('filter-condition-select').value = '';
    document.getElementById('filter-min-area').value = '';
    document.getElementById('filter-stats-badge').style.display = 'none';

    const layerName = document.getElementById('filter-layer-select').value;
    if (STATE.layers[layerName]) {
      STATE.layers[layerName].setStyle((feat) => getLayerStyle(layerName, feat));
    }
  }

  // =========================================================================
  // 10. DASHBOARD E GRÁFICOS (CHART.JS)
  // =========================================================================

  function initCharts() {
    if (STATE.charts.initialized) return;
    STATE.charts.initialized = true;

    // Gráfico 1: Uso e Cobertura da Terra em Carolina (Donut)
    const ctxLand = document.getElementById('chart-land-use');
    if (ctxLand) {
      new Chart(ctxLand, {
        type: 'doughnut',
        data: {
          labels: ['Vegetação Nativa', 'Área Consolidada', 'APP', 'Hidrografia', 'Demais Áreas'],
          datasets: [{
            data: [297224, 206699, 37438, 12609, 72790],
            backgroundColor: ['#2e7d32', '#e65100', '#00897b', '#0288d1', '#94a3b8'],
            borderWidth: 2,
            borderColor: '#ffffff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { boxWidth: 12, font: { size: 10.5 } }
            },
            tooltip: {
              callbacks: {
                label: function (ctx) {
                  const val = ctx.raw.toLocaleString('pt-BR') + ' ha';
                  const pct = ((ctx.raw / 626760) * 100).toFixed(1) + '%';
                  return ` ${ctx.label}: ${val} (${pct})`;
                }
              }
            }
          }
        }
      });
    }

    // Gráfico 2: Status dos Cadastros Ambientais
    const ctxCond = document.getElementById('chart-conditions');
    if (ctxCond) {
      new Chart(ctxCond, {
        type: 'bar',
        data: {
          labels: ['Aguardando Análise', 'Aguard. Notificação', 'Em Revisão', 'Regularização'],
          datasets: [{
            label: 'Imóveis / Feições',
            data: [6910, 2575, 438, 59],
            backgroundColor: '#0288d1',
            borderRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } },
            x: { ticks: { font: { size: 9.5 } } }
          },
          plugins: {
            legend: { display: false }
          }
        }
      });
    }
  }

  // =========================================================================
  // 11. CAPTURA DO MAPA (PRINT / SNAPSHOT)
  // =========================================================================

  function setupPrintTool() {
    const btnPrint = document.getElementById('tool-print');
    btnPrint.addEventListener('click', async () => {
      if (typeof html2canvas === 'undefined') {
        window.print();
        return;
      }
      btnPrint.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

      try {
        const canvas = await html2canvas(document.getElementById('map'), {
          useCORS: true,
          allowTaint: false,
          ignoreElements: (el) => el.classList.contains('leaflet-control-zoom')
        });

        const link = document.createElement('a');
        link.download = `Geoportal_Carolina_Mapa_${new Date().toISOString().slice(0, 10)}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      } catch (err) {
        console.warn('Erro na captura html2canvas, usando print padrão do navegador:', err);
        window.print();
      } finally {
        btnPrint.innerHTML = '<i class="fa-solid fa-camera"></i>';
      }
    });
  }

  // =========================================================================
  // 12. IMPORTAÇÃO DE ARQUIVOS EXTERNOS (KML / GEOJSON)
  // =========================================================================

  function setupKMLImport() {
    const btnImport = document.getElementById('btn-import-kml');
    const fileInput = document.getElementById('file-kml-input');
    const cardImported = document.getElementById('card-camada_importada');
    const btnRemoveImported = document.getElementById('btn-remove-imported');

    if (btnImport && fileInput) {
      btnImport.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          processImportedFile(e.target.files[0]);
        }
      });
    }

    // Suporte a Arrastar e Soltar (Drag & Drop) sobre o mapa
    const mapContainer = document.getElementById('map');
    mapContainer.addEventListener('dragover', (e) => {
      e.preventDefault();
      mapContainer.classList.add('drag-over');
    });

    mapContainer.addEventListener('dragleave', (e) => {
      e.preventDefault();
      mapContainer.classList.remove('drag-over');
    });

    mapContainer.addEventListener('drop', (e) => {
      e.preventDefault();
      mapContainer.classList.remove('drag-over');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        processImportedFile(e.dataTransfer.files[0]);
      }
    });

    if (btnRemoveImported) {
      btnRemoveImported.addEventListener('click', () => {
        if (STATE.layers['camada_importada']) {
          STATE.map.removeLayer(STATE.layers['camada_importada']);
          delete STATE.layers['camada_importada'];
          delete STATE.layerData['camada_importada'];
        }
        cardImported.style.display = 'none';
        fileInput.value = '';
      });
    }

    function processImportedFile(file) {
      const fileName = file.name;
      const ext = fileName.split('.').pop().toLowerCase();
      const reader = new FileReader();

      reader.onload = (event) => {
        const text = event.target.result;
        let geojson = null;

        try {
          if (ext === 'kml' || text.includes('<kml')) {
            geojson = parseKMLToGeoJSON(text);
          } else if (ext === 'geojson' || ext === 'json') {
            geojson = JSON.parse(text);
          } else {
            alert('Formato de arquivo não suportado. Utilize arquivos .kml ou .geojson.');
            return;
          }

          if (!geojson || !geojson.features || geojson.features.length === 0) {
            alert('Nenhuma feição geográfica válida foi encontrada no arquivo.');
            return;
          }

          loadUserImportedGeoJSON(fileName, geojson);
        } catch (err) {
          console.error('Erro ao processar arquivo importado:', err);
          alert('Erro ao ler arquivo: ' + err.message);
        }
      };

      reader.readAsText(file);
    }

    function loadUserImportedGeoJSON(fileName, geojson) {
      if (STATE.layers['camada_importada']) {
        STATE.map.removeLayer(STATE.layers['camada_importada']);
      }

      STATE.layerData['camada_importada'] = geojson;

      let totalHa = 0;
      geojson.features.forEach((f) => {
        if (f.geometry && f.geometry.type.includes('Polygon')) {
          const coords = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0];
          const pts = coords.map(c => L.latLng(c[1], c[0]));
          totalHa += calculatePolygonArea(pts) / 10000;
        }
      });

      const importedLayer = L.geoJSON(geojson, {
        style: {
          color: '#7e22ce',
          weight: 3,
          fillColor: '#a855f7',
          fillOpacity: 0.35
        },
        onEachFeature: (f, lyr) => {
          const p = f.properties || {};
          lyr.bindPopup(`
            <div class="popup-container">
              <div class="popup-header" style="background:#7e22ce;">
                <span><i class="fa-solid fa-file-import"></i> ${p.nome || p.name || 'Propriedade Importada'}</span>
              </div>
              <div class="popup-body">
                <div style="font-size:12px; margin-bottom:6px;"><strong>Origem:</strong> ${fileName}</div>
                ${p.descricao || p.description ? `<p style="font-size:11.5px; color:#475569;">${p.descricao || p.description}</p>` : ''}
                ${totalHa > 0 ? `<div style="font-size:13px; font-weight:700; color:#1b5e20;">Área Calculada: ${totalHa.toFixed(2)} ha</div>` : ''}
              </div>
            </div>
          `);
        }
      });

      STATE.layers['camada_importada'] = importedLayer;
      importedLayer.addTo(STATE.map);

      // Atualiza o card na sidebar
      cardImported.style.display = 'block';
      document.getElementById('imported-layer-title').innerText = fileName;
      document.getElementById('imported-layer-subtext').innerText = `${geojson.features.length} feições importadas`;
      document.getElementById('imported-area-badge').innerText = totalHa > 0 ? `${totalHa.toFixed(1)} ha` : `${geojson.features.length} feições`;
      document.getElementById('chk-camada_importada').checked = true;

      // Abre a sidebar se estiver fechada e foca nas camadas
      const sidebar = document.getElementById('sidebar');
      if (sidebar.classList.contains('collapsed')) {
        sidebar.classList.remove('collapsed');
        document.getElementById('btn-toggle-sidebar').classList.add('active');
      }
      document.querySelector('.tab-btn[data-tab="tab-layers"]').click();

      // Enquadra a camada no mapa
      STATE.map.fitBounds(importedLayer.getBounds(), { padding: [50, 50], maxZoom: 16 });
      alert(`Camada "${fileName}" importada com sucesso!\n${geojson.features.length} feições carregadas no Geoportal.`);
    }
  }

  // Parser leve e autônomo de KML para GeoJSON
  function parseKMLToGeoJSON(xmlStr) {
    const parser = new DOMParser();
    const xml = parser.parseFromString(xmlStr, 'text/xml');
    const placemarks = xml.querySelectorAll('Placemark');
    const features = [];

    placemarks.forEach((pm) => {
      const name = pm.querySelector('name') ? pm.querySelector('name').textContent : 'Sem nome';
      const desc = pm.querySelector('description') ? pm.querySelector('description').textContent : '';

      const poly = pm.querySelector('Polygon');
      const line = pm.querySelector('LineString');
      const pt = pm.querySelector('Point');

      if (poly) {
        const coordsText = poly.querySelector('coordinates') ? poly.querySelector('coordinates').textContent.trim() : '';
        const coords = coordsText.split(/\s+/).map(c => {
          const parts = c.split(',');
          return [parseFloat(parts[0]), parseFloat(parts[1])];
        }).filter(c => !isNaN(c[0]) && !isNaN(c[1]));

        if (coords.length >= 3) {
          features.push({
            type: 'Feature',
            properties: { nome: name, descricao: desc },
            geometry: { type: 'Polygon', coordinates: [coords] }
          });
        }
      } else if (line) {
        const coordsText = line.querySelector('coordinates') ? line.querySelector('coordinates').textContent.trim() : '';
        const coords = coordsText.split(/\s+/).map(c => {
          const parts = c.split(',');
          return [parseFloat(parts[0]), parseFloat(parts[1])];
        }).filter(c => !isNaN(c[0]) && !isNaN(c[1]));

        features.push({
          type: 'Feature',
          properties: { nome: name, descricao: desc },
          geometry: { type: 'LineString', coordinates: coords }
        });
      } else if (pt) {
        const coordsText = pt.querySelector('coordinates') ? pt.querySelector('coordinates').textContent.trim() : '';
        const parts = coordsText.split(',');
        const lng = parseFloat(parts[0]);
        const lat = parseFloat(parts[1]);
        if (!isNaN(lng) && !isNaN(lat)) {
          features.push({
            type: 'Feature',
            properties: { nome: name, descricao: desc },
            geometry: { type: 'Point', coordinates: [lng, lat] }
          });
        }
      }
    });

    return { type: 'FeatureCollection', features };
  }

  // =========================================================================
  // 13. GERADOR DE FICHA TÉCNICA / RELATÓRIO AMBIENTAL EM PDF
  // =========================================================================

  window.generatePropertyReport = function (layerName, codImovel) {
    const data = STATE.layerData[layerName];
    if (!data || !data.features) return;
    const feat = data.features.find(f => f.properties && f.properties.cod_imovel === codImovel);
    if (!feat) {
      alert('Imóvel não localizado para emissão do relatório.');
      return;
    }

    const p = feat.properties;
    const layerTitle = CONFIG.layerTitles[layerName] || layerName;
    const areaHa = p.num_area ? Number(p.num_area).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 }) : 'N/D';
    const areaM2 = p.num_area ? (Number(p.num_area) * 10000).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : 'N/D';
    const dataEmissao = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const hashDoc = 'CAR-' + Math.random().toString(36).substring(2, 10).toUpperCase() + '-' + new Date().getFullYear();

    const html = `
      <div class="report-header-banner">
        <div style="display:flex; align-items:center; gap:14px;">
          <div style="width:48px; height:48px; border-radius:10px; background:#1b5e20; color:#fff; display:flex; align-items:center; justify-content:center; font-size:24px;">
            <i class="fa-solid fa-tree"></i>
          </div>
          <div>
            <h2 style="font-size:18px; font-weight:800; color:#0f172a; margin:0;">GEOPORTAL MUNICIPAL DE CAROLINA - MA</h2>
            <div style="font-size:12px; color:#64748b; font-weight:500;">Sistema de Informações Geográficas Ambientais e Territoriais</div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:10.5px; font-weight:700; background:#e8f5e9; color:#1b5e20; padding:3px 8px; border-radius:12px; display:inline-block;">CERTIDÃO AMBIENTAL</div>
          <div style="font-size:11px; color:#94a3b8; margin-top:3px;">Doc: ${hashDoc}</div>
        </div>
      </div>

      <div style="text-align:center; margin-bottom:24px;">
        <h3 style="font-size:16px; font-weight:700; color:#1b5e20; margin:0;">FICHA TÉCNICA DE CARACTERIZAÇÃO AMBIENTAL (CAR / SICAR)</h3>
        <p style="font-size:12px; color:#64748b; margin-top:4px;">Emissão em conformidade com o Código Florestal Brasileiro (Lei nº 12.651/2012)</p>
      </div>

      <div class="report-section">
        <div class="report-section-title"><i class="fa-solid fa-map-pin"></i> 1. Identificação Territorial do Imóvel</div>
        <div class="report-grid-2">
          <div class="report-field-item">
            <span class="report-field-label">Código CAR Oficial:</span>
            <span class="report-field-value" style="font-family:monospace; color:#0369a1;">${p.cod_imovel || 'N/A'}</span>
          </div>
          <div class="report-field-item">
            <span class="report-field-label">Município / UF:</span>
            <span class="report-field-value">${p.municipio || 'Carolina'} - ${p.cod_estado || 'MA'}</span>
          </div>
          <div class="report-field-item">
            <span class="report-field-label">Código IBGE do Município:</span>
            <span class="report-field-value">2102804</span>
          </div>
          <div class="report-field-item">
            <span class="report-field-label">Bioma Predominante:</span>
            <span class="report-field-value">Cerrado (com transição Amazônica)</span>
          </div>
        </div>
      </div>

      <div class="report-section">
        <div class="report-section-title"><i class="fa-solid fa-layer-group"></i> 2. Atributos da Camada Selecionada</div>
        <div class="report-grid-2">
          <div class="report-field-item">
            <span class="report-field-label">Camada Cartográfica:</span>
            <span class="report-field-value">${layerTitle}</span>
          </div>
          <div class="report-field-item">
            <span class="report-field-label">Tema Declarado:</span>
            <span class="report-field-value">${p.nom_tema || 'Não informado'}</span>
          </div>
          <div class="report-field-item">
            <span class="report-field-label">Área Calculada (ha):</span>
            <span class="report-field-value" style="color:#1b5e20; font-size:15px;">${areaHa} ha</span>
          </div>
          <div class="report-field-item">
            <span class="report-field-label">Área em Metros Quadrados:</span>
            <span class="report-field-value">${areaM2} m²</span>
          </div>
        </div>
      </div>

      <div class="report-section">
        <div class="report-section-title"><i class="fa-solid fa-shield-halved"></i> 3. Situação e Regularidade Cadastral</div>
        <div class="report-grid-2">
          <div class="report-field-item">
            <span class="report-field-label">Condição Cadastral no SICAR:</span>
            <span class="report-field-value" style="color:#e65100;">${p.des_condic || 'Sem informação'}</span>
          </div>
          <div class="report-field-item">
            <span class="report-field-label">Status Cadastral:</span>
            <span class="report-field-value">${p.ind_status === 'AT' ? 'Ativo (AT)' : (p.ind_status || 'Ativo')}</span>
          </div>
          <div class="report-field-item">
            <span class="report-field-label">Bacia Hidrográfica:</span>
            <span class="report-field-value">Bacia do Rio Tocantins</span>
          </div>
          <div class="report-field-item">
            <span class="report-field-label">Sistema de Referência Espacial:</span>
            <span class="report-field-value">SIRGAS 2000 / EPSG:4326</span>
          </div>
        </div>
      </div>

      <div class="report-footer-seal">
        <div>
          <strong>Geoportal Municipal de Carolina - MA</strong><br>
          Desenvolvido por: <strong>Richard Oliveira Jardim</strong><br>
          Data de Emissão: ${dataEmissao}
        </div>
        <div style="text-align:right;">
          <div style="font-family:monospace; font-size:10px; color:#94a3b8;">Hash Autenticação: ${hashDoc}</div>
          <div style="font-size:10px; color:#1b5e20; font-weight:600;"><i class="fa-solid fa-circle-check"></i> Documento Gerado pelo WebGIS Carolina</div>
        </div>
      </div>
    `;

    document.getElementById('report-printable-area').innerHTML = html;
    document.getElementById('report-modal').style.display = 'flex';
  };

  window.closeReport = function () {
    document.getElementById('report-modal').style.display = 'none';
  };

  window.printReport = function () {
    window.print();
  };

  // =========================================================================
  // 14. EVENTOS DO MAPA (COORDENADAS, ESCALA, ZOOM)
  // =========================================================================

  function setupMapEvents() {
    const coordDisplay = document.getElementById('coord-display');
    const zoomDisplay = document.getElementById('zoom-display');

    STATE.map.on('mousemove', (e) => {
      if (coordDisplay) {
        const lat = e.latlng.lat.toFixed(4);
        const lon = e.latlng.lng.toFixed(4);
        coordDisplay.innerHTML = `<i class="fa-solid fa-location-crosshairs"></i> Lat: ${lat} | Lon: ${lon}`;
      }
    });

    STATE.map.on('zoomend', () => {
      if (zoomDisplay) {
        zoomDisplay.innerText = `Zoom: ${STATE.map.getZoom()}`;
      }
    });
  }

  // =========================================================================
  // 13. INICIALIZAÇÃO GERAL AO CARREGAR O DOM
  // =========================================================================

  document.addEventListener('DOMContentLoaded', () => {
    initMap();
    setupUI();
    loadAllLayers();
  });

})();
