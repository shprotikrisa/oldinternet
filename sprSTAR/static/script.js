
// --- ЗВЁЗДНЫЙ ШЛЕЙФ КУРСОРА ---
const canvas = document.getElementById('cursor-canvas');
const ctx = canvas.getContext('2d');
let sparkles = [];

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

class Sparkle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.size = Math.random() * 6 + 3;
    this.speedX = (Math.random() - 0.5) * 1.5;
    this.speedY = Math.random() * 1 + 0.5;
    this.opacity = 1;

    const colors = ['#ff69b4', '#ffd700', '#ffffff', '#e6a8d7', '#ff1493'];
    this.color = colors[Math.floor(Math.random() * colors.length)];
  }

  update() {
    this.x += this.speedX;
    this.y += this.speedY;
    this.opacity -= 0.03;
  }

  draw() {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.opacity);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size / 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = this.color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x - this.size, this.y);
    ctx.lineTo(this.x + this.size, this.y);
    ctx.moveTo(this.x, this.y - this.size);
    ctx.lineTo(this.x, this.y + this.size);
    ctx.stroke();
    ctx.restore();
  }
}

window.addEventListener('mousemove', (e) => {
  for (let i = 0; i < 2; i++) {
    sparkles.push(new Sparkle(e.clientX, e.clientY));
  }
});

function animate() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < sparkles.length; i++) {
    sparkles[i].update();
    sparkles[i].draw();

    if (sparkles[i].opacity <= 0) {
      sparkles.splice(i, 1);
      i--;
    }
  }

  requestAnimationFrame(animate);
}

animate();


// --- УПРАВЛЕНИЕ ДАННЫМИ ПРОФИЛЯ ---
const displayName = document.getElementById('display-name');
const displayStatus = document.getElementById('display-status');
const displaySong = document.getElementById('display-song');
const displayArtist = document.getElementById('display-artist');

const postUserName = document.getElementById('post-user-name');
const postUserStatus = document.getElementById('post-user-status');
const postInputName = document.getElementById('post-input-name');
const postInputStatus = document.getElementById('post-input-status');

const avatarInput = document.getElementById('avatar-input');
const avatarPreview = document.getElementById('avatar-preview');
const avatarPlaceholder = document.getElementById('avatar-placeholder');

const postAvatarPreview = document.getElementById('post-avatar-preview');
const postAvatarPlaceholder = document.getElementById('post-avatar-placeholder');

const profileModal = document.getElementById('profile-modal');
const editProfileBtn = document.getElementById('edit-profile-btn');
const closeBtn = document.getElementById('close-modal-btn');
const saveBtn = document.getElementById('save-profile-btn');

const inputName = document.getElementById('input-name');
const inputStatus = document.getElementById('input-status');
const inputSong = document.getElementById('input-song');
const inputArtist = document.getElementById('input-artist');


// Загрузка данных из localStorage
function loadProfileData() {
  const savedName = localStorage.getItem('y2k_name') || 'шмигулі2007';
  const savedStatus = localStorage.getItem('y2k_status') || 'статус: in love...';
  const savedSong = localStorage.getItem('y2k_song') || 'song name';
  const savedArtist = localStorage.getItem('y2k_artist') || 'author';
  const savedAvatar = localStorage.getItem('y2k_avatar');

  displayName.innerText = savedName;
  displayStatus.innerText = savedStatus.startsWith('статус:')
    ? savedStatus
    : `статус: ${savedStatus}`;

  displaySong.innerText = savedSong;
  displayArtist.innerText = savedArtist;

  if (postUserName) postUserName.innerText = savedName;
  if (postUserStatus) postUserStatus.innerText = displayStatus.innerText;
  if (postInputName) postInputName.value = savedName;
  if (postInputStatus) postInputStatus.value = displayStatus.innerText;

  if (savedAvatar) {
    avatarPreview.src = savedAvatar;
    avatarPreview.classList.remove('hidden');
    avatarPlaceholder.classList.add('hidden');

    if (postAvatarPreview) {
      postAvatarPreview.src = savedAvatar;
      postAvatarPreview.classList.remove('hidden');

      if (postAvatarPlaceholder) {
        postAvatarPlaceholder.classList.add('hidden');
      }
    }
  }
}


// Загрузка аватара
avatarInput.addEventListener('change', (e) => {
  const file = e.target.files[0];

  if (file) {
    const reader = new FileReader();

    reader.onload = function(evt) {
      localStorage.setItem('y2k_avatar', evt.target.result);
      loadProfileData();
    };

    reader.readAsDataURL(file);
  }
});


