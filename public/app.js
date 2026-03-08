// Utility to escape strings for inline attributes and remove newlines
function esc(str) {
  if (!str) return '';
  return str.toString()
    .replace(/[\n\r]+/g, ' ') // Remove newlines
    .replace(/'/g, "\\'")     // Escape single quotes
    .replace(/"/g, '&quot;')  // Escape double quotes
    .trim();
}

const API_BASE = '/api';

const state = {
  plugins: [],
  activePlugin: null,
  loading: false
};

const dom = {
  pluginSelector: document.getElementById('plugin-selector'),
  searchInput: document.getElementById('search-input'),
  searchBtn: document.getElementById('search-btn'),
  gridContainer: document.getElementById('media-grid-container'),
  statusContainer: document.getElementById('status-container'),
  detailsModal: document.getElementById('details-modal'),
  modalContent: document.getElementById('modal-content')
};

async function init() {
  await loadPlugins();

  dom.pluginSelector.addEventListener('change', (e) => {
    state.activePlugin = e.target.value;
    loadHome();
  });

  dom.searchBtn.addEventListener('click', handleSearch);
  dom.searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSearch();
  });
}

function showStatus(message, type = 'info') {
  dom.statusContainer.innerHTML = `<div class="alert alert-${type}"><span>${message}</span></div>`;
  dom.statusContainer.classList.remove('hidden');
  if (type !== 'error') {
    setTimeout(() => dom.statusContainer.classList.add('hidden'), 3000);
  }
}

function hideStatus() {
  dom.statusContainer.classList.add('hidden');
}

function setLoading(isLoading) {
  state.loading = isLoading;
  if (isLoading) {
    dom.gridContainer.innerHTML = `
            <div class="flex justify-center items-center py-20">
                <span class="loading loading-spinner text-primary loading-lg"></span>
            </div>
        `;
  }
}

async function loadPlugins() {
  try {
    const res = await fetch(`${API_BASE}/plugins`);
    const plugins = await res.json();
    state.plugins = plugins;

    if (plugins.length === 0) {
      dom.pluginSelector.innerHTML = `<option disabled selected>Nenhum plugin encontrado</option>`;
      showStatus('Nenhum plugin instalado na pasta src/plugins/', 'warning');
      return;
    }

    dom.pluginSelector.innerHTML = plugins.map((p, i) =>
      `<option value="${p.id}" ${i === 0 ? 'selected' : ''}>${p.name}</option>`
    ).join('');

    state.activePlugin = plugins[0].id;
    loadHome();
  } catch (e) {
    console.error(e);
    showStatus('Erro ao carregar plugins', 'error');
  }
}

async function loadHome() {
  if (!state.activePlugin) return;
  setLoading(true);
  hideStatus();
  try {
    const res = await fetch(`${API_BASE}/plugin/${state.activePlugin}/home`);
    const data = await res.json();
    renderHome(data);
  } catch (e) {
    console.error(e);
    showStatus('Erro ao carregar Home do plugin', 'error');
    dom.gridContainer.innerHTML = '';
  } finally {
    setLoading(false);
  }
}

async function handleSearch() {
  const query = dom.searchInput.value.trim();
  if (!query || !state.activePlugin) return;

  setLoading(true);
  hideStatus();
  try {
    const res = await fetch(`${API_BASE}/plugin/${state.activePlugin}/search?query=${encodeURIComponent(query)}`);
    const results = await res.json();
    renderSearchResults(results, query);
  } catch (e) {
    console.error(e);
    showStatus('Erro ao buscar', 'error');
    dom.gridContainer.innerHTML = '';
  } finally {
    setLoading(false);
  }
}

function renderMediaCard(item) {
  return `
        <div class="card bg-base-100 shadow-xl image-full cursor-pointer hover:scale-105 transition-transform duration-200" onclick="openDetails('${esc(item.url)}')">
            <figure><img src="${item.posterUrl || 'https://via.placeholder.com/300x450?text=No+Image'}" alt="${esc(item.name)}" class="object-cover w-full h-64 md:h-80" /></figure>
            <div class="card-body p-4 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/50 to-transparent">
                <h2 class="card-title text-sm md:text-base text-white line-clamp-2">${item.name}</h2>
                <div class="flex justify-between items-center mt-2">
                    ${item.year ? `<div class="badge badge-primary badge-sm">${item.year}</div>` : '<div></div>'}
                    ${item.score ? `<div class="badge badge-accent badge-sm"><i class="fa-solid fa-star text-xs mr-1"></i> ${item.score}</div>` : ''}
                </div>
            </div>
        </div>
    `;
}

function renderHome(homeData) {
  let html = '';

  if (!homeData || homeData.length === 0) {
    dom.gridContainer.innerHTML = '<div class="text-center py-10 opacity-50">Nenhum dado retornado PELO PLUGIN.</div>';
    return;
  }

  homeData.forEach(section => {
    html += `
            <section class="mb-8">
                <h2 class="text-2xl font-bold mb-4 text-primary border-l-4 border-primary pl-3">${section.name}</h2>
                <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    ${section.list.map(renderMediaCard).join('')}
                </div>
            </section>
        `;
  });

  dom.gridContainer.innerHTML = html;
}

