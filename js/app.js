import {
  PROPERTY_META,
  MAGICPLAN_FLOORS,
  DEFAULT_REHAB_ITEMS,
  TELEPORT_SPOTS,
  getMagicplanUrl,
} from "./property-data.js";
import { PropertyScene3D } from "./scene3d.js";

const STORAGE_KEY = "rehab_1733_sara_ct_v3";

let rehabItems = loadRehabItems();
let activeRehabId = null;
let currentSpotId = "tp-living";
let leafletMap = null;
let satLayer = null;
let streetLayer = null;

// DOM Elements
const canvasContainer = document.getElementById("canvas-container");
const leftHud = document.getElementById("left-hud");
const bottomBanner = document.getElementById("bottom-banner");
const fpTeleportBar = document.getElementById("fp-teleport-bar");
const fpSpotsBar = document.getElementById("fp-spots-bar");
const teleportSelect = document.getElementById("teleport-select");
const overlayMagicplan = document.getElementById("overlay-magicplan");
const overlayMaps = document.getElementById("overlay-maps");
const selectedRoomCard = document.getElementById("selected-room-card");
const rehabListEl = document.getElementById("rehab-list");
const totalBudgetEl = document.getElementById("total-budget");
const includedCountEl = document.getElementById("included-count");
const toastEl = document.getElementById("toast");

// Initialize external links & Magicplan launchpad
document.getElementById("link-streetview").href = PROPERTY_META.googleStreetViewUrl;
document.getElementById("link-earth").href = PROPERTY_META.googleEarthUrl;
document.getElementById("link-gmaps").href = PROPERTY_META.googleMapsPlaceUrl;
document.getElementById("mp-all-photos-link").href = getMagicplanUrl("main", "photos");
renderMagicplanLaunchpad();

// Initialize 3D Scene
const scene3d = new PropertyScene3D(canvasContainer, {
  onSelectRoom: (room) => showRoomInspector(room),
  onSelectPano: (pano) => showPanoInspector(pano),
  onSelectRehab: (item) => selectRehabItem(item.id, false),
  onTeleport: (spot) => updateTeleportUI(spot),
});

scene3d.syncRehabPins(rehabItems);
initTeleportControls();
renderRehabList();

// === Before vs. After Rehab 3D State Toggle ===
document.querySelectorAll("[data-rehab-state]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const isAfter = btn.dataset.rehabState === "after";
    document.querySelectorAll("[data-rehab-state]").forEach((b) => {
      b.classList.toggle("active", b === btn);
    });
    scene3d.setRehabPreviewMode(isAfter);
    showToast(
      isAfter
        ? "✨ After-Rehab 3D Preview: In-Law Suite + Mini-Split, White Shaker/Granite Kitchen, Extended Primary Shower & Clean Exterior!"
        : "🔧 As-Is Condition: Raw Garage Conv. Orientation, Curtain Rods, Exposed Plumbing/Panel, Falling Crawl Insulation & Downspout Bucket"
    );
  });
});

// === Eye-Level Room Teleporter Setup ===
function initTeleportControls() {
  teleportSelect.innerHTML = `<option value="">-- Choose a Room to Drop In --</option>`;
  fpSpotsBar.innerHTML = "";

  TELEPORT_SPOTS.forEach((spot) => {
    const opt = document.createElement("option");
    opt.value = spot.id;
    opt.textContent = spot.label;
    teleportSelect.appendChild(opt);

    const pill = document.createElement("button");
    pill.className = `pill ${spot.id === currentSpotId ? "active" : ""}`;
    pill.dataset.spotId = spot.id;
    pill.textContent = spot.label;
    pill.addEventListener("click", () => {
      currentSpotId = spot.id;
      switchMainMode("walkthrough", spot.id);
    });
    fpSpotsBar.appendChild(pill);
  });

  teleportSelect.addEventListener("change", (e) => {
    if (!e.target.value) return;
    currentSpotId = e.target.value;
    switchMainMode("walkthrough", currentSpotId);
  });
}

function updateTeleportUI(spot) {
  currentSpotId = spot.id;
  teleportSelect.value = spot.id;
  document.querySelectorAll("#fp-spots-bar .pill").forEach((p) => {
    p.classList.toggle("active", p.dataset.spotId === spot.id);
  });
  document.getElementById("wall-slider").value = 100;
  document.getElementById("wall-val").textContent = "100%";
  document.getElementById("explode-slider").value = 0;
  document.getElementById("explode-val").textContent = "0%";
}

// === Mode Tabs ===
document.querySelectorAll(".mode-tab").forEach((btn) => {
  btn.addEventListener("click", () => switchMainMode(btn.dataset.mode));
});

