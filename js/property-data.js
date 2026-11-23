// 1733 Sara Ct SE, Conyers, GA 30013 — Architectural 3D Geometry, Doors/Windows, Fixtures & Rehab Scope Data
// Coordinate system: 1 unit = 1 foot.
// X = Left-to-Right (West-to-East standing in driveway facing front), Z = Rear-to-Front (-Z = North/Rear Backyard, +Z = South/Front Driveway), Y = Elevation.

export const PROPERTY_META = {
  address: "1733 Sara Ct SE, Conyers, GA 30013",
  shortTitle: "1733 Sara Ct SE",
  cityState: "Conyers, GA 30013",
  client: "Andrew & Kabe",
  broker: "Tony Tran • Georgia Real Estate Consultant • The NXT Team - Simply Homes ATL",
  title: "Georgia Real Estate Consultant",
  team: "The NXT Team - Simply Homes ATL",
  phone: "678-900-8363",
  email: "tonyt.nxt@gmail.com",
  lat: 33.6440541,
  lng: -84.0060406,
  totalSqFt: 2832.89,
  livingSqFt: 2085.86,
  floorsCount: 4,
  roomsCount: 17,
  bathroomsCount: 3,
  magicplanId: "d99551b1-3f34-4fe6-9b87-219fabfade1c",
  googleMapsPlaceUrl:
    "https://www.google.com/maps/place/1733+Sara+Ct+SE,+Conyers,+GA+30013/@33.6440541,-84.0060406,19z",
  googleStreetViewUrl:
    "https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=33.6440541,-84.0060406",
  googleEarthUrl:
    "https://earth.google.com/web/@33.6440541,-84.0060406,245a,110d,35y,0h,55t,0r",
};

export const MAGICPLAN_FLOORS = {
  upstairs: {
    id: "upstairs",
    label: "Upstairs",
    floorId: "6afe9035.c5ed8fff",
    sqFt: "770.98 sq ft",
    ceiling: "8' 1¼\"",
    baseY: 9.0,
    explodeOffset: 20.0,
    color: "#38bdf8",
  },
  main: {
    id: "main",
    label: "Main Floor & Deck",
    floorId: "6aff33e9.ee6a57ff",
    sqFt: "808.12 sq ft (609.64 living)",
    ceiling: "8' 0\"",
    baseY: 5.8,
    explodeOffset: 12.5,
    color: "#34d399",
  },
  garage: {
    id: "garage",
    label: "Garage Conv. / In-Law Suite",
    floorId: "6aff35f4.20ed9fff",
    sqFt: "705.24 sq ft",
    ceiling: "8' 0\" (PDF sensor reads 13' 6\")",
    baseY: 0.4,
    explodeOffset: 6.0,
    color: "#fbbf24",
  },
  crawl: {
    id: "crawl",
    label: "Crawl Space / Cellar",
    floorId: "6aff3f03.da4ce7ff",
    sqFt: "467.58 sq ft",
    ceiling: "5' 5\"",
    baseY: 0.0,
    explodeOffset: 0.0,
    color: "#a78bfa",
  },
};

export function getMagicplanUrl(floorKey, mode = "360") {
  const base = `https://cloud.magicplan.app/plan/${PROPERTY_META.magicplanId}`;
  if (mode === "photos") return `${base}/images/list`;
  const floor = MAGICPLAN_FLOORS[floorKey] || MAGICPLAN_FLOORS.main;
  return `${base}/sketch/${mode}/${floor.floorId}`;
}

