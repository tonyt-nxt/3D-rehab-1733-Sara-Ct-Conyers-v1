import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { MAGICPLAN_FLOORS, ROOMS, PANO_PINS, TELEPORT_SPOTS } from "./property-data.js";

export class PropertyScene3D {
  constructor(container, callbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;

    this.floorGroups = {};
    this.wallMeshes = [];
    this.roomMeshes = [];
    this.pinMeshes = [];
    this.ceilingFans = [];
    this.blenderSlots = [];
    this.exteriorGroup = new THREE.Group();

    // Rehab Before vs. After state & dynamic swap registries
    this.isAfterRehab = false;
    this.asIsOnlyObjects = [];
    this.afterRehabOnlyObjects = [];
    this.floorSlabRegistry = []; // { mesh, asIsMat, afterMat }
    this.interiorWallMats = [];
    this.trimTouchupMats = [];
    this.exteriorSidingMat = null;
    this.exteriorStoneMat = null;

    this.explodeFactor = 0;
    this.wallScaleY = 0.68;

    // First-person walkthrough state
    this.walkMode = false;
    this.walkKeys = {};
    this.walkYaw = 0.25;
    this.walkPitch = 0;
    this.isDraggingLook = false;
    this.lastMouse = { x: 0, y: 0 };

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.clock = new THREE.Clock();

    this._initScene();
    this._createMaterials();
    this._buildLot();
    this._buildFloorsAndWalls();
    this._buildInteriorStairs();
    this._buildInteriorFixtures();
    this._buildExteriorShell();
    this._build360Pins();
    this._loadBlenderFixtures();
    this._bindEvents();
    this.setRehabPreviewMode(false);
    this.setCameraPreset("dollhouse");
    this._animate();
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x090f1a);
    this.scene.fog = new THREE.FogExp2(0x090f1a, 0.0032);

    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;

    this.camera = new THREE.PerspectiveCamera(52, w / h, 0.2, 600);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.container.appendChild(this.renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.015;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 160;

    // Ambient & sun lighting
    const hemi = new THREE.HemisphereLight(0xe0f2fe, 0x1e293b, 0.95);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfffbeb, 1.45);
    sun.position.set(45, 72, 42);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -65;
    sun.shadow.camera.right = 65;
    sun.shadow.camera.top = 65;
    sun.shadow.camera.bottom = -65;
    sun.shadow.bias = -0.0005;
    this.scene.add(sun);