function switchMainMode(mode, spotId = currentSpotId) {
  document.querySelectorAll(".mode-tab").forEach((b) => {
    b.classList.toggle("active", b.dataset.mode === mode);
  });

  overlayMagicplan.classList.toggle("visible", mode === "magicplan");
  overlayMaps.classList.toggle("visible", mode === "maps");

  const is3D = mode === "dollhouse" || mode === "walkthrough";
  leftHud.style.display = is3D ? "flex" : "none";
  bottomBanner.style.display = is3D ? "block" : "none";
  fpTeleportBar.classList.toggle("visible", mode === "walkthrough");

  if (mode === "dollhouse") {
    scene3d.setWalkthroughMode(false);
    document.getElementById("wall-slider").value = 68;
    document.getElementById("wall-val").textContent = "68%";
    teleportSelect.value = "";
    bottomBanner.innerHTML =
      "<strong>Dollhouse Controls:</strong> Left-drag to orbit • Right-drag to pan • Scroll to zoom • Toggle <strong>🔧 As-Is / ✨ After Rehab</strong> in the top bar to preview Andrew &amp; Kabe's renovation!";
  } else if (mode === "walkthrough") {
    const extToggle = document.getElementById("toggle-exterior");
    extToggle.checked = false;
    scene3d.setExteriorVisible(false);
    scene3d.setWalkthroughMode(true, spotId);
    bottomBanner.innerHTML =
      "<strong>First-Person Walk (Eye Level 5.5'):</strong> Use <strong>W A S D</strong> or Arrow keys to walk through doorways • <strong>Q / E</strong> down/up • <strong>Click &amp; drag</strong> to look around • Use the top bar to teleport rooms or toggle <strong>✨ After Rehab</strong>!";
  } else if (mode === "maps") {
    initLeafletMap();
  }
}

function renderMagicplanLaunchpad() {
  const grid = document.getElementById("mp-launchpad-grid");
  if (!grid) return;
  grid.innerHTML = "";

  const notesByFloor = {
    upstairs: "5 panoramas (#1–#5): Primary Bed (needs closet), Primary Bath (6-drawer vanity & extended shower), Hall Bath (missing vanity), Beds 2 & 3 (mismatched fans).",
    main: "3 panoramas (#6–#8): Rear Deck/Balcony, Kitchen (same layout + shaker/granite), Living Room (curtains out, laundry studs/GFCI) + Dining lights/LVP.",
    garage: "4 panoramas (#9–#12, Magicplan Page 26): Front-Right Driveway Room (#10 → Open Kitchenette), Front-Left Bed (#11 + closet), Back-Right Living (#12 + Mini-Split), Back-Left Bath (#9).",
    crawl: "2 panoramas + 4 photos (Pages 37–40): Rear (-Z) door under deck + water heater next to door, ~10% falling insulation & wood/drywall/trash debris.",
  };

  Object.values(MAGICPLAN_FLOORS).forEach((fl) => {
    const card = document.createElement("div");
    card.className = "mp-floor-card";
    card.innerHTML = `
      <h3><span class="dot" style="background:${fl.color}; width:10px; height:10px;"></span> ${fl.label}</h3>
      <div class="mp-floor-meta">${fl.sqFt} • Ceiling: ${fl.ceiling}</div>
      <div style="font-size:12px; color:#cbd5e1; line-height:1.45;">${notesByFloor[fl.id] || ""}</div>
      <div class="mp-btn-row">
        <a class="btn btn-primary btn-sm" href="${getMagicplanUrl(fl.id, "360")}" target="_blank" rel="noopener">🌐 360° Panoramas</a>
        <a class="btn btn-sm" href="${getMagicplanUrl(fl.id, "3d")}" target="_blank" rel="noopener">🧊 Magicplan 3D</a>
        <a class="btn btn-sm" href="${getMagicplanUrl(fl.id, "2d")}" target="_blank" rel="noopener">📐 2D Floorplan</a>
        <a class="btn btn-sm" href="${getMagicplanUrl(fl.id, "photos")}" target="_blank" rel="noopener">🖼️ Photos List</a>
      </div>
    `;
    grid.appendChild(card);
  });
}