// First-Person Eye-Level Teleport Presets (updated for corrected 90° Garage Conversion & Crawl Space door)
export const TELEPORT_SPOTS = [
  { id: "tp-living", label: "Main Living Room (Entry)", floor: "main", x: -12.0, z: 7.5, yaw: 0.25, eyeH: 5.3 },
  { id: "tp-dining", label: "Dining Room & Patio", floor: "main", x: -16.0, z: -4.0, yaw: -0.6, eyeH: 5.3 },
  { id: "tp-kitchen", label: "Main Kitchen", floor: "main", x: -7.2, z: -2.6, yaw: -0.45, eyeH: 5.3 },
  { id: "tp-deck", label: "Rear Balcony / Deck", floor: "main", x: -11.0, z: -20.5, yaw: 3.14, eyeH: 5.3 },
  { id: "tp-primary", label: "Upstairs Primary Suite", floor: "upstairs", x: 16.8, z: -6.2, yaw: 3.14, eyeH: 5.3 },
  { id: "tp-pribath", label: "Primary Bath (Extended Shower)", floor: "upstairs", x: 6.5, z: -4.2, yaw: 0.72, eyeH: 5.3 },
  { id: "tp-upbath", label: "Upstairs Hall Bath", floor: "upstairs", x: 5.4, z: 1.5, yaw: 1.2, eyeH: 5.3 },
  { id: "tp-garage", label: "In-Law Living (Back-Right)", floor: "garage", x: 14.0, z: -1.0, yaw: -0.5, eyeH: 5.3 },
  { id: "tp-kitchenette", label: "In-Law Kitchenette (Front-Right)", floor: "garage", x: 16.5, z: 9.2, yaw: -1.32, eyeH: 5.3 },
  { id: "tp-lowerbed", label: "In-Law Bedroom (Front-Left)", floor: "garage", x: 7.2, z: 11.2, yaw: 0.4, eyeH: 5.3 },
  { id: "tp-gbath", label: "Lower Bath (Back-Left)", floor: "garage", x: 7.2, z: -6.8, yaw: 1.1, eyeH: 5.3 },
  { id: "tp-crawl", label: "Crawl Space (Rear Door & WH)", floor: "crawl", x: -11.2, z: -2.2, yaw: -0.52, eyeH: 3.9 },
];