    const backFill = new THREE.DirectionalLight(0x93c5fd, 0.58);
    backFill.position.set(-42, 30, -45);
    this.scene.add(backFill);
  }

  // === Procedural High-Detail CanvasTextures ===
  _makeCanvasTex(drawFn, repeatX = 4, repeatY = 4, size = 256) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    drawFn(ctx, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.needsUpdate = true;
    return tex;
  }

  _createMaterials() {
    // 1. Warm Oak LVP Plank Texture
    const lvpTex = this._makeCanvasTex((ctx, s) => {
      ctx.fillStyle = "#8d6e4c";
      ctx.fillRect(0, 0, s, s);
      const planks = 6;
      const ph = s / planks;
      const tones = ["#846545", "#967653", "#7b5c3d", "#9f7f5c", "#8b6b4a", "#7f6041"];
      for (let i = 0; i < planks; i++) {
        ctx.fillStyle = tones[i % tones.length];
        ctx.fillRect(0, i * ph, s, ph - 2);
        ctx.strokeStyle = "rgba(50,30,15,0.18)";
        ctx.lineWidth = 1;
        for (let g = 0; g < 5; g++) {
          ctx.beginPath();
          ctx.moveTo(0, i * ph + (g + 1) * (ph / 6));
          ctx.lineTo(s, i * ph + (g + 1) * (ph / 6));
          ctx.stroke();
        }
        const jx = ((i * 97) % (s - 40)) + 20;
        ctx.fillStyle = "rgba(35,20,10,0.45)";
        ctx.fillRect(jx, i * ph, 2, ph);
        ctx.fillRect(0, (i + 1) * ph - 2, s, 2);
      }
    }, 5, 5);

    // 2. Worn Kitchen/Dining Tile (As-Is)
    const tileWornTex = this._makeCanvasTex((ctx, s) => {
      ctx.fillStyle = "#57534e";
      ctx.fillRect(0, 0, s, s);
      const cells = 4;
      const cw = s / cells;
      for (let r = 0; r < cells; r++) {
        for (let c = 0; c < cells; c++) {
          ctx.fillStyle = (r + c) % 2 === 0 ? "#8a837b" : "#7e776f";
          ctx.fillRect(c * cw + 3, r * cw + 3, cw - 6, cw - 6);
          ctx.fillStyle = "rgba(60,50,40,0.22)";
          ctx.beginPath();
          ctx.arc(c * cw + cw * 0.55, r * cw + cw * 0.45, cw * 0.22, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }, 5, 5);

    // 3. Raw/Tiled Concrete (Garage Conv. Living As-Is)
    const concreteTex = this._makeCanvasTex((ctx, s) => {
      ctx.fillStyle = "#6c727a";
      ctx.fillRect(0, 0, s, s);
      const cw = s / 4;
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          ctx.fillStyle = (r + c) % 3 === 0 ? "#7a7770" : "#5e636b";
          ctx.fillRect(c * cw + 2, r * cw + 2, cw - 4, cw - 4);
        }
      }
      for (let i = 0; i < 140; i++) {
        ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.06)" : "rgba(20,20,20,0.1)";
        ctx.fillRect((i * 37) % s, (i * 73) % s, 14, 10);
      }
    }, 4, 4);

    // 4. Slate Bathroom Tile & Clean Modern Ceramic Bath Tile
    const slateTileTex = this._makeCanvasTex((ctx, s) => {
      ctx.fillStyle = "#334155";
      ctx.fillRect(0, 0, s, s);
      const cw = s / 4;
      const colors = ["#475569", "#5c4d42", "#3f4c5c", "#645749"];
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          ctx.fillStyle = colors[(r * 3 + c) % colors.length];
          ctx.fillRect(c * cw + 2, r * cw + 2, cw - 4, cw - 4);
        }
      }
    }, 4, 4);

    const cleanTileTex = this._makeCanvasTex((ctx, s) => {
      ctx.fillStyle = "#cbd5e1";
      ctx.fillRect(0, 0, s, s);
      const cw = s / 4;
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          ctx.fillStyle = (r + c) % 2 === 0 ? "#f1f5f9" : "#e2e8f0";
          ctx.fillRect(c * cw + 2, r * cw + 2, cw - 4, cw - 4);
        }
      }
    }, 4, 4);

    // 5. Pebble Shower Floor (As-Is) vs. Modern Ceramic Shower Tile (After Rehab)
    const pebbleTex = this._makeCanvasTex((ctx, s) => {
      ctx.fillStyle = "#5c5346";
      ctx.fillRect(0, 0, s, s);
      const tones = ["#8c7d6b", "#6f6457", "#a39480", "#4f463c", "#9c8f7e"];
      for (let i = 0; i < 85; i++) {
        const px = ((i * 53) % (s - 16)) + 8;
        const py = ((i * 89) % (s - 16)) + 8;
        const r = 7 + (i % 7);
        ctx.fillStyle = tones[i % tones.length];
        ctx.beginPath();
        ctx.ellipse(px, py, r, r * 0.78, (i * 0.4) % Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
    }, 2, 2);

    const graniteTex = this._makeCanvasTex((ctx, s) => {
      ctx.fillStyle = "#e7e5e4";
      ctx.fillRect(0, 0, s, s);
      const specks = ["#d6d3d1", "#78716c", "#44403c", "#a8a29e", "#fafaf9", "#292524"];
      for (let i = 0; i < 420; i++) {
        ctx.fillStyle = specks[i % specks.length];
        ctx.fillRect((i * 41) % s, (i * 67) % s, 2 + (i % 4), 2 + ((i * 3) % 3));
      }
    }, 3, 2);

    // 6. Deck Planks (Weathered vs. Fresh Cedar Stain)
    const makeDeckTex = (base, plankA, plankB) =>
      this._makeCanvasTex((ctx, s) => {
        ctx.fillStyle = base;
        ctx.fillRect(0, 0, s, s);
        const rows = 8;
        const rh = s / rows;
        for (let i = 0; i < rows; i++) {
          ctx.fillStyle = i % 2 === 0 ? plankA : plankB;
          ctx.fillRect(0, i * rh + 2, s, rh - 4);
        }
      }, 6, 6);

    // 7. Crawl Space Dirt/Torn Plastic vs. Clean Optional White Vapor Barrier
    const crawlDirtTex = this._makeCanvasTex((ctx, s) => {
      ctx.fillStyle = "#4a382b";
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 120; i++) {
        ctx.fillStyle = i % 2 === 0 ? "rgba(35,24,16,0.35)" : "rgba(110,85,62,0.22)";
        ctx.fillRect((i * 29) % s, (i * 59) % s, 10, 8);
      }
      ctx.fillStyle = "rgba(180,190,200,0.25)";
      ctx.fillRect(28, 35, s - 90, s - 80);
    }, 3, 3);

    const vaporTex = this._makeCanvasTex((ctx, s) => {
      ctx.fillStyle = "#e2e8f0";
      ctx.fillRect(0, 0, s, s);
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 3;
      ctx.strokeRect(4, 4, s - 8, s - 8);
    }, 4, 4);

    // 8. Cinderblock Foundation Walls (Interior CMU & Painted Black Exterior CMU)
    const cmuTex = this._makeCanvasTex((ctx, s) => {
      ctx.fillStyle = "#475569";
      ctx.fillRect(0, 0, s, s);
      const rows = 4;
      const rh = s / rows;
      ctx.fillStyle = "#64748b";
      for (let r = 0; r < rows; r++) {
        const offset = (r % 2) * (s / 4);
        for (let c = -1; c < 3; c++) {
          ctx.fillRect(c * (s / 2) + offset + 3, r * rh + 3, s / 2 - 6, rh - 6);
        }
      }
    }, 5, 2);

    const blackCmuTex = this._makeCanvasTex((ctx, s) => {
      ctx.fillStyle = "#111827";
      ctx.fillRect(0, 0, s, s);
      const rows = 4;
      const rh = s / rows;
      ctx.fillStyle = "#1f2937";
      for (let r = 0; r < rows; r++) {
        const offset = (r % 2) * (s / 4);
        for (let c = -1; c < 3; c++) {
          ctx.fillRect(c * (s / 2) + offset + 3, r * rh + 3, s / 2 - 6, rh - 6);
        }
      }
    }, 6, 2);

    // 9. Dark Blue Vertical Board-and-Batten Siding
    const makeSidingTex = (bg, rib) =>
      this._makeCanvasTex((ctx, s) => {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, s, s);
        const strips = 8;
        const sw = s / strips;
        for (let i = 0; i < strips; i++) {
          ctx.fillStyle = rib;
          ctx.fillRect(i * sw, 0, 5, s);
          ctx.fillStyle = "rgba(0,0,0,0.32)";
          ctx.fillRect(i * sw + 5, 0, 3, s);
        }
      }, 6, 2);

    // 10. Stacked Stone Veneer (Weathered As-Is vs. Pressure-Washed After Rehab)
    const makeStoneTex = (brightBoost = 0) =>
      this._makeCanvasTex((ctx, s) => {
        ctx.fillStyle = brightBoost ? "#57534e" : "#44403c";
        ctx.fillRect(0, 0, s, s);
        const rows = 6;
        const rh = s / rows;
        const palette = brightBoost
          ? ["#a8a29e", "#b5a694", "#9ca3af", "#d6d3d1", "#9a8a78"]
          : ["#78716c", "#8c7a6b", "#6b6560", "#9ca3af", "#7c6d5c"];
        for (let r = 0; r < rows; r++) {
          let x = 0;
          let idx = r * 3;
          while (x < s) {
            const w = 36 + ((idx * 29) % 44);
            ctx.fillStyle = palette[idx % palette.length];
            ctx.fillRect(x + 2, r * rh + 2, Math.min(w - 4, s - x - 2), rh - 4);
            x += w;
            idx++;
          }
        }
      }, 5, 2);

    // 11. Architectural Roof Shingles
    const roofTex = this._makeCanvasTex((ctx, s) => {
      ctx.fillStyle = "#1e242b";
      ctx.fillRect(0, 0, s, s);
      const rows = 8;
      const rh = s / rows;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < 4; c++) {
          ctx.fillStyle = (r + c) % 2 === 0 ? "#28303a" : "#1f262e";
          ctx.fillRect(c * (s / 4) + 2, r * rh + 2, s / 4 - 4, rh - 3);
        }
      }
    }, 6, 4);

    this.tex = {
      sidingAsIs: makeSidingTex("#182b40", "#223b56"),
      sidingAfter: makeSidingTex("#173a63", "#214d80"),
      stoneAsIs: makeStoneTex(0),
      stoneAfter: makeStoneTex(1),
      roofTex,
      graniteTex,
      pebbleTex,
      cleanTileTex,
    };

    this.floorMats = {
      lvpOak: new THREE.MeshStandardMaterial({ map: lvpTex, roughness: 0.52 }),
      tileWorn: new THREE.MeshStandardMaterial({ map: tileWornTex, roughness: 0.8 }),
      concreteStained: new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.9 }),
      tileSlate: new THREE.MeshStandardMaterial({ map: slateTileTex, roughness: 0.65 }),
      tileClean: new THREE.MeshStandardMaterial({ map: cleanTileTex, roughness: 0.4 }),
      deckWeathered: new THREE.MeshStandardMaterial({
        map: makeDeckTex("#3e352e", "#6e5d4f", "#5e4f42"),
        roughness: 0.92,
      }),
      deckStained: new THREE.MeshStandardMaterial({
        map: makeDeckTex("#452715", "#8c5432", "#7c4829"),
        roughness: 0.68,
      }),
      crawlDirt: new THREE.MeshStandardMaterial({ map: crawlDirtTex, roughness: 0.98 }),
      vaporBarrier: new THREE.MeshStandardMaterial({ map: vaporTex, roughness: 0.55 }),
    };

    this.cmuWallMat = new THREE.MeshStandardMaterial({ map: cmuTex, roughness: 0.92 });
    this.blackCmuMat = new THREE.MeshStandardMaterial({ map: blackCmuTex, roughness: 0.85 });
    this.graniteMat = new THREE.MeshStandardMaterial({ map: graniteTex, roughness: 0.22, metalness: 0.08 });
    this.pebbleMat = new THREE.MeshStandardMaterial({ map: pebbleTex, roughness: 0.88 });
    this.cleanCeramicMat = new THREE.MeshStandardMaterial({ map: cleanTileTex, roughness: 0.35 });
    this.glassMat = new THREE.MeshStandardMaterial({
      color: 0xbae6fd,
      roughness: 0.08,
      metalness: 0.25,
      transparent: true,
      opacity: 0.3,
    });
    this.extGlassMat = this.glassMat.clone();
    this.extGlassMat.userData = { baseOpacity: 0.3 };
    this.showerGlassMat = new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      roughness: 0.05,
      metalness: 0.15,
      transparent: true,
      opacity: 0.26,
      side: THREE.DoubleSide,
    });
    this.frameMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.38 });
    this.doorWoodMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.45 });

    // Upgrade core surfaces asynchronously with real Poly Haven CC0 1K PBR map sets (diff, nor, rough)
    const tl = new THREE.TextureLoader();
    const loadPbr = (prefix, rx, ry, mats, norScale = 0.55) => {
      const cfg = (url, isColor) => {
        const tx = tl.load(url, () => {
          mats.forEach((m) => { m.needsUpdate = true; });
        });
        tx.wrapS = THREE.RepeatWrapping;
        tx.wrapT = THREE.RepeatWrapping;
        tx.repeat.set(rx, ry);
        tx.anisotropy = 8;
        if (isColor) tx.colorSpace = THREE.SRGBColorSpace;
        return tx;
      };
      const diff = cfg(`assets/textures/${prefix}_diff.jpg`, true);
      const nor = cfg(`assets/textures/${prefix}_nor.jpg`, false);
      const rough = cfg(`assets/textures/${prefix}_rough.jpg`, false);
      mats.forEach((m) => {
        m.map = diff;
        m.normalMap = nor;
        m.normalScale = new THREE.Vector2(norScale, norScale);
        m.roughnessMap = rough;
        m.needsUpdate = true;
      });
    };

    loadPbr("lvp_oak", 4, 4, [this.floorMats.lvpOak], 0.55);
    this.floorMats.lvpOak.roughness = 0.78;

    loadPbr("tile_ceramic", 5, 5, [this.floorMats.tileClean, this.cleanCeramicMat], 0.50);
    this.floorMats.tileClean.roughness = 0.55;
    this.cleanCeramicMat.roughness = 0.45;

    loadPbr("deck_oak", 4, 4, [this.floorMats.deckStained], 0.65);
    this.floorMats.deckStained.color.setHex(0xc88d65);
    this.floorMats.deckStained.roughness = 0.85;

    loadPbr("granite_counter", 3, 3, [this.graniteMat], 0.40);
    this.graniteMat.roughness = 0.35;

    this.pbrTex = {
      stoneDiff: (() => {
        const tx = tl.load("assets/textures/stone_stacked_diff.jpg");
        tx.wrapS = THREE.RepeatWrapping; tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(6, 3);
        tx.anisotropy = 8; tx.colorSpace = THREE.SRGBColorSpace;
        return tx;
      })(),
      stoneNor: (() => {
        const tx = tl.load("assets/textures/stone_stacked_nor.jpg");
        tx.wrapS = THREE.RepeatWrapping; tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(6, 3);
        return tx;
      })(),
      stoneRough: (() => {
        const tx = tl.load("assets/textures/stone_stacked_rough.jpg");
        tx.wrapS = THREE.RepeatWrapping; tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(6, 3);
        return tx;
      })(),
      roofDiff: (() => {
        const tx = tl.load("assets/textures/roof_slates_diff.jpg");
        tx.wrapS = THREE.RepeatWrapping; tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(0.28, 0.28);
        tx.anisotropy = 8; tx.colorSpace = THREE.SRGBColorSpace;
        return tx;
      })(),
      roofNor: (() => {
        const tx = tl.load("assets/textures/roof_slates_nor.jpg");
        tx.wrapS = THREE.RepeatWrapping; tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(0.28, 0.28);
        return tx;
      })(),
    };
  }

  _buildLot() {
    const lotGroup = new THREE.Group();

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(250, 250),
      new THREE.MeshStandardMaterial({ color: 0x182b20, roughness: 0.96 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.15;
    ground.receiveShadow = true;
    lotGroup.add(ground);

    const grid = new THREE.GridHelper(140, 28, 0x334155, 0x1e293b);
    grid.position.y = -0.1;
    grid.material.opacity = 0.24;
    grid.material.transparent = true;
    lotGroup.add(grid);

    // Driveway leading right up to Front-Right Garage Conv. Entry & walkway to Front Entry Steps
    const driveMat = new THREE.MeshStandardMaterial({ color: 0x3b424c, roughness: 0.9 });
    const drive = new THREE.Mesh(new THREE.PlaneGeometry(20, 36), driveMat);
    drive.rotation.x = -Math.PI / 2;
    drive.position.set(13.5, -0.05, 34);
    drive.receiveShadow = true;
    lotGroup.add(drive);

    const walk = new THREE.Mesh(new THREE.PlaneGeometry(16, 5), driveMat);
    walk.rotation.x = -Math.PI / 2;
    walk.position.set(-1, -0.04, 17.5);
    lotGroup.add(walk);

    // Timber Landscape Border Edging & Mulch Bed (Magicplan PDF Page 2 Photo 8)
    const timberMat = new THREE.MeshStandardMaterial({ color: 0x4b3621, roughness: 0.92 });
    const mulchMat = new THREE.MeshStandardMaterial({ color: 0x2d1e15, roughness: 0.96 });
    const frontBed = new THREE.Mesh(new THREE.BoxGeometry(15.5, 0.25, 4.2), mulchMat);
    frontBed.position.set(-13.5, 0.0, 14.3);
    lotGroup.add(frontBed);

    const frontTimber = new THREE.Mesh(new THREE.BoxGeometry(15.8, 0.45, 0.45), timberMat);
    frontTimber.position.set(-13.5, 0.12, 16.4);
    lotGroup.add(frontTimber);

    const sideTimber = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 4.4), timberMat);
    sideTimber.position.set(-21.3, 0.12, 14.3);
    lotGroup.add(sideTimber);

    // Side Wood Fence & Gate (Magicplan PDF Page 2 Photo 5)
    const fenceMat = new THREE.MeshStandardMaterial({ color: 0x6e5641, roughness: 0.9 });
    this.trimTouchupMats.push({ mat: fenceMat, asIsHex: 0x6b5a4a, afterHex: 0x8a6543 });
    for (let x = -28.0; x <= -22.2; x += 0.55) {
      const picket = new THREE.Mesh(new THREE.BoxGeometry(0.42, 5.2, 0.16), fenceMat);
      picket.position.set(x, 2.6, 2.5);
      picket.castShadow = true;
      lotGroup.add(picket);
    }
    const fenceRailTop = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.24, 0.25), fenceMat);
    fenceRailTop.position.set(-25.1, 4.4, 2.45);
    lotGroup.add(fenceRailTop);
    const fenceRailBot = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.24, 0.25), fenceMat);
    fenceRailBot.position.set(-25.1, 1.2, 2.45);
    lotGroup.add(fenceRailBot);
    const gateLatch = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.4, 0.22),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7 })
    );
    gateLatch.position.set(-22.5, 3.0, 2.55);
    lotGroup.add(gateLatch);

    // Surrounding Georgia Pines & Hardwoods
    const treePositions = [
      [-35, -22], [-38, 6], [-32, 24], [36, -22], [40, 8],
      [34, 24], [-18, -42], [6, -44], [26, -38], [-44, -8],
    ];
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.9 });
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x1e3f2b, roughness: 0.85 });

    treePositions.forEach(([tx, tz], i) => {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, 12, 7), trunkMat);
      trunk.position.set(tx, 6, tz);
      trunk.castShadow = true;
      lotGroup.add(trunk);

      const crown = new THREE.Mesh(new THREE.ConeGeometry(5 + (i % 3), 15 + (i % 4) * 2, 7), foliageMat);
      crown.position.set(tx, 16, tz);
      crown.castShadow = true;
      lotGroup.add(crown);
    });

    // Right-Rear Tree with Overhanging Branches above the Right-Side Roof/Gutter (Andrew's trim target!)
    const rightRearTrunk = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.2, 24, 8), trunkMat);
    rightRearTrunk.position.set(27.5, 12, -13.5);
    rightRearTrunk.castShadow = true;
    lotGroup.add(rightRearTrunk);

    const rightRearCrown = new THREE.Mesh(new THREE.SphereGeometry(6.5, 10, 10), foliageMat);
    rightRearCrown.position.set(28.5, 24, -14.0);
    lotGroup.add(rightRearCrown);

    // Overhanging branches reaching over right-wing roof & rear gutter (As-Is only; trimmed in After Rehab!)
    const overhangGroup = new THREE.Group();
    const branchMat = new THREE.MeshStandardMaterial({ color: 0x3f2e21, roughness: 0.9 });
    const leafClusterMat = new THREE.MeshStandardMaterial({ color: 0x2a5235, roughness: 0.85 });

    [
      { pos: [22.5, 19.8, -11.5], rotZ: 1.25, len: 10 },
      { pos: [20.5, 18.8, -8.5], rotZ: 1.32, len: 11 },
    ].forEach((b) => {
      const limb = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.42, b.len, 6), branchMat);
      limb.position.set(...b.pos);
      limb.rotation.z = b.rotZ;
      overhangGroup.add(limb);

      const leaves = new THREE.Mesh(new THREE.SphereGeometry(2.6, 8, 8), leafClusterMat);
      leaves.position.set(b.pos[0] - 3.2, b.pos[1] - 0.5, b.pos[2]);
      leaves.scale.set(1.4, 0.7, 1.1);
      overhangGroup.add(leaves);
    });

    this.scene.add(overhangGroup);
    this.asIsOnlyObjects.push(overhangGroup);
    this.scene.add(lotGroup);
  }

  _buildFloorsAndWalls() {
    Object.values(MAGICPLAN_FLOORS).forEach((fl) => {
      const grp = new THREE.Group();
      grp.position.y = fl.baseY;
      grp.userData.floorKey = fl.id;
      this.floorGroups[fl.id] = grp;
      this.scene.add(grp);
    });

    ROOMS.forEach((room) => {
      const grp = this.floorGroups[room.floor];
      if (!grp) return;

      const asIsMat = this.floorMats[room.floorTex] || this.floorMats.lvpOak;
      const afterMat = this.floorMats[room.afterFloorTex || room.floorTex] || asIsMat;

      // 1. Floor Slabs (single rect or multi-rect for L-shaped rooms)
      const rects = room.rects || [{ x: room.x, z: room.z, w: room.w, d: room.d }];
      rects.forEach((rc) => {
        const cx = rc.x + rc.w / 2;
        const cz = rc.z + rc.d / 2;
        const slab = new THREE.Mesh(new THREE.BoxGeometry(rc.w, 0.35, rc.d), asIsMat);
        slab.position.set(cx, 0.175, cz);
        slab.receiveShadow = true;
        slab.castShadow = true;
        slab.userData = { type: "room", room };
        grp.add(slab);
        this.roomMeshes.push(slab);
        this.floorSlabRegistry.push({ mesh: slab, asIsMat, afterMat });
      });

      const cx = room.x + room.w / 2;
      const cz = room.z + room.d / 2;

      // Warm interior point light in main rooms
      if (!room.isDeck && room.w * room.d > 85) {
        const pt = new THREE.PointLight(0xfff3d6, 0.45, 24);
        pt.position.set(cx, room.h - 0.8, cz);
        grp.add(pt);
      }

      // 2. Deck Railings, Balusters, Structural Joists & Backyard Stairs
      if (room.isDeck) {
        this._buildDetailedDeck(grp, room);
      } else {
        // 3. Segmented Architectural Walls with Real Doorways, Windows & Demolishable Partitions
        this._buildRoomWalls(grp, room);
      }

      // Floating Room Nameplate
      const labelSprite = this._makeTextSprite(room.name, "#f1f5f9", "rgba(15,23,42,0.84)");
      labelSprite.position.set(cx, 1.55, cz);
      labelSprite.scale.set(7.6, 1.85, 1);
      grp.add(labelSprite);
    });
  }

  _buildDetailedDeck(grp, room) {
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4c35, roughness: 0.88 });
    const joistMat = new THREE.MeshStandardMaterial({ color: 0x523927, roughness: 0.92 });
    this.trimTouchupMats.push({ mat: woodMat, asIsHex: 0x685748, afterHex: 0x8c5230 });

    for (let x = room.x + 1; x <= room.x + room.w - 1; x += 2.2) {
      const joist = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, room.d), joistMat);
      joist.position.set(x, -0.35, room.z + room.d / 2);
      grp.add(joist);
    }

    const postCoords = [
      [room.x + 1.0, room.z + 1.0],
      [room.x + room.w / 2, room.z + 1.0],
      [room.x + room.w - 1.0, room.z + 1.0],
      [room.x + 1.0, room.z + room.d - 1.0],
      [room.x + room.w - 1.0, room.z + room.d - 1.0],
    ];
    postCoords.forEach(([px, pz]) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.55, 5.8, 0.55), woodMat);
      post.position.set(px, -2.9, pz);
      post.castShadow = true;
      grp.add(post);
    });

    const railH = 3.2;
    const addRailSpan = (x1, z1, x2, z2) => {
      const dx = x2 - x1;
      const dz = z2 - z1;
      const len = Math.hypot(dx, dz);
      if (len < 0.5) return;
      const mx = (x1 + x2) / 2;
      const mz = (z1 + z2) / 2;
      const isX = Math.abs(dx) > Math.abs(dz);

      const topRail = new THREE.Mesh(new THREE.BoxGeometry(isX ? len : 0.32, 0.22, isX ? 0.32 : len), woodMat);
      topRail.position.set(mx, 0.35 + railH, mz);
      grp.add(topRail);

      const botRail = new THREE.Mesh(new THREE.BoxGeometry(isX ? len : 0.24, 0.16, isX ? 0.24 : len), woodMat);
      botRail.position.set(mx, 0.75, mz);
      grp.add(botRail);

      const steps = Math.floor(len / 0.75);
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const bx = x1 + dx * t;
        const bz = z1 + dz * t;
        const bal = new THREE.Mesh(new THREE.BoxGeometry(0.12, railH - 0.45, 0.12), woodMat);
        bal.position.set(bx, 0.35 + railH / 2, bz);
        grp.add(bal);
      }
    };

    addRailSpan(room.x, room.z, room.x + 3.0, room.z);
    addRailSpan(room.x + 7.0, room.z, room.x + room.w, room.z);
    addRailSpan(room.x, room.z, room.x, room.z + room.d);
    addRailSpan(room.x + room.w, room.z, room.x + room.w, room.z + room.d);

    for (let i = 0; i < 8; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.24, 1.05), woodMat);
      step.position.set(room.x + 5.0, -0.35 - i * 0.7, room.z - 0.55 - i * 0.95);
      step.castShadow = true;
      grp.add(step);
    }
  }

  _buildRoomWalls(grp, room) {
    const isCrawl = room.floor === "crawl";
    const wallMat = isCrawl
      ? this.cmuWallMat
      : new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.82 });

    if (!isCrawl) {
      this.interiorWallMats.push(wallMat);
    }

    const baseMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });
    const wallT = 0.38;
    const h = room.h;

    const defs = room.customWalls
      ? room.customWalls.map((cw, idx) => ({ ...cw, key: `custom-${idx}` }))
      : [
          { key: "north", axis: "x", start: room.x, len: room.w, fixedZ: room.z + wallT / 2 },
          { key: "south", axis: "x", start: room.x, len: room.w, fixedZ: room.z + room.d - wallT / 2 },
          { key: "west", axis: "z", start: room.z, len: room.d, fixedX: room.x + wallT / 2 },
          { key: "east", axis: "z", start: room.z, len: room.d, fixedX: room.x + room.w - wallT / 2 },
        ];

    const walls = room.walls || {};

    defs.forEach((def) => {
      const cfg = room.customWalls ? def : walls[def.key] || {};
      if (cfg.skip) return;
      const segRoomH = def.h || h;

      const isDemolishedAfter = Boolean(cfg.demolishAfter);
      const targetParent = isDemolishedAfter ? new THREE.Group() : grp;
      if (isDemolishedAfter) {
        grp.add(targetParent);
        this.asIsOnlyObjects.push(targetParent);

        // In After Rehab, show clean structural header beam where interior wall was knocked down
        const beamGrp = new THREE.Group();
        const beam = new THREE.Mesh(
          new THREE.BoxGeometry(def.axis === "x" ? def.len : wallT, 0.8, def.axis === "x" ? wallT : def.len),
          wallMat
        );
        const cx = def.axis === "x" ? def.start + def.len / 2 : def.fixedX;
        const cz = def.axis === "x" ? def.fixedZ : def.start + def.len / 2;
        beam.position.set(cx, 0.35 + (segRoomH - 0.4) * this.wallScaleY, cz);
        beam.scale.y = this.wallScaleY;
        beam.userData = { type: "room", room, yBottom: segRoomH - 0.8, segH: 0.8 };
        beamGrp.add(beam);
        this.wallMeshes.push(beam);
        grp.add(beamGrp);
        this.afterRehabOnlyObjects.push(beamGrp);
      }

      const openings = [...(cfg.openings || [])].sort((a, b) => a.pos - b.pos);
      let cursor = 0;

      const addWallBox = (segStart, segLen, yBottom, segH) => {
        if (segLen <= 0.08 || segH <= 0.08) return;
        const isX = def.axis === "x";
        const geo = new THREE.BoxGeometry(isX ? segLen : wallT, segH, isX ? wallT : segLen);
        const mesh = new THREE.Mesh(geo, wallMat);
        const centerAlong = def.start + segStart + segLen / 2;
        const wx = isX ? centerAlong : def.fixedX;
        const wz = isX ? def.fixedZ : centerAlong;

        mesh.position.set(wx, 0.35 + (yBottom + segH / 2) * this.wallScaleY, wz);
        mesh.scale.y = this.wallScaleY;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = { type: "room", room, yBottom, segH };
        targetParent.add(mesh);
        this.wallMeshes.push(mesh);

        if (!isCrawl && yBottom === 0 && segLen > 0.4) {
          const bGeo = new THREE.BoxGeometry(
            isX ? segLen : wallT + 0.08,
            0.38,
            isX ? wallT + 0.08 : segLen
          );
          const bMesh = new THREE.Mesh(bGeo, baseMat);
          bMesh.position.set(wx, 0.35 + 0.19, wz);
          targetParent.add(bMesh);
        }
      };

      openings.forEach((op) => {
        const opStart = Math.max(cursor, op.pos);
        const opEnd = Math.min(def.len, opStart + op.w);
        const opW = opEnd - opStart;

        if (opStart > cursor) {
          addWallBox(cursor, opStart - cursor, 0, segRoomH);
        }

        if (opW > 0.2) {
          const sill = op.sill || 0;
          const topY = Math.min(segRoomH, sill + op.h);
          if (sill > 0.05) addWallBox(opStart, opW, 0, sill);
          if (segRoomH - topY > 0.05) addWallBox(opStart, opW, topY, segRoomH - topY);
          this._buildOpeningFixture(targetParent, def, opStart, opW, sill, op.h, wallT, op);
        }

        cursor = opEnd;
      });

      if (cursor < def.len) {
        addWallBox(cursor, def.len - cursor, 0, segRoomH);
      }
    });
  }

  _buildOpeningFixture(grp, def, opStart, opW, sill, opH, wallT, op) {
    const isX = def.axis === "x";
    const centerAlong = def.start + opStart + opW / 2;
    const cx = isX ? centerAlong : def.fixedX;
    const cz = isX ? def.fixedZ : centerAlong;

    if (op.type === "window") {
      const winGrp = new THREE.Group();
      winGrp.position.set(cx, 0.35 + (sill + opH / 2) * this.wallScaleY, cz);
      winGrp.scale.y = this.wallScaleY;
      winGrp.userData = { yBottom: sill, segH: opH };

      const frameT = 0.14;
      const topBar = new THREE.Mesh(
        new THREE.BoxGeometry(isX ? opW : wallT + 0.1, frameT, isX ? wallT + 0.1 : opW),
        this.frameMat
      );
      topBar.position.y = opH / 2 - frameT / 2;
      winGrp.add(topBar);

      const sillBar = new THREE.Mesh(
        new THREE.BoxGeometry(isX ? opW + 0.2 : wallT + 0.22, frameT, isX ? wallT + 0.22 : opW + 0.2),
        this.frameMat
      );
      sillBar.position.y = -opH / 2 + frameT / 2;
      winGrp.add(sillBar);

      const glass = new THREE.Mesh(
        new THREE.BoxGeometry(isX ? opW - 0.15 : 0.08, opH - 0.2, isX ? 0.08 : opW - 0.15),
        this.glassMat
      );
      winGrp.add(glass);

      const midH = new THREE.Mesh(
        new THREE.BoxGeometry(isX ? opW - 0.1 : 0.12, 0.1, isX ? 0.12 : opW - 0.1),
        this.frameMat
      );
      winGrp.add(midH);

      const panes = op.panes || 2;
      for (let p = 1; p < panes; p++) {
        const offset = -opW / 2 + (opW * p) / panes;
        const vBar = new THREE.Mesh(
          new THREE.BoxGeometry(isX ? 0.1 : 0.12, opH - 0.2, isX ? 0.12 : 0.1),
          this.frameMat
        );
        if (isX) vBar.position.x = offset;
        else vBar.position.z = offset;
        winGrp.add(vBar);
      }

      grp.add(winGrp);
      this.wallMeshes.push(winGrp);
    } else if (op.type === "door" || op.type === "french") {
      // Doors omitted intentionally for unobstructed dollhouse walkthrough clarity
      return;
    }
  }

  // === Split-Level Interior Staircases ===
  _buildInteriorStairs() {
    const treadMat = new THREE.MeshStandardMaterial({ color: 0x8b6b4a, roughness: 0.65 });
    const riserMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 });

    // 1. Flight from Main Floor (y=5.8) UP to Upstairs Hallway (y=9.0) at x = -2.3..0.0, z = 3.5..6.2
    const mainGrp = this.floorGroups.main;
    if (mainGrp) {
      const stepsUp = 6;
      const dy = 3.2 / stepsUp;
      const dx = 2.6 / stepsUp;
      for (let i = 0; i < stepsUp; i++) {
        const tread = new THREE.Mesh(new THREE.BoxGeometry(dx + 0.1, 0.18, 2.7), treadMat);
        tread.position.set(-2.3 + i * dx, 0.35 + (i + 1) * dy, 4.85);
        mainGrp.add(tread);

        const riser = new THREE.Mesh(new THREE.BoxGeometry(0.1, dy, 2.7), riserMat);
        riser.position.set(-2.3 + i * dx - dx / 2, 0.35 + (i + 0.5) * dy, 4.85);
        mainGrp.add(riser);
      }
    }

    // 2. Flight from Garage Conversion (y=0.4, Z=-4.2) UP South to Main Floor Landing (y=5.8, Z=2.6) along X=0.3..3.1
    const garGrp = this.floorGroups.garage;
    if (garGrp) {
      const stepsDown = 8;
      const dy = 5.4 / stepsDown;
      const dz = 6.6 / stepsDown;
      for (let i = 0; i < stepsDown; i++) {
        const tread = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.18, dz + 0.1), treadMat);
        tread.position.set(1.7, 0.35 + (i + 1) * dy, -3.8 + i * dz);
        garGrp.add(tread);

        const riser = new THREE.Mesh(new THREE.BoxGeometry(2.8, dy, 0.1), riserMat);
        riser.position.set(1.7, 0.35 + (i + 0.5) * dy, -3.8 + i * dz - dz / 2);
        garGrp.add(riser);
      }
    }
  }

  _registerGlbSlot(parent, prefab, pos, rotY = 0, scale = [1, 1, 1], fallback = null, isFan = false) {
    const slot = new THREE.Group();
    slot.position.set(pos[0], pos[1], pos[2]);
    slot.rotation.y = rotY;
    slot.scale.set(scale[0], scale[1], scale[2]);
    parent.add(slot);
    this.blenderSlots.push({ slot, prefab, fallback, isFan });
    return slot;
  }

  _loadBlenderFixtures() {
    const loader = new GLTFLoader();
    loader.load(
      "assets/models/rehab_fixtures.glb?v=2",
      (gltf) => {
        this.blenderSlots.forEach(({ slot, prefab, fallback, isFan }) => {
          const src = gltf.scene.getObjectByName(prefab);
          if (!src) return;
          const clone = src.clone(true);
          clone.position.set(0, 0, 0);
          clone.rotation.set(0, 0, 0);
          clone.scale.set(1, 1, 1);
          clone.traverse((ch) => {
            if (ch.isMesh) {
              ch.castShadow = true;
              ch.receiveShadow = true;
              const mat = ch.material;
              if (mat && mat.name && (mat.name.includes("ShowerGlass") || mat.name.includes("Glass"))) {
                if (mat.name.includes("ShowerGlass")) {
                  mat.transparent = true;
                  mat.opacity = 0.32;
                  mat.depthWrite = false;
                  mat.side = THREE.DoubleSide;
                }
              }
            }
          });
          slot.add(clone);
          if (fallback) {
            fallback.visible = false;
            if (fallback.parent) fallback.parent.remove(fallback);
          }
          if (isFan) {
            this.ceilingFans.push(clone);
          }
        });
        this.setRehabPreviewMode(this.isAfterRehab);
      },
      undefined,
      (err) => console.warn("GLB fixtures load skipped:", err)
    );
  }

  // === Detailed Room-by-Room Interior Fixtures & As-Is vs. After Rehab Visuals ===
  _buildInteriorFixtures() {
    const addSlot = (...args) => this._registerGlbSlot(...args);
    const porcelainMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2 });
    const stainedPorcelainMat = new THREE.MeshStandardMaterial({ color: 0xd6cfc2, roughness: 0.45 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.85, roughness: 0.15 });
    const stainlessMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.78, roughness: 0.22 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3 });
    const copperMat = new THREE.MeshStandardMaterial({ color: 0xb45309, metalness: 0.7, roughness: 0.3 });
    const pvcMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4 });
    const blackPipeMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });

    // ---------------------------------------------------------
    // 1. MAIN FLOOR: Kitchen, Dining Room, Living Room & Laundry
    // ---------------------------------------------------------
    const mainGrp = this.floorGroups.main;
    if (mainGrp) {
      // --- KITCHEN (Same Layout) ---
      // As-Is: dated gray-taupe flat cabinets, dark worn counters, shallow double-bowl sink
      const kitchenAsIsGrp = new THREE.Group();
      const kAsIsFb = new THREE.Group();
      const oldCabMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.7 });
      const oldTopMat = new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.65 });
      const oldNorthBase = new THREE.Mesh(new THREE.BoxGeometry(7.2, 3.0, 2.1), oldCabMat);
      oldNorthBase.position.set(-6.5, 1.85, -9.85);
      const oldNorthTop = new THREE.Mesh(new THREE.BoxGeometry(7.3, 0.18, 2.2), oldTopMat);
      oldNorthTop.position.set(-6.5, 3.4, -9.85);
      const oldDoubleSink = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 1.4), stainlessMat);
      oldDoubleSink.position.set(-6.8, 3.45, -9.85);
      const oldSinkDivider = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 1.4), stainlessMat);
      oldSinkDivider.position.set(-6.8, 3.46, -9.85);
      const oldEastBase = new THREE.Mesh(new THREE.BoxGeometry(2.1, 3.0, 3.8), oldCabMat);
      oldEastBase.position.set(-1.25, 1.85, -8.5);
      const oldEastTop = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.18, 3.9), oldTopMat);
      oldEastTop.position.set(-1.25, 3.4, -8.5);
      const oldUpperCab = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.2, 6.2), oldCabMat);
      oldUpperCab.position.set(-0.85, 6.2, -7.2);
      kAsIsFb.add(oldNorthBase, oldNorthTop, oldDoubleSink, oldSinkDivider, oldEastBase, oldEastTop);
      kitchenAsIsGrp.add(kAsIsFb, oldUpperCab);
      addSlot(kitchenAsIsGrp, "Kitchen_North_AsIs", [-6.5, 0.35, -9.85], 0, [1, 1, 1], kAsIsFb);
      addSlot(kitchenAsIsGrp, "Kitchen_East_AsIs", [-1.25, 0.35, -8.5], -Math.PI / 2, [1, 1, 1], null);
      mainGrp.add(kitchenAsIsGrp);
      this.asIsOnlyObjects.push(kitchenAsIsGrp);

      // After-Rehab Kitchen: Brand-New White Shaker Cabinets, Granite Countertops, 1 Large Single-Bowl Deep Sink, GFCI, New SS Fridge
      const kitchenAfterGrp = new THREE.Group();
      const kAfterFb = new THREE.Group();
      const shakerMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 });
      const shakerTrimMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4 });
      const newNorthBase = new THREE.Mesh(new THREE.BoxGeometry(7.2, 3.0, 2.1), shakerMat);
      newNorthBase.position.set(-6.5, 1.85, -9.85);
      const newNorthTop = new THREE.Mesh(new THREE.BoxGeometry(7.35, 0.2, 2.25), this.graniteMat);
      newNorthTop.position.set(-6.5, 3.42, -9.85);
      // Shaker door trim panels along front of north base cabinets
      for (let sx = -9.5; sx <= -3.5; sx += 1.5) {
        const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.2, 0.08), shakerTrimMat);
        doorFrame.position.set(sx, 1.8, -8.78);
        kAfterFb.add(doorFrame);
      }

      // 1 Large Single-Bowl Deep-Dish Sink + Modern Gooseneck Faucet
      const deepSinkOuter = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.65, 1.55), stainlessMat);
      deepSinkOuter.position.set(-6.8, 3.22, -9.85);
      const deepSinkVoid = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.16, 1.32), new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.7, roughness: 0.3 }));
      deepSinkVoid.position.set(-6.8, 3.48, -9.85);
      const gooseneckPost = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.05, 8), chromeMat);
      gooseneckPost.position.set(-6.8, 3.95, -10.42);
      const gooseneckArc = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.045, 8, 14, Math.PI), chromeMat);
      gooseneckArc.position.set(-6.8, 4.45, -10.14);
      gooseneckArc.rotation.y = Math.PI / 2;

      const newEastBase = new THREE.Mesh(new THREE.BoxGeometry(2.1, 3.0, 3.8), shakerMat);
      newEastBase.position.set(-1.25, 1.85, -8.5);
      const newEastTop = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.2, 3.95), this.graniteMat);
      newEastTop.position.set(-1.25, 3.42, -8.5);
      const newUpperCab = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.3, 6.2), shakerMat);
      newUpperCab.position.set(-0.85, 6.2, -7.2);

      // GFCI Receptacle Outlets near water
      const gfci1 = this._makeGfciOutlet();
      gfci1.position.set(-4.2, 4.2, -10.82);
      const gfci2 = this._makeGfciOutlet();
      gfci2.rotation.y = -Math.PI / 2;
      gfci2.position.set(-0.22, 4.2, -8.2);

      // New Stainless Steel Refrigerator
      const fridge = new THREE.Mesh(new THREE.BoxGeometry(2.7, 5.9, 2.9), stainlessMat);
      fridge.position.set(-1.45, 3.3, -2.2);
      const fridgeSeam = new THREE.Mesh(new THREE.BoxGeometry(0.06, 5.8, 0.08), darkMat);
      fridgeSeam.position.set(-2.8, 3.3, -2.2);

      kAfterFb.add(
        newNorthBase, newNorthTop, deepSinkOuter, deepSinkVoid, gooseneckPost, gooseneckArc,
        newEastBase, newEastTop, newUpperCab, fridge, fridgeSeam
      );
      kitchenAfterGrp.add(kAfterFb, gfci1, gfci2);
      addSlot(kitchenAfterGrp, "Kitchen_North_After", [-6.5, 0.35, -9.85], 0, [1, 1, 1], kAfterFb);
      addSlot(kitchenAfterGrp, "Kitchen_East_After", [-1.25, 0.35, -8.5], -Math.PI / 2, [1, 1, 1], null);
      addSlot(kitchenAfterGrp, "Kitchen_Upper_After", [-0.85, 5.05, -7.2], -Math.PI / 2, [1, 1, 1], null);
      addSlot(kitchenAfterGrp, "Fridge_FrenchDoor", [-1.45, 0.35, -2.2], -Math.PI / 2, [1, 1, 1], null);
      mainGrp.add(kitchenAfterGrp);
      this.afterRehabOnlyObjects.push(kitchenAfterGrp);

      // Salvaged Existing Matching Stainless Steel Electric Range + Over-Range Microwave (Both As-Is & After Rehab!)
      const rangeMicroFb = new THREE.Group();
      const stove = new THREE.Mesh(new THREE.BoxGeometry(2.5, 3.1, 2.4), stainlessMat);
      stove.position.set(-1.35, 1.9, -5.2);
      const cooktop = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.08, 2.2), darkMat);
      cooktop.position.set(-1.35, 3.48, -5.2);
      const microwave = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.45, 2.4), stainlessMat);
      microwave.position.set(-0.9, 5.65, -5.2);
      const mwGlass = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.0, 1.6), darkMat);
      mwGlass.position.set(-1.62, 5.65, -5.3);
      rangeMicroFb.add(stove, cooktop, microwave, mwGlass);
      mainGrp.add(rangeMicroFb);
      addSlot(mainGrp, "Range_30in", [-1.35, 0.35, -5.2], -Math.PI / 2, [1, 1, 1], rangeMicroFb);
      addSlot(mainGrp, "Microwave_OverRange", [-0.90, 4.92, -5.2], -Math.PI / 2, [1, 1, 1], null);

      // --- DINING ROOM: Dated vs. Modern Light Fixture ---
      const oldDiningLight = new THREE.Group();
      const brassStem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 8), copperMat);
      brassStem.position.set(-16.0, 7.2, -5.5);
      const brassGlobe = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), new THREE.MeshStandardMaterial({ color: 0xfef3c7, emissive: 0xfde68a, emissiveIntensity: 0.35 }));
      brassGlobe.position.set(-16.0, 6.3, -5.5);
      oldDiningLight.add(brassStem, brassGlobe);
      mainGrp.add(oldDiningLight);
      this.asIsOnlyObjects.push(oldDiningLight);

      const modernDiningLight = new THREE.Group();
      const modernDiningFb = new THREE.Group();
      const modBar = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.12, 0.2), darkMat);
      modBar.position.set(-16.0, 6.5, -5.5);
      const modDrop1 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 8), darkMat);
      modDrop1.position.set(-17.0, 7.25, -5.5);
      const modDrop2 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 8), darkMat);
      modDrop2.position.set(-15.0, 7.25, -5.5);
      modernDiningFb.add(modBar, modDrop1, modDrop2);
      [-17.4, -16.0, -14.6].forEach((gx) => {
        const bulb = new THREE.Mesh(
          new THREE.SphereGeometry(0.24, 12, 10),
          new THREE.MeshStandardMaterial({ color: 0xfffbeb, emissive: 0xfde68a, emissiveIntensity: 0.65 })
        );
        bulb.position.set(gx, 6.32, -5.5);
        modernDiningFb.add(bulb);
      });
      modernDiningLight.add(modernDiningFb);
      addSlot(modernDiningLight, "Chandelier_Linear_Modern", [-16.0, 7.98, -5.5], Math.PI / 2, [1, 1, 1], modernDiningFb);
      mainGrp.add(modernDiningLight);
      this.afterRehabOnlyObjects.push(modernDiningLight);

      // --- MAIN LIVING ROOM: Ceiling Fan, As-Is Curtain Rods/Draperies, & Laundry Area ---
      const livingFan = this._makeCeilingFan(true);
      livingFan.position.set(-11.0, 7.6, 5.8);
      mainGrp.add(livingFan);
      this.ceilingFans.push(livingFan);
      addSlot(mainGrp, "Ceiling_Fan_Modern", [-11.0, 8.0, 5.8], 0, [1, 1, 1], livingFan, true);

      // As-Is Window Curtain Rods & Draperies (Deleted in After Rehab!)
      const curtainsAsIs = new THREE.Group();
      const drapeMat = new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.85 });
      const rodMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7 });
      // Front triple window curtains (x = -17.5..-9.3, z = 11.3)
      const frontRod = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 9.2, 8), rodMat);
      frontRod.rotation.z = Math.PI / 2;
      frontRod.position.set(-13.4, 7.15, 11.2);
      curtainsAsIs.add(frontRod);
      [-17.4, -9.4].forEach((cx) => {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(1.1, 5.4, 0.28), drapeMat);
        panel.position.set(cx, 4.45, 11.2);
        curtainsAsIs.add(panel);
      });
      // West window curtains (x = -20.8, z = 5.6)
      const westRod = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.4, 8), rodMat);
      westRod.rotation.x = Math.PI / 2;
      westRod.position.set(-20.85, 7.15, 5.6);
      curtainsAsIs.add(westRod);
      [3.8, 7.4].forEach((cz) => {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(0.28, 5.2, 0.85), drapeMat);
        panel.position.set(-20.85, 4.5, cz);
        curtainsAsIs.add(panel);
      });
      mainGrp.add(curtainsAsIs);
      this.asIsOnlyObjects.push(curtainsAsIs);

      // Right-Side Entry Laundry Area (Washer/Dryer + Open Studs/PVC in As-Is -> Closed Drywall + GFCI in After Rehab)
      const washer = new THREE.Mesh(new THREE.BoxGeometry(2.3, 3.2, 2.3), porcelainMat);
      washer.position.set(-2.0, 1.95, 10.2);
      mainGrp.add(washer);
      addSlot(mainGrp, "Washer_FrontLoad", [-2.0, 0.35, 10.2], Math.PI, [1, 1, 1], washer);

      const laundryAsIs = new THREE.Group();
      const studMat = new THREE.MeshStandardMaterial({ color: 0xb48a5a, roughness: 0.85 });
      for (let i = 0; i < 4; i++) {
        const stud = new THREE.Mesh(new THREE.BoxGeometry(0.18, 7.5, 0.35), studMat);
        stud.position.set(-3.4 + i * 1.1, 4.1, 8.8);
        laundryAsIs.add(stud);
      }
      const exposedLaundryPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 5.5, 8), pvcMat);
      exposedLaundryPipe.position.set(-0.6, 3.2, 10.2);
      laundryAsIs.add(exposedLaundryPipe);
      mainGrp.add(laundryAsIs);
      this.asIsOnlyObjects.push(laundryAsIs);

      const laundryAfter = new THREE.Group();
      const laundryDrywall = new THREE.Mesh(
        new THREE.BoxGeometry(3.8, 7.5, 0.35),
        new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 })
      );
      laundryDrywall.position.set(-2.0, 4.1, 8.8);
      const laundryGfci = this._makeGfciOutlet();
      laundryGfci.position.set(-3.6, 4.2, 10.2);
      laundryGfci.rotation.y = Math.PI / 2;
      laundryAfter.add(laundryDrywall, laundryGfci);
      mainGrp.add(laundryAfter);
      this.afterRehabOnlyObjects.push(laundryAfter);
    }

    // ---------------------------------------------------------
    // 2. UPSTAIRS: Primary Suite, Extended Shower, 6-Drawer Vanity, Hall Bath, Matching Fans
    // ---------------------------------------------------------
    const upGrp = this.floorGroups.upstairs;
    if (upGrp) {
      // Primary Bedroom Fan + Open Shelves (As-Is) vs. Dedicated Closed Reach-In Closet (After Rehab)
      const priFan = this._makeCeilingFan(true);
      priFan.position.set(16.4, 7.7, -3.5);
      upGrp.add(priFan);
      this.ceilingFans.push(priFan);
      addSlot(upGrp, "Ceiling_Fan_Modern", [16.4, 8.1, -3.5], 0, [1, 1, 1], priFan, true);

      const openClosetAsIs = new THREE.Group();
      for (let s = 1; s <= 5; s++) {
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.12, 1.4), this.frameMat);
        shelf.position.set(18.0, 0.35 + s * 1.3, 2.5);
        openClosetAsIs.add(shelf);
      }
      upGrp.add(openClosetAsIs);
      this.asIsOnlyObjects.push(openClosetAsIs);

      // Framed Dedicated Closed Reach-In Closet in Primary Bedroom (After Rehab!)
      // Spans cleanly to East wall (X=13.9..24.1) with solid TV-mounting wall on Left & double doors on Right
      const closedClosetAfter = new THREE.Group();
      const closetWallMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 });
      const tvClosetWallL = new THREE.Mesh(new THREE.BoxGeometry(5.8, 7.8, 0.35), closetWallMat);
      tvClosetWallL.position.set(16.75, 4.25, 0.9);
      const frontClosetWallR = new THREE.Mesh(new THREE.BoxGeometry(0.75, 7.8, 0.35), closetWallMat);
      frontClosetWallR.position.set(23.75, 4.25, 0.9);
      const sideClosetWallL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 7.8, 2.5), closetWallMat);
      sideClosetWallL.position.set(13.9, 4.25, 2.1);
      const closetHeader = new THREE.Mesh(new THREE.BoxGeometry(4.0, 1.1, 0.35), closetWallMat);
      closetHeader.position.set(21.55, 7.6, 0.9);
      closedClosetAfter.add(tvClosetWallL, frontClosetWallR, sideClosetWallL, closetHeader);
      upGrp.add(closedClosetAfter);
      this.afterRehabOnlyObjects.push(closedClosetAfter);

      // Secondary Bedrooms (Bed 2 & Bed 3): Mismatched Ceiling Fans (As-Is) -> Matching Modern Fans (After Rehab)
      const mismatchedFansAsIs = new THREE.Group();
      const oldFan2 = this._makeCeilingFan(false, 0x5c4033, 0xb45309, 4); // Dated brown/brass 4-blade
      oldFan2.position.set(6.0, 7.7, 11.0);
      const oldFan3 = this._makeCeilingFan(false, 0xe2e8f0, 0xf8fafc, 5); // Dated all-white dome 5-blade
      oldFan3.position.set(18.5, 7.7, 9.8);
      mismatchedFansAsIs.add(oldFan2, oldFan3);
      upGrp.add(mismatchedFansAsIs);
      this.asIsOnlyObjects.push(mismatchedFansAsIs);

      const matchingFansAfter = new THREE.Group();
      const modFan2 = this._makeCeilingFan(true, 0x1e293b, 0x334155, 5);
      modFan2.position.set(6.0, 7.7, 11.0);
      const modFan3 = this._makeCeilingFan(true, 0x1e293b, 0x334155, 5);
      modFan3.position.set(18.5, 7.7, 9.8);
      matchingFansAfter.add(modFan2, modFan3);
      upGrp.add(matchingFansAfter);
      this.afterRehabOnlyObjects.push(matchingFansAfter);
      this.ceilingFans.push(oldFan2, oldFan3, modFan2, modFan3);
      addSlot(matchingFansAfter, "Ceiling_Fan_Modern", [6.0, 8.1, 11.0], 0, [1, 1, 1], modFan2, true);
      addSlot(matchingFansAfter, "Ceiling_Fan_Modern", [18.5, 8.1, 9.8], 0, [1, 1, 1], modFan3, true);

      // --- PRIMARY BATHROOM ---
      // Salvaged Toilet (against south wall facing -Z cleanly beside double vanity)
      const priToilet = this._makeToilet(porcelainMat);
      priToilet.rotation.y = Math.PI;
      priToilet.position.set(1.5, 0.35, -2.55);
      upGrp.add(priToilet);
      addSlot(upGrp, "Toilet_Detailed", [1.5, 0.35, -2.90], Math.PI, [1, 1, 1], priToilet);

      // Salvaged 6-Drawer Double Vanity (Nicks & missing top-left pull in As-Is -> Touched-up + all 6 pulls + Mirror + GFCI in After Rehab!)
      const vanityWoodMat = new THREE.MeshStandardMaterial({ color: 0x5c4738, roughness: 0.68 });
      this.trimTouchupMats.push({ mat: vanityWoodMat, asIsHex: 0x5c4738, afterHex: 0x4b382a });
      const priVanityBaseFb = new THREE.Group();
      const priVanity = new THREE.Mesh(new THREE.BoxGeometry(5.0, 2.8, 1.8), vanityWoodMat);
      priVanity.position.set(5.1, 1.75, -2.75);
      const priTop = new THREE.Mesh(new THREE.BoxGeometry(5.1, 0.16, 1.9), porcelainMat);
      priTop.position.set(5.1, 3.2, -2.75);
      priVanityBaseFb.add(priVanity, priTop);
      upGrp.add(priVanityBaseFb);

      // 6 Drawer fronts (3 left, 3 right — top-left handle MISSING in As-Is!)
      const pullPositions = [
        [3.3, 2.75], [3.3, 1.95], [3.3, 1.15],
        [6.9, 2.75], [6.9, 1.95], [6.9, 1.15],
      ];
      const missingPullAfter = new THREE.Group();
      const asIsHardware = new THREE.Group();
      const afterHardware = new THREE.Group();
      pullPositions.forEach(([px, py], idx) => {
        if (idx !== 0) {
          const oldPull = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.12), copperMat);
          oldPull.position.set(px, py, -3.68);
          asIsHardware.add(oldPull);
        }
        const newPull = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.14), chromeMat);
        newPull.position.set(px, py, -3.68);
        afterHardware.add(newPull);
      });
      // Large mirror + GFCI outlet added in After Rehab
      const priMirrorFb = new THREE.Group();
      const priMirrorFrame = new THREE.Mesh(new THREE.BoxGeometry(4.8, 3.2, 0.12), darkMat);
      priMirrorFrame.position.set(5.1, 5.2, -2.14);
      const priMirrorGlass = new THREE.Mesh(
        new THREE.BoxGeometry(4.5, 2.9, 0.14),
        new THREE.MeshStandardMaterial({ color: 0xe0f2fe, metalness: 0.9, roughness: 0.08 })
      );
      priMirrorGlass.position.set(5.1, 5.2, -2.16);
      priMirrorFb.add(afterHardware, priMirrorFrame, priMirrorGlass);
      const priGfci = this._makeGfciOutlet();
      priGfci.position.set(7.8, 4.0, -2.12);
      missingPullAfter.add(priMirrorFb, priGfci);
      upGrp.add(asIsHardware, missingPullAfter);
      this.asIsOnlyObjects.push(asIsHardware);
      this.afterRehabOnlyObjects.push(missingPullAfter);
      addSlot(asIsHardware, "Vanity_Double_AsIs", [5.1, 0.35, -3.02], Math.PI, [1, 1, 1], priVanityBaseFb);
      addSlot(missingPullAfter, "Vanity_Double_After", [5.1, 0.35, -3.02], Math.PI, [1, 1, 1], priMirrorFb);

      // Primary Shower: As-Is (Compact w/ Pebble Floor & Curtain Rod) -> After Rehab (Extended toward intact right window w/ Ceramic Tile & Swinging Glass Enclosure!)
      const priShowerAsIs = new THREE.Group();
      const asIsPebblePan = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.28, 3.8), this.pebbleMat);
      asIsPebblePan.position.set(1.9, 0.48, -8.3);
      const asIsRod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.8, 8), chromeMat);
      asIsRod.rotation.x = Math.PI / 2;
      asIsRod.position.set(3.4, 7.1, -8.3);
      const asIsCurtain = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 6.4, 2.8),
        new THREE.MeshStandardMaterial({ color: 0xe7e5e4, roughness: 0.9 })
      );
      asIsCurtain.position.set(3.4, 3.85, -8.8);
      priShowerAsIs.add(asIsPebblePan, asIsRod, asIsCurtain);
      upGrp.add(priShowerAsIs);
      this.asIsOnlyObjects.push(priShowerAsIs);

      const priShowerAfter = new THREE.Group();
      const priShowerFb = new THREE.Group();
      // Extended shower ends at X = 5.7 (left edge of right-shifted North window X = 5.9..7.7)
      const extCeramicFloor = new THREE.Mesh(new THREE.BoxGeometry(5.3, 0.28, 3.9), this.cleanCeramicMat);
      extCeramicFloor.position.set(3.05, 0.48, -8.15);
      const extCurb = new THREE.Mesh(new THREE.BoxGeometry(5.3, 0.45, 0.25), this.cleanCeramicMat);
      extCurb.position.set(3.05, 0.58, -6.25);
      // Swinging glass shower enclosure (front fixed panel + angled swinging glass door)
      const fixedGlass = new THREE.Mesh(new THREE.BoxGeometry(2.8, 6.8, 0.08), this.showerGlassMat);
      fixedGlass.position.set(1.8, 4.1, -6.25);
      const swingDoor = new THREE.Mesh(new THREE.BoxGeometry(2.4, 6.8, 0.08), this.showerGlassMat);
      swingDoor.position.set(4.25, 4.1, -5.7);
      swingDoor.rotation.y = 0.52;
      const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(0.08, 6.8, 3.8), this.showerGlassMat);
      sideGlass.position.set(5.7, 4.1, -8.15);
      priShowerFb.add(extCeramicFloor, extCurb, fixedGlass, swingDoor, sideGlass);
      priShowerAfter.add(priShowerFb);
      addSlot(priShowerAfter, "Shower_Extended_After", [3.05, 0.35, -8.15], 0, [1, 1, 1], priShowerFb);
      upGrp.add(priShowerAfter);
      this.afterRehabOnlyObjects.push(priShowerAfter);

      // --- UPSTAIRS SHARED FULL HALL BATH ---
      // Salvaged shower tile + salvaged toilet
      const hallShowerTile = new THREE.Mesh(
        new THREE.BoxGeometry(2.8, 0.28, 4.6),
        this.cleanCeramicMat
      );
      hallShowerTile.position.set(1.5, 0.48, 0.8);
      upGrp.add(hallShowerTile);

      const hallToilet = this._makeToilet(stainedPorcelainMat);
      hallToilet.position.set(4.2, 0.35, -0.7);
      upGrp.add(hallToilet);
      addSlot(upGrp, "Toilet_Detailed", [4.2, 0.35, -0.7], 0, [1, 1, 1], hallToilet);

      // As-Is Exposed Plumbing Pipes on wall where vanity was removed
      const exposedPlumbingGrp = new THREE.Group();
      const pTrap = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.4, 8), blackPipeMat);
      pTrap.rotation.x = Math.PI / 2;
      pTrap.position.set(6.4, 1.7, -1.0);
      exposedPlumbingGrp.add(pTrap);
      [-0.45, 0.45].forEach((dx) => {
        const supply = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.6, 8), copperMat);
        supply.position.set(6.4 + dx, 1.3, -1.2);
        exposedPlumbingGrp.add(supply);
      });
      upGrp.add(exposedPlumbingGrp);
      this.asIsOnlyObjects.push(exposedPlumbingGrp);

      // After Rehab: New Vanity + GFCI + Glass Sliding Shower Door
      const hallAfterGrp = new THREE.Group();
      const hallVanityFb = new THREE.Group();
      const vBox = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.8, 1.7), this.frameMat);
      vBox.position.set(6.4, 1.75, -0.7);
      const vTop = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.16, 1.8), porcelainMat);
      vTop.position.set(6.4, 3.2, -0.7);
      const vFaucet = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 8), chromeMat);
      vFaucet.position.set(6.4, 3.55, -1.3);
      const hallMirror = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.8, 0.1), darkMat);
      hallMirror.position.set(6.4, 5.1, -1.55);
      hallVanityFb.add(vBox, vTop, vFaucet, hallMirror);
      const hallGfci = this._makeGfciOutlet();
      hallGfci.position.set(7.9, 4.0, -1.5);
      // Glass Sliding Shower Door
      const sliderTrackTop = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.15, 4.6), chromeMat);
      sliderTrackTop.position.set(2.9, 7.2, 0.8);
      const sliderGlass1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 6.7, 2.35), this.showerGlassMat);
      sliderGlass1.position.set(2.86, 3.85, -0.25);
      const sliderGlass2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 6.7, 2.35), this.showerGlassMat);
      sliderGlass2.position.set(2.94, 3.85, 1.85);
      hallAfterGrp.add(hallVanityFb, hallGfci, sliderTrackTop, sliderGlass1, sliderGlass2);
      addSlot(hallAfterGrp, "Vanity_Single_After", [6.4, 0.35, -0.75], 0, [1, 1, 1], hallVanityFb);
      upGrp.add(hallAfterGrp);
      this.afterRehabOnlyObjects.push(hallAfterGrp);
    }

    // ---------------------------------------------------------
    // 3. GARAGE CONVERSION / IN-LAW SUITE (Corrected 90° Layout)
    // ---------------------------------------------------------
    const garGrp = this.floorGroups.garage;
    if (garGrp) {
      // --- STAIRWELL BREAKER PANEL (As-Is Open -> After Closed + Drywall) ---
      const openPanelGrp = new THREE.Group();
      const panelAsIs = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.8, 1.6), new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.7 }));
      panelAsIs.position.set(0.32, 4.8, -1.2);
      const copperStripe = new THREE.Mesh(new THREE.BoxGeometry(0.26, 2.2, 0.35), copperMat);
      copperStripe.position.set(0.34, 4.8, -1.2);
      openPanelGrp.add(panelAsIs, copperStripe);
      garGrp.add(openPanelGrp);
      this.asIsOnlyObjects.push(openPanelGrp);

      const panelClosed = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 2.9, 1.7),
        new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.5, roughness: 0.35 })
      );
      panelClosed.position.set(0.3, 4.8, -1.2);
      garGrp.add(panelClosed);
      this.afterRehabOnlyObjects.push(panelClosed);

      // --- BACK-RIGHT LIVING ROOM: Ceiling Fan, 5 Recessed Lights, Washer/Dryer Hookups, Fake Vents vs. Mini-Split ---
      const garFan = this._makeCeilingFan(true);
      garFan.position.set(16.5, 7.6, -1.0);
      garGrp.add(garFan);
      this.ceilingFans.push(garFan);
      addSlot(garGrp, "Ceiling_Fan_Modern", [16.5, 8.0, -1.0], 0, [1, 1, 1], garFan, true);

      // 5 Recessed Ceiling Lights (visible wafer trims floating at ceiling line)
      const recessedCoords = [
        [13.5, -7.8],
        [20.5, -7.8],
        [8.5, 1.2],
        [16.5, 2.8],
        [21.5, -2.0],
      ];
      recessedCoords.forEach(([lx, lz]) => {
        const trimRing = new THREE.Mesh(
          new THREE.CylinderGeometry(0.45, 0.45, 0.08, 16),
          this.frameMat
        );
        trimRing.position.set(lx, 7.95, lz);
        const ledDisc = new THREE.Mesh(
          new THREE.CylinderGeometry(0.32, 0.32, 0.1, 12),
          new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfef3c7, emissiveIntensity: 0.85 })
        );
        ledDisc.position.set(lx, 7.94, lz);
        garGrp.add(trimRing, ledDisc);
      });

      // Washer Connection Box + 240V Dryer Electrical Outlet on Stairwell Utility Wall (x = 3.8, z = 1.8)
      const utilityGrp = new THREE.Group();
      const washerBox = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.1, 1.2), this.frameMat);
      washerBox.position.set(3.82, 3.6, 1.8);
      const hotValve = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.25, 8), new THREE.MeshStandardMaterial({ color: 0xef4444 }));
      hotValve.rotation.z = Math.PI / 2;
      hotValve.position.set(3.88, 3.6, 1.5);
      const coldValve = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.25, 8), new THREE.MeshStandardMaterial({ color: 0x3b82f6 }));
      coldValve.rotation.z = Math.PI / 2;
      coldValve.position.set(3.88, 3.6, 2.1);
      const dryerOutlet = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.65, 0.5), darkMat);
      dryerOutlet.position.set(3.82, 2.2, 3.2);
      utilityGrp.add(washerBox, hotValve, coldValve, dryerOutlet);
      garGrp.add(utilityGrp);

      // As-Is Fake HVAC Vent Grilles
      const fakeVentsAsIs = new THREE.Group();
      [
        [10.2, 6.8, -5.2],
        [7.0, 6.8, 5.75],
        [19.0, 6.8, 5.75],
      ].forEach(([vx, vy, vz]) => {
        const grille = new THREE.Mesh(
          new THREE.BoxGeometry(1.2, 0.65, 0.15),
          new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.4 })
        );
        grille.position.set(vx, vy, vz);
        fakeVentsAsIs.add(grille);
      });
      garGrp.add(fakeVentsAsIs);
      this.asIsOnlyObjects.push(fakeVentsAsIs);

      // After Rehab: Wall-Mounted Ductless Heat-Pump Mini-Split Indoor Head (East wall, x=24.0, y=6.8, z=-1.5)
      const miniSplitIndoor = new THREE.Group();
      const msFb = new THREE.Group();
      const msBody = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.05, 3.4), porcelainMat);
      msBody.position.set(23.85, 6.8, -1.5);
      const msVane = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 3.0), darkMat);
      msVane.position.set(23.45, 6.4, -1.5);
      const msLed = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.08, 0.3),
        new THREE.MeshStandardMaterial({ color: 0x34d399, emissive: 0x34d399, emissiveIntensity: 1.0 })
      );
      msLed.position.set(23.44, 6.8, -0.4);
      msFb.add(msBody, msVane, msLed);
      miniSplitIndoor.add(msFb);
      addSlot(miniSplitIndoor, "MiniSplit_Indoor_Head", [24.25, 6.25, -1.5], -Math.PI / 2, [1, 1, 1], msFb);
      garGrp.add(miniSplitIndoor);
      this.afterRehabOnlyObjects.push(miniSplitIndoor);

      // --- BACK-LEFT BATHROOM (Marker #9, X=0..10.7, Z=-10.5..-5.0) ---
      const gToilet = this._makeToilet(porcelainMat);
      gToilet.position.set(5.4, 0.35, -9.0);
      garGrp.add(gToilet);
      addSlot(garGrp, "Toilet_Detailed", [5.4, 0.35, -9.1], 0, [1, 1, 1], gToilet);

      const gShowerPan = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.3, 4.7), this.pebbleMat);
      gShowerPan.position.set(1.9, 0.5, -7.8);
      garGrp.add(gShowerPan);

      // As-Is: Exposed Cast-Iron & PVC Plumbing Lines behind toilet + Shower Curtain Rod
      const gBathAsIs = new THREE.Group();
      const castIronStack = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 7.6, 10), blackPipeMat);
      castIronStack.position.set(4.5, 4.1, -9.85);
      const pvcDrainLine = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 7.6, 10), pvcMat);
      pvcDrainLine.position.set(6.2, 4.1, -9.85);
      const pvcHoriz = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.2, 8), pvcMat);
      pvcHoriz.rotation.z = Math.PI / 2;
      pvcHoriz.position.set(5.35, 2.2, -9.85);
      const gCurtainRod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 4.6, 8), chromeMat);
      gCurtainRod.rotation.x = Math.PI / 2;
      gCurtainRod.position.set(3.45, 7.1, -7.8);
      gBathAsIs.add(castIronStack, pvcDrainLine, pvcHoriz, gCurtainRod);
      garGrp.add(gBathAsIs);
      this.asIsOnlyObjects.push(gBathAsIs);

      // After Rehab: Boxed-in Plumbing Chase, Glass Shower Enclosure, New Vanity + GFCI
      const gBathAfter = new THREE.Group();
      const gVanityFb = new THREE.Group();
      const chase = new THREE.Mesh(new THREE.BoxGeometry(2.5, 7.6, 0.85), this.frameMat);
      chase.position.set(5.35, 4.1, -9.75);
      const gGlassDoor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 6.8, 4.6), this.showerGlassMat);
      gGlassDoor.position.set(3.45, 3.9, -7.8);
      const gGlassFrame = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 4.6), chromeMat);
      gGlassFrame.position.set(3.45, 7.3, -7.8);
      const gVanity = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.8, 1.65), this.frameMat);
      gVanity.position.set(9.0, 1.75, -9.3);
      const gVanityTop = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.16, 1.75), porcelainMat);
      gVanityTop.position.set(9.0, 3.2, -9.3);
      const gMirror = new THREE.Mesh(new THREE.BoxGeometry(2.1, 2.6, 0.1), darkMat);
      gMirror.position.set(9.0, 5.1, -10.05);
      gVanityFb.add(gVanity, gVanityTop, gMirror);
      const gGfci = this._makeGfciOutlet();
      gGfci.position.set(10.1, 4.0, -10.0);
      gBathAfter.add(chase, gGlassDoor, gGlassFrame, gVanityFb, gGfci);
      addSlot(gBathAfter, "Vanity_Single_After", [9.0, 0.35, -9.25], 0, [0.9, 1.0, 0.9], gVanityFb);
      garGrp.add(gBathAfter);
      this.afterRehabOnlyObjects.push(gBathAfter);

      // --- FRONT-LEFT BEDROOM (Marker #11): Add Framed Closet System Next to Stairs in After Rehab ---
      const lowerClosetAfter = new THREE.Group();
      const lcWall = new THREE.Mesh(new THREE.BoxGeometry(0.35, 7.7, 2.4), this.frameMat);
      lcWall.position.set(5.2, 4.2, 6.9);
      const lcFrontL = new THREE.Mesh(new THREE.BoxGeometry(0.9, 7.7, 0.35), this.frameMat);
      lcFrontL.position.set(0.85, 4.2, 8.0);
      const lcFrontR = new THREE.Mesh(new THREE.BoxGeometry(0.9, 7.7, 0.35), this.frameMat);
      lcFrontR.position.set(4.75, 4.2, 8.0);
      const lcHeader = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.0, 0.35), this.frameMat);
      lcHeader.position.set(2.8, 7.55, 8.0);
      lowerClosetAfter.add(lcWall, lcFrontL, lcFrontR, lcHeader);
      garGrp.add(lowerClosetAfter);
      this.afterRehabOnlyObjects.push(lowerClosetAfter);

      // --- FRONT-RIGHT ROOM -> OPEN IN-LAW KITCHENETTE (After Rehab!) ---
      const kitchenetteAfter = new THREE.Group();
      const k2Fb = new THREE.Group();
      const kCab = new THREE.Mesh(new THREE.BoxGeometry(2.1, 3.0, 6.6), this.frameMat);
      kCab.position.set(23.1, 1.85, 11.4);
      const kTop = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.2, 6.75), this.graniteMat);
      kTop.position.set(23.1, 3.42, 11.4);
      // Upper cabinet positioned south of East window (Z=12.6..15.2) so window over sink stays clear
      const kUpper = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 2.6), this.frameMat);
      kUpper.position.set(23.5, 6.1, 13.9);
      const kSink = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.14, 1.8), stainlessMat);
      kSink.position.set(23.1, 3.5, 10.6);
      const kFaucet = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.75, 8), chromeMat);
      kFaucet.position.set(23.6, 3.9, 10.6);
      const kAppliance = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.0, 1.8), stainlessMat);
      kAppliance.position.set(23.1, 4.02, 13.6);
      const kFridge = new THREE.Mesh(new THREE.BoxGeometry(2.5, 5.4, 2.5), stainlessMat);
      kFridge.position.set(22.9, 3.05, 6.9);
      const kGfci = this._makeGfciOutlet();
      kGfci.rotation.y = -Math.PI / 2;
      kGfci.position.set(24.05, 4.2, 12.7);
      k2Fb.add(kCab, kTop, kSink, kFaucet, kAppliance, kFridge);
      kitchenetteAfter.add(k2Fb, kUpper, kGfci);
      addSlot(kitchenetteAfter, "InLaw_Kitchenette_After", [23.05, 0.35, 11.4], -Math.PI / 2, [1, 1, 1], k2Fb);
      addSlot(kitchenetteAfter, "Fridge_FrenchDoor", [22.9, 0.35, 6.9], -Math.PI / 2, [0.92, 0.92, 0.86], null);
      garGrp.add(kitchenetteAfter);
      this.afterRehabOnlyObjects.push(kitchenetteAfter);
    }

    // ---------------------------------------------------------
    // 4. CRAWL SPACE: Water Heater Right Next to Rear Door + Falling Insulation & Debris (As-Is)
    // ---------------------------------------------------------
    const crawlGrp = this.floorGroups.crawl;
    if (crawlGrp) {
      // Electric Water Heater placed RIGHT NEXT TO rear (-Z) crawl door (door at x=-8.0..-5.2, z=-11.1)
      const whTank = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 4.3, 16), porcelainMat);
      whTank.position.set(-3.2, 2.5, -8.8);
      crawlGrp.add(whTank);

      [-0.35, 0.35].forEach((dx) => {
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 8), copperMat);
        pipe.position.set(-3.2 + dx, 4.9, -8.8);
        crawlGrp.add(pipe);
      });

      // CMU center support piers
      [
        [-11.0, -5.0],
        [-11.0, 4.0],
      ].forEach(([px, pz]) => {
        const pier = new THREE.Mesh(new THREE.BoxGeometry(1.4, 5.2, 1.4), this.cmuWallMat);
        pier.position.set(px, 2.9, pz);
        crawlGrp.add(pier);
      });

      // Overhead wood floor joists
      const joistMat = new THREE.MeshStandardMaterial({ color: 0x6b4f35, roughness: 0.9 });
      for (let z = -9.5; z <= 10.5; z += 2.5) {
        const j = new THREE.Mesh(new THREE.BoxGeometry(20.6, 0.45, 0.18), joistMat);
        j.position.set(-10.8, 5.2, z);
        crawlGrp.add(j);
      }

      // As-Is Only: ~10% Falling Fiberglass Insulation Hanging from Joists + Wood/Drywall/Trash Debris on Floor
      const crawlDebrisAsIs = new THREE.Group();
      const insulMat = new THREE.MeshStandardMaterial({ color: 0xf4a6b8, roughness: 0.96 });
      const insulationSpots = [
        { pos: [-16.2, 4.1, -6.2], rotX: 0.45, rotZ: 0.25 },
        { pos: [-13.5, 3.8, -1.2], rotX: -0.55, rotZ: -0.2 },
        { pos: [-8.0, 4.0, 3.8], rotX: 0.5, rotZ: 0.15 },
        { pos: [-17.5, 3.9, 6.2], rotX: -0.4, rotZ: 0.3 },
      ];
      insulationSpots.forEach((sp) => {
        const batt = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.4, 0.4), insulMat);
        batt.position.set(...sp.pos);
        batt.rotation.set(sp.rotX, 0.2, sp.rotZ);
        crawlDebrisAsIs.add(batt);
      });

      // Wood pieces, drywall scraps, and trash bags/debris scattered on soil floor
      const woodScrapMat = new THREE.MeshStandardMaterial({ color: 0x9c7349, roughness: 0.92 });
      const drywallScrapMat = new THREE.MeshStandardMaterial({ color: 0xe7e5e4, roughness: 0.9 });
      const trashMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85 });

      [
        [-15.5, 0.45, -5.0, 0.4],
        [-12.0, 0.45, 1.5, -0.7],
        [-6.5, 0.45, 7.2, 1.1],
      ].forEach(([wx, wy, wz, ry]) => {
        const wood = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.18, 0.45), woodScrapMat);
        wood.position.set(wx, wy, wz);
        wood.rotation.y = ry;
        crawlDebrisAsIs.add(wood);
      });

      [
        [-14.2, 0.42, 6.0, 0.2],
        [-9.0, 0.42, -2.5, -0.5],
      ].forEach(([dx, dy, dz, ry]) => {
        const dw = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.14, 1.1), drywallScrapMat);
        dw.position.set(dx, dy, dz);
        dw.rotation.y = ry;
        crawlDebrisAsIs.add(dw);
      });

      [
        [-18.0, 0.6, 2.0],
        [-7.5, 0.6, -4.0],
      ].forEach(([tx, ty, tz]) => {
        const bag = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 0), trashMat);
        bag.position.set(tx, ty, tz);
        bag.scale.set(1.2, 0.7, 1.0);
        crawlDebrisAsIs.add(bag);
      });

      crawlGrp.add(crawlDebrisAsIs);
      this.asIsOnlyObjects.push(crawlDebrisAsIs);
    }
  }

  _makeGfciOutlet() {
    const grp = new THREE.Group();
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.48, 0.05), this.frameMat);
    const led = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.08, 0.07),
      new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 0.9 })
    );
    led.position.y = 0.06;
    grp.add(plate, led);
    return grp;
  }

  _makeToilet(mat) {
    const grp = new THREE.Group();
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.48, 1.35, 12), mat);
    bowl.position.set(0, 0.68, 0.35);
    grp.add(bowl);

    const tank = new THREE.Mesh(new THREE.BoxGeometry(1.35, 1.35, 0.65), mat);
    tank.position.set(0, 1.85, -0.3);
    grp.add(tank);
    return grp;
  }

  _makeCeilingFan(modern = true, bladeHex = 0x5c4033, hubHex = 0xcbd5e1, bladeCount = 5) {
    const fan = new THREE.Group();
    const hubMat = new THREE.MeshStandardMaterial({ color: hubHex, metalness: modern ? 0.75 : 0.4, roughness: 0.25 });
    const bladeMat = new THREE.MeshStandardMaterial({ color: bladeHex, roughness: 0.55 });

    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.7, 8), hubMat);
    rod.position.y = 0.2;
    fan.add(rod);

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.22, 12), hubMat);
    fan.add(hub);

    if (modern) {
      const lightKit = new THREE.Mesh(
        new THREE.CylinderGeometry(0.36, 0.36, 0.14, 12),
        new THREE.MeshStandardMaterial({ color: 0xfffbeb, emissive: 0xfde68a, emissiveIntensity: 0.45 })
      );
      lightKit.position.y = -0.14;
      fan.add(lightKit);
    }

    for (let i = 0; i < bladeCount; i++) {
      const angle = (i * Math.PI * 2) / bladeCount;
      const blade = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.05, 0.42), bladeMat);
      blade.position.set(Math.cos(angle) * 1.3, 0, Math.sin(angle) * 1.3);
      blade.rotation.y = -angle;
      fan.add(blade);
    }
    return fan;
  }

  // === Detailed Exterior Shell (Pages 2-3 Photos 1-17: Siding, Stone, Cinderblock Defects, Downspout Bucket, Condensers) ===
  _buildExteriorShell() {
    this.exteriorSidingMat = new THREE.MeshStandardMaterial({
      map: this.tex.sidingAsIs,
      roughness: 0.75,
      transparent: true,
      opacity: 0.85,
    });
    this.exteriorStoneMat = new THREE.MeshStandardMaterial({
      map: this.pbrTex.stoneDiff || this.tex.stoneAsIs,
      normalMap: this.pbrTex.stoneNor,
      normalScale: new THREE.Vector2(0.7, 0.7),
      roughnessMap: this.pbrTex.stoneRough,
      roughness: 0.9,
      transparent: true,
      opacity: 0.94,
    });
    const roofMat = new THREE.MeshStandardMaterial({
      map: this.pbrTex.roofDiff || this.tex.roofTex,
      normalMap: this.pbrTex.roofNor,
      normalScale: new THREE.Vector2(0.65, 0.65),
      roughness: 0.85,
      transparent: true,
      opacity: 0.92,
    });

    // Exterior fascia/corner trim targeted for blue touch-up paint in After Rehab
    const touchupTrimMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.45 });
    this.trimTouchupMats.push({ mat: touchupTrimMat, asIsHex: 0xf1f5f9, afterHex: 0x1e3f66 });

    // Left Wing (Crawl Space Black CMU Foundation + Stacked Stone Lower Front + Blue Board-and-Batten Upper)
    const leftFoundation = new THREE.Mesh(new THREE.BoxGeometry(22.2, 5.8, 23.8), this.blackCmuMat);
    leftFoundation.position.set(-10.8, 2.9, 0.4);
    this.exteriorGroup.add(leftFoundation);

    // Front Stacked Stone Veneer Facade on Left Wing
    const leftFrontStone = new THREE.Mesh(new THREE.BoxGeometry(22.35, 5.8, 0.45), this.exteriorStoneMat);
    leftFrontStone.position.set(-10.8, 2.9, 12.2);
    this.exteriorGroup.add(leftFrontStone);

    const leftUpper = new THREE.Mesh(new THREE.BoxGeometry(22.2, 8.2, 23.8), this.exteriorSidingMat);
    leftUpper.position.set(-10.8, 9.9, 0.4);
    this.exteriorGroup.add(leftUpper);

    const leftFascia = new THREE.Mesh(new THREE.BoxGeometry(22.3, 0.45, 24.8), touchupTrimMat);
    leftFascia.position.set(-11.15, 13.9, 0.4);
    this.exteriorGroup.add(leftFascia);

    const leftRoof = this._makeGableRoof(22.6, 25.4, 5.0, roofMat);
    leftRoof.position.set(-11.3, 14.1, 0.4);
    this.exteriorGroup.add(leftRoof);

    // Front Living Room Triple Window
    const frontWinFrame = new THREE.Mesh(new THREE.BoxGeometry(8.4, 4.6, 0.45), this.frameMat);
    frontWinFrame.position.set(-13.4, 10.3, 12.35);
    this.exteriorGroup.add(frontWinFrame);
    const frontWinGlass = new THREE.Mesh(new THREE.BoxGeometry(7.8, 4.0, 0.52), this.extGlassMat);
    frontWinGlass.position.set(-13.4, 10.3, 12.38);
    this.exteriorGroup.add(frontWinGlass);

    // Closed Exterior Doors (visible only when Exterior Shell & Roof is checked)
    const extDoorPanelMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.45, metalness: 0.1 });
    const extWhiteDoorMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.42 });
    const extBrassMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.85, roughness: 0.25 });
    const addClosedSingleExtDoor = (x, y, z, w, h, d, panelMat, outDir = 1, hasUpperGlass = true) => {
      const grp = new THREE.Group();
      const frame = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.frameMat);
      const slab = new THREE.Mesh(new THREE.BoxGeometry(w - 0.35, h - 0.3, d + 0.04), panelMat);
      slab.position.y = -0.05;
      grp.add(frame, slab);
      if (hasUpperGlass) {
        const lite = new THREE.Mesh(new THREE.BoxGeometry(w * 0.58, h * 0.34, d + 0.09), this.extGlassMat);
        lite.position.y = h * 0.19;
        grp.add(lite);
      }
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), extBrassMat);
      knob.position.set((w / 2 - 0.52) * outDir, -0.25, outDir * (d / 2 + 0.09));
      grp.add(knob);
      grp.position.set(x, y, z);
      this.exteriorGroup.add(grp);
    };

    // 1. Front Main Entry Door (Left Wing Front, +Z above stone steps)
    addClosedSingleExtDoor(-3.4, 9.3, 12.35, 3.4, 6.9, 0.45, extDoorPanelMat, 1, true);

    // 3. Rear Main Floor Double French Doors at the Deck (Left Wing Back, -Z)
    const deckFrenchGrp = new THREE.Group();
    const dfFrame = new THREE.Mesh(new THREE.BoxGeometry(5.6, 6.9, 0.45), this.frameMat);
    const dfStile = new THREE.Mesh(new THREE.BoxGeometry(0.24, 6.6, 0.5), this.frameMat);
    [-1.32, 1.32].forEach((dx) => {
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(2.45, 6.5, 0.47), extWhiteDoorMat);
      leaf.position.x = dx;
      const glass = new THREE.Mesh(new THREE.BoxGeometry(1.85, 5.2, 0.53), this.extGlassMat);
      glass.position.set(dx, 0.15, 0);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), extBrassMat);
      knob.position.set(dx > 0 ? 0.25 : -0.25, -0.25, -0.3);
      deckFrenchGrp.add(leaf, glass, knob);
    });
    deckFrenchGrp.add(dfFrame, dfStile);
    deckFrenchGrp.position.set(-16.0, 9.55, -11.45);
    this.exteriorGroup.add(deckFrenchGrp);

    // 4. Rear Crawl Space Door under the Deck (Left Wing Back, -Z)
    const crawlWoodDoorMat = new THREE.MeshStandardMaterial({ color: 0x3f2e21, roughness: 0.85 });
    const crawlTrimMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
    const extCrawlGrp = new THREE.Group();
    const crawlDoorFrame = new THREE.Mesh(new THREE.BoxGeometry(3.15, 4.6, 0.34), crawlTrimMat);
    const crawlDoorLeaf = new THREE.Mesh(new THREE.BoxGeometry(2.85, 4.35, 0.38), crawlWoodDoorMat);
    const crawlDoorLatch = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.32, 0.12), extBrassMat);
    crawlDoorLatch.position.set(-1.05, -0.1, -0.24);
    extCrawlGrp.add(crawlDoorFrame, crawlDoorLeaf, crawlDoorLatch);
    extCrawlGrp.position.set(-6.6, 2.2, -11.45);
    this.exteriorGroup.add(extCrawlGrp);

    // Right Wing (Stacked Stone Lower Front + Blue Board-and-Batten Upper)
    const rightBase = new THREE.Mesh(new THREE.BoxGeometry(25.0, 8.8, 26.8), this.exteriorSidingMat);
    rightBase.position.set(12.3, 4.4, 2.7);
    this.exteriorGroup.add(rightBase);

    const rightFrontStone = new THREE.Mesh(new THREE.BoxGeometry(25.15, 8.8, 0.45), this.exteriorStoneMat);
    rightFrontStone.position.set(12.3, 4.4, 16.0);
    this.exteriorGroup.add(rightFrontStone);

    const rightUpper = new THREE.Mesh(new THREE.BoxGeometry(25.0, 8.4, 26.8), this.exteriorSidingMat);
    rightUpper.position.set(12.3, 13.0, 2.7);
    this.exteriorGroup.add(rightUpper);

    const rightFascia = new THREE.Mesh(new THREE.BoxGeometry(26.0, 0.5, 27.8), touchupTrimMat);
    rightFascia.position.set(12.3, 17.1, 2.7);
    this.exteriorGroup.add(rightFascia);

    const rightRoof = this._makeGableRoof(26.6, 28.4, 5.6, roofMat);
    rightRoof.position.set(12.3, 17.3, 2.7);
    this.exteriorGroup.add(rightRoof);

    // Front Upstairs Windows (2 windows)
    [6.0, 18.5].forEach((wx) => {
      const f = new THREE.Mesh(new THREE.BoxGeometry(3.8, 4.2, 0.45), this.frameMat);
      f.position.set(wx, 13.3, 16.15);
      this.exteriorGroup.add(f);
      const g = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.6, 0.52), this.extGlassMat);
      g.position.set(wx, 13.3, 16.18);
      this.exteriorGroup.add(g);
    });

    // 2. Front In-Law / Garage Driveway Door (Right Wing Front, +Z) + Front-Left Window (#11)
    addClosedSingleExtDoor(17.2, 3.8, 16.18, 3.3, 6.8, 0.45, extDoorPanelMat, 1, true);

    const lowerFrontWinF = new THREE.Mesh(new THREE.BoxGeometry(3.9, 4.0, 0.45), this.frameMat);
    lowerFrontWinF.position.set(6.9, 4.8, 16.18);
    const lowerFrontWinG = new THREE.Mesh(new THREE.BoxGeometry(3.3, 3.4, 0.52), this.extGlassMat);
    lowerFrontWinG.position.set(6.9, 4.8, 16.21);
    this.exteriorGroup.add(lowerFrontWinF, lowerFrontWinG);

    // 5. Rear In-Law Suite Backyard Door (Right Wing Back, -Z)
    addClosedSingleExtDoor(14.8, 3.8, -10.75, 3.2, 6.8, 0.42, extWhiteDoorMat, -1, true);

    // === Foundation Defects (Photos 14-16: Block Hole, Step Cracks, Rusted Vent) ===
    const foundationDefectsAsIs = new THREE.Group();
    const blockHole = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.85, 0.95),
      new THREE.MeshStandardMaterial({ color: 0x030712, roughness: 1.0 })
    );
    blockHole.position.set(-21.95, 1.3, 5.2);
    const crack1 = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 1.6, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x9ca3af })
    );
    crack1.position.set(-21.95, 1.4, -2.5);
    crack1.rotation.x = 0.45;
    const rustedVent = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 0.9, 1.7),
      new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.9 })
    );
    rustedVent.position.set(-21.95, 1.8, -6.5);
    foundationDefectsAsIs.add(blockHole, crack1, rustedVent);
    this.exteriorGroup.add(foundationDefectsAsIs);
    this.asIsOnlyObjects.push(foundationDefectsAsIs);

    const patchedFoundationAfter = new THREE.Group();
    const cleanVent = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 0.9, 1.7),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4 })
    );
    cleanVent.position.set(-21.95, 1.8, -6.5);
    patchedFoundationAfter.add(cleanVent);
    this.exteriorGroup.add(patchedFoundationAfter);
    this.afterRehabOnlyObjects.push(patchedFoundationAfter);

    // === Corner Downspout + Wooden Trough & Purple Bucket (Photo 17 As-Is) -> Clean Extension (After Rehab) ===
    const gutterMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.35, roughness: 0.4 });
    const frontLeftDownspout = new THREE.Mesh(new THREE.BoxGeometry(0.32, 13.5, 0.32), gutterMat);
    frontLeftDownspout.position.set(-22.05, 7.2, 11.7);
    this.exteriorGroup.add(frontLeftDownspout);

    const bucketAsIs = new THREE.Group();
    const woodTrough = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 0.35, 0.65),
      new THREE.MeshStandardMaterial({ color: 0x6e5641, roughness: 0.95 })
    );
    woodTrough.position.set(-23.0, 0.75, 12.1);
    woodTrough.rotation.z = 0.18;
    const purpleBucket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.75, 0.62, 1.45, 14),
      new THREE.MeshStandardMaterial({ color: 0x7e22ce, roughness: 0.45 })
    );
    purpleBucket.position.set(-24.4, 0.72, 12.2);
    bucketAsIs.add(woodTrough, purpleBucket);
    this.exteriorGroup.add(bucketAsIs);
    this.asIsOnlyObjects.push(bucketAsIs);

    const extensionAfter = new THREE.Mesh(
      new THREE.BoxGeometry(4.8, 0.28, 0.45),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 })
    );
    extensionAfter.position.set(-24.3, 0.15, 11.8);
    this.exteriorGroup.add(extensionAfter);
    this.afterRehabOnlyObjects.push(extensionAfter);

    // Rear Gutters (Sagging right rear in As-Is -> Re-nailed flush in After Rehab)
    const rearGutterAsIs = new THREE.Mesh(new THREE.BoxGeometry(25.4, 0.35, 0.4), gutterMat);
    rearGutterAsIs.position.set(12.3, 16.65, -10.85);
    rearGutterAsIs.rotation.z = -0.045;
    this.exteriorGroup.add(rearGutterAsIs);
    this.asIsOnlyObjects.push(rearGutterAsIs);

    const rearGutterAfter = new THREE.Mesh(new THREE.BoxGeometry(25.4, 0.35, 0.4), touchupTrimMat);
    rearGutterAfter.position.set(12.3, 17.0, -10.85);
    this.exteriorGroup.add(rearGutterAfter);
    this.afterRehabOnlyObjects.push(rearGutterAfter);

    // === BOTH Exterior HVAC Condensers in After Rehab ===
    const condensersAfter = new THREE.Group();
    // 1. Half-House Central HVAC Condenser (Left Wing)
    const pad1 = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.3, 3.4), new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.9 }));
    pad1.position.set(-23.8, 0.15, -3.0);
    const cond1 = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.0, 2.6), new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.55, roughness: 0.35 }));
    cond1.position.set(-23.8, 1.8, -3.0);
    const grille1 = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.08, 16), new THREE.MeshStandardMaterial({ color: 0x0f172a }));
    grille1.position.set(-23.8, 3.32, -3.0);
    condensersAfter.add(pad1, cond1, grille1);

    // 2. Garage Conversion Ductless Mini-Split Condenser (East Wall outside Living Room)
    const pad2 = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.25, 3.4), new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.9 }));
    pad2.position.set(26.1, 0.12, -1.5);
    const cond2 = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.4, 2.8), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.35, roughness: 0.35 }));
    cond2.position.set(26.1, 1.45, -1.5);
    const msFan = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.1, 16), new THREE.MeshStandardMaterial({ color: 0x0f172a }));
    msFan.rotation.z = Math.PI / 2;
    msFan.position.set(26.76, 1.5, -1.5);
    const lineSet = new THREE.Mesh(new THREE.BoxGeometry(0.25, 6.2, 0.25), this.frameMat);
    lineSet.position.set(24.9, 4.0, -1.5);
    condensersAfter.add(pad2, cond2, msFan, lineSet);

    this.scene.add(condensersAfter);
    this.afterRehabOnlyObjects.push(condensersAfter);

    // Stone Front Entry Steps
    for (let i = 0; i < 4; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.6, 1.2), this.exteriorStoneMat);
      step.position.set(-3.4, 0.3 + i * 0.6, 15.6 - i * 1.05);
      this.exteriorGroup.add(step);
    }

    this.scene.add(this.exteriorGroup);
  }

  _makeGableRoof(width, depth, height, mat) {
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, 0);
    shape.lineTo(0, height);
    shape.lineTo(width / 2, 0);
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
    geo.translate(0, 0, -depth / 2);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    return mesh;
  }

  // === "As-Is vs. After Rehab" Live 3D Toggle ===
  setRehabPreviewMode(isAfter) {
    this.isAfterRehab = Boolean(isAfter);

    this.asIsOnlyObjects.forEach((obj) => {
      obj.visible = !this.isAfterRehab;
    });
    this.afterRehabOnlyObjects.forEach((obj) => {
      obj.visible = this.isAfterRehab;
    });

    this.floorSlabRegistry.forEach(({ mesh, asIsMat, afterMat }) => {
      mesh.material = this.isAfterRehab ? afterMat : asIsMat;
    });

    this.interiorWallMats.forEach((mat) => {
      mat.color.setHex(this.isAfterRehab ? 0xf8fafc : 0xd6d3d1);
    });

    this.trimTouchupMats.forEach(({ mat, asIsHex, afterHex }) => {
      mat.color.setHex(this.isAfterRehab ? afterHex : asIsHex);
    });

    if (this.exteriorSidingMat) {
      this.exteriorSidingMat.map = this.isAfterRehab ? this.tex.sidingAfter : this.tex.sidingAsIs;
      this.exteriorSidingMat.needsUpdate = true;
    }

    if (this.exteriorStoneMat) {
      this.exteriorStoneMat.map = this.pbrTex.stoneDiff || (this.isAfterRehab ? this.tex.stoneAfter : this.tex.stoneAsIs);
      this.exteriorStoneMat.color.setHex(this.isAfterRehab ? 0xffffff : 0xdfd8cf);
      this.exteriorStoneMat.needsUpdate = true;
    }
  }

  _build360Pins() {
    PANO_PINS.forEach((p) => {
      const grp = this.floorGroups[p.floor];
      if (!grp) return;

      const pinMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.75,
        roughness: 0.25,
      });
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.68, 16, 16), pinMat);
      sphere.position.set(p.x, 3.2, p.z);
      sphere.userData = { type: "pano", pano: p, baseY: 3.2 };
      grp.add(sphere);
      this.pinMeshes.push(sphere);

      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.07, 2.8, 6),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.55 })
      );
      stem.position.set(p.x, 1.6, p.z);
      grp.add(stem);
    });
  }

  syncRehabPins(items) {
    this.pinMeshes = this.pinMeshes.filter((m) => {
      if (m.userData.type === "rehab") {
        if (m.parent) m.parent.remove(m);
        if (m.userData.stem && m.userData.stem.parent) {
          m.userData.stem.parent.remove(m.userData.stem);
        }
        return false;
      }
      return true;
    });

    items.forEach((item) => {
      const grp = this.floorGroups[item.floor] || this.floorGroups.main;
      if (!grp || !item.pin) return;

      const isMust = item.priority === "Must-Do";
      const color = isMust ? 0xf87171 : 0xfbbf24;
      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: item.included ? 0.68 : 0.15,
        roughness: 0.3,
        transparent: true,
        opacity: item.included ? 1 : 0.35,
      });

      const pin = new THREE.Mesh(new THREE.OctahedronGeometry(0.88, 0), mat);
      pin.position.set(item.pin.x, 4.6, item.pin.z);

      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 4.2, 6),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.65 })
      );
      stem.position.set(item.pin.x, 2.2, item.pin.z);

      pin.userData = { type: "rehab", item, baseY: 4.6, stem };
      grp.add(stem);
      grp.add(pin);
      this.pinMeshes.push(pin);
    });
  }

  _makeTextSprite(text, textColor = "#fff", bgColor = "rgba(15,23,42,0.8)") {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.roundRect(16, 20, 480, 88, 22);
    ctx.fill();

    ctx.font = "bold 28px Inter, Segoe UI, sans-serif";
    ctx.fillStyle = textColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 256, 65);

    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    return new THREE.Sprite(mat);
  }

  setExteriorVisible(visible) {
    this.exteriorGroup.visible = visible;
  }

  setFloorVisible(floorKey, visible) {
    if (this.floorGroups[floorKey]) {
      this.floorGroups[floorKey].visible = visible;
    }
  }

  setExplodeFactor(factor01) {
    this.explodeFactor = factor01;
    Object.values(MAGICPLAN_FLOORS).forEach((fl) => {
      const grp = this.floorGroups[fl.id];
      if (grp) {
        grp.position.y = fl.baseY + fl.explodeOffset * factor01;
      }
    });
    this.exteriorGroup.traverse((obj) => {
      if (obj.isMesh && obj.material && obj.material.transparent) {
        if (obj.material.userData.baseOpacity === undefined) {
          obj.material.userData.baseOpacity = obj.material.opacity;
        }
        const baseOp = obj.material.userData.baseOpacity;
        obj.material.opacity = factor01 > 0.08 ? Math.max(0.1, baseOp * (1 - factor01)) : baseOp;
      }
    });
  }

  setWallCutaway(scale01) {
    this.wallScaleY = scale01;
    this.wallMeshes.forEach((w) => {
      const yBottom = w.userData.yBottom || 0;
      const segH = w.userData.segH || w.userData.fullHeight || 8;
      w.scale.y = scale01;
      w.position.y = 0.35 + (yBottom + segH / 2) * scale01;
    });
  }

  setCameraPreset(preset) {
    this.walkMode = false;
    this.controls.enabled = true;

    const presets = {
      dollhouse: { pos: [38, 34, 44], target: [2, 7, -2] },
      front: { pos: [2, 12, 54], target: [2, 8, 2] },
      rear: { pos: [-16, 17, -54], target: [-2, 7, -8] },
      top: { pos: [2, 78, 8], target: [2, 6, -4] },
    };
    const p = presets[preset] || presets.dollhouse;
    this.camera.position.set(...p.pos);
    this.controls.target.set(...p.target);
    this.controls.update();
  }

  focusPoint(floorKey, x, z) {
    this.walkMode = false;
    this.controls.enabled = true;
    const fl = MAGICPLAN_FLOORS[floorKey] || MAGICPLAN_FLOORS.main;
    const y = fl.baseY + fl.explodeOffset * this.explodeFactor + 3;
    this.controls.target.set(x, y, z);
    this.camera.position.set(x + 15, y + 13, z + 17);
    this.controls.update();
  }

  teleportToSpot(spotId) {
    const spot = TELEPORT_SPOTS.find((s) => s.id === spotId) || TELEPORT_SPOTS[0];
    const fl = MAGICPLAN_FLOORS[spot.floor] || MAGICPLAN_FLOORS.main;

    Object.keys(this.floorGroups).forEach((k) => {
      this.floorGroups[k].visible = true;
    });
    this.setExplodeFactor(0);
    this.setWallCutaway(1.0);

    this.walkMode = true;
    this.controls.enabled = false;
    this.camera.position.set(spot.x, fl.baseY + (spot.eyeH || 5.3), spot.z);
    this.walkYaw = spot.yaw || 0;
    this.walkPitch = -0.04;
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.set(this.walkPitch, this.walkYaw, 0);

    if (this.callbacks.onTeleport) {
      this.callbacks.onTeleport(spot);
    }
  }

  setWalkthroughMode(enabled, spotId = "tp-living") {
    if (enabled) {
      this.teleportToSpot(spotId);
    } else {
      this.walkMode = false;
      this.controls.enabled = true;
      this.setWallCutaway(0.68);
      this.setCameraPreset("dollhouse");
    }
  }

  _bindEvents() {
    window.addEventListener("resize", () => {
      const w = this.container.clientWidth || window.innerWidth;
      const h = this.container.clientHeight || window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });

    const dom = this.renderer.domElement;

    dom.addEventListener("pointerdown", (e) => {
      this.lastMouse = { x: e.clientX, y: e.clientY };
      this._downPos = { x: e.clientX, y: e.clientY };
      if (this.walkMode) this.isDraggingLook = true;
    });

    window.addEventListener("pointermove", (e) => {
      if (this.walkMode && this.isDraggingLook) {
        const dx = e.clientX - this.lastMouse.x;
        const dy = e.clientY - this.lastMouse.y;
        this.walkYaw -= dx * 0.0042;
        this.walkPitch = Math.max(-1.15, Math.min(1.15, this.walkPitch - dy * 0.0042));
        this.camera.rotation.order = "YXZ";
        this.camera.rotation.y = this.walkYaw;
        this.camera.rotation.x = this.walkPitch;
        this.lastMouse = { x: e.clientX, y: e.clientY };
      }
    });

    window.addEventListener("pointerup", (e) => {
      this.isDraggingLook = false;
      if (!this._downPos) return;
      const dist = Math.hypot(e.clientX - this._downPos.x, e.clientY - this._downPos.y);
      if (dist < 6 && e.target === dom) {
        this._handleClick(e);
      }
    });

    window.addEventListener("keydown", (e) => {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
      this.walkKeys[e.code] = true;
    });
    window.addEventListener("keyup", (e) => {
      this.walkKeys[e.code] = false;
    });
  }

  _handleClick(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const visiblePins = this.pinMeshes.filter((p) => p.parent && p.parent.visible);
    const pinHits = this.raycaster.intersectObjects(visiblePins, false);
    if (pinHits.length > 0) {
      const data = pinHits[0].object.userData;
      if (data.type === "rehab" && this.callbacks.onSelectRehab) {
        this.callbacks.onSelectRehab(data.item);
        return;
      }
      if (data.type === "pano" && this.callbacks.onSelectPano) {
        this.callbacks.onSelectPano(data.pano);
        return;
      }
    }

    const visibleRooms = this.roomMeshes.filter((r) => r.parent && r.parent.visible);
    const roomHits = this.raycaster.intersectObjects(visibleRooms, false);
    if (roomHits.length > 0 && this.callbacks.onSelectRoom) {
      this.callbacks.onSelectRoom(roomHits[0].object.userData.room);
    }
  }

  _animate() {
    requestAnimationFrame(() => this._animate());
    const dt = Math.min(this.clock.getDelta(), 0.1);
    const t = this.clock.elapsedTime;

    this.pinMeshes.forEach((p, idx) => {
      if (p.userData.baseY !== undefined) {
        p.position.y = p.userData.baseY + Math.sin(t * 2.4 + idx) * 0.2;
        p.rotation.y += dt * 1.1;
      }
    });

    this.ceilingFans.forEach((fan) => {
      fan.rotation.y += dt * 1.8;
    });

    if (this.walkMode) {
      const speed = 13.5 * dt;
      const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.walkYaw);
      const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.walkYaw);
      if (this.walkKeys["KeyW"] || this.walkKeys["ArrowUp"]) this.camera.position.addScaledVector(forward, speed);
      if (this.walkKeys["KeyS"] || this.walkKeys["ArrowDown"]) this.camera.position.addScaledVector(forward, -speed);
      if (this.walkKeys["KeyA"] || this.walkKeys["ArrowLeft"]) this.camera.position.addScaledVector(right, -speed);
      if (this.walkKeys["KeyD"] || this.walkKeys["ArrowRight"]) this.camera.position.addScaledVector(right, speed);
      if (this.walkKeys["KeyE"]) this.camera.position.y += speed * 0.6;
      if (this.walkKeys["KeyQ"]) this.camera.position.y -= speed * 0.6;
    } else {
      this.controls.update();
    }

    this.renderer.render(this.scene, this.camera);
  }
}