function initLeafletMap() {
  if (!window.L) return;
  if (!leafletMap) {
    leafletMap = L.map("leaflet-map", {
      center: [PROPERTY_META.lat, PROPERTY_META.lng],
      zoom: 19,
      maxZoom: 20,
    });

    satLayer = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 20, attribution: "Esri World Imagery" }
    ).addTo(leafletMap);

    streetLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 20,
      attribution: "&copy; OpenStreetMap contributors",
    });

    L.marker([PROPERTY_META.lat, PROPERTY_META.lng])
      .addTo(leafletMap)
      .bindPopup(
        `<strong>1733 Sara Ct SE</strong><br/>Conyers, GA 30013<br/><a href="${PROPERTY_META.googleStreetViewUrl}" target="_blank">Open Street View ↗</a> | <a href="${PROPERTY_META.googleEarthUrl}" target="_blank">Google Earth 3D ↗</a>`
      )
      .openPopup();

    document.getElementById("btn-map-sat").addEventListener("click", (e) => {
      if (!leafletMap.hasLayer(satLayer)) leafletMap.addLayer(satLayer);
      if (leafletMap.hasLayer(streetLayer)) leafletMap.removeLayer(streetLayer);
      e.target.classList.add("active");
      document.getElementById("btn-map-street").classList.remove("active");
    });

    document.getElementById("btn-map-street").addEventListener("click", (e) => {
      if (!leafletMap.hasLayer(streetLayer)) leafletMap.addLayer(streetLayer);
      if (leafletMap.hasLayer(satLayer)) leafletMap.removeLayer(satLayer);
      e.target.classList.add("active");
      document.getElementById("btn-map-sat").classList.remove("active");
    });
  } else {
    setTimeout(() => leafletMap.invalidateSize(), 120);
  }
}

// === Left HUD 3D Controls ===
document.getElementById("toggle-exterior").addEventListener("change", (e) => {
  scene3d.setExteriorVisible(e.target.checked);
});

document.querySelectorAll(".floor-toggle").forEach((cb) => {
  cb.addEventListener("change", (e) => {
    scene3d.setFloorVisible(e.target.dataset.floor, e.target.checked);
  });
});

document.querySelectorAll("[data-solo]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const targetFloor = btn.dataset.solo;
    document.getElementById("toggle-exterior").checked = false;
    scene3d.setExteriorVisible(false);

    document.querySelectorAll(".floor-toggle").forEach((cb) => {
      const show = cb.dataset.floor === targetFloor;
      cb.checked = show;
      scene3d.setFloorVisible(cb.dataset.floor, show);
    });
    scene3d.focusPoint(targetFloor, targetFloor === "main" || targetFloor === "crawl" ? -10 : 12, 0);
  });
});

document.getElementById("btn-show-all").addEventListener("click", () => {
  document.getElementById("toggle-exterior").checked = true;
  scene3d.setExteriorVisible(true);
  document.querySelectorAll(".floor-toggle").forEach((cb) => {
    cb.checked = true;
    scene3d.setFloorVisible(cb.dataset.floor, true);
  });
  scene3d.setCameraPreset("dollhouse");
});

const explodeSlider = document.getElementById("explode-slider");
const explodeVal = document.getElementById("explode-val");
explodeSlider.addEventListener("input", (e) => {
  const v = Number(e.target.value);
  explodeVal.textContent = `${v}%`;
  scene3d.setExplodeFactor(v / 100);
});

const wallSlider = document.getElementById("wall-slider");
const wallVal = document.getElementById("wall-val");
wallSlider.addEventListener("input", (e) => {
  const v = Number(e.target.value);
  wallVal.textContent = `${v}%`;
  scene3d.setWallCutaway(v / 100);
});

document.querySelectorAll("[data-cam]").forEach((btn) => {
  btn.addEventListener("click", () => {
    switchMainMode("dollhouse");
    scene3d.setCameraPreset(btn.dataset.cam);
  });
});

// === Room & 360° Inspector ===
function showRoomInspector(room) {
  const fl = MAGICPLAN_FLOORS[room.floor];
  const url360 = getMagicplanUrl(room.floor, "360");
  selectedRoomCard.innerHTML = `
    <h4>📍 ${room.name} <span style="font-weight:400; color:var(--muted);">(${fl.label})</span></h4>
    <p style="margin-bottom:6px;"><strong>Dimensions:</strong> ${room.dims} • <strong>Ceiling:</strong> ${fl.ceiling}</p>
    <p style="margin-bottom:8px;">${room.notes}</p>
    <div style="display:flex; gap:6px; flex-wrap:wrap;">
      <button class="btn btn-primary btn-sm" id="inspect-open-360">🌐 Open ${fl.label} 360°</button>
      <a class="btn btn-sm" href="${url360}" target="_blank" rel="noopener">↗ New Tab</a>
    </div>
  `;
  document.getElementById("inspect-open-360").addEventListener("click", () => {
    window.open(url360, "_blank", "noopener");
  });
}

