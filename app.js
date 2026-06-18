/**
 * Eating Picker - app.js
 * Core application logic: storage, map, canvas wheel, filtering, sound effects, confetti.
 */

// ==========================================================================
// 1. Initial State & Default Data
// ==========================================================================
const DEFAULT_RESTAURANTS = [
    {
        id: "default-1",
        name: "鼎泰豐 信義店",
        cuisine: "中式, 小籠包",
        price: "3",
        rating: "5",
        lat: 25.0334,
        lng: 121.5301,
        address: "台北市大安區信義路二段194號",
        notes: "黃金十八摺小籠包，排骨炒飯必點。人潮多建議提前排隊。",
        link: "https://www.dintaifung.com.tw/queue/"
    },
    {
        id: "default-2",
        name: "一蘭拉麵 台灣台北本店",
        cuisine: "日式, 拉麵",
        price: "2",
        rating: "4",
        lat: 25.0348,
        lng: 121.5694,
        address: "台北市信義區松仁路97號",
        notes: "豚骨拉麵湯頭濃郁，赤紅秘製醬汁超讚。24小時營業！",
        link: "https://ichiran.com.tw/"
    },
    {
        id: "default-3",
        name: "詹記麻辣火鍋 敦南店",
        cuisine: "火鍋, 麻辣鍋",
        price: "3",
        rating: "5",
        lat: 25.0253,
        lng: 121.5435,
        address: "台北市大安區和平東路三段60號",
        notes: "鴨血豆腐被譽為全台最強，復古霓虹裝潢極有氣氛。",
        link: "https://inline.app/booking/-KpEs6W97l2xV3zPa9S4"
    },
    {
        id: "default-4",
        name: "美而美 經典早餐",
        cuisine: "中式, 早餐",
        price: "1",
        rating: "4",
        lat: 25.0423,
        lng: 121.5132,
        address: "台北市中正區許昌街14號",
        notes: "大冰奶與經典培根蛋吐司，台灣靈魂早餐代表。",
        link: "https://www.foodpanda.com.tw/"
    },
    {
        id: "default-5",
        name: "微風建一食堂",
        cuisine: "日式, 無菜單料理",
        price: "3",
        rating: "4",
        lat: 25.0487,
        lng: 121.5422,
        address: "台北市中山區八德路二段300巷10號",
        notes: "精緻日式居酒屋，食材新鮮，海鮮拼盤非常奢華。",
        link: "https://www.facebook.com/Jian1shi/"
    },
    {
        id: "default-6",
        name: "阿宗麵線",
        cuisine: "台灣小吃, 麵線",
        price: "1",
        rating: "4",
        lat: 25.0431,
        lng: 121.5078,
        address: "台北市萬華區峨眉街8-1號",
        notes: "西門町經典小吃，站著吃也心甘情願，柴魚湯頭濃郁。",
        link: "https://www.ubereats.com/"
    }
];

let restaurants = [];
let lastWinner = null;

// Map & Geolocation variables
let map;
let markersGroup;
let selectedCoordinates = null;
let currentPositionMarker = null;

// Roulette Wheel Canvas State
let canvas, ctx;
let particleCanvas, particleCtx;
let isSpinning = false;
let startAngle = 0;
let spinArcStart = 10;
let spinTime = 0;
let spinTimeTotal = 0;
let rouletteRestaurants = [];
let lastTickAngle = 0;

// 賽車輪胎煙霧粒子系統
let smokeParticles = [];

// Web Audio API Context for synthetic tick sound
let audioCtx = null;

// ==========================================================================
// 2. Initialisation & Lifecycle
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
    // Initialise UI Lucide Icons
    lucide.createIcons();

    // Set header date
    const options = { weekday: 'long', month: 'short', day: 'numeric' };
    document.getElementById('current-date').textContent = new Date().toLocaleDateString('zh-TW', options);

    // Initialise Leaflet Map
    initMap();

    // Initialise Database (async load)
    loadData();

    // Setup Event Listeners
    setupEventListeners();
});

// Load restaurants (Prioritise LocalStorage, fall back to restaurants.json on server)
async function loadData() {
    // 優先檢查瀏覽器的 LocalStorage 是否已有資料
    const localData = localStorage.getItem("eating_picker_restaurants");
    if (localData) {
        try {
            restaurants = JSON.parse(localData);
            updateRestaurantCount();
            refreshUI();
            return;
        } catch (e) {
            console.error("Failed to parse LocalStorage data:", e);
        }
    }

    // 若 LocalStorage 為空，嘗試讀取伺服器上的 restaurants.json
    try {
        const response = await fetch("restaurants.json");
        if (response.ok) {
            const data = await response.json();
            if (data && data.length > 0) {
                restaurants = data;
                localStorage.setItem("eating_picker_restaurants", JSON.stringify(restaurants));
                updateRestaurantCount();
                refreshUI();
                return;
            }
        }
    } catch (e) {
        console.warn("Failed to fetch restaurants.json, loading defaults instead.", e);
    }

    // 最後的備用機制：載入寫在程式碼中的預設名單
    restaurants = [...DEFAULT_RESTAURANTS];
    localStorage.setItem("eating_picker_restaurants", JSON.stringify(restaurants));
    updateRestaurantCount();
    refreshUI();
}