function renderSearchResults(results, query) {
  let html = `
        <section class="mb-8">
            <h2 class="text-2xl font-bold mb-4 text-primary border-l-4 border-primary pl-3">Resultados para "${query}"</h2>
            ${results.length === 0 ? '<p class="text-neutral-content opacity-50">Nenhum resultado encontrado.</p>' : ''}
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                ${results.map(renderMediaCard).join('')}
            </div>
        </section>
    `;
  dom.gridContainer.innerHTML = html;
}

async function openDetails(url) {
  dom.detailsModal.showModal();
  dom.modalContent.innerHTML = `
        <div class="flex justify-center items-center h-full">
            <span class="loading loading-spinner text-primary loading-lg"></span>
        </div>
    `;

  try {
    const res = await fetch(`${API_BASE}/plugin/${state.activePlugin}/load`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    const data = await res.json();
    renderDetails(data, url);
  } catch (e) {
    console.error(e);
    dom.modalContent.innerHTML = `<div class="p-8 text-center text-error"><i class="fa-solid fa-circle-exclamation text-4xl mb-4"></i><p>Erro ao carregar detalhes</p></div>`;
  }
}

function renderDetails(data, originalUrl) {
  const isSeries = data.type === 'TvSeries';

  let episodesHtml = '';
  if (isSeries && data.episodes && data.episodes.length > 0) {
    const seasons = {};
    data.episodes.forEach(ep => {
      const s = ep.season || 1;
      if (!seasons[s]) seasons[s] = [];
      seasons[s].push(ep);
    });

    episodesHtml = `
            <div class="mt-8">
                <h3 class="text-xl font-bold mb-4">Temporadas e Episódios</h3>
                ${Object.keys(seasons).map(sNumber => `
                    <div class="collapse collapse-arrow bg-base-200 mb-2">
                        <input type="radio" name="season-accordion" ${parseInt(sNumber) === 1 ? 'checked="checked"' : ''} /> 
                        <div class="collapse-title text-lg font-medium">Temporada ${sNumber}</div>
                        <div class="collapse-content">
                            <div class="flex flex-col gap-2">
                                ${seasons[sNumber].map(ep => `
                                    <button class="btn btn-neutral justify-start" onclick="window.loadLinks('${esc(ep.data)}', '${esc(ep.name || `Episódio ${ep.episode}`)}')">
                                        <i class="fa-solid fa-play text-primary mr-2"></i> 
                                        Episódio ${ep.episode} - ${ep.name || `Episódio ${ep.episode}`}
                                    </button>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
  }

  const watchButton = !isSeries ? `
        <button class="btn btn-primary w-full sm:w-auto text-lg no-animation mt-6 shadow-lg shadow-primary/30" onclick="window.loadLinks('${esc(data.dataUrl || originalUrl)}', '${esc(data.name)}')">
            <i class="fa-solid fa-play mr-2"></i> Assistir Filme
        </button>
    ` : '';

  dom.modalContent.innerHTML = `
        <div class="relative w-full h-64 md:h-96">
            <div class="absolute inset-0 bg-cover bg-center opacity-30" style="background-image: url('${data.posterUrl}')"></div>
            <div class="absolute inset-0 bg-gradient-to-t from-base-100 to-transparent"></div>
            <div class="absolute bottom-0 left-0 p-6 md:p-10 flex flex-col md:flex-row gap-6 w-full items-end">
                <img src="${data.posterUrl}" class="w-32 md:w-48 rounded-lg shadow-2xl hidden md:block z-10" />
                <div class="z-10 w-full">
                    <h1 class="text-3xl md:text-5xl font-extrabold text-white mb-2 drop-shadow-md">${data.name}</h1>
                    <div class="flex flex-wrap gap-2 text-sm md:text-base font-semibold text-white/80">
                        ${data.year ? `<span><i class="fa-regular fa-calendar mr-1"></i> ${data.year}</span>` : ''}
                        ${data.duration ? `<span class="ml-4"><i class="fa-regular fa-clock mr-1"></i> ${data.duration} min</span>` : ''}
                        ${data.score ? `<span class="ml-4 text-accent"><i class="fa-solid fa-star mr-1"></i> ${data.score}</span>` : ''}
                    </div>
                </div>
            </div>
        </div>
        
        <div class="p-6 md:p-10 -mt-4 relative z-20">
            ${data.tags && data.tags.length > 0 ? `
                <div class="flex flex-wrap gap-2 mb-6">
                    ${data.tags.map(tag => `<span class="badge badge-outline badge-md">${tag}</span>`).join('')}
                </div>
            ` : ''}
            
            ${data.plot ? `
                <div class="bg-base-200/50 p-6 rounded-xl border border-base-300">
                    <h3 class="font-bold text-lg mb-2 opacity-80">Sinopse</h3>
                    <p class="text-base-content/80 leading-relaxed">${data.plot}</p>
                </div>
            ` : ''}

            ${watchButton}
            ${episodesHtml}

            <!-- Player Container -->
            <div id="player-container" class="mt-8 hidden">
                <div class="divider">PLAYER</div>
                <h3 class="text-xl font-bold mb-4" id="player-title">Carregando links...</h3>
                <div id="links-list" class="flex flex-col gap-2 mb-6"></div>
                <div id="video-wrapper" class="mt-4 aspect-video bg-black rounded-xl overflow-hidden hidden shadow-2xl border-4 border-primary/20">
                    <video id="video-player" controls class="w-full h-full"></video>
                </div>
            </div>
        </div>
    `;
}

// Move loadLinks and playVideo to global scope explicitly to avoid issues
window.loadLinks = async function (dataUrl, title) {
  const playerContainer = document.getElementById('player-container');
  const linksList = document.getElementById('links-list');
  const playerTitle = document.getElementById('player-title');
  const videoWrapper = document.getElementById('video-wrapper');

  if (!playerContainer) return;

  playerContainer.classList.remove('hidden');
  videoWrapper.classList.add('hidden');

  playerTitle.innerHTML = `<span class="loading loading-dots loading-md text-primary mr-2"></span> Buscando links para: ${title}`;
  linksList.innerHTML = '';

  try {
    playerContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });

    const res = await fetch(`${API_BASE}/plugin/${state.activePlugin}/loadLinks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: dataUrl })
    });

    const links = await res.json();

    // Link validation and console signaling
    if (links && Array.isArray(links)) {
      links.forEach(link => {
        if (!link.url || link.url.includes('undefined') || link.url.includes('null')) {
          console.warn(`[Link Validation] Link detectado com problema:`, link);
        }
      });
    }

    if (!links || links.length === 0) {
      playerTitle.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-error mr-2"></i> Nenhum link direto encontrado para: ${title}`;
      linksList.innerHTML = `<p class="text-warning text-sm">Talvez o provedor use um player externo não compatível diretamente com o web player.</p>`;
      return;
    }

    playerTitle.innerHTML = `<i class="fa-solid fa-circle-play text-primary mr-2"></i> Servidores disponíveis para: ${title}`;

    linksList.innerHTML = links.map(link => `
            <button class="btn btn-outline btn-primary justify-between" onclick="window.playVideo('${esc(link.url)}')">
                <span><i class="fa-solid fa-server mr-2"></i> ${link.name}</span>
                <span class="badge badge-sm badge-ghost">${link.quality || 'Auto'}</span>
            </button>
        `).join('');

  } catch (e) {
    console.error(e);
    playerTitle.innerHTML = `<i class="fa-solid fa-circle-exclamation text-error mr-2"></i> Erro ao buscar links`;
  }
}