function showPanoInspector(pano) {
  const fl = MAGICPLAN_FLOORS[pano.floor];
  const url360 = getMagicplanUrl(pano.floor, "360");
  selectedRoomCard.innerHTML = `
    <h4>📷 ${pano.label} (Marker #${pano.num})</h4>
    <p style="margin-bottom:8px;">Jump directly into Andrew &amp; Kabe's live Magicplan 360° sphere for <strong>${fl.label}</strong>.</p>
    <div style="display:flex; gap:6px; flex-wrap:wrap;">
      <a class="btn btn-primary btn-sm" href="${url360}" target="_blank" rel="noopener">🌐 Launch 360° Sphere ↗</a>
      <button class="btn btn-sm" id="inspect-open-launchpad">All Floors</button>
    </div>
  `;
  document.getElementById("inspect-open-launchpad").addEventListener("click", () => {
    switchMainMode("magicplan");
  });
}

// === Rehab Scope & Budget Estimator ===
function loadRehabItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.warn("Could not read saved rehab items:", err);
  }
  return structuredClone(DEFAULT_REHAB_ITEMS);
}

function saveRehabItems() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rehabItems));
  } catch (err) {
    console.warn("Could not save rehab items:", err);
  }
  updateTotals();
  scene3d.syncRehabPins(rehabItems);
}

function updateTotals() {
  const active = rehabItems.filter((i) => i.included);
  const lowSum = active.reduce((acc, i) => acc + (Number(i.low) || 0), 0);
  const highSum = active.reduce((acc, i) => acc + (Number(i.high) || 0), 0);
  includedCountEl.textContent = active.length;
  totalBudgetEl.textContent = `$${lowSum.toLocaleString()} – $${highSum.toLocaleString()}`;
}

function selectRehabItem(id, focus3D = true) {
  activeRehabId = id;
  const item = rehabItems.find((i) => i.id === id);
  document.querySelectorAll(".rehab-card").forEach((el) => {
    el.classList.toggle("active", el.dataset.id === id);
  });

  const card = document.querySelector(`.rehab-card[data-id="${id}"]`);
  if (card) card.scrollIntoView({ behavior: "smooth", block: "nearest" });

  if (item) {
    const fl = MAGICPLAN_FLOORS[item.floor] || MAGICPLAN_FLOORS.main;
    selectedRoomCard.innerHTML = `
      <h4>🛠️ ${item.title}</h4>
      <p style="margin-bottom:6px;"><strong>Level:</strong> ${fl.label} • <strong>Priority:</strong> ${item.priority}</p>
      <p style="margin-bottom:8px;">${item.evidence}</p>
      <div style="display:flex; gap:6px; flex-wrap:wrap;">
        <button class="btn btn-primary btn-sm" id="rehab-jump-360">🌐 Inspect ${fl.label} 360°</button>
        <button class="btn btn-sm" id="rehab-jump-photos">🖼️ View Photos</button>
      </div>
    `;
    document.getElementById("rehab-jump-360").addEventListener("click", () => {
      window.open(getMagicplanUrl(item.floor, "360"), "_blank", "noopener");
    });
    document.getElementById("rehab-jump-photos").addEventListener("click", () => {
      window.open(getMagicplanUrl(item.floor, "photos"), "_blank", "noopener");
    });

    if (focus3D && item.pin) {
      switchMainMode("dollhouse");
      document.getElementById("toggle-exterior").checked = false;
      scene3d.setExteriorVisible(false);
      scene3d.focusPoint(item.floor, item.pin.x, item.pin.z);
    }
  }
}