// Save restaurants to both LocalStorage and try to sync to server JSON file if possible
async function saveData(syncWithServer = true) {
    // 先寫入 LocalStorage 確保前端即時保存
    localStorage.setItem("eating_picker_restaurants", JSON.stringify(restaurants));
    updateRestaurantCount();

    if (syncWithServer) {
        try {
            // 如果是在本機執行 Python 服務，這會成功寫入硬碟；如果是在 GitHub Pages 上，則會失敗（被 catch 捕獲）
            await fetch("/api/restaurants", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(restaurants)
            });
        } catch (e) {
            console.log("Failed to sync to server (normal if running on GitHub Pages):", e);
        }
    }
}

function updateRestaurantCount() {
    document.getElementById("restaurant-count").textContent = restaurants.length;
}

// Play a synthetic click/tick sound using Web Audio API
// Play a synthetic click/tick sound using Web Audio API (pitch shifting based on velocity)
function playTickSound(speed = 10) {
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        // Speed is between 0 and 50. Slow speed = less than 0.8
        const isRacing = speed > 20;
        const isSuspenseTick = speed < 0.8;
        
        // Deep engine roar for racing, sharp click for normal
        const pitch = isRacing ? (40 + speed * 1.5) : (isSuspenseTick ? 400 : 750); 
        const duration = isRacing ? 0.05 : (isSuspenseTick ? 0.08 : 0.03);
        
        osc.type = isRacing ? 'sawtooth' : 'sine';
        osc.frequency.setValueAtTime(pitch, audioCtx.currentTime);
        if (!isRacing) osc.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + duration);
        
        // Lowpass filter for engine muffler effect
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(isRacing ? 250 : 20000, audioCtx.currentTime);
        
        osc.disconnect();
        osc.connect(filter);
        filter.connect(gainNode);

        const startGain = isRacing ? 0.4 : (isSuspenseTick ? 0.25 : 0.12);
        gainNode.gain.setValueAtTime(startGain, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
        // Fallback silently if audio context is blocked
    }
}

// Play metallic victory chime arpeggio when winner is selected
function playWinSound() {
    try {
        if (!audioCtx) return;
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 arpeggio
        notes.forEach((freq, idx) => {
            setTimeout(() => {
                const osc = audioCtx.createOscillator();
                const gainNode = audioCtx.createGain();
                
                osc.connect(gainNode);
                gainNode.connect(audioCtx.destination);
                
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
                
                gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
                
                osc.start();
                osc.stop(audioCtx.currentTime + 0.65);
            }, idx * 100);
        });
    } catch (e) {}
}

// 語音語音朗讀輔助函數
function speakText(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); // 停止先前的朗讀
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-TW';
        
        // 尋找中文語音
        const voices = window.speechSynthesis.getVoices();
        const voice = voices.find(v => v.lang.includes('zh-TW') || v.lang.includes('zh-HK') || v.lang.includes('zh-CN'));
        if (voice) {
            utterance.voice = voice;
        }
        window.speechSynthesis.speak(utterance);
    }
}

// ==========================================================================
// 3. Map Component (Leaflet Integration)
// ==========================================================================
function initMap() {
    // Default coordinates center (Taipei Main Station)
    const defaultLat = 25.0423;
    const defaultLng = 121.5132;

    map = L.map('map-container', {
        zoomControl: false, // 停用預設的左上角縮放控制，避免與漂浮標題衝突
        doubleClickZoom: false // Disable to handle custom double click
    }).setView([defaultLat, defaultLng], 14);

    // Modern Dark Mode map tiles: CartoDB Dark Matter
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    // 新增縮放控制於右下角，維持畫面清爽極簡
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // 延遲強制更新地圖尺寸計算，確保全螢幕渲染完全
    setTimeout(() => {
        map.invalidateSize();
    }, 200);

    markersGroup = L.layerGroup().addTo(map);

    // Map Interactivity: Click to open coordinates picker
    map.on('dblclick', (e) => {
        openAddModalWithCoordinates(e.latlng.lat, e.latlng.lng);
    });

    map.on('popupopen', () => {
        lucide.createIcons();
    });
}



// Update Map markers based on filtered restaurants
function updateMapMarkers(filteredList) {
    markersGroup.clearLayers();

    filteredList.forEach(item => {
        if (item.lat && item.lng) {
            // Build rating stars
            const stars = '★'.repeat(parseInt(item.rating)) + '☆'.repeat(5 - parseInt(item.rating));
            const priceSymbol = '$'.repeat(parseInt(item.price));
            
            const popupContent = `
                <div class="map-popup-card">
                    <h3 class="popup-title">${item.name}</h3>
                    <div class="popup-meta">
                        <span class="badge">${item.cuisine}</span>
                        <span class="price-indicator">${priceSymbol}</span>
                        <span style="color: var(--accent-color); font-size: 12px;">${stars}</span>
                    </div>
                    ${item.notes ? `<p class="popup-notes">"${item.notes}"</p>` : ''}
                    <div class="popup-actions">
                        ${item.link ? `<a href="${item.link}" target="_blank" class="btn btn-xs btn-primary"><i data-lucide="shopping-cart" style="width:10px; height:10px; display:inline-block; vertical-align:middle; margin-right:4px;"></i>點餐</a>` : ''}
                        <button onclick="editRestaurant('${item.id}')" class="btn btn-xs btn-outline">編輯</button>
                        <button onclick="spinRouletteWithSingleTarget('${item.id}')" class="btn btn-xs btn-secondary">今天選這家！</button>
                    </div>
                </div>
            `;

            // Custom elegant circle marker
            const marker = L.circleMarker([item.lat, item.lng], {
                radius: 10,
                fillColor: "#6366f1",
                color: "#a855f7",
                weight: 2,
                opacity: 0.8,
                fillOpacity: 0.6
            }).addTo(markersGroup);

            marker.bindPopup(popupContent);
        }
    });
}

