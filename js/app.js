// Variables Globales
const STORAGE_KEY = 'tonys_trips_data';
let appData = { mapData: null, states: {} };
let isAdmin = false;
let selectedState = null;
let currentPhotoIndex = 0;

// Inicialización de la aplicación
async function init() {
    loadData();

    if (!appData.mapData) {
        try {
            const response = await fetch('./states_simple.geojson');
            appData.mapData = await response.json();
            saveData();
        } catch (err) {
            alert("Error cargando el mapa inicial. Verifica tu conexión a internet.");
            return;
        }
    }
    renderMap();
}

// Persistencia de Datos en Servidor Estático (Local Storage)
function loadData() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        try {
            appData = JSON.parse(stored);
        } catch (e) {
            console.error('Error parseando datos guardados:', e);
        }
    }
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
}

// Utilidad para limpiar nombres
function slugify(text) {
    return text.toString().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '');
}

// Renderizado del Mapa con D3
function renderMap() {
    const container = document.getElementById('map-container');
    container.innerHTML = ''; 
    
    const width = 1000;
    const height = 650;

    const svg = d3.select(container).append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('class', 'w-full h-full max-h-[85vh] drop-shadow-[0_0_20px_rgba(255,255,255,0.15)]');

    const projection = d3.geoMercator().fitSize([width, height], appData.mapData);
    const path = d3.geoPath().projection(projection);
    const defs = svg.append('defs');

    // Insertar patrones de imágenes para estados con fotos
    appData.mapData.features.forEach(feature => {
        const stateName = feature.properties.NOMGEO;
        const stateData = appData.states[stateName];
        
        if (stateData && stateData.photos && stateData.photos.length > 0) {
            const slug = slugify(stateName);
            defs.append('pattern')
                .attr('id', `bg-${slug}`)
                .attr('patternContentUnits', 'objectBoundingBox')
                .attr('width', 1)
                .attr('height', 1)
                .append('image')
                .attr('href', stateData.photos[0].base64)
                .attr('x', 0).attr('y', 0)
                .attr('width', 1).attr('height', 1)
                .attr('preserveAspectRatio', 'xMidYMid slice');
        }
    });

    // Dibujar Estados
    svg.selectAll('path')
        .data(appData.mapData.features)
        .enter().append('path')
        .attr('d', path)
        .attr('fill', d => {
            const stateData = appData.states[d.properties.NOMGEO];
            if (stateData && stateData.photos && stateData.photos.length > 0) {
                return `url(#bg-${slugify(d.properties.NOMGEO)})`;
            }
            return 'rgba(128, 128, 128, 0.4)';
        })
        .attr('stroke', 'white')
        .attr('stroke-width', '1.5')
        .attr('class', 'cursor-pointer transition-all duration-300 hover:opacity-80 hover:stroke-[3px]')
        .on('click', (event, d) => openGallery(d.properties.NOMGEO))
        .append('title')
        .text(d => d.properties.NOMGEO);
}

// Autenticación y Controles de Admin
function promptLogin() {
    if (isAdmin) {
        alert("Modo administrador activo.");
        return;
    }
    const pass = prompt("Contraseña de administrador:");
    if (pass === "700331") {
        isAdmin = true;
        document.getElementById('admin-header-controls').classList.remove('hidden');
    } else if (pass !== null) {
        alert("Contraseña incorrecta.");
    }
}

// Exportar e Importar base de datos (.json)
function exportData() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appData));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = "tonys_trips_backup.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            appData = JSON.parse(e.target.result);
            saveData();
            renderMap();
            alert("Datos restaurados correctamente.");
        } catch (err) {
            alert("Archivo no válido.");
        }
    };
    reader.readAsText(file);
}

// Lógica de Galería
function openGallery(stateName) {
    selectedState = stateName;
    currentPhotoIndex = 0;
    
    document.getElementById('gallery-title').innerText = stateName;
    document.getElementById('wiki-link').href = `https://es.wikipedia.org/wiki/${encodeURIComponent(stateName)}`;
    
    document.getElementById('admin-controls').classList.toggle('hidden', !isAdmin);

    const modal = document.getElementById('gallery-modal');
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('opacity-0'), 10);
    
    updateGalleryUI();
}

function closeGallery() {
    const modal = document.getElementById('gallery-modal');
    modal.classList.add('opacity-0');
    setTimeout(() => modal.classList.add('hidden'), 300);
    selectedState = null;
}