// Открытие модального окна
function openModal() {
  inputName.value = displayName.innerText;
  inputStatus.value = displayStatus.innerText.replace(/^статус:\s*/, '');
  inputSong.value = displaySong.innerText;
  inputArtist.value = displayArtist.innerText;

  profileModal.classList.remove('hidden');
}

editProfileBtn.addEventListener('click', openModal);
displayName.addEventListener('dblclick', openModal);
displayStatus.addEventListener('dblclick', openModal);

document.getElementById('ipod-widget').addEventListener('click', openModal);

closeBtn.addEventListener('click', () => {
  profileModal.classList.add('hidden');
});

saveBtn.addEventListener('click', () => {
  const newName = inputName.value.trim() || 'шмигулі2007';
  const newStatus = inputStatus.value.trim() || 'in love...';
  const newSong = inputSong.value.trim() || 'song name';
  const newArtist = inputArtist.value.trim() || 'author';

  localStorage.setItem('y2k_name', newName);
  localStorage.setItem('y2k_status', newStatus);
  localStorage.setItem('y2k_song', newSong);
  localStorage.setItem('y2k_artist', newArtist);

  loadProfileData();
  profileModal.classList.add('hidden');
});

loadProfileData();


// --- ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК ---
const navBtns = document.querySelectorAll('.nav-btn');

const tabContents = {
  profile: document.getElementById('profile-section'),
  post: document.getElementById('post-section'),
  photos: document.getElementById('photos-section'),
  contact: document.getElementById('contact-section')
};

navBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    navBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const selectedTab = btn.dataset.tab;

    Object.values(tabContents).forEach(content => {
      if (content) content.classList.add('hidden');
    });

    if (tabContents[selectedTab]) {
      tabContents[selectedTab].classList.remove('hidden');
    }
  });
});


// Подменю профиля
const subtabBtns = document.querySelectorAll('.subtab-btn');

subtabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    subtabBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});


// --- ВЕБ-КАМЕРА И РАМКИ ---
const webcam = document.getElementById('webcam');
const startCamBtn = document.getElementById('start-cam-btn');
const snapBtn = document.getElementById('snap-btn');
const frameButtons = document.querySelectorAll('.frame-btn');
const frameOverlayImg = document.getElementById('frame-overlay-img');
const photoCanvas = document.getElementById('photo-canvas');
const resultContainer = document.getElementById('result-container');
const downloadLink = document.getElementById('download-link');

let processedFrame = null;
let frameLoading = false;


// --- СИСТЕМА ФИЛЬТРОВ ---

let currentEffect = 'original';
let effectIntensity = 70;

const effects = {
  original: {
    name: 'Original'
  },
  vintage: {
    name: 'Vintage'
  },
  y2k: {
    name: 'Y2K'
  },
  vhs: {
    name: 'VHS'
  },
  dreamy: {
    name: 'Dreamy'
  }
};