// ==========================================================================
// 4. Pocket List & Filtering
// ==========================================================================
function renderRestaurantList(filteredList) {
    const listContainer = document.getElementById("restaurant-list");
    
    if (filteredList.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-state">
                <i data-lucide="store" class="empty-icon"></i>
                <p>找不到符合條件的餐廳</p>
                <button onclick="resetAllFilters()" class="btn btn-sm btn-outline">清除所有篩選</button>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    listContainer.innerHTML = '';
    filteredList.forEach(item => {
        const itemEl = document.createElement("div");
        itemEl.className = "restaurant-item";
        itemEl.dataset.id = item.id;

        const stars = '★'.repeat(parseInt(item.rating));
        const priceStr = '$'.repeat(parseInt(item.price));

        itemEl.innerHTML = `
            <div class="item-info">
                <span class="item-title">${item.name}</span>
                <div class="item-meta">
                    <span class="badge">${item.cuisine}</span>
                    <span class="price-indicator">${priceStr}</span>
                    <span class="item-stars">${stars}</span>
                </div>
                ${item.notes ? `<p class="item-notes">${item.notes}</p>` : ''}
            </div>
            <div class="item-actions">
                ${item.link ? `
                    <a class="btn-item-action order" href="${item.link}" target="_blank" title="線上點餐" style="color: var(--accent-green);">
                        <i data-lucide="shopping-cart" style="width:14px; height:14px;"></i>
                    </a>
                ` : ''}
                ${item.lat && item.lng ? `
                    <button class="btn-item-action locate" onclick="locateRestaurantOnMap('${item.id}')" title="定位地圖">
                        <i data-lucide="map-pin" style="width:14px; height:14px;"></i>
                    </button>
                ` : ''}
                <button class="btn-item-action edit" onclick="openEditModal('${item.id}')" title="編輯">
                    <i data-lucide="edit-3" style="width:14px; height:14px;"></i>
                </button>
                <button class="btn-item-action delete" onclick="deleteRestaurant('${item.id}')" title="刪除">
                    <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
                </button>
            </div>
        `;
        listContainer.appendChild(itemEl);
    });

    lucide.createIcons();
}

function locateRestaurantOnMap(id) {
    const item = restaurants.find(r => r.id === id);
    if (item && item.lat && item.lng) {
        // 解鎖地圖，隱藏輪盤
        document.body.classList.add("map-unlocked");

        // 關閉口袋清單抽屜
        const drawer = document.getElementById("sidebar-drawer");
        if (drawer) {
            drawer.classList.remove("open");
        }

        map.flyTo([item.lat, item.lng], 17, { duration: 1.2 });
        // Find marker to open its popup
        markersGroup.eachLayer(layer => {
            if (layer.getLatLng().lat === item.lat && layer.getLatLng().lng === item.lng) {
                layer.openPopup();
            }
        });
    }
}

function refreshUI() {
    rouletteRestaurants = restaurants;
    renderRestaurantList(restaurants);
    updateMapMarkers(restaurants);
    initCanvasRoulette();
}

// ==========================================================================
// 5. Add / Edit Modal CRUD
// ==========================================================================
function openAddModal() {
    document.getElementById("modal-title").textContent = "新增口袋美食";
    document.getElementById("edit-id").value = "";
    document.getElementById("restaurant-form").reset();
    document.getElementById("star-3").checked = true; // Default 3 stars
    document.getElementById("rt-link").value = "";
    selectedCoordinates = null;
    document.getElementById("rt-latlng").value = "";
    
    // 重設進階設定折疊狀態
    document.getElementById("advanced-form-fields").classList.remove("open");
    document.getElementById("toggle-advanced-btn").textContent = "展開進階設定 ▾";
    
    openModal("restaurant-modal");
}

function openAddModalWithCoordinates(lat, lng) {
    openAddModal();
    selectedCoordinates = { lat, lng };
    document.getElementById("rt-latlng").value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

function openEditModal(id) {
    const item = restaurants.find(r => r.id === id);
    if (!item) return;

    document.getElementById("modal-title").textContent = "編輯餐廳資訊";
    document.getElementById("edit-id").value = item.id;
    document.getElementById("rt-name").value = item.name;
    document.getElementById("rt-cuisine").value = item.cuisine;
    document.getElementById("rt-price").value = item.price;
    document.getElementById(`star-${item.rating}`).checked = true;
    document.getElementById("rt-address").value = item.address || "";
    document.getElementById("rt-link").value = item.link || "";
    document.getElementById("rt-notes").value = item.notes || "";

    if (item.lat && item.lng) {
        selectedCoordinates = { lat: item.lat, lng: item.lng };
        document.getElementById("rt-latlng").value = `${item.lat.toFixed(6)}, ${item.lng.toFixed(6)}`;
    } else {
        selectedCoordinates = null;
        document.getElementById("rt-latlng").value = "";
    }

    // 重設進階設定折疊狀態
    document.getElementById("advanced-form-fields").classList.remove("open");
    document.getElementById("toggle-advanced-btn").textContent = "展開進階設定 ▾";

    openModal("restaurant-modal");
}

function handleFormSubmit(e) {
    e.preventDefault();
    
    const id = document.getElementById("edit-id").value;
    const name = document.getElementById("rt-name").value.trim();
    const cuisine = document.getElementById("rt-cuisine").value.trim() || "未分類";
    const price = document.getElementById("rt-price").value;
    const notes = document.getElementById("rt-notes").value.trim();
    const address = document.getElementById("rt-address").value.trim();
    const link = document.getElementById("rt-link").value.trim();
    
    // Get star rating
    const ratingActive = document.querySelector('input[name="rating"]:checked');
    const rating = ratingActive ? ratingActive.value : "3";

    if (!name) return;

    let targetLat = null;
    let targetLng = null;

    const latlngStr = document.getElementById("rt-latlng").value.trim();
    if (latlngStr) {
        const parts = latlngStr.split(/,|，/);
        if (parts.length === 2) {
            const parsedLat = parseFloat(parts[0].trim());
            const parsedLng = parseFloat(parts[1].trim());
            if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
                targetLat = parsedLat;
                targetLng = parsedLng;
            }
        }
    }

    if (id) {
        // Edit Mode
        const index = restaurants.findIndex(r => r.id === id);
        if (index !== -1) {
            restaurants[index] = {
                ...restaurants[index],
                name, cuisine, price, rating, address, notes, link,
                lat: targetLat, lng: targetLng
            };
        }
    } else {
        // Add Mode
        const newRestaurant = {
            id: Date.now().toString(),
            name, cuisine, price, rating, address, notes, link,
            lat: targetLat, lng: targetLng
        };
        restaurants.push(newRestaurant);
    }

    saveData();
    refreshUI();
    closeModal("restaurant-modal");
}

function deleteRestaurant(id) {
    if (confirm("確定要將這家餐廳從您的口袋清單中移除嗎？")) {
        restaurants = restaurants.filter(r => r.id !== id);
        saveData();
        refreshUI();
    }
}

// Load default preset restaurants
function loadDefaults() {
    if (confirm("載入推薦預設餐廳會與您現有的清單合併，是否繼續？")) {
        // Filter out items already in the list by name to prevent absolute duplicates
        const existingNames = new Set(restaurants.map(r => r.name));
        DEFAULT_RESTAURANTS.forEach(def => {
            if (!existingNames.has(def.name)) {
                restaurants.push({
                    ...def,
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 5)
                });
            }
        });
        saveData();
        refreshUI();
    }
}