function updateGalleryUI() {
    const stateData = appData.states[selectedState] || { photos: [] };
    const photos = stateData.photos;
    
    const mainImg = document.getElementById('main-image');
    const emptyMsg = document.getElementById('empty-msg');
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    const descViewer = document.getElementById('desc-viewer');
    const descEditor = document.getElementById('desc-editor');
    const photoCounter = document.getElementById('photo-counter');
    
    document.getElementById('btn-delete-photo').classList.toggle('hidden', photos.length === 0);

    if (photos.length > 0) {
        const currentPhoto = photos[currentPhotoIndex];
        mainImg.src = currentPhoto.base64;
        mainImg.classList.remove('hidden');
        emptyMsg.classList.add('hidden');
        
        photoCounter.innerText = `${currentPhotoIndex + 1} / ${photos.length} fotos (Max: 10)`;
        
        if (isAdmin) {
            descEditor.value = currentPhoto.desc || "";
            descEditor.classList.remove('hidden');
            descViewer.classList.add('hidden');
        } else {
            descViewer.innerText = currentPhoto.desc || "Sin descripción.";
            descViewer.classList.remove('hidden');
            descEditor.classList.add('hidden');
        }
        
        btnPrev.classList.toggle('hidden', photos.length <= 1);
        btnNext.classList.toggle('hidden', photos.length <= 1);
    } else {
        mainImg.classList.add('hidden');
        emptyMsg.classList.remove('hidden');
        descViewer.classList.add('hidden');
        descEditor.classList.add('hidden');
        btnPrev.classList.add('hidden');
        btnNext.classList.add('hidden');
        photoCounter.innerText = "0 / 10 fotos";
    }
    
    renderThumbnails(photos);
}

function renderThumbnails(photos) {
    const container = document.getElementById('thumbnails');
    container.innerHTML = '';
    
    photos.forEach((photo, index) => {
        const thumb = document.createElement('div');
        thumb.className = `w-14 h-14 bg-gray-800 border-2 flex-shrink-0 cursor-pointer overflow-hidden rounded ${index === currentPhotoIndex ? 'border-blue-500' : 'border-transparent opacity-60 hover:opacity-100'}`;
        thumb.onclick = () => {
            currentPhotoIndex = index;
            updateGalleryUI();
        };
        
        const img = document.createElement('img');
        img.src = photo.base64;
        img.className = "w-full h-full object-cover pointer-events-none";
        thumb.appendChild(img);
        container.appendChild(thumb);
    });
}

function prevPhoto() {
    const limit = appData.states[selectedState]?.photos?.length || 0;
    if (limit > 0) {
        currentPhotoIndex = (currentPhotoIndex - 1 + limit) % limit;
        updateGalleryUI();
    }
}

function nextPhoto() {
    const limit = appData.states[selectedState]?.photos?.length || 0;
    if (limit > 0) {
        currentPhotoIndex = (currentPhotoIndex + 1) % limit;
        updateGalleryUI();
    }
}

// Subida, Procesamiento y Eliminación de Fotos
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!appData.states[selectedState]) {
        appData.states[selectedState] = { photos: [] };
    }

    if (appData.states[selectedState].photos.length >= 10) {
        alert("Límite alcanzado: Máximo 10 fotos por estado.");
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const MAX_SIZE = 1200;
            let width = img.width;
            let height = img.height;

            if (width > height && width > MAX_SIZE) {
                height *= MAX_SIZE / width;
                width = MAX_SIZE;
            } else if (height > MAX_SIZE) {
                width *= MAX_SIZE / height;
                height = MAX_SIZE;
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            const dataUrl = canvas.toDataURL('image/jpeg', 0.80);
            
            appData.states[selectedState].photos.push({
                base64: dataUrl,
                desc: ""
            });
            
            currentPhotoIndex = appData.states[selectedState].photos.length - 1;
            saveData();
            updateGalleryUI();
            renderMap();
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    event.target.value = '';
}

function deleteCurrentPhoto() {
    if (confirm("¿Seguro que deseas eliminar esta foto?")) {
        appData.states[selectedState].photos.splice(currentPhotoIndex, 1);
        currentPhotoIndex = Math.max(0, currentPhotoIndex - 1);
        saveData();
        updateGalleryUI();
        renderMap();
    }
}

function saveDescription() {
    const text = document.getElementById('desc-editor').value;
    if (appData.states[selectedState] && appData.states[selectedState].photos[currentPhotoIndex]) {
        appData.states[selectedState].photos[currentPhotoIndex].desc = text;
        saveData();
    }
}

// Arrancar
window.onload = init;