function renderRehabList() {
  rehabListEl.innerHTML = "";
  rehabItems.forEach((item) => {
    const badgeClass =
      item.priority === "Must-Do"
        ? "badge-must"
        : item.priority === "Value-Add"
        ? "badge-value"
        : "badge-cosmetic";

    const card = document.createElement("div");
    card.className = `rehab-card ${item.id === activeRehabId ? "active" : ""} ${
      item.included ? "" : "excluded"
    }`;
    card.dataset.id = item.id;

    card.innerHTML = `
      <div class="rehab-top">
        <input type="checkbox" class="inc-check" ${item.included ? "checked" : ""} title="Include in budget" />
        <div style="flex:1;">
          <div class="rehab-title">${item.title}</div>
          <div class="badges">
            <span class="badge ${badgeClass}">${item.priority}</span>
            <span class="badge badge-cat">${item.category}</span>
            <span class="badge badge-cosmetic">${MAGICPLAN_FLOORS[item.floor]?.label || item.floor}</span>
          </div>
        </div>
      </div>
      <div class="rehab-evidence">${item.evidence}</div>
      <div class="cost-inputs">
        <label class="cost-field">
          <span>Low ($)</span>
          <input type="number" class="low-input" step="100" value="${item.low}" />
        </label>
        <label class="cost-field">
          <span>High ($)</span>
          <input type="number" class="high-input" step="100" value="${item.high}" />
        </label>
        <button class="btn btn-sm focus-btn" title="Locate in 3D">🎯 3D</button>
      </div>
      <textarea class="rehab-notes" placeholder="Add your renovation advice for Andrew & Kabe...">${item.notes}</textarea>
    `;

    card.querySelector(".rehab-title").addEventListener("click", () => selectRehabItem(item.id, true));
    card.querySelector(".focus-btn").addEventListener("click", () => selectRehabItem(item.id, true));

    card.querySelector(".inc-check").addEventListener("change", (e) => {
      item.included = e.target.checked;
      card.classList.toggle("excluded", !item.included);
      saveRehabItems();
    });

    card.querySelector(".low-input").addEventListener("input", (e) => {
      item.low = Number(e.target.value) || 0;
      saveRehabItems();
    });

    card.querySelector(".high-input").addEventListener("input", (e) => {
      item.high = Number(e.target.value) || 0;
      saveRehabItems();
    });

    card.querySelector(".rehab-notes").addEventListener("input", (e) => {
      item.notes = e.target.value;
      saveRehabItems();
    });

    rehabListEl.appendChild(card);
  });

  updateTotals();
}

document.getElementById("btn-add-item").addEventListener("click", () => {
  const title = prompt("Enter rehab item title (e.g., Roof Inspection / Gutter Guards):");
  if (!title || !title.trim()) return;
  const newItem = {
    id: `custom-${Date.now()}`,
    title: title.trim(),
    category: "Custom",
    priority: "Value-Add",
    floor: "main",
    pin: { x: -10, z: 2 },
    low: 1000,
    high: 2500,
    included: true,
    evidence: "Added manually by Tony during walkthrough.",
    notes: "",
  };
  rehabItems.push(newItem);
  saveRehabItems();
  renderRehabList();
  selectRehabItem(newItem.id, true);
});

document.getElementById("btn-reset-rehab").addEventListener("click", () => {
  if (!confirm("Reset all rehab items and estimates back to default?")) return;
  rehabItems = structuredClone(DEFAULT_REHAB_ITEMS);
  saveRehabItems();
  renderRehabList();
  showToast("Rehab estimates reset to default");
});

function buildMarkdownSummary() {
  const active = rehabItems.filter((i) => i.included);
  const lowSum = active.reduce((a, i) => a + (Number(i.low) || 0), 0);
  const highSum = active.reduce((a, i) => a + (Number(i.high) || 0), 0);

  const lines = [
    `# Renovation & Rehab Scope — ${PROPERTY_META.address}`,
    `**Prepared by:** ${PROPERTY_META.broker} (${PROPERTY_META.phone} • ${PROPERTY_META.email})`,
    `**Prepared for:** ${PROPERTY_META.client}`,
    `**Total Area:** ${PROPERTY_META.totalSqFt} sq ft (${PROPERTY_META.livingSqFt} sq ft Heated/Cooled Living w/ Mini-Split In-Law Suite)`,
    `**Estimated Rehab Range:** $${lowSum.toLocaleString()} – $${highSum.toLocaleString()}`,
    `**Magicplan 360° Link:** ${getMagicplanUrl("main", "360")}`,
    "",
    "## Priority Rehab Breakdown",
  ];

  active.forEach((item, idx) => {
    lines.push(
      `### ${idx + 1}. ${item.title} [${item.priority}] — $${Number(item.low).toLocaleString()}–$${Number(item.high).toLocaleString()}`,
      `- **Area:** ${MAGICPLAN_FLOORS[item.floor]?.label || item.floor} (${item.category})`,
      `- **Observed:** ${item.evidence}`,
      `- **Recommendation:** ${item.notes}`,
      ""
    );
  });

  return lines.join("\n");
}

document.getElementById("btn-export-copy").addEventListener("click", async () => {
  const md = buildMarkdownSummary();
  try {
    await navigator.clipboard.writeText(md);
    showToast("Rehab summary copied to clipboard!");
  } catch {
    showToast("Clipboard blocked — use Save .md instead");
  }
});

document.getElementById("btn-export-md").addEventListener("click", () => {
  const md = buildMarkdownSummary();
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "1733-Sara-Ct-SE-Rehab-Scope.md";
  a.click();
  URL.revokeObjectURL(a.href);
  showToast("Saved 1733-Sara-Ct-SE-Rehab-Scope.md");
});

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 3200);
}
