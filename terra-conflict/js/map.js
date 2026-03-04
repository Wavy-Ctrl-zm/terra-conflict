/* ============================================================
   map.js — Map class: tile data, rendering, collision
   ============================================================ */
'use strict';

var TC = window.TC || {};

TC.Map = function(mapDef) {
  this.def      = mapDef;
  this.tiles    = TC[mapDef.buildFn]();
  this.tileSize = TC.TILE;
  this.widthPx  = TC.MAP_W * TC.TILE;
  this.heightPx = TC.MAP_H * TC.TILE;
  this._buildRenderCache();
};

TC.Map.prototype._buildRenderCache = function() {
  // Pre-render map to an off-screen canvas for performance
  var oc  = document.createElement('canvas');
  oc.width  = this.widthPx;
  oc.height = this.heightPx;
  var ctx = oc.getContext('2d');
  var T   = TC.T;
  var ts  = this.tileSize;
  var pal = this.def.palette;

  for (var y = 0; y < TC.MAP_H; y++) {
    for (var x = 0; x < TC.MAP_W; x++) {
      var tile = this.tiles[y][x];
      var colors, c;

      switch(tile) {
        case T.FLOOR: colors = pal.floor; break;
        case T.WALL:  colors = pal.wall;  break;
        case T.WATER: colors = pal.water; break;
        case T.VEG:   colors = pal.veg;   break;
        case T.BUSH:  colors = pal.bush;  break;
        case T.ROAD:  colors = pal.road;  break;
        default:      colors = pal.floor;
      }

      // Pick a stable color variant based on position
      c = colors[(x * 7 + y * 13) % colors.length];
      ctx.fillStyle = c;
      ctx.fillRect(x*ts, y*ts, ts, ts);

      // Draw details per tile type
      if (tile === T.WALL) {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(x*ts, y*ts, ts, 3);
        ctx.fillRect(x*ts, y*ts, 3, ts);
        // top highlight
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.fillRect(x*ts, y*ts+ts-3, ts, 3);
      }

      if (tile === T.WATER) {
        // water ripple lines
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1;
        for (var wi = 0; wi < 3; wi++) {
          ctx.beginPath();
          ctx.moveTo(x*ts + 2, y*ts + 8 + wi*8);
          ctx.lineTo(x*ts + ts - 2, y*ts + 6 + wi*8);
          ctx.stroke();
        }
      }

      if (tile === T.VEG) {
        // tree dots
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.arc(x*ts + ts/2, y*ts + ts/2, ts*0.35, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.beginPath();
        ctx.arc(x*ts + ts*0.35, y*ts + ts*0.35, ts*0.12, 0, Math.PI*2);
        ctx.fill();
      }

      if (tile === T.BUSH) {
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        for (var bi = 0; bi < 3; bi++) {
          ctx.beginPath();
          ctx.arc(x*ts + 6 + bi*10, y*ts + ts/2, 5, 0, Math.PI*2);
          ctx.fill();
        }
      }

      if (tile === T.ROAD) {
        // subtle road edge lines
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(x*ts, y*ts, ts, 1);
        ctx.fillRect(x*ts, y*ts+ts-1, ts, 1);
      }
    }
  }

  // Grid lines (very subtle)
  ctx.strokeStyle = 'rgba(0,0,0,0.06)';
  ctx.lineWidth = 0.5;
  for (var gx = 0; gx <= TC.MAP_W; gx++) {
    ctx.beginPath(); ctx.moveTo(gx*ts, 0); ctx.lineTo(gx*ts, this.heightPx); ctx.stroke();
  }
  for (var gy = 0; gy <= TC.MAP_H; gy++) {
    ctx.beginPath(); ctx.moveTo(0, gy*ts); ctx.lineTo(this.widthPx, gy*ts); ctx.stroke();
  }

  this._cache = oc;
};

TC.Map.prototype.draw = function(ctx, camX, camY) {
  ctx.drawImage(this._cache, -camX, -camY);
};

TC.Map.prototype.tileAt = function(worldX, worldY) {
  var tx = Math.floor(worldX / this.tileSize);
  var ty = Math.floor(worldY / this.tileSize);
  if (tx < 0 || ty < 0 || tx >= TC.MAP_W || ty >= TC.MAP_H) return TC.T.WALL;
  return this.tiles[ty][tx];
};

TC.Map.prototype.isSolid = function(worldX, worldY) {
  var t = this.tileAt(worldX, worldY);
  return t === TC.T.WALL || t === TC.T.VEG || t === TC.T.WATER;
};

TC.Map.prototype.isWater = function(worldX, worldY) {
  return this.tileAt(worldX, worldY) === TC.T.WATER;
};

TC.Map.prototype.isBush = function(worldX, worldY) {
  return this.tileAt(worldX, worldY) === TC.T.BUSH || this.tileAt(worldX, worldY) === TC.T.VEG;
};

// Line-of-sight raycast. Returns true if clear path between two world points.
TC.Map.prototype.lineOfSight = function(x1, y1, x2, y2) {
  var dx = x2 - x1;
  var dy = y2 - y1;
  var dist  = Math.sqrt(dx*dx + dy*dy);
  var steps = Math.ceil(dist / (this.tileSize * 0.4));
  if (steps === 0) return true;
  for (var i = 1; i <= steps; i++) {
    var t  = i / steps;
    var cx = x1 + dx * t;
    var cy = y1 + dy * t;
    if (this.isSolid(cx, cy)) return false;
  }
  return true;
};

// Clamp camera so it doesn't show outside map
TC.Map.prototype.clampCamera = function(camX, camY) {
  return {
    x: Math.max(0, Math.min(camX, this.widthPx  - TC.CANVAS_W)),
    y: Math.max(0, Math.min(camY, this.heightPx - TC.CANVAS_H))
  };
};
