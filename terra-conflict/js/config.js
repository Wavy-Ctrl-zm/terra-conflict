/* ============================================================
   TERRA CONFLICT: Global Warfare
   config.js — Constants, Factions, Map Definitions
   ============================================================ */
'use strict';

var TC = window.TC || {};

TC.TILE      = 32;          // px per tile
TC.MAP_W     = 38;          // tiles wide
TC.MAP_H     = 28;          // tiles tall
TC.CANVAS_W  = 900;
TC.CANVAS_H  = 580;

// Tile types
TC.T = { FLOOR:0, WALL:1, WATER:2, VEG:3, BUSH:4, ROAD:5 };

// ── Factions ──────────────────────────────────────────────
TC.FACTIONS = [
  {
    id: 'lusaka',
    name: 'Lusaka Grey Force',
    subtitle: 'Zambian Elite Jungle Unit',
    flag: '🇿🇲',
    color: '#3a8a2a',
    darkColor: '#1a4a10',
    description: 'Masters of jungle warfare. Silent, adaptive, deadly in dense terrain.',
    weapon: { name:'AK Jungle', damage:28, fireRate:0.14, range:320, spread:0.06, clip:30, reloadTime:2.0, color:'#5a4a2a' },
    secondary: { name:'Jungle Pistol', damage:22, fireRate:0.3, range:200, spread:0.08, clip:12, reloadTime:1.5, color:'#3a3a2a' },
    speed: 185,
    health: 100,
    bodyColor: '#3a6a20',
    helmetColor: '#2d5010',
    tacticalAdvantage: 'bush' // move faster through bushes
  },
  {
    id: 'sahel',
    name: 'Sahelian Sand Hawks',
    subtitle: 'Desert Elite Operators',
    flag: '🌍',
    color: '#c8913a',
    darkColor: '#7a5520',
    description: 'Long-range desert specialists. Precision, patience, and suppression.',
    weapon: { name:'Desert Marksman', damage:55, fireRate:0.45, range:500, spread:0.02, clip:10, reloadTime:2.5, color:'#c8a06a' },
    secondary: { name:'Sand SMG', damage:18, fireRate:0.09, range:180, spread:0.12, clip:25, reloadTime:1.8, color:'#8a7050' },
    speed: 170,
    health: 90,
    bodyColor: '#c8913a',
    helmetColor: '#8a6020',
    tacticalAdvantage: 'desert'
  },
  {
    id: 'cipher',
    name: 'Cipher PMC',
    subtitle: 'Urban Tactical Operators',
    flag: '🌐',
    color: '#5a5a7a',
    darkColor: '#2a2a4a',
    description: 'All-environment contractors. Versatile, heavily equipped, dangerous anywhere.',
    weapon: { name:'Combat Rifle', damage:32, fireRate:0.12, range:360, spread:0.05, clip:35, reloadTime:1.8, color:'#3a3a4a' },
    secondary: { name:'Urban Shotgun', damage:70, fireRate:0.7, range:120, spread:0.35, clip:6, reloadTime:2.2, color:'#2a2a3a' },
    speed: 175,
    health: 115,
    bodyColor: '#3a3a5a',
    helmetColor: '#1a1a3a',
    tacticalAdvantage: 'urban'
  }
];

// ── Map Builders ──────────────────────────────────────────
function mkMap() {
  var tiles = [];
  for (var y = 0; y < TC.MAP_H; y++) {
    tiles[y] = [];
    for (var x = 0; x < TC.MAP_W; x++) {
      tiles[y][x] = TC.T.FLOOR;
    }
  }
  return tiles;
}
function setRect(t, x, y, w, h, tile) {
  for (var dy = 0; dy < h; dy++)
    for (var dx = 0; dx < w; dx++)
      if (y+dy >= 0 && y+dy < TC.MAP_H && x+dx >= 0 && x+dx < TC.MAP_W)
        t[y+dy][x+dx] = tile;
}
function setBorder(t) {
  for (var x = 0; x < TC.MAP_W; x++) { t[0][x] = TC.T.WALL; t[TC.MAP_H-1][x] = TC.T.WALL; }
  for (var y = 0; y < TC.MAP_H; y++) { t[y][0] = TC.T.WALL; t[y][TC.MAP_W-1] = TC.T.WALL; }
}
function setHollow(t, x, y, w, h, wallT, floorT) {
  setRect(t, x, y, w, h, wallT);
  if (w > 2 && h > 2) setRect(t, x+1, y+1, w-2, h-2, floorT);
}
// Cut a door opening in hollow building
function setDoor(t, x, y) { t[y][x] = TC.T.FLOOR; }