// ==========================================================================
// 6. Roulette Canvas & Random Spin Logic
// ==========================================================================
function initCanvasRoulette() {
    canvas = document.getElementById("roulette-canvas");
    ctx = canvas.getContext("2d");
    
    particleCanvas = document.getElementById("particle-canvas");
    particleCtx = particleCanvas.getContext("2d");

    // Make sure we have enough options or insert fallback
    if (rouletteRestaurants.length === 0) {
        rouletteRestaurants = [...DEFAULT_RESTAURANTS];
    }
    
    drawRouletteWheel();
}

// Draw the dynamic roulette sections on canvas
function drawRouletteWheel() {
    if (!canvas) return;
    
    const count = rouletteRestaurants.length;
    const arc = Math.PI * 2 / count;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const outsideRadius = 175;
    const textRadius = 120;
    const insideRadius = 45;
    
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    
    // Dynamic palette
    const colors = [
        "#6366f1", "#4f46e5", "#8b5cf6", "#7c3aed", 
        "#a855f7", "#9333ea", "#ec4899", "#db2777"
    ];
    
    for (let i = 0; i < count; i++) {
        const angle = startAngle + i * arc;
        ctx.fillStyle = colors[i % colors.length];
        
        ctx.beginPath();
        ctx.arc(cx, cy, outsideRadius, angle, angle + arc, false);
        ctx.arc(cx, cy, insideRadius, angle + arc, angle, true);
        ctx.fill();
        ctx.strokeStyle = "rgba(15, 23, 42, 0.4)";
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Save state for text draw
        ctx.save();
        ctx.fillStyle = "#ffffff";
        ctx.translate(cx + Math.cos(angle + arc / 2) * textRadius, cy + Math.sin(angle + arc / 2) * textRadius);
        ctx.rotate(angle + arc / 2 + Math.PI / 2);
        
        const text = rouletteRestaurants[i].name;
        ctx.font = 'bold 12px Outfit, Noto Sans TC';
        
        // Truncate long names
        let renderText = text;
        if (renderText.length > 7) {
            renderText = renderText.slice(0, 6) + '...';
        }
        
        ctx.fillText(renderText, -ctx.measureText(renderText).width / 2, 0);
        ctx.restore();
    }
    
    // Draw Center Circle
    ctx.beginPath();
    ctx.arc(cx, cy, insideRadius, 0, Math.PI * 2, false);
    ctx.fillStyle = "#1e293b";
    ctx.strokeStyle = "#a855f7";
    ctx.lineWidth = 4;
    ctx.fill();
    ctx.stroke();
    
    // Draw central text/icon inside the center circle
    ctx.fillStyle = "#ffffff";
    ctx.font = 'bold 14px Outfit, Noto Sans TC';
    ctx.fillText("選什麼", cx - ctx.measureText("選什麼").width / 2, cy + 5);
}

// Wobble pointer when slice segment passes under it (simulating mechanical peg hits)
function wobblePointer() {
    const pointer = document.querySelector(".wheel-pointer");
    if (!pointer) return;
    pointer.style.transform = "translateX(-50%) rotate(-18deg)";
    setTimeout(() => {
        pointer.style.transform = "translateX(-50%) rotate(0deg)";
    }, 55);
}