// Detailed Room Definitions with Segmented Wall Openings (Doors, Archways, Windows)
// Wall keys: north (at z = room.z), south (at z = room.z + room.d), west (at x = room.x), east (at x = room.x + room.w)
// Opening "pos" is distance in feet from the wall's minimum coordinate (x for north/south, z for west/east).
export const ROOMS = [
  // === LEVEL 1: CRAWL SPACE ===
  {
    id: "crawl-cellar",
    name: "Crawl Space / Cellar",
    floor: "crawl",
    x: -21.5,
    z: -11.1,
    w: 21.5,
    d: 23.0,
    h: 5.4,
    floorTex: "crawlDirt",
    afterFloorTex: "vaporBarrier",
    wallTex: "cinderBlock",
    dims: "21' 5\" × 22' 8\" (468 sq ft)",
    notes:
      "Rear (-Z) door looking out toward Rear Balcony/Deck with electric water heater right next to it. As-Is: ~10% falling fiberglass insulation + wood/drywall/trash debris. After Rehab: remove insulation & debris (no new insulation), clean optional vapor barrier & pre-listing moisture check.",
    walls: {
      north: {
        openings: [
          { type: "vent", pos: 3.5, w: 1.6, h: 0.8, sill: 3.8 },
          { type: "door", pos: 13.5, w: 2.8, h: 4.4, isExterior: true, doorColor: 0x3f2e21, openAngle: 0.65 }, // Rear door under Rear Deck
          { type: "vent", pos: 18.2, w: 1.6, h: 0.8, sill: 3.8 },
        ],
      },
      south: { openings: [{ type: "vent", pos: 10, w: 1.6, h: 0.8, sill: 3.8 }] },
      west: { openings: [{ type: "vent", pos: 4.5, w: 1.6, h: 0.8, sill: 3.8 }, { type: "vent", pos: 15.0, w: 1.6, h: 0.8, sill: 3.8 }] },
      east: { openings: [] },
    },
  },

  // === LEVEL 3: MAIN FLOOR & REAR DECK ===
  {
    id: "main-living",
    name: "Living Room",
    floor: "main",
    x: -21.5,
    z: 0.0,
    w: 21.5,
    d: 11.9,
    h: 8.0,
    floorTex: "lvpOak",
    afterFloorTex: "lvpOak",
    wallTex: "drywall",
    dims: "21' 7\" × 11' 11\" (271 sq ft)",
    notes:
      "Front-facing triple window (remove curtain rods & draperies in After Rehab), front entry door, ceiling fan, right-side entry laundry area (close open drywall/exposed PVC + add GFCI & code verification).",
    walls: {
      north: {
        openings: [
          { type: "arch", pos: 2.2, w: 6.5, h: 7.0 }, // Open to Dining Room
          { type: "door", pos: 13.5, w: 3.0, h: 6.8, openAngle: 1.2 }, // To Kitchen
        ],
      },
      south: {
        openings: [
          { type: "window", pos: 4.0, w: 8.2, h: 4.5, sill: 2.2, panes: 3 }, // Front triple window
          { type: "door", pos: 16.5, w: 3.2, h: 6.8, isExterior: true, doorColor: 0xf8fafc, openAngle: 0.35 }, // Front Entry Door
        ],
      },
      west: {
        openings: [{ type: "window", pos: 3.8, w: 3.6, h: 4.2, sill: 2.5, panes: 2 }],
      },
      east: {
        openings: [
          { type: "arch", pos: 1.8, w: 6.2, h: 7.2 }, // Split-level stair opening to Upstairs & Lower Level
        ],
      },
    },
  },
  {
    id: "main-dining",
    name: "Dining Room",
    floor: "main",
    x: -21.5,
    z: -11.1,
    w: 11.0,
    d: 11.1,
    h: 8.0,
    floorTex: "tileWorn",
    afterFloorTex: "lvpOak",
    wallTex: "drywall",
    dims: "11' 0\" × 11' 1\" (121 sq ft)",
    notes:
      "New LVP over existing worn tile, full interior paint (walls/trim/ceilings), modern statement light fixture replacing dated chandelier, French doors to Rear Deck.",
    walls: {
      north: {
        openings: [
          { type: "french", pos: 2.8, w: 5.4, h: 6.8 }, // Double glass patio doors to Rear Deck
        ],
      },
      south: { skip: true }, // Shared with Living Room
      west: {
        openings: [{ type: "window", pos: 3.5, w: 3.6, h: 4.2, sill: 2.5, panes: 2 }],
      },
      east: {
        openings: [{ type: "arch", pos: 3.2, w: 4.4, h: 7.0 }], // Pass-through to Kitchen
      },
    },
  },
  {
    id: "main-kitchen",
    name: "Kitchen",
    floor: "main",
    x: -10.5,
    z: -11.1,
    w: 10.5,
    d: 11.1,
    h: 8.0,
    floorTex: "tileWorn",
    afterFloorTex: "lvpOak",
    wallTex: "drywall",
    dims: "10' 4\" × 11' 2\" (115 sq ft)",
    notes:
      "Same layout: brand-new white shaker cabinets, brand-new granite countertops, 1 large single-bowl deep-dish sink w/ gooseneck faucet, GFCI outlets near water, salvage existing SS electric range & microwave, new SS refrigerator, new LVP over tile.",
    walls: {
      north: {
        openings: [{ type: "window", pos: 3.4, w: 3.6, h: 3.4, sill: 3.6, panes: 2 }], // Window over sink
      },
      south: { skip: true }, // Shared with Living Room
      west: { skip: true }, // Shared with Dining Room
      east: { openings: [] },
    },
  },
  {
    id: "main-deck",
    name: "Rear Balcony / Deck",
    floor: "main",
    x: -21.5,
    z: -27.2,
    w: 22.0,
    d: 16.1,
    h: 3.4,
    isDeck: true,
    floorTex: "deckWeathered",
    afterFloorTex: "deckStained",
    dims: "24' 6\" × 16' 10\" (208 sq ft)",
    notes: "Elevated wood deck above crawl space rear door with structural joists, railings, balusters & stairs down to backyard. Pressure wash & stain in After Rehab.",
  },

  // === LEVEL 2: GARAGE CONVERSION / IN-LAW SUITE (90° Corrected Driveway Orientation, Magicplan Page 26) ===
  // Standing in driveway looking at front: +Z = Front/Driveway, -Z = Rear/Backyard, -X = Left, +X = Right
  {
    id: "garage-bath",
    name: "Lower Bath (Back-Left)",
    floor: "garage",
    x: 0.0,
    z: -10.5,
    w: 10.7,
    d: 5.5,
    h: 8.0,
    floorTex: "tileSlate",
    afterFloorTex: "tileClean",
    wallTex: "drywall",
    dims: "10' 8.5\" × 5' 5.25\" (58.23 sq ft)",
    notes:
      "Marker #9 (Top-Left next to interior stairs). As-Is: exposed cast-iron & PVC plumbing lines behind toilet, shower curtain rod, stained pebble pan. After Rehab: box in plumbing lines, deep-clean/recaulk/reseal shower tiles + glass shower enclosure + new vanity + GFCI outlet.",
    walls: {
      north: {
        openings: [{ type: "window", pos: 5.4, w: 2.4, h: 2.2, sill: 4.8, panes: 1 }],
      },
      south: {
        openings: [{ type: "door", pos: 6.2, w: 2.8, h: 6.8, openAngle: 0.9 }], // Into Living Room near stairs
      },
      west: { openings: [] },
      east: { openings: [] },
    },
  },
  {
    id: "garage-living",
    name: "In-Law Living Room (Back-Right)",
    floor: "garage",
    x: 3.4,
    z: -10.5,
    w: 21.1,
    d: 16.0,
    rects: [
      { x: 0.0, z: -5.0, w: 3.4, d: 10.5 }, // Stairwell bottom landing & hall under upper stairs
      { x: 3.4, z: -5.0, w: 21.1, d: 10.5 }, // Main lower living zone (between stairs/bath and front rooms)
      { x: 10.7, z: -10.5, w: 13.8, d: 5.5 }, // Top-Right backyard wing
    ],
    h: 8.0,
    floorTex: "concreteStained",
    afterFloorTex: "lvpOak",
    wallTex: "drywall",
    dims: "14' 2.75\" × 28' 2.25\" (292.67 sq ft)",
    notes:
      "Marker #12 (Back-Right). Backyard exterior door, 5 recessed lights + ceiling fan, washer connection + 240V dryer outlet, stairwell access. After Rehab: new LVP floor, closed breaker panel, wall-mounted Ductless Mini-Split HVAC, open flow into Front-Right Kitchenette.",
    customWalls: [
      // Top-Right North exterior wall (Z = -10.5, X = 10.7..24.5) with Backyard Door + Window
      {
        axis: "x",
        start: 10.7,
        len: 13.8,
        fixedZ: -10.5 + 0.19,
        openings: [
          { type: "door", pos: 2.6, w: 3.0, h: 6.8, isExterior: true, doorColor: 0xf8fafc, openAngle: 0.45 },
          { type: "window", pos: 7.6, w: 3.8, h: 4.0, sill: 2.6, panes: 2 },
        ],
      },
      // East exterior wall (X = 24.5, Z = -10.5..5.5) with 2 windows + Mini-Split zone between them
      {
        axis: "z",
        start: -10.5,
        len: 16.0,
        fixedX: 24.5 - 0.19,
        openings: [
          { type: "window", pos: 2.4, w: 3.5, h: 3.8, sill: 2.8, panes: 2 },
          { type: "window", pos: 10.6, w: 3.5, h: 3.8, sill: 2.8, panes: 2 },
        ],
      },
      // Stairwell separation wall (X = 3.4, Z = -1.6..5.5), leaving Z = -5.0..-1.6 open for stairs
      {
        axis: "z",
        start: -1.6,
        len: 7.1,
        fixedX: 3.4 + 0.19,
        openings: [],
      },
      // Stairwell west backing wall (X = 0.19, Z = -5.0..5.5, height 5.4' up to Main Floor slab)
      {
        axis: "z",
        start: -5.0,
        len: 10.5,
        fixedX: 0.19,
        h: 5.4,
        openings: [],
      },
    ],
  },
  {
    id: "garage-bed1",
    name: "In-Law Bedroom (Front-Left)",
    floor: "garage",
    x: 0.0,
    z: 5.5,
    w: 13.8,
    d: 10.3,
    h: 8.0,
    floorTex: "lvpOak",
    afterFloorTex: "lvpOak",
    wallTex: "drywall",
    dims: "10' 3.75\" × 13' 5.5\" (138.67 sq ft)",
    notes:
      "Marker #11 (Bottom-Left next to stairs). Front window looking at driveway, interior door to Living Room. As-Is: no closet & fake HVAC vent. After Rehab: add framed closet system next to stairs for true conforming bedroom + Mini-Split conditioned suite.",
    walls: {
      north: {
        openings: [{ type: "door", pos: 8.6, w: 2.8, h: 6.8, openAngle: -0.9 }], // Into Living Room
      },
      south: {
        openings: [{ type: "window", pos: 5.0, w: 3.8, h: 4.0, sill: 2.6, panes: 2 }], // Front Driveway Window
      },
      west: { openings: [] },
      east: { openings: [] },
    },
  },
  {
    id: "garage-bed2",
    name: "Front-Right Room → In-Law Kitchenette",
    floor: "garage",
    x: 13.8,
    z: 5.5,
    w: 10.7,
    d: 10.3,
    h: 8.0,
    floorTex: "lvpOak",
    afterFloorTex: "lvpOak",
    wallTex: "drywall",
    dims: "10' 4\" × 10' 3.5\" (106.18 sq ft)",
    notes:
      "Marker #10 (Bottom-Right). Exterior door leading in from driveway. As-Is: enclosed room with interior door into Living Room. After Rehab: knock down interior wall into Living Room to convert into an open Kitchen / Kitchenette (white shaker cabinets, granite counter, sink, fridge nook, GFCI).",
    walls: {
      north: {
        demolishAfter: true, // Interior wall demolished in After Rehab to open Kitchenette to Living Room!
        openings: [{ type: "door", pos: 2.0, w: 2.8, h: 6.8, openAngle: 0.9 }],
      },
      south: {
        openings: [
          { type: "door", pos: 1.8, w: 3.2, h: 6.8, isExterior: true, doorColor: 0xf8fafc, openAngle: -0.45 }, // Exterior Driveway Entry Door
          { type: "window", pos: 6.6, w: 2.4, h: 3.8, sill: 2.8, panes: 1 },
        ],
      },
      west: { skip: true }, // Shared with Front-Left bedroom east wall
      east: { openings: [{ type: "window", pos: 3.4, w: 3.4, h: 3.8, sill: 2.8, panes: 2 }] },
    },
  },

  // === LEVEL 4: UPSTAIRS ===
  {
    id: "up-hall",
    name: "Upstairs Hallway",
    floor: "upstairs",
    x: 0.0,
    z: 3.4,
    w: 12.2,
    d: 3.1,
    h: 8.1,
    floorTex: "lvpOak",
    afterFloorTex: "lvpOak",
    wallTex: "drywall",
    dims: "14' 9\" × 3' 0\" (44 sq ft)",
    notes: "Connects split-level stairs to Upstairs Hall Bath, Primary Bedroom, and Bedrooms 2 & 3.",
    walls: {
      north: {
        openings: [
          { type: "door", pos: 4.2, w: 2.6, h: 6.8, openAngle: -0.9 }, // To Hall Bath
          { type: "door", pos: 8.8, w: 2.8, h: 6.8, openAngle: 0.9 }, // To Primary Bedroom
        ],
      },
      south: {
        openings: [{ type: "door", pos: 5.5, w: 2.8, h: 6.8, openAngle: 0.85 }], // To Upstairs Bed 2
      },
      west: {
        openings: [{ type: "arch", pos: 0.2, w: 2.7, h: 7.2 }], // Top of stairs from Main Floor
      },
      east: {
        openings: [{ type: "door", pos: 0.2, w: 2.7, h: 6.8, openAngle: -0.85 }], // To Upstairs Bed 3
      },
    },
  },
  {
    id: "up-primary-bed",
    name: "Primary Bedroom",
    floor: "upstairs",
    x: 8.3,
    z: -10.5,
    w: 16.2,
    d: 13.9,
    h: 8.1,
    floorTex: "lvpOak",
    afterFloorTex: "lvpOak",
    wallTex: "drywall",
    dims: "16' 5\" × 14' 4\" (225 sq ft)",
    notes:
      "As-Is: open closet organizer shelving. After Rehab: frame dedicated closed reach-in closet with double doors so King bed, nightstands & mounted TV wall lay out cleanly.",
    walls: {
      north: {
        openings: [
          { type: "window", pos: 3.5, w: 3.8, h: 4.2, sill: 2.5, panes: 2 },
          { type: "window", pos: 10.2, w: 3.8, h: 4.2, sill: 2.5, panes: 2 },
        ],
      },
      south: { skip: true }, // Shared with Hall & Bed 3
      west: {
        openings: [{ type: "door", pos: 3.5, w: 2.8, h: 6.8, openAngle: 0.9 }], // To Primary Bath
      },
      east: {
        openings: [{ type: "window", pos: 5.0, w: 3.8, h: 4.2, sill: 2.5, panes: 2 }],
      },
    },
  },
  {
    id: "up-primary-bath",
    name: "Primary Bathroom",
    floor: "upstairs",
    x: 0.0,
    z: -10.5,
    w: 8.3,
    d: 8.8,
    h: 8.1,
    floorTex: "tileSlate",
    afterFloorTex: "tileClean",
    wallTex: "drywall",
    dims: "9' 7\" × 8' 10\" (69 sq ft)",
    notes:
      "Salvage 6-drawer double vanity (touch up nicks, replace all hardware incl. missing top-left pull), install mirror + GFCI, salvage toilet, remove curtain rod, extend shower toward intact right window w/ modern ceramic tile + swinging glass enclosure (replacing pebble floor).",
    walls: {
      north: { openings: [{ type: "window", pos: 5.9, w: 1.8, h: 2.8, sill: 4.1, panes: 1 }] },
      south: { openings: [] },
      west: { openings: [] },
      east: { skip: true },
    },
  },
  {
    id: "up-hall-bath",
    name: "Upstairs Hall Bath",
    floor: "upstairs",
    x: 0.0,
    z: -1.7,
    w: 8.3,
    d: 5.1,
    h: 8.1,
    floorTex: "tileSlate",
    afterFloorTex: "tileClean",
    wallTex: "drywall",
    dims: "8' 3\" × 5' 1\" (42 sq ft)",
    notes:
      "As-Is: missing vanity w/ exposed pipes & P-trap. After Rehab: salvage shower tile (deep clean/recaulk/reseal) + install glass sliding shower door, new vanity over plumbing, salvage toilet, GFCI protection.",
    walls: {
      north: { skip: true },
      south: { skip: true },
      west: { openings: [] },
      east: { skip: true },
    },
  },
  {
    id: "up-bed2",
    name: "Upstairs Bedroom 2",
    floor: "upstairs",
    x: 0.0,
    z: 6.5,
    w: 12.2,
    d: 9.3,
    h: 8.1,
    floorTex: "lvpOak",
    afterFloorTex: "lvpOak",
    wallTex: "drywall",
    dims: "12' 1\" × 9' 3\" (111 sq ft)",
    notes: "Front-left upstairs bedroom. Replace mismatched ceiling fan with matching modern ceiling fan + full paint.",
    walls: {
      north: { skip: true },
      south: { openings: [{ type: "window", pos: 4.2, w: 3.8, h: 4.2, sill: 2.5, panes: 2 }] },
      west: { openings: [{ type: "window", pos: 2.8, w: 3.4, h: 4.0, sill: 2.6, panes: 2 }] },
      east: { skip: true },
    },
  },
  {
    id: "up-bed3",
    name: "Upstairs Bedroom 3",
    floor: "upstairs",
    x: 12.2,
    z: 3.4,
    w: 12.3,
    d: 12.4,
    h: 8.1,
    floorTex: "lvpOak",
    afterFloorTex: "lvpOak",
    wallTex: "drywall",
    dims: "9' 11\" × 12' 8\" (125 sq ft)",
    notes: "Front-right upstairs bedroom. Replace mismatched ceiling fan with matching modern ceiling fan + full paint.",
    walls: {
      north: { openings: [] },
      south: { openings: [{ type: "window", pos: 4.2, w: 3.8, h: 4.2, sill: 2.5, panes: 2 }] },
      west: { openings: [] },
      east: { openings: [{ type: "window", pos: 4.2, w: 3.6, h: 4.0, sill: 2.6, panes: 2 }] },
    },
  },
];

