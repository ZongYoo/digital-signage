const STORAGE_KEY  = 'ds_playlist';
const TICKER_KEY   = 'ds_ticker';
const FADE_MS      = 500;

function loadPlaylist() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

// ── DOM 元素 ──────────────────────────────────
const imgEl       = document.getElementById('media-image');
const videoEl     = document.getElementById('media-video');
const ytWrapperEl = document.getElementById('yt-wrapper');
const loadingEl   = document.getElementById('loading');
const fadeEl      = document.getElementById('fade-overlay');

let playlist     = [];
let currentIndex = 0;
let playTimer    = null;
let loadTimer    = null;
let fadeTimerId  = null;
let ytPlayer     = null;
let ytAPIReady   = false;
let playSession  = 0;

// ── 淡入淡出 ──────────────────────────────────

function fadeIn() {
  fadeEl.style.opacity = '0';
}

// ── YouTube IFrame API 就緒 Promise ───────────
let resolveYTAPI;
const ytAPIReadyPromise = new Promise(resolve => { resolveYTAPI = resolve; });

window.onYouTubeIframeAPIReady = function () {
  ytAPIReady = true;
  resolveYTAPI();
};

if (window.YT && window.YT.Player) {
  ytAPIReady = true;
  resolveYTAPI();
}

// ── YouTube 工具函式 ──────────────────────────

function isYouTube(url) {
  return /youtube\.com|youtu\.be/.test(url);
}

function getYouTubeId(url) {
  const short = url.match(/youtu\.be\/([^?&/]+)/);
  if (short) return short[1];
  const watch = url.match(/[?&]v=([^?&]+)/);
  if (watch) return watch[1];
  const embed = url.match(/\/embed\/([^?&/]+)/);
  if (embed) return embed[1];
  return null;
}

function bustUrl(url) {
  return url.includes('?') ? `${url}&t=${Date.now()}` : `${url}?t=${Date.now()}`;
}

// ── 顯示 / 隱藏 ───────────────────────────────

function showLayer(type) {
  imgEl.classList.toggle('hidden',   type !== 'image');
  videoEl.classList.toggle('hidden', type !== 'video');
  ytWrapperEl.style.display = (type === 'youtube') ? 'block' : 'none';
}

function hideAll() {
  imgEl.classList.add('hidden');
  videoEl.classList.add('hidden');
  ytWrapperEl.style.display = 'none';
}

// ── 強制重置所有播放容器 ──────────────────────

function resetContainers() {
  if (ytPlayer) {
    try { ytPlayer.stopVideo(); } catch (e) {}
    try { ytPlayer.destroy();   } catch (e) {}
    ytPlayer = null;
  }
  ytWrapperEl.innerHTML = '';

  videoEl.onended   = null;
  videoEl.onerror   = null;
  videoEl.oncanplay = null;
  videoEl.pause();
  videoEl.removeAttribute('src');

  imgEl.onload  = null;
  imgEl.onerror = null;
  imgEl.removeAttribute('src');
}

// ── 跳至下一個（含淡出效果） ──────────────────

function nextItem() {
  clearTimeout(playTimer);
  clearTimeout(loadTimer);
  clearTimeout(fadeTimerId);

  fadeEl.style.opacity = '1';   // 淡出至黑幕

  const nextIdx = (currentIndex + 1) % playlist.length;
  fadeTimerId = setTimeout(() => {
    currentIndex = nextIdx;
    playItem(currentIndex);
  }, FADE_MS);
}

// ── YouTube Player 建立 ───────────────────────

function createYTPlayer(videoId, session) {
  ytWrapperEl.innerHTML = '<div id="yt-player"></div>';

  const origin = (window.location.origin && window.location.origin !== 'null')
    ? window.location.origin
    : undefined;

  ytPlayer = new YT.Player('yt-player', {
    videoId,
    playerVars: {
      enablejsapi: 1,
      autoplay:    1,
      mute:        1,
      rel:         0,
      playsinline: 1,
      controls:    0,
      vq:          'hd1080',   // 預設要求 1080p 畫質
      ...(origin ? { origin } : {})
    },
    events: {
      onReady(e) {
        if (session !== playSession) return;
        clearTimeout(loadTimer);
        e.target.setPlaybackQuality('hd1080');   // 明確設定 1080p
        e.target.playVideo();
        loadingEl.classList.add('hidden');
        showLayer('youtube');
        fadeIn();   // 淡入新媒體
      },
      onStateChange(e) {
        if (session !== playSession) return;
        if (e.data === YT.PlayerState.ENDED) nextItem();
      },
      onError(e) {
        if (session !== playSession) return;
        console.warn('YouTube 播放錯誤，錯誤碼：', e.data);
        nextItem();
      }
    }
  });
}