// Trigger modal content vibration on win climax
function triggerScreenShake() {
    const content = document.querySelector("#roulette-modal .modal-content");
    if (!content) return;
    content.classList.add("shake");
    setTimeout(() => {
        content.classList.remove("shake");
    }, 350);
}

// 賽車輪胎燒胎煙霧粒子類別
class BurnoutParticle {
    constructor(x, y, vx, vy, type = 'smoke') {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.type = type; // 'smoke', 'rubber', 'spark'
        this.life = 0;
        
        if (type === 'smoke') {
            this.size = Math.random() * 5 + 4; // 初始尺寸較小
            this.maxSize = Math.random() * 20 + 25; // 膨脹後尺寸 (25~45px)
            this.alpha = Math.random() * 0.35 + 0.35; // 初始透明度 (0.35 ~ 0.70)
            this.maxLife = Math.random() * 30 + 55; // 存活幀數 (55~85幀，煙霧長度加倍)
            // 隨機灰白輪胎焦煙色調
            const gray = Math.floor(Math.random() * 25) + 210; // 210 ~ 235
            this.colorBase = `rgba(${gray}, ${gray}, ${gray},`;
        } else if (type === 'rubber') {
            this.size = Math.random() * 2 + 1; // 1 ~ 3px 橡膠屑
            this.alpha = Math.random() * 0.6 + 0.4;
            this.maxLife = Math.random() * 30 + 20;
            this.colorBase = `rgba(15, 23, 42,`; // 極黑灰橡膠
        } else if (type === 'spark') {
            this.size = Math.random() * 1.5 + 1; // 1 ~ 2.5px 火花
            this.alpha = 1.0;
            this.maxLife = Math.random() * 12 + 6; // 火花短暫
            const greenVal = Math.floor(Math.random() * 120) + 100; // 亮黃/橘紅色
            this.colorBase = `rgba(251, ${greenVal}, 35,`;
        }
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life++;

        if (this.type === 'smoke') {
            // 阻力減速 (衰減變慢，煙霧飛得更遠更長)
            this.vx *= 0.958;
            this.vy *= 0.958;
            
            // 煙霧熱對流：微幅向上漂移 (模擬真實焦黑輪胎煙霧緩緩升空)
            this.vy -= 0.06;
            
            // 煙霧緩慢膨脹，限制最大半徑防止單一雲霧過大
            if (this.size < this.maxSize) {
                this.size += 0.45;
            }
            this.alpha = Math.max(0, (1 - this.life / this.maxLife) * 0.45);
        } else if (this.type === 'rubber') {
            // 橡膠碎屑受重力影響掉落
            this.vy += 0.22;
            this.vx *= 0.97;
            this.vy *= 0.97;
            this.alpha = Math.max(0, 1 - this.life / this.maxLife);
        } else if (this.type === 'spark') {
            // 火花極速衰減
            this.vx *= 0.91;
            this.vy *= 0.91;
            this.vy += 0.06;
            this.alpha = Math.max(0, 1 - this.life / this.maxLife);
        }
    }

