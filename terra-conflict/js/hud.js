/* ============================================================
   hud.js — Heads-Up Display rendering
   ============================================================ */
'use strict';

var TC = window.TC || {};

TC.HUD = (function() {
  var W = TC.CANVAS_W;
  var H = TC.CANVAS_H;

  // Damage flash overlay
  var damageFlash = 0;

  function triggerDamageFlash() { damageFlash = 0.4; }

  function update(dt) {
    damageFlash = Math.max(0, damageFlash - dt * 2.5);
  }

  function draw(ctx, game) {
    var player = game.player;
    if (!player || player.dead) return;

    _drawVignette(ctx);
    _drawHealthBar(ctx, player);
    _drawAmmoDisplay(ctx, player);
    _drawWaveInfo(ctx, game);
    _drawScore(ctx, game);
    _drawMinimap(ctx, game);
    _drawCrosshair(ctx, player);
    _drawWeaponIndicator(ctx, player);
    if (damageFlash > 0) _drawDamageFlash(ctx);
    if (game.weatherAlpha > 0) _drawWeatherEffect(ctx, game);
  }

  function _drawVignette(ctx) {
    var grad = ctx.createRadialGradient(W/2, H/2, H*0.3, W/2, H/2, H*0.85);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  function _drawHealthBar(ctx, player) {
    var barW  = 200;
    var barH  = 16;
    var bx    = 20;
    var by    = H - 58;
    var pct   = player.health / player.maxHealth;

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    _roundRect(ctx, bx-4, by-20, barW+8, barH+28, 6);
    ctx.fill();

    // Label
    ctx.fillStyle = '#aaaaaa';
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.fillText('HEALTH', bx, by - 4);

    // Bar bg
    ctx.fillStyle = '#1a0000';
    ctx.fillRect(bx, by, barW, barH);

    // Bar fill
    var barColor = pct > 0.6 ? '#22cc44' : pct > 0.3 ? '#ddaa00' : '#cc2222';
    ctx.fillStyle = barColor;
    ctx.fillRect(bx, by, barW * pct, barH);

    // Glow
    ctx.shadowColor = barColor;
    ctx.shadowBlur  = 8;
    ctx.fillRect(bx, by, barW * pct, barH);
    ctx.shadowBlur  = 0;

    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, barW, barH);

    // HP text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.fillText(Math.ceil(player.health) + ' / ' + player.maxHealth, bx + 4, by + 12);
  }

  function _drawAmmoDisplay(ctx, player) {
    var ax = 240;
    var ay = H - 58;
    var wpn = player.getCurrentWeapon();
    var ammo = player.ammo[player.activeWpn];
    var maxAmmo = player.maxAmmo[player.activeWpn];

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    _roundRect(ctx, ax-4, ay-20, 180, 44, 6);
    ctx.fill();

    ctx.fillStyle = '#aaaaaa';
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.fillText(wpn.name.toUpperCase(), ax, ay - 4);

    if (player.reloading) {
      ctx.fillStyle = '#ffaa00';
      ctx.font = 'bold 14px "Courier New", monospace';
      ctx.fillText('RELOADING...', ax, ay + 14);
    } else {
      ctx.fillStyle = ammo === 0 ? '#cc2222' : '#ffffff';
      ctx.font = 'bold 22px "Courier New", monospace';
      ctx.fillText(ammo, ax, ay + 16);
      ctx.fillStyle = '#888888';
      ctx.font = '14px "Courier New", monospace';
      ctx.fillText(' / ' + maxAmmo, ax + (ammo > 9 ? 28 : 16), ay + 14);
    }

    // Weapon switch hint
    ctx.fillStyle = '#555555';
    ctx.font = '10px "Courier New", monospace';
    var altName = (player.activeWpn === 'primary' ? player.secondary : player.weapon).name;
    ctx.fillText('[Q] ' + altName, ax, ay + 30);
  }

  function _drawWaveInfo(ctx, game) {
    var wx = W/2;
    var wy = 24;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    _roundRect(ctx, wx - 90, wy - 16, 180, 28, 6);
    ctx.fill();
    ctx.fillStyle = '#ffaa00';
    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('WAVE ' + game.wave + '  |  ENEMIES: ' + game.enemies.filter(function(e){return !e.dead;}).length, wx, wy + 5);
    ctx.textAlign = 'left';
  }

  function _drawScore(ctx, game) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    _roundRect(ctx, W - 164, 8, 156, 28, 6);
    ctx.fill();
    ctx.fillStyle = '#44ccff';
    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.textAlign = 'right';
    ctx.fillText('SCORE: ' + game.score, W - 16, 26);
    ctx.textAlign = 'left';
  }

  function _drawMinimap(ctx, game) {
    var mm = 130;
    var mx = W - mm - 14;
    var my = H - mm - 14;
    var scale = mm / (TC.MAP_W * TC.TILE);

    ctx.save();
    ctx.globalAlpha = 0.88;

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.strokeStyle = game.currentMapDef.faction ? game.currentMapDef.palette.road[0] : '#446644';
    _roundRect(ctx, mx - 3, my - 3, mm + 6, mm + 6, 5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Tiles (simplified)
    var T = TC.T;
    var tileW = mm / TC.MAP_W;
    var tileH = mm / TC.MAP_H;
    for (var ty = 0; ty < TC.MAP_H; ty += 2) {
      for (var tx = 0; tx < TC.MAP_W; tx += 2) {
        var tile = game.map.tiles[ty][tx];
        var col;
        switch(tile) {
          case T.WALL:  col = '#333'; break;
          case T.WATER: col = '#1a5a8a'; break;
          case T.VEG:   col = '#1a3a10'; break;
          case T.BUSH:  col = '#2a4a18'; break;
          case T.ROAD:  col = '#4a4a4a'; break;
          default:      col = '#2a2a2a';
        }
        ctx.fillStyle = col;
        ctx.fillRect(mx + tx*tileW, my + ty*tileH, tileW*2+1, tileH*2+1);
      }
    }

    // Enemies (red dots)
    game.enemies.forEach(function(e) {
      if (e.dead) return;
      ctx.fillStyle = '#ff4444';
      ctx.beginPath();
      ctx.arc(mx + e.x * scale, my + e.y * scale, 2, 0, Math.PI*2);
      ctx.fill();
    });

    // Player (faction color)
    var p = game.player;
    ctx.fillStyle = p.faction.color;
    ctx.shadowColor = p.faction.color;
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.arc(mx + p.x * scale, my + p.y * scale, 3, 0, Math.PI*2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Camera view rectangle
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      mx + game.camX * scale, my + game.camY * scale,
      TC.CANVAS_W * scale, TC.CANVAS_H * scale
    );

    ctx.restore();
  }

  function _drawCrosshair(ctx, player) {
    var mx = TC.Input.mouse.x;
    var my = TC.Input.mouse.y;
    var wpn = player.getCurrentWeapon();
    var spread = (wpn.spread || 0.05) * 120;

    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1;
    ctx.shadowColor = player.faction.color;
    ctx.shadowBlur = 4;

    var hs = Math.max(6, Math.min(20, spread));
    var gap = 5;
    // Top
    ctx.beginPath(); ctx.moveTo(mx, my - gap - hs); ctx.lineTo(mx, my - gap); ctx.stroke();
    // Bottom
    ctx.beginPath(); ctx.moveTo(mx, my + gap); ctx.lineTo(mx, my + gap + hs); ctx.stroke();
    // Left
    ctx.beginPath(); ctx.moveTo(mx - gap - hs, my); ctx.lineTo(mx - gap, my); ctx.stroke();
    // Right
    ctx.beginPath(); ctx.moveTo(mx + gap, my); ctx.lineTo(mx + gap + hs, my); ctx.stroke();
    // Center dot
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.arc(mx, my, 1.5, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
  }

  function _drawWeaponIndicator(ctx, player) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    _roundRect(ctx, 20, H - 100, 80, 36, 5);
    ctx.fill();
    ctx.fillStyle = player.activeWpn === 'primary' ? player.faction.color : '#888';
    ctx.font = 'bold 10px "Courier New", monospace';
    ctx.fillText('PRIMARY', 28, H - 82);
    ctx.fillStyle = player.activeWpn === 'secondary' ? player.faction.color : '#888';
    ctx.fillText('SECONDARY', 28, H - 70);
  }

  function _drawDamageFlash(ctx) {
    ctx.fillStyle = 'rgba(200,0,0,' + (damageFlash * 0.35) + ')';
    ctx.fillRect(0, 0, W, H);
    // Edge damage indicator
    var g = ctx.createRadialGradient(W/2, H/2, H*0.2, W/2, H/2, H);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(200,0,0,' + damageFlash * 0.5 + ')');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function _drawWeatherEffect(ctx, game) {
    ctx.fillStyle = 'rgba(' + game.weatherColor + ',' + game.weatherAlpha.toFixed(2) + ')';
    ctx.fillRect(0, 0, W, H);
  }

  function drawWaveAnnounce(ctx, game) {
    if (game.waveAnnounceTimer <= 0) return;
    var t = game.waveAnnounceTimer;
    var alpha = t > 1.5 ? 1 : t / 1.5;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    _roundRect(ctx, W/2-180, H/2-45, 360, 90, 10);
    ctx.fill();
    ctx.fillStyle = '#ffaa00';
    ctx.font = 'bold 28px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('WAVE ' + game.wave, W/2, H/2 - 10);
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '14px "Courier New", monospace';
    ctx.fillText(game.waveEnemyCount + ' ENEMIES INCOMING', W/2, H/2 + 20);
    ctx.textAlign = 'left';
    ctx.restore();
  }

  function drawKillFeed(ctx, game) {
    var feedX = W - 250;
    var feedY = 50;
    for (var i = 0; i < game.killFeed.length; i++) {
      var kf = game.killFeed[i];
      if (kf.timer <= 0) continue;
      var a = Math.min(1, kf.timer);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      _roundRect(ctx, feedX-4, feedY-14+i*22, 240, 18, 4);
      ctx.fill();
      ctx.fillStyle = '#ffcc44';
      ctx.font = '12px "Courier New", monospace';
      ctx.fillText(kf.text, feedX, feedY + i*22);
      ctx.restore();
    }
  }

  function _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.lineTo(x+w-r, y); ctx.arcTo(x+w,y, x+w,y+r, r);
    ctx.lineTo(x+w, y+h-r); ctx.arcTo(x+w,y+h, x+w-r,y+h, r);
    ctx.lineTo(x+r, y+h); ctx.arcTo(x,y+h, x,y+h-r, r);
    ctx.lineTo(x, y+r); ctx.arcTo(x,y, x+r,y, r);
    ctx.closePath();
  }

  return {
    update: update,
    draw: draw,
    triggerDamageFlash: triggerDamageFlash,
    drawWaveAnnounce: drawWaveAnnounce,
    drawKillFeed: drawKillFeed
  };
})();