// Создание панели фильтров
function createEffectPanel() {
  const panel = document.createElement('div');
  panel.id = 'photo-effects-panel';

  panel.innerHTML = `
    <div class="effects-heading">PHOTO EFFECTS</div>

    <div class="effects-buttons">
      <button type="button" class="effect-btn active" data-effect="original">
        Original
      </button>

      <button type="button" class="effect-btn" data-effect="vintage">
        Vintage
      </button>

      <button type="button" class="effect-btn" data-effect="y2k">
        Y2K
      </button>

      <button type="button" class="effect-btn" data-effect="vhs">
        VHS
      </button>

      <button type="button" class="effect-btn" data-effect="dreamy">
        Dreamy
      </button>
    </div>

    <div class="effect-intensity">
      <label for="effect-intensity">
        INTENSITY:
        <span id="effect-intensity-value">70%</span>
      </label>

      <input
        type="range"
        id="effect-intensity"
        min="0"
        max="100"
        value="70"
      >
    </div>
  `;

  const style = document.createElement('style');

  style.textContent = `
    #photo-effects-panel {
      margin-top: 15px;
      padding: 12px;
      border: 1px solid #d98abd;
      background: rgba(255, 240, 250, 0.92);
      color: #713b67;
      font-family: inherit;
      box-sizing: border-box;
      width: 100%;
    }

    .effects-heading {
      font-size: 12px;
      font-weight: bold;
      letter-spacing: 2px;
      margin-bottom: 10px;
    }

    .effects-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .effect-btn {
      padding: 7px 10px;
      border: 1px solid #d98abd;
      background: #fff8fc;
      color: #713b67;
      font-family: inherit;
      font-size: 12px;
      cursor: pointer;
    }

    .effect-btn:hover,
    .effect-btn.active {
      background: #e9a6d1;
      color: #fff;
    }

    .effect-intensity {
      margin-top: 12px;
      display: flex;
      flex-direction: column;
      gap: 7px;
      font-size: 11px;
    }

    .effect-intensity input {
      width: 100%;
      cursor: pointer;
      accent-color: #d477b5;
    }

    #vhs-preview-overlay {
      position: absolute;
      inset: 0;
      z-index: 3;
      pointer-events: none;
      display: none;
      background:
        repeating-linear-gradient(
          to bottom,
          transparent 0px,
          transparent 3px,
          rgba(0, 0, 0, 0.18) 4px
        );
      mix-blend-mode: multiply;
    }

    #vhs-preview-overlay.active {
      display: block;
    }

    #dreamy-preview-overlay {
      position: absolute;
      inset: 0;
      z-index: 3;
      pointer-events: none;
      display: none;
      background: rgba(255, 220, 245, 0.2);
      box-shadow: inset 0 0 25px rgba(255, 255, 255, 0.8);
    }

    #dreamy-preview-overlay.active {
      display: block;
    }

    #vintage-preview-overlay {
      position: absolute;
      inset: 0;
      z-index: 3;
      pointer-events: none;
      display: none;
      background:
        radial-gradient(
          ellipse,
          transparent 50%,
          rgba(90, 45, 10, 0.2) 100%
        );
    }

    #vintage-preview-overlay.active {
      display: block;
    }
  `;

  document.head.appendChild(style);

  const frameParent = frameButtons.length
    ? frameButtons[0].parentElement
    : snapBtn.parentElement;

  frameParent.appendChild(panel);

  const effectButtons = panel.querySelectorAll('.effect-btn');
  const intensityInput = panel.querySelector('#effect-intensity');
  const intensityValue = panel.querySelector('#effect-intensity-value');

  effectButtons.forEach(button => {
    button.addEventListener('click', () => {
      effectButtons.forEach(b => b.classList.remove('active'));
      button.classList.add('active');

      currentEffect = button.dataset.effect;

      updatePreviewEffect();
    });
  });

  intensityInput.addEventListener('input', () => {
    effectIntensity = Number(intensityInput.value);
    intensityValue.textContent = `${effectIntensity}%`;

    updatePreviewEffect();
  });
}


// Создание визуальных слоёв предпросмотра
function createPreviewOverlays() {
  const previewParent = webcam.parentElement;

  if (!previewParent) return;

  if (getComputedStyle(previewParent).position === 'static') {
    previewParent.style.position = 'relative';
  }

  const overlayNames = [
    'vhs-preview-overlay',
    'dreamy-preview-overlay',
    'vintage-preview-overlay'
  ];

  overlayNames.forEach(id => {
    if (!document.getElementById(id)) {
      const overlay = document.createElement('div');
      overlay.id = id;
      previewParent.appendChild(overlay);
    }
  });
}


// CSS-фильтр для живого предпросмотра
function updatePreviewEffect() {
  const amount = effectIntensity / 100;

  let filter = 'none';

  if (currentEffect === 'vintage') {
    filter = `
      sepia(${0.65 * amount})
      saturate(${1 + 0.35 * amount})
      contrast(${1 + 0.12 * amount})
      brightness(${1 + 0.04 * amount})
    `;
  }

  if (currentEffect === 'y2k') {
    filter = `
      saturate(${1 + 0.9 * amount})
      contrast(${1 + 0.2 * amount})
      hue-rotate(${-12 * amount}deg)
      brightness(${1 + 0.06 * amount})
    `;
  }

  if (currentEffect === 'vhs') {
    filter = `
      saturate(${1 + 0.5 * amount})
      contrast(${1 + 0.18 * amount})
      hue-rotate(${8 * amount}deg)
    `;
  }

  if (currentEffect === 'dreamy') {
    filter = `
      brightness(${1 + 0.2 * amount})
      saturate(${1 + 0.2 * amount})
      blur(${2 * amount}px)
    `;
  }

  webcam.style.filter = filter;

  const vhsOverlay = document.getElementById('vhs-preview-overlay');
  const dreamyOverlay = document.getElementById('dreamy-preview-overlay');
  const vintageOverlay = document.getElementById('vintage-preview-overlay');

  vhsOverlay.classList.toggle('active', currentEffect === 'vhs');
  dreamyOverlay.classList.toggle('active', currentEffect === 'dreamy');
  vintageOverlay.classList.toggle('active', currentEffect === 'vintage');

  vhsOverlay.style.opacity = amount;
  dreamyOverlay.style.opacity = amount;
  vintageOverlay.style.opacity = amount;
}