    draw(ctx) {
        ctx.save();
        
        if (this.type === 'smoke') {
            ctx.beginPath();
            const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
            grad.addColorStop(0, this.colorBase + `${this.alpha})`);
            grad.addColorStop(0.35, this.colorBase + `${this.alpha * 0.7})`);
            grad.addColorStop(0.7, this.colorBase + `${this.alpha * 0.15})`);
            grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
            
            ctx.fillStyle = grad;
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'rubber') {
            ctx.beginPath();
            ctx.fillStyle = this.colorBase + `${this.alpha})`;
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'spark') {
            ctx.shadowBlur = 6;
            ctx.shadowColor = '#fb923c';
            ctx.beginPath();
            ctx.fillStyle = this.colorBase + `${this.alpha})`;
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    }
}

// 產生賽車胎煙粒子 (僅在輪盤下方 6 點鐘接觸點)
function spawnBurnoutParticles(speed) {
    if (speed < 1.5) return; // 轉速過慢停止產生
    
    const cx = 400; // Centered relative to 800x800 particle canvas
    const cy = 400; // Centered relative to 800x800 particle canvas
    const r = 175;
    
    // 輪盤正下方接觸點 (6 點鐘方向)
    const bx = cx;
    const by = cy + r;
    
    // 根據轉速計算產生的粒子數量 (速度越快，煙霧越濃)
    const smokeCount = Math.floor(speed / 4.5) + 1;
    for (let i = 0; i < smokeCount; i++) {
        // 在輪盤下方接觸點微幅隨機偏差
        const px = bx + (Math.random() - 0.5) * 35;
        const py = by - 8 + (Math.random() - 0.5) * 6; // 稍微往上一點，避免貼齊邊緣
        
        // 切線速度為向左 (順時針旋轉在最下方是向左移動)
        const tangentSpeed = speed * 0.18;
        const vx = -tangentSpeed - (Math.random() * 2);
        const vy = (Math.random() - 0.5) * 1.5 - 0.5; // 稍微向上與左右飄散
        
        smokeParticles.push(new BurnoutParticle(px, py, vx, vy, 'smoke'));
        
        // 高速磨擦時甩出橡膠碎屑 (向左下方噴出)
        if (Math.random() < 0.22 && speed > 10) {
            smokeParticles.push(new BurnoutParticle(
                px,
                py,
                -tangentSpeed * 1.4 - (Math.random() * 2),
                Math.random() * 2.5, // 偏向下噴射
                'rubber'
            ));
        }
        
        // 極高速時磨擦起火花 (向左方噴射)
        if (Math.random() < 0.25 && speed > 18) {
            smokeParticles.push(new BurnoutParticle(
                px,
                py,
                -tangentSpeed * 1.6 - (Math.random() * 3),
                (Math.random() - 0.5) * 3.5,
                'spark'
            ));
        }
    }
}

// 更新與繪製粒子系統
function updateAndDrawParticles() {
    if (!particleCanvas || !particleCtx) return;
    
    // 清空粒子畫布
    particleCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
    
    // 更新粒子，並過濾死亡粒子
    smokeParticles.forEach(p => p.update());
    smokeParticles = smokeParticles.filter(p => p.life < p.maxLife);
    
    // 繪製粒子 (一般混合模式，符合厚重濃煙的質感)
    smokeParticles.forEach(p => p.draw(particleCtx));
}

// Dynamic spinning animation loop
function rotateWheel() {
    let continueLoop = false;
    
    if (isSpinning) {
        spinTime += 30;
        if (spinTime >= spinTimeTotal) {
            stopRotateWheel(); // Sets isSpinning = false
        }
    }
    
    if (isSpinning || smokeParticles.length > 0) {
        continueLoop = true;
    }
    
    if (isSpinning) {
        // Easing out quadratic function
        const spinAngleStart = spinArcStart - (easeOut(spinTime, 0, spinArcStart, spinTimeTotal));
        startAngle += (spinAngleStart * Math.PI / 180);
        drawRouletteWheel();
        
        // 產生賽車燒胎煙霧與碎屑
        spawnBurnoutParticles(spinAngleStart);
        
        // Dynamic Racing Visual Effects
        const canvas = document.getElementById("roulette-canvas");
        if (spinAngleStart > 10) {
            canvas.classList.add("wheel-racing-dynamic");
            
            // Map speed to blur and shake amount
            const intensity = Math.min((spinAngleStart - 10) / 30, 1); // 0 to 1
            canvas.style.setProperty('--spin-blur', `${intensity * 4}px`);
            canvas.style.setProperty('--spin-glow', `${intensity * 40}px`);
            canvas.style.setProperty('--spin-shake-x', `${(Math.random() - 0.5) * intensity * 8}px`);
            canvas.style.setProperty('--spin-shake-y', `${(Math.random() - 0.5) * intensity * 8}px`);
        } else {
            canvas.classList.remove("wheel-racing-dynamic");
            canvas.style.removeProperty('--spin-blur');
            canvas.style.removeProperty('--spin-glow');
            canvas.style.removeProperty('--spin-shake-x');
            canvas.style.removeProperty('--spin-shake-y');
        }
        
        // Tick sound based on segment crossings
        const count = rouletteRestaurants.length;
        const arc = Math.PI * 2 / count;
        const currentSegmentAngle = Math.floor(startAngle / arc);
        if (currentSegmentAngle !== lastTickAngle) {
            playTickSound(spinAngleStart);
            wobblePointer();
            if (spinAngleStart > 20) {
                const pointer = document.querySelector(".wheel-pointer");
                pointer.classList.add("pointer-spark");
                setTimeout(() => pointer.classList.remove("pointer-spark"), 30);
            }
            lastTickAngle = currentSegmentAngle;
        }
    } else {
        // 停止旋轉時，僅重繪靜止輪盤以覆蓋上一幀的畫面，然後在上面繪製剩餘煙霧
        drawRouletteWheel();
    }
    
    // 更新並繪製所有粒子
    if (smokeParticles.length > 0) {
        updateAndDrawParticles();
    }
    
    if (continueLoop) {
        requestAnimationFrame(rotateWheel);
    }
}

function easeOut(t, b, c, d) {
    const ts = (t /= d) * t;
    const tc = ts * t;
    return b + c * (tc + -3 * ts + 3 * t);
}

function startSpin() {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
    if (rouletteRestaurants.length === 0) {
        alert("目前清單中沒有符合條件的餐廳可供輪盤抽取！請調整篩選器。");
        return;
    }

    if (isSpinning) {
        // Boost the spin! (Add time and speed)
        spinTimeTotal += 2500; // Add 2.5 seconds
        spinArcStart += 8; // Boost speed
        
        // Cap max speed and time
        if (spinArcStart > 50) spinArcStart = 50;
        if (spinTimeTotal - spinTime > 15000) spinTimeTotal = spinTime + 15000;
        
        // Visual feedback on the button
        const btn = document.getElementById("spin-btn");
        if (btn) {
            btn.style.transform = "scale(0.9)";
            setTimeout(() => btn.style.transform = "none", 100);
        }
        return;
    }
    
    // 確保收回得獎卡片與重新鎖定地圖
    document.body.classList.remove("map-unlocked");
    const slideCard = document.getElementById("winner-slide-card");
    if (slideCard) {
        slideCard.classList.remove("active");
        slideCard.classList.add("hidden");
    }
    
    // 清空舊煙霧粒子與畫布
    smokeParticles = [];
    if (particleCanvas && particleCtx) {
        particleCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
    }
    
    isSpinning = true;
    spinTime = 0;
    spinArcStart = Math.random() * 20 + 30; // Initial speed
    spinTimeTotal = Math.random() * 4000 + 6000; // Duration 6-10 seconds
    
    rotateWheel();
}

function stopRotateWheel() {
    isSpinning = false;
    const canvas = document.getElementById("roulette-canvas");
    canvas.classList.remove("wheel-racing-dynamic");
    canvas.style.removeProperty('--spin-blur');
    canvas.style.removeProperty('--spin-glow');
    canvas.style.removeProperty('--spin-shake-x');
    canvas.style.removeProperty('--spin-shake-y');
    
    // Play winning celebration arpeggio
    playWinSound();
    
    // Trigger screen rumble shake
    triggerScreenShake();
    
    const count = rouletteRestaurants.length;
    const arc = Math.PI * 2 / count;
    
    // The pointer points downwards or upwards? 
    // In our style pointer is at the very top: Angle = 3/2 * Math.PI (or -Math.PI / 2)
    // Wheel rotates clockwise. Segment angle resolves counterclockwise relative to startAngle.
    const degrees = startAngle * 180 / Math.PI + 90;
    const arcd = arc * 180 / Math.PI;
    const index = Math.floor((360 - (degrees % 360)) / arcd) % count;
    
    // Edge case correction
    const selectedItem = rouletteRestaurants[index < 0 ? count + index : index];
    
    // Show Selection Result
    showWinner(selectedItem);
}

function showWinner(item) {
    lastWinner = item;
    const title = document.getElementById("result-title");
    const cuisine = document.getElementById("result-cuisine");
    const price = document.getElementById("result-price");
    const rating = document.getElementById("result-rating");
    const address = document.getElementById("result-address");
    const notes = document.getElementById("result-notes");
    
    title.textContent = item.name;
    cuisine.textContent = item.cuisine;
    price.textContent = '$'.repeat(parseInt(item.price));
    rating.textContent = '★'.repeat(parseInt(item.rating)) + '☆'.repeat(5 - parseInt(item.rating));
    
    if (item.address) {
        address.innerHTML = `<i data-lucide="map-pin" style="width:12px; height:12px;"></i> ${item.address}`;
    } else {
        address.textContent = "";
    }
    
    if (item.notes) {
        notes.textContent = `"${item.notes}"`;
        notes.classList.remove("hidden");
    } else {
        notes.classList.add("hidden");
    }

    // Toggle Order Link Button
    const orderBtn = document.getElementById("result-order-btn");
    if (item.link) {
        orderBtn.href = item.link;
        orderBtn.classList.remove("hidden");
    } else {
        orderBtn.classList.add("hidden");
    }

    // 解鎖地圖遮罩，並顯示底部中獎卡片
    document.body.classList.add("map-unlocked");
    const slideCard = document.getElementById("winner-slide-card");
    slideCard.classList.remove("hidden");
    setTimeout(() => {
        slideCard.classList.add("active");
    }, 50);

    // 朗讀餐廳名稱
    speakText(`恭喜抽中：${item.name}`);

    lucide.createIcons();

    // Trigger premium Confetti Burst!
    const duration = 2 * 1000;
    const end = Date.now() + duration;

    (function frame() {
        confetti({
            particleCount: 3,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: ['#6366f1', '#a855f7', '#fb7185'],
            zIndex: 9999
        });
        confetti({
            particleCount: 3,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: ['#6366f1', '#a855f7', '#fb7185'],
            zIndex: 9999
        });

        if (Date.now() < end) {
            requestAnimationFrame(frame);
        }
    }());

    // 自動平滑定位地圖至得獎餐廳並開啟 Popup
    if (item.lat && item.lng) {
        setTimeout(() => {
            locateRestaurantOnMap(item.id);
        }, 700);
    }

    // 綁定地圖定位按鈕
    const locateBtn = document.getElementById("result-locate-btn");
    if (locateBtn) {
        if (item.lat && item.lng) {
            locateBtn.style.display = "inline-flex";
            locateBtn.onclick = () => {
                locateRestaurantOnMap(item.id);
            };
        } else {
            locateBtn.style.display = "none";
        }
    }
}

// Allows direct single-target showcase
window.spinRouletteWithSingleTarget = function(id) {
    const target = restaurants.find(r => r.id === id);
    if (!target) return;
    
    // Force wheel to target
    rouletteRestaurants = [target];
    drawRouletteWheel();
    
    // Instantly select
    showWinner(target);
};

// ==========================================================================
// 7. Modals Helper & UI Event Bindings
// ==========================================================================
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add("open");
        if (modalId === "roulette-modal") {
            // Draw when modal renders so layout is correct
            setTimeout(initCanvasRoulette, 100);
        }
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove("open");
    }
}