// ── ZAMBIA JUNGLE MAP ─────────────────────────────────────
TC.buildZambiaMap = function() {
  var t = mkMap();
  setBorder(t);

  // Dense forest clusters (VEG = impassable, dark)
  setRect(t, 2, 2, 5, 6, TC.T.VEG);
  setRect(t, 4, 3, 3, 4, TC.T.VEG);
  setRect(t, 28, 2, 6, 5, TC.T.VEG);
  setRect(t, 31, 4, 4, 6, TC.T.VEG);
  setRect(t, 2, 18, 5, 7, TC.T.VEG);
  setRect(t, 30, 19, 7, 6, TC.T.VEG);
  setRect(t, 14, 2, 4, 3, TC.T.VEG);
  setRect(t, 20, 20, 5, 5, TC.T.VEG);
  setRect(t, 8, 14, 3, 5, TC.T.VEG);
  setRect(t, 25, 10, 4, 5, TC.T.VEG);

  // Bush patches (passable cover)
  setRect(t, 9, 3, 2, 2, TC.T.BUSH);
  setRect(t, 22, 5, 3, 2, TC.T.BUSH);
  setRect(t, 6, 10, 2, 3, TC.T.BUSH);
  setRect(t, 20, 12, 2, 2, TC.T.BUSH);
  setRect(t, 15, 18, 3, 2, TC.T.BUSH);
  setRect(t, 28, 14, 2, 3, TC.T.BUSH);
  setRect(t, 12, 22, 3, 2, TC.T.BUSH);
  setRect(t, 33, 13, 2, 2, TC.T.BUSH);

  // River (water, diagonal-ish)
  for (var i = 0; i < 10; i++) {
    var rx = 16 + i;
    var ry = 6 + Math.floor(i * 1.4);
    if (rx < TC.MAP_W-1 && ry < TC.MAP_H-1) {
      t[ry][rx] = TC.T.WATER;
      if (ry+1 < TC.MAP_H-1) t[ry+1][rx] = TC.T.WATER;
    }
  }
  // widen river at centre
  for (var j = 16; j < 24; j++) {
    if (t[12][j] === TC.T.FLOOR) t[12][j] = TC.T.WATER;
    if (t[13][j] === TC.T.FLOOR) t[13][j] = TC.T.WATER;
  }

  // Ranger outpost (hollow building, two doors)
  setHollow(t, 11, 9, 7, 5, TC.T.WALL, TC.T.FLOOR);
  setDoor(t, 13, 9);   // top door
  setDoor(t, 13, 13);  // bottom door
  setDoor(t, 11, 11);  // left door

  // Secondary hut
  setHollow(t, 22, 16, 5, 4, TC.T.WALL, TC.T.FLOOR);
  setDoor(t, 24, 16);
  setDoor(t, 22, 18);

  // Path through jungle
  setRect(t, 7, 11, 4, 1, TC.T.ROAD);
  setRect(t, 18, 6, 1, 4, TC.T.ROAD);
  setRect(t, 22, 9, 3, 1, TC.T.ROAD);

  return t;
};