// 360° Panorama Camera Hotspots (matching numbered markers #1–#12 + Crawl Space in Magicplan PDF)
export const PANO_PINS = [
  { id: "pano-1", num: "1", label: "360° Upstairs Hall Bath", floor: "upstairs", x: 4.1, z: 0.8 },
  { id: "pano-2", num: "2", label: "360° Primary Bath", floor: "upstairs", x: 4.1, z: -6.0 },
  { id: "pano-3", num: "3", label: "360° Upstairs Bed 2", floor: "upstairs", x: 6.0, z: 11.0 },
  { id: "pano-4", num: "4", label: "360° Upstairs Bed 3", floor: "upstairs", x: 18.5, z: 9.8 },
  { id: "pano-5", num: "5", label: "360° Primary Bedroom", floor: "upstairs", x: 16.4, z: -3.3 },
  { id: "pano-6", num: "6", label: "360° Rear Balcony / Deck", floor: "main", x: -10.5, z: -19.0 },
  { id: "pano-7", num: "7", label: "360° Kitchen", floor: "main", x: -5.2, z: -5.5 },
  { id: "pano-8", num: "8", label: "360° Main Living Room", floor: "main", x: -11.0, z: 6.0 },
  { id: "pano-9", num: "9", label: "360° Lower Bath (Back-Left)", floor: "garage", x: 5.4, z: -7.7 },
  { id: "pano-10", num: "10", label: "360° Front-Right Room / Kitchenette", floor: "garage", x: 19.2, z: 10.6 },
  { id: "pano-11", num: "11", label: "360° Front-Left Bedroom", floor: "garage", x: 6.9, z: 10.6 },
  { id: "pano-12", num: "12", label: "360° Garage Conv. Living (Back-Right)", floor: "garage", x: 15.5, z: -2.0 },
  { id: "pano-13", num: "C", label: "360° Crawl Space (Rear Door)", floor: "crawl", x: -7.0, z: -6.5 },
];