function resetFromWinnerCard() {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
    const slideCard = document.getElementById("winner-slide-card");
    if (slideCard) {
        slideCard.classList.remove("active");
        setTimeout(() => {
            slideCard.classList.add("hidden");
        }, 500);
    }
    document.body.classList.remove("map-unlocked");
    
    // 恢復輪盤的備選池為所有餐廳，並重繪輪盤
    rouletteRestaurants = restaurants;
    drawRouletteWheel();
}

function setupEventListeners() {
    // Modal Close buttons
    document.querySelectorAll(".close-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const mId = btn.getAttribute("data-modal");
            closeModal(mId);
        });
    });

    // Outer click modal & drawer close
    window.addEventListener("click", (e) => {
        if (e.target.classList.contains("modal")) {
            closeModal(e.target.id);
        }
        
        // 點擊口袋清單抽屜外部時自動收合抽屜
        const drawer = document.getElementById("sidebar-drawer");
        const toggleBtn = document.getElementById("toggle-drawer-btn");
        if (drawer && drawer.classList.contains("open") && !drawer.contains(e.target) && !toggleBtn.contains(e.target)) {
            drawer.classList.remove("open");
        }
    });

    // Pocket List Side Drawer Toggle
    document.getElementById("toggle-drawer-btn").addEventListener("click", () => {
        const drawer = document.getElementById("sidebar-drawer");
        if (drawer) {
            drawer.classList.add("open");
        }
    });
    document.getElementById("close-drawer-btn").addEventListener("click", () => {
        const drawer = document.getElementById("sidebar-drawer");
        if (drawer) {
            drawer.classList.remove("open");
        }
    });

    // Winner Slide Card Close
    document.getElementById("close-winner-card-btn").addEventListener("click", resetFromWinnerCard);

    // Return to Wheel Button Click
    document.getElementById("show-wheel-btn").addEventListener("click", resetFromWinnerCard);

    // Add/Edit Form Advanced Fields Toggle
    document.getElementById("toggle-advanced-btn").addEventListener("click", (e) => {
        const advFields = document.getElementById("advanced-form-fields");
        const btn = e.target;
        if (advFields.classList.contains("open")) {
            advFields.classList.remove("open");
            btn.textContent = "展開進階設定 ▾";
        } else {
            advFields.classList.add("open");
            btn.textContent = "收合進階設定 ▴";
        }
    });

    // Add Restaurant Dialog Trigger
    document.getElementById("add-restaurant-btn").addEventListener("click", openAddModal);

    // Form Submission
    document.getElementById("restaurant-form").addEventListener("submit", handleFormSubmit);

    // Spin button clicks
    document.getElementById("spin-btn").addEventListener("click", startSpin);
    document.getElementById("respin-btn").addEventListener("click", () => {
        // 先收回中獎卡片與重新鎖定地圖，再開始旋轉
        document.body.classList.remove("map-unlocked");
        const slideCard = document.getElementById("winner-slide-card");
        if (slideCard) {
            slideCard.classList.remove("active");
            slideCard.classList.add("hidden");
        }
        startSpin();
    });

    // Coordinates Picker Tool
    document.getElementById("pick-coords-btn").addEventListener("click", () => {
        alert("請在地圖上雙擊 (Double Click) 想要選取的餐廳位置，將會自動載入座標！");
        closeModal("restaurant-modal");
    });



    // Preset Load button
    const loadDefaultsBtn = document.getElementById("load-defaults-btn");
    if (loadDefaultsBtn) {
        loadDefaultsBtn.addEventListener("click", loadDefaults);
    }

    // Winner Share / Send to Phone Panel
    const shareBtn = document.getElementById("result-share-btn");
    if (shareBtn) {
        shareBtn.addEventListener("click", () => {
            if (lastWinner) {
                openShareModal(lastWinner);
            }
        });
    }


    // Native Share
    const shareNativeBtn = document.getElementById("share-native-btn");
    if (shareNativeBtn) {
        shareNativeBtn.addEventListener("click", () => {
            if (lastWinner && navigator.share) {
                const mapsUrl = generateMapsUrl(lastWinner);
                const shareText = `今天吃這家！\n🍴 餐廳：${lastWinner.name}\n🏷️ 料理：${lastWinner.cuisine}\n⭐ 評分：${'★'.repeat(parseInt(lastWinner.rating))}\n📍 地址：${lastWinner.address || '無'}\n🔗 地圖與導航：${mapsUrl}`;
                navigator.share({
                    title: lastWinner.name,
                    text: shareText,
                    url: mapsUrl
                }).catch(err => {
                    console.log("Error sharing", err);
                });
            }
        });
    }
}