// Применение фильтра к итоговой фотографии
function applyEffectToCanvas(source, width, height) {
  const effectCanvas = document.createElement('canvas');
  const effectCtx = effectCanvas.getContext('2d');

  effectCanvas.width = width;
  effectCanvas.height = height;

  const amount = effectIntensity / 100;

  effectCtx.drawImage(source, 0, 0, width, height);

  if (currentEffect === 'original' || amount === 0) {
    return effectCanvas;
  }

  const imageData = effectCtx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Vintage, Y2K и VHS: обработка цветов
  if (
    currentEffect === 'vintage' ||
    currentEffect === 'y2k' ||
    currentEffect === 'vhs'
  ) {
    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      if (currentEffect === 'vintage') {
        const sepiaR = r * 0.393 + g * 0.769 + b * 0.189;
        const sepiaG = r * 0.349 + g * 0.686 + b * 0.168;
        const sepiaB = r * 0.272 + g * 0.534 + b * 0.131;

        r = r + (sepiaR - r) * amount * 0.75;
        g = g + (sepiaG - g) * amount * 0.75;
        b = b + (sepiaB - b) * amount * 0.75;

        const grain = (Math.random() - 0.5) * 28 * amount;

        r += grain;
        g += grain;
        b += grain;
      }

      if (currentEffect === 'y2k') {
        r += 12 * amount;
        g += 4 * amount;
        b += 22 * amount;

        const average = (r + g + b) / 3;

        r = average + (r - average) * (1 + amount * 0.7);
        g = average + (g - average) * (1 + amount * 0.7);
        b = average + (b - average) * (1 + amount * 0.7);
      }

      if (currentEffect === 'vhs') {
        r += 18 * amount;
        b += 24 * amount;
        g -= 4 * amount;

        const average = (r + g + b) / 3;

        r = average + (r - average) * (1 + amount * 0.45);
        g = average + (g - average) * (1 + amount * 0.45);
        b = average + (b - average) * (1 + amount * 0.45);
      }

      data[i] = Math.max(0, Math.min(255, r));
      data[i + 1] = Math.max(0, Math.min(255, g));
      data[i + 2] = Math.max(0, Math.min(255, b));
    }

    effectCtx.putImageData(imageData, 0, 0);
  }

  // VHS: горизонтальные полосы
  if (currentEffect === 'vhs') {
    effectCtx.save();

    effectCtx.globalAlpha = 0.25 * amount;
    effectCtx.fillStyle = '#000000';

    for (let y = 0; y < height; y += 5) {
      effectCtx.fillRect(0, y, width, 1);
    }

    effectCtx.restore();

    // Лёгкие цветные смещения
    const shift = Math.round(5 * amount);

    if (shift > 0) {
      const copyCanvas = document.createElement('canvas');
      copyCanvas.width = width;
      copyCanvas.height = height;

      const copyCtx = copyCanvas.getContext('2d');
      copyCtx.drawImage(effectCanvas, 0, 0);

      effectCtx.save();
      effectCtx.globalAlpha = 0.2 * amount;
      effectCtx.globalCompositeOperation = 'screen';
      effectCtx.drawImage(copyCanvas, shift, 0);
      effectCtx.restore();
    }
  }

  // Dreamy: мягкое свечение
  if (currentEffect === 'dreamy') {
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = width;
    glowCanvas.height = height;

    const glowCtx = glowCanvas.getContext('2d');

    glowCtx.filter = `blur(${Math.max(1, 12 * amount)}px)`;
    glowCtx.drawImage(effectCanvas, 0, 0, width, height);

    effectCtx.save();
    effectCtx.globalAlpha = 0.45 * amount;
    effectCtx.globalCompositeOperation = 'screen';
    effectCtx.drawImage(glowCanvas, 0, 0);
    effectCtx.restore();

    effectCtx.save();
    effectCtx.globalAlpha = 0.12 * amount;
    effectCtx.fillStyle = '#ffe5f5';
    effectCtx.fillRect(0, 0, width, height);
    effectCtx.restore();
  }

  // Виньетка для Vintage
  if (currentEffect === 'vintage') {
    const gradient = effectCtx.createRadialGradient(
      width / 2,
      height / 2,
      width * 0.15,
      width / 2,
      height / 2,
      width * 0.75
    );

    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, `rgba(65, 35, 10, ${0.35 * amount})`);

    effectCtx.fillStyle = gradient;
    effectCtx.fillRect(0, 0, width, height);
  }

  return effectCanvas;
}