// Pre-loaded Rehab Scope & Budget Items (In-Law Suite + Mini-Split + Room-by-Room Salvage vs. Replace)
export const DEFAULT_REHAB_ITEMS = [
  {
    id: "rehab-hvac-central",
    title: "Half-House Central Heat Pump HVAC (Main & Upstairs)",
    category: "Mechanical / GLA",
    priority: "Must-Do",
    floor: "main",
    pin: { x: -8.0, z: 2.0 },
    low: 6500,
    high: 10500,
    included: true,
    evidence: "No central HVAC currently installed; basement vents are fake. Condition Main Floor + Upstairs (~1,381 sq ft) with central heat pump + ductwork.",
    notes:
      "Install central heat pump/air handler + exterior condenser (left wing). Pair with lower-level ductless mini-split so 100% of 2,086 sq ft qualifies as heated/cooled living area.",
  },
  {
    id: "rehab-minisplit",
    title: "Garage Conv. Ductless Heat-Pump Mini-Split + Exterior Condenser",
    category: "Mechanical / GLA",
    priority: "Must-Do",
    floor: "garage",
    pin: { x: 22.0, z: -1.5 },
    low: 2600,
    high: 4500,
    included: true,
    evidence: "705 sq ft Garage Conversion currently has fake wall vents and zero conditioning, risking $0 appraisal GLA contributory value.",
    notes:
      "Install high-efficiency wall-mounted ductless heat-pump mini-split (multi-zone or open suite unit) + exterior condenser outside East wall so all 705 sq ft count toward heated/cooled appraisal value.",
  },
  {
    id: "rehab-inlaw-conversion",
    title: "In-Law Suite Conversion: Knock Wall to Open Kitchenette + Front-Left Bedroom Closet",
    category: "Value-Add / Layout",
    priority: "Value-Add",
    floor: "garage",
    pin: { x: 18.5, z: 5.5 },
    low: 4500,
    high: 8500,
    included: true,
    evidence: "Magicplan Page 26: Front-Right (#10, 106 sf) has driveway entry door; Front-Left (#11, 139 sf) lacks a closet; Back-Right Living (#12, 293 sf) has washer/dryer hookups.",
    notes:
      "Knock down interior wall between Front-Right & Living Room to build open Kitchenette (cabinets, counter, sink, fridge nook, GFCI); frame reach-in closet in Front-Left room next to stairs so it qualifies as a conforming bedroom; verify washer/dryer hookup.",
  },
  {
    id: "rehab-kitchen",
    title: "Main Kitchen: White Shaker Cabinets, Granite, Deep Single Sink & Fridge",
    category: "Kitchen / ARV",
    priority: "Value-Add",
    floor: "main",
    pin: { x: -5.5, z: -6.5 },
    low: 6800,
    high: 11500,
    included: true,
    evidence: "Same layout saves plumbing/electrical moves. Salvage working matching SS electric range & microwave; add brand-new shaker cabinets, granite, deep bowl sink & SS fridge.",
    notes:
      "Install white shaker cabinets, granite countertops, 1 large single-bowl deep-dish sink w/ gooseneck faucet, GFCI receptacles near water, new SS refrigerator, and keep salvaged matching SS range & microwave.",
  },
  {
    id: "rehab-paint-lvp-fixtures",
    title: "Full Interior Paint, New LVP Over Tile, Modern Dining Lights & Remove Living Curtains",
    category: "Cosmetic / ARV",
    priority: "Must-Do",
    floor: "main",
    pin: { x: -15.5, z: 1.0 },
    low: 6500,
    high: 10800,
    included: true,
    evidence: "Worn tile in Kitchen (115 sf) & Dining (121 sf), raw/tiled Garage Living (293 sf), heavy curtain rods in front Living window, dated dining light.",
    notes:
      "Full interior paint (walls, trim, ceilings), lay new waterproof LVP over Kitchen/Dining/Garage Living, replace Dining chandelier with modern fixture, and delete Living Room curtain rods/draperies.",
  },
  {
    id: "rehab-primary-suite",
    title: "Primary Suite: Extended Ceramic Shower w/ Swinging Glass, Vanity Hardware/Mirror & Closet",
    category: "Primary / Bath",
    priority: "Value-Add",
    floor: "upstairs",
    pin: { x: 4.5, z: -5.5 },
    low: 4200,
    high: 7800,
    included: true,
    evidence: "Primary Bath 6-drawer double vanity salvageable (missing top-left pull, nicks); pebble shower floor & curtain rod dated; Primary Bed needs closed closet wall.",
    notes:
      "Touch up vanity & replace all 6 hardware pulls, add large mirror + GFCI, salvage toilet, remove curtain rod, extend shower toward intact right window w/ modern ceramic tile + swinging glass door; frame closed reach-in closet in Primary Bedroom.",
  },
  {
    id: "rehab-up-hall-bath-fans",
    title: "Upstairs Hall Bath (New Vanity, Glass Sliding Door, GFCI) + Matching Bedroom Fans",
    category: "Plumbing / Fixtures",
    priority: "Must-Do",
    floor: "upstairs",
    pin: { x: 4.0, z: 1.5 },
    low: 2400,
    high: 4600,
    included: true,
    evidence: "Hall Bath vanity missing with exposed pipes; existing shower tiles & toilet salvageable; Bedrooms 2 & 3 have mismatching ceiling fans.",
    notes:
      "Deep-clean/recaulk/reseal Hall Bath shower tiles + install glass sliding shower door, install new vanity over exposed plumbing + GFCI, salvage toilet, and install matching modern ceiling fans in Bedrooms 2 & 3.",
  },
  {
    id: "rehab-garage-bath",
    title: "Lower In-Law Bath: Box Cast-Iron/PVC Lines, Glass Enclosure, Vanity & GFCI",
    category: "Plumbing / Bath",
    priority: "Must-Do",
    floor: "garage",
    pin: { x: 5.5, z: -8.0 },
    low: 2200,
    high: 4400,
    included: true,
    evidence: "PDF Page 30: Exposed cast-iron & PVC lines behind toilet, shower curtain rod, missing vanity.",
    notes:
      "Frame & drywall chase to hide exposed cast-iron/PVC plumbing behind toilet, deep-clean/recaulk/reseal salvageable shower tiles, replace curtain rod with glass shower enclosure, install new vanity + GFCI outlet.",
  },
  {
    id: "rehab-electrical-laundry-sewer",
    title: "Critical Blind Spots: Breaker Panel/Amperage, GFCI Upgrades, Laundry Wall & Sewer Check",
    category: "Safety / Code",
    priority: "Must-Do",
    floor: "main",
    pin: { x: -1.8, z: 8.8 },
    low: 1400,
    high: 3200,
    included: true,
    evidence: "Open stairwell breaker panel (PDF Page 28), open laundry studs/PVC in Main Living (Page 25), water-adjacent outlets lack GFCI; confirm public sewer vs. septic.",
    notes:
      "PRE-LISTING BLIND SPOTS: (1) Confirm Public Sewer vs. Septic before marketing bedroom/in-law count. (2) Close stairwell breaker panel + verify service amperage for HVAC + Mini-Split + Kitchenette + laundry. (3) Upgrade all wet-area outlets to GFCI; drywall/finish Main Living laundry wall.",
  },
  {
    id: "rehab-crawl-exterior",
    title: "Crawl Space Cleanup + Exterior Wash, Blue Trim, Tree Trim, Gutters & Downspout Fix",
    category: "Exterior / Crawl",
    priority: "Must-Do",
    floor: "crawl",
    pin: { x: -7.0, z: -9.0 },
    low: 2400,
    high: 5200,
    included: true,
    evidence: "PDF Pages 2–3, 19, 37–40: ~10% falling crawl insulation & wood/drywall/trash debris; purple bucket & wood trough at corner downspout; black CMU hole/cracks/rusted vent; overhanging right-rear branches & loose rear gutters.",
    notes:
      "Remove/discard all falling crawl insulation (no new insulation to stay lean) & debris + add optional vapor barrier + inspect for water stains/moisture. Exterior: pressure wash, blue trim touch-up, trim right-rear limbs, re-nail rear gutters, replace bucket/trough w/ downspout extension, patch foundation hole/cracks/vent.",
  },
];