// Global hookups for inline onclick calls in Popups & Lists
window.editRestaurant = openEditModal;
window.locateRestaurantOnMap = locateRestaurantOnMap;
window.deleteRestaurant = deleteRestaurant;
window.loadDefaults = loadDefaults;

// ==========================================================================
// 8. Sharing & Send to Phone Functions
// ==========================================================================
function generateMapsUrl(item) {
    if (item.lat && item.lng) {
        return `https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}`;
    } else if (item.address) {
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.name + ' ' + item.address)}`;
    } else {
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.name)}`;
    }
}

function openShareModal(item) {
    const mapsUrl = generateMapsUrl(item);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(mapsUrl)}`;
    
    const qrImg = document.getElementById("qr-code-img");
    const qrShimmer = document.getElementById("qr-shimmer");
    const qrSection = document.getElementById("qr-code-section");
    
    // Check if mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
    if (isMobile) {
        qrSection.style.display = "none";
    } else {
        qrSection.style.display = "flex";
        
        // Dynamic loading Shimmer effect
        qrImg.classList.add("hidden");
        qrShimmer.classList.remove("hidden");
        
        qrImg.onload = () => {
            qrShimmer.classList.add("hidden");
            qrImg.classList.remove("hidden");
        };
        qrImg.src = qrUrl;
    }
    
    // Toggle system native share button
    const nativeShareBtn = document.getElementById("share-native-btn");
    if (navigator.share) {
        nativeShareBtn.classList.remove("hidden");
    } else {
        nativeShareBtn.classList.add("hidden");
    }
    
    openModal("share-modal");
}