// ── 播放邏輯 ──────────────────────────────────

async function playItem(index) {
  clearTimeout(playTimer);
  clearTimeout(loadTimer);

  const session = ++playSession;

  resetContainers();
  hideAll();
  loadingEl.classList.remove('hidden');

  const item = playlist[index];

  if (item.type === 'image') {
    imgEl.onload = () => {
      if (session !== playSession) return;
      loadingEl.classList.add('hidden');
      showLayer('image');
      fadeIn();   // 淡入圖片
      playTimer = setTimeout(nextItem, item.duration ?? 5000);
    };
    imgEl.onerror = () => {
      if (session !== playSession) return;
      console.warn(`圖片載入失敗：${item.url}`);
      nextItem();
    };
    imgEl.src = item.url;

  } else if (item.type === 'video') {

    if (isYouTube(item.url)) {
      const videoId = getYouTubeId(item.url);
      if (!videoId) {
        console.warn('無法解析 YouTube 影片 ID：', item.url);
        nextItem();
        return;
      }

      loadTimer = setTimeout(() => {
        console.warn('YouTube 載入逾時，跳至下一項');
        nextItem();
      }, 8000);

      if (!ytAPIReady) {
        await ytAPIReadyPromise;
      }
      if (session !== playSession) return;

      createYTPlayer(videoId, session);

    } else {
      loadTimer = setTimeout(() => {
        console.warn(`影片載入逾時，跳至下一項：${item.url}`);
        nextItem();
      }, 10000);

      videoEl.oncanplay = () => {
        if (session !== playSession) return;
        clearTimeout(loadTimer);
        loadingEl.classList.add('hidden');
        showLayer('video');
        fadeIn();   // 淡入影片
        videoEl.oncanplay = null;
      };
      videoEl.onended = () => {
        if (session !== playSession) return;
        nextItem();
      };
      videoEl.onerror = () => {
        if (session !== playSession) return;
        clearTimeout(loadTimer);
        console.warn(`影片載入失敗：${item.url}`);
        nextItem();
      };

      videoEl.src = bustUrl(item.url);
      videoEl.load();
      videoEl.play().catch(err => {
        if (session !== playSession) return;
        if (err.name === 'AbortError') return;
        console.warn('自動播放受阻，等待使用者互動後重試', err);
        document.addEventListener('click', () => videoEl.play(), { once: true });
      });
    }

  } else {
    console.warn(`未知的媒體類型：${item.type}`);
    nextItem();
  }
}

// ── 時鐘 ──────────────────────────────────────

function initClock() {
  const timeEl = document.getElementById('clock-time');
  const dateEl = document.getElementById('clock-date');
  const days   = ['日', '一', '二', '三', '四', '五', '六'];

  function tick() {
    const now  = new Date();
    const hh   = String(now.getHours()).padStart(2, '0');
    const mm   = String(now.getMinutes()).padStart(2, '0');
    const ss   = String(now.getSeconds()).padStart(2, '0');
    timeEl.textContent = `${hh}:${mm}:${ss}`;

    const yyyy = now.getFullYear();
    const mo   = String(now.getMonth() + 1).padStart(2, '0');
    const dd   = String(now.getDate()).padStart(2, '0');
    dateEl.textContent = `${yyyy}/${mo}/${dd}（${days[now.getDay()]}）`;
  }

  tick();
  setInterval(tick, 1000);
}

// ── 跑馬燈 ────────────────────────────────────

function initTicker() {
  try {
    const cfg = JSON.parse(localStorage.getItem(TICKER_KEY));
    if (!cfg?.enabled || !cfg.text) return;

    const ticker = document.getElementById('ticker');
    const spanA  = document.getElementById('ticker-a');
    const spanB  = document.getElementById('ticker-b');
    const track  = ticker.querySelector('.ticker-track');

    // 在兩段文字間加入分隔符，確保視覺上有間距
    const textWithSep = cfg.text + '\u3000\u3000\u2726\u3000\u3000';
    spanA.textContent = textWithSep;
    spanB.textContent = textWithSep;

    const duration = Math.max(8, Number(cfg.speed) || 30);
    track.style.animationDuration = `${duration}s`;

    ticker.classList.add('ticker-active');
  } catch (e) {}
}

// ── 非同步初始化 ──────────────────────────────

async function init() {
  playlist = loadPlaylist();

  initClock();
  initTicker();

  if (playlist.length === 0) {
    loadingEl.textContent = '目前無廣告內容';
    fadeIn();   // 遮罩淡出，讓提示文字可見
    return;
  }

  playItem(currentIndex);
}

init();