TC.MAPS = [
  {
    id: 'zambia',
    name: 'LUANGWA SHADOW',
    subtitle: 'Zambia, Africa',
    icon: '🌿',
    description: 'Dense jungle. River crossing. Ranger outpost. Wildlife ambient.',
    palette: {
      floor:   ['#2d5a1b','#345e1f','#2a5518','#3a6a22'],
      wall:    ['#0d2b08','#0f3209','#0a2006'],
      water:   ['#1a5a5a','#1e6b6b','#165252'],
      veg:     ['#0d2b08','#112e09','#0a2506'],
      bush:    ['#2a5a10','#325f14','#285012'],
      road:    ['#7a5a20','#8a6a25','#6a4a18']
    },
    ambience: 'jungle',
    buildFn: 'buildZambiaMap',
    playerSpawn: { x: 5*TC.TILE + 16, y: 12*TC.TILE + 16 },
    enemySpawns: [
      {x:33,y:4},{x:34,y:10},{x:35,y:20},{x:30,y:25},
      {x:20,y:3},{x:22,y:22},{x:28,y:17},{x:15,y:25},
      {x:8,y:20},{x:6,y:5}
    ],
    bgColor: '#1a3a0a',
    fogColor: 'rgba(10,30,5,0.18)'
  },
  {
    id: 'sahara',
    name: 'SANDGHOST',
    subtitle: 'Sahara Desert, North Africa',
    icon: '🏜️',
    description: 'Open desert. Sandstorm events. Long-range engagement. Rock cover.',
    palette: {
      floor:   ['#d4b483','#c9a96e','#e2c88a','#ccab76'],
      wall:    ['#8b7355','#9a7f5e','#7a6345'],
      water:   ['#4a7a9a','#5a8aaa','#3a6a8a'],
      veg:     ['#8b7a45','#9a864e','#7a6a3a'],
      bush:    ['#a08a50','#b09060','#906840'],
      road:    ['#b89860','#c8a870','#a08040']
    },
    ambience: 'desert',
    buildFn: 'buildSaharaMap',
    playerSpawn: { x: 4*TC.TILE + 16, y: 14*TC.TILE + 16 },
    enemySpawns: [
      {x:33,y:5},{x:32,y:14},{x:30,y:22},{x:25,y:25},
      {x:18,y:3},{x:20,y:24},{x:28,y:10},{x:14,y:6},
      {x:35,y:18},{x:10,y:22}
    ],
    bgColor: '#b89060',
    fogColor: 'rgba(200,160,80,0.08)'
  },
  {
    id: 'urban',
    name: 'IRON GRID',
    subtitle: 'Urban District — Fictional City',
    icon: '🏙️',
    description: 'Urban warfare. Multi-floor buildings. Alleys. Central plaza.',
    palette: {
      floor:   ['#484848','#505050','#3e3e3e','#4a4a4a'],
      wall:    ['#1a1a1a','#222222','#161616'],
      water:   ['#2a4a6b','#304f72','#203d5a'],
      veg:     ['#2a5010','#305514','#203e0c'],
      bush:    ['#2a5010','#305514','#203e0c'],
      road:    ['#2e2e2e','#363636','#282828']
    },
    ambience: 'urban',
    buildFn: 'buildUrbanMap',
    playerSpawn: { x: 4*TC.TILE + 16, y: 14*TC.TILE + 16 },
    enemySpawns: [
      {x:33,y:4},{x:34,y:13},{x:33,y:22},{x:25,y:26},
      {x:18,y:2},{x:20,y:25},{x:28,y:8},{x:14,y:25},
      {x:10,y:4},{x:12,y:22}
    ],
    bgColor: '#1a1a1a',
    fogColor: 'rgba(0,0,0,0.22)'
  }
];