function initEffectPanel() {
  const panel = document.getElementById('photo-effects-panel');

  const effectButtons = panel.querySelectorAll('.effect-btn');
  const intensityInput = panel.querySelector('#effect-intensity');
  const intensityValue = panel.querySelector('#effect-intensity-value');

  effectButtons.forEach(button => {
    button.addEventListener('click', () => {
      effectButtons.forEach(b => b.classList.remove('active'));
      button.classList.add('active');

      currentEffect = button.dataset.effect;
      updatePreviewEffect();
    });
  });

  intensityInput.addEventListener('input', () => {
    effectIntensity = Number(intensityInput.value);
    intensityValue.textContent = `${effectIntensity}%`;

    updatePreviewEffect();
  });
}

initEffectPanel();
createPreviewOverlays();


// --- ОБРАБОТКА РАМОК И УДАЛЕНИЕ ЗЕЛЁНОГО ЦВЕТА ---

function loadAndProcessFrame(src) {
  frameLoading = true;
  snapBtn.disabled = true;

  frameOverlayImg.style.visibility = 'hidden';

  const originalImage = new Image();

  originalImage.onload = () => {
    const frameCanvas = document.createElement('canvas');
    const frameCtx = frameCanvas.getContext('2d');

    frameCanvas.width = originalImage.naturalWidth;
    frameCanvas.height = originalImage.naturalHeight;

    frameCtx.drawImage(originalImage, 0, 0);

    const imageData = frameCtx.getImageData(
      0, 0,
      frameCanvas.width,
      frameCanvas.height
    );

    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const isGreen =
        g > 100 &&
        g > r * 1.35 &&
        g > b * 1.35 &&
        r < 150 &&
        b < 150;

      if (isGreen) {
        data[i + 3] = 0;
      }
    }

    frameCtx.putImageData(imageData, 0, 0);

    const processedUrl = frameCanvas.toDataURL('image/png');

    processedFrame = new Image();

    processedFrame.onload = () => {
      frameOverlayImg.src = processedUrl;
      frameOverlayImg.style.visibility = 'visible';

      frameLoading = false;

      if (webcam.srcObject && webcam.videoWidth > 0) {
        snapBtn.disabled = false;
      }
    };

    processedFrame.src = processedUrl;
  };

  originalImage.onerror = () => {
    frameLoading = false;
    snapBtn.disabled = true;
    console.error('Не удалось загрузить рамку:', src);
  };

  originalImage.src = src;
}


// Начальная рамка
loadAndProcessFrame(frameOverlayImg.getAttribute('src'));


// Включение камеры
if (startCamBtn) {
  startCamBtn.addEventListener('click', async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });

      webcam.srcObject = stream;

      await webcam.play();

      startCamBtn.innerText = 'Камера включена';
      startCamBtn.disabled = true;

      updatePreviewEffect();

      if (!frameLoading && processedFrame) {
        snapBtn.disabled = false;
      }

    } catch (err) {
      alert('Не удалось получить доступ к веб-камере.');
      console.error(err);
    }
  });
}


// Смена рамок
frameButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    frameButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    loadAndProcessFrame(btn.dataset.frameImg);
  });
});


// --- СОЗДАНИЕ ФОТОГРАФИИ С ФИЛЬТРОМ ---

if (snapBtn) {
  snapBtn.addEventListener('click', () => {
    if (
      !webcam.videoWidth ||
      !webcam.videoHeight ||
      !processedFrame ||
      frameLoading
    ) {
      console.error('Камера или рамка ещё не готовы.');
      return;
    }

    const width = processedFrame.naturalWidth;
    const height = processedFrame.naturalHeight;

    photoCanvas.width = width;
    photoCanvas.height = height;

    const photoCtx = photoCanvas.getContext('2d');

    // Сначала обрабатываем изображение с камеры
    const filteredPhoto = applyEffectToCanvas(
      webcam,
      width,
      height
    );

    // Рисуем фотографию с фильтром
    photoCtx.clearRect(0, 0, width, height);
    photoCtx.drawImage(filteredPhoto, 0, 0, width, height);

    // Поверх накладываем обработанную рамку
    photoCtx.globalCompositeOperation = 'source-over';
    photoCtx.drawImage(processedFrame, 0, 0, width, height);

    // Показываем результат
    resultContainer.classList.remove('hidden');

    // Подготавливаем скачивание
    downloadLink.href = photoCanvas.toDataURL('image/png');
  });
}