let player = null;

function initPlayer() {
  const video = document.querySelector('#video-player');
  if (!video) return;

  // Initialize Plyr
  player = new Plyr(video, {
    controls: [
      'play-large', 'restart', 'rewind', 'play', 'fast-forward', 'progress',
      'current-time', 'duration', 'mute', 'volume', 'captions', 'settings',
      'pip', 'airplay', 'fullscreen'
    ],
    tooltips: { controls: true, seek: true }
  });

  window.player = player;
}

window.playVideo = function (url) {
  const videoWrapper = document.getElementById('video-wrapper');
  const video = document.getElementById('video-player');

  if (!videoWrapper || !video) return;

  // Detection logic for direct video (allows parameters after extension)
  const isDirectVideo = /\.(mp4|m3u8|mkv|webm|ogv)(\?|#|$)/i.test(url) || url.includes('.m3u8') || url.includes('get_video') || url.includes('stream');

  if (isDirectVideo) {
    videoWrapper.classList.remove('hidden');
    video.classList.remove('hidden');

    if (url.includes('.m3u8')) {
      if (Hls.isSupported()) {
        const hls = new Hls({
          maxBufferSize: 60 * 1024 * 1024,
          maxBufferLength: 30,
          startLevel: -1,
          enableWorker: true
        });
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, function () {
          video.play();
        });
        player.on('languagechange', () => {
          setTimeout(() => hls.subtitleTrack = player.currentTrack, 50);
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url;
        video.play();
      }
    } else {
      video.src = url;
      video.play();
    }
    videoWrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } else {
    // Show warning instead of iframe
    videoWrapper.classList.add('hidden');
    video.pause();
    video.src = '';
    alert("Este link ainda não é suportado pelos nossos extratores e não permitimos iframes.");
    console.error("Link não suportado (Iframe bloqueado):", url);
  }
}

// Exposed globally for card clicks
window.openDetails = openDetails;

// Start app
document.addEventListener('DOMContentLoaded', () => {
  init();
  initPlayer();
});