// ── SAHARA MAP ────────────────────────────────────────────
TC.buildSaharaMap = function() {
  var t = mkMap();
  setBorder(t);

  // Dune ridges (horizontal rock walls)
  setRect(t, 2, 6, 12, 2, TC.T.WALL);
  setRect(t, 18, 6, 10, 2, TC.T.WALL);
  setRect(t, 5, 16, 8, 2, TC.T.WALL);
  setRect(t, 20, 18, 14, 2, TC.T.WALL);
  setRect(t, 2, 22, 10, 2, TC.T.WALL);
  setRect(t, 25, 8, 10, 2, TC.T.WALL);
  setRect(t, 8, 11, 6, 1, TC.T.WALL);
  setRect(t, 30, 14, 5, 1, TC.T.WALL);

  // Rock clusters
  setRect(t, 14, 10, 3, 3, TC.T.WALL);
  setRect(t, 22, 12, 3, 3, TC.T.WALL);
  setRect(t, 6, 20, 2, 2, TC.T.WALL);
  setRect(t, 33, 20, 3, 3, TC.T.WALL);

  // Central bunker
  setHollow(t, 16, 12, 8, 6, TC.T.WALL, TC.T.FLOOR);
  setDoor(t, 18, 12);
  setDoor(t, 21, 17);
  setDoor(t, 16, 14);
  setDoor(t, 23, 14);

  // Oasis (water)
  setRect(t, 9, 22, 3, 2, TC.T.WATER);

  // Scrub vegetation (passable desert scrub)
  setRect(t, 3, 10, 2, 2, TC.T.BUSH);
  setRect(t, 15, 4, 2, 2, TC.T.BUSH);
  setRect(t, 28, 21, 2, 2, TC.T.BUSH);
  setRect(t, 32, 4, 3, 2, TC.T.BUSH);
  setRect(t, 10, 25, 3, 1, TC.T.BUSH);
  setRect(t, 24, 25, 3, 1, TC.T.BUSH);

  return t;
};

// ── URBAN MAP ─────────────────────────────────────────────
TC.buildUrbanMap = function() {
  var t = mkMap();
  setBorder(t);

  // Fill roads first
  setRect(t, 1, 1, TC.MAP_W-2, TC.MAP_H-2, TC.T.ROAD);

  // Building block NW
  setHollow(t, 2, 2, 8, 7, TC.T.WALL, TC.T.FLOOR);
  setDoor(t, 6, 2); setDoor(t, 6, 8); setDoor(t, 2, 5); setDoor(t, 9, 5);

  // Building block NE (two buildings)
  setHollow(t, 22, 2, 6, 5, TC.T.WALL, TC.T.FLOOR);
  setDoor(t, 24, 2); setDoor(t, 27, 4);
  setHollow(t, 30, 2, 7, 5, TC.T.WALL, TC.T.FLOOR);
  setDoor(t, 33, 2); setDoor(t, 30, 4);

  // Building block SW
  setHollow(t, 2, 18, 9, 8, TC.T.WALL, TC.T.FLOOR);
  setDoor(t, 5, 18); setDoor(t, 5, 25); setDoor(t, 10, 22);

  // Building block SE (L-shape via two rects)
  setHollow(t, 26, 19, 10, 7, TC.T.WALL, TC.T.FLOOR);
  setDoor(t, 29, 19); setDoor(t, 35, 22);

  // Central plaza (park/fountain)
  setRect(t, 14, 10, 10, 8, TC.T.FLOOR);   // plaza ground
  setRect(t, 17, 12, 4, 4, TC.T.WATER);    // fountain
  setRect(t, 14, 10, 2, 2, TC.T.VEG);      // corner trees
  setRect(t, 22, 10, 2, 2, TC.T.VEG);
  setRect(t, 14, 16, 2, 2, TC.T.VEG);
  setRect(t, 22, 16, 2, 2, TC.T.VEG);

  // Tall building center-right
  setHollow(t, 14, 3, 6, 6, TC.T.WALL, TC.T.FLOOR);
  setDoor(t, 16, 3); setDoor(t, 19, 8);

  // Pillars / urban obstacles mid-map
  for (var px = 3; px < 12; px += 3) {
    t[13][px] = TC.T.WALL;
    t[16][px] = TC.T.WALL;
  }

  // Parking barriers
  setRect(t, 12, 20, 1, 6, TC.T.WALL);
  setRect(t, 12, 20, 2, 1, TC.T.WALL);
  setRect(t, 12, 25, 2, 1, TC.T.WALL);

  // Urban greenery
  setRect(t, 22, 11, 2, 1, TC.T.VEG);
  setRect(t, 2, 11, 2, 1, TC.T.VEG);

  return t;
};
