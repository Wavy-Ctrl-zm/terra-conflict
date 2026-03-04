/* ============================================================
   game.js — Main game engine, state machine, game loop
   ============================================================ */
'use strict';

var TC = window.TC || {};

TC.Game = (function() {
  var canvas, ctx;

  // ── State ─────────────────────────────────────────────────
  var state = 'menu'; // menu|faction|mapselect|playing|paused|gameover
  var selectedFaction = 0;
  var selectedMap     = 0;

  // Gameplay state
  var player    = null;
  var map       = null;
  var enemies   = [];
  var bullets   = [];
  var score     = 0;
  var wave      = 1;
  var camX = 0, camY = 0;
  var shakeX = 0, shakeY = 0, shakeDuration = 0;
  var waveAnnounceTimer = 0;
  var waveEnemyCount    = 0;
  var waveSpawnQueue    = [];
  var waveSpawnTimer    = 0;
  var betweenWaveTimer  = 0;
  var waveClear         = false;
  var killFeed = [];
  var weatherAlpha = 0, weatherColor = '200,180,100';
  var weatherTimer = 0;
  var menuAnim = 0;
  var menuParticles = [];
  var currentMapDef = null;
  var lastTime = 0;
  var gameOver = false;
  var totalKills = 0;

  // ── Init ──────────────────────────────────────────────────
  function init() {
    canvas = document.getElementById('game-canvas');
    ctx    = canvas.getContext('2d');
    canvas.width  = TC.CANVAS_W;
    canvas.height = TC.CANVAS_H;

    TC.Input.init(canvas);
    TC.Audio.init();

    // Menu background particles
    for (var i = 0; i < 60; i++) {
      menuParticles.push({
        x: Math.random() * TC.CANVAS_W,
        y: Math.random() * TC.CANVAS_H,
        size: 0.5 + Math.random() * 2,
        speed: 10 + Math.random() * 30,
        angle: Math.random() * Math.PI * 2,
        color: Math.random() < 0.3 ? '#ff5c00' : '#446644',
        alpha: 0.2 + Math.random() * 0.5
      });
    }

    requestAnimationFrame(loop);
  }

  // ── Main Loop ─────────────────────────────────────────────
  function loop(ts) {
    var dt = Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;

    menuAnim += dt;

    switch(state) {
      case 'menu':     updateMenu(dt);     drawMenu();     break;
      case 'faction':  updateMenu(dt);     drawFactionSelect(); break;
      case 'mapselect':updateMenu(dt);     drawMapSelect();    break;
      case 'playing':  updateGame(dt);     drawGame();         break;
      case 'paused':   drawGame();         drawPause();        break;
      case 'gameover': drawGame();         drawGameOver();     break;
    }

    requestAnimationFrame(loop);
  }

  // ── Menu update ───────────────────────────────────────────
  function updateMenu(dt) {
    menuParticles.forEach(function(p) {
      p.x += Math.cos(p.angle) * p.speed * dt;
      p.y += Math.sin(p.angle) * p.speed * dt;
      if (p.x < 0) p.x = TC.CANVAS_W;
      if (p.x > TC.CANVAS_W) p.x = 0;
      if (p.y < 0) p.y = TC.CANVAS_H;
      if (p.y > TC.CANVAS_H) p.y = 0;
    });
  }

  // ── Game Update ───────────────────────────────────────────
  function updateGame(dt) {
    if (gameOver) return;

    // Screen shake
    if (shakeDuration > 0) {
      shakeDuration -= dt;
      var intensity = shakeX * (shakeDuration / 0.3);
      camX += (Math.random()-0.5) * intensity * 2;
      camY += (Math.random()-0.5) * intensity * 2;
    }

    // Announcements
    if (waveAnnounceTimer > 0) waveAnnounceTimer -= dt;

    // Kill feed
    killFeed.forEach(function(k){ k.timer -= dt; });
    killFeed = killFeed.filter(function(k){ return k.timer > 0; });

    // Weather
    weatherTimer += dt;
    if (weatherTimer > 20) { weatherTimer = 0; weatherAlpha = 0; }
    if (currentMapDef && currentMapDef.id === 'sahara') {
      // sandstorm pulse every 30s
      var stormPhase = (menuAnim % 30);
      weatherAlpha   = stormPhase > 25 ? Math.sin((stormPhase-25)/5*Math.PI)*0.25 : 0;
      weatherColor   = '180,140,60';
    }

    // Update HUD
    TC.HUD.update(dt);

    // Input
    if (TC.Input.isDown('Escape') || TC.Input.isDown('KeyP')) {
      if (!TC._pDown) { state = 'paused'; TC._pDown = true; return; }
    } else { TC._pDown = false; }

    // Player update
    if (!player.dead) {
      player.update(dt, map);
      if (TC.Input.mouse.down || TC.Input.isDown('Space')) {
        player.tryShoot(bullets);
      }
    } else {
      // Player died
      gameOver = true;
    }

    // Bullets update
    for (var bi = bullets.length - 1; bi >= 0; bi--) {
      var b = bullets[bi];
      b.update(dt, map);
      if (b.dead) {
        if (b.hit) TC.Particles.spawnHitSpark(b.x, b.y);
        bullets.splice(bi, 1);
        continue;
      }

      // Bullet-entity collision
      if (b.owner === 'player') {
        enemies.forEach(function(e) {
          if (e.dead || e.dying) return;
          var dx = b.x - e.x, dy = b.y - e.y;
          if (dx*dx + dy*dy < e.radius*e.radius) {
            var killed = e.takeDamage(b.damage);
            b.dead = true;
            if (killed) {
              score += e.reward * wave;
              totalKills++;
              killFeed.unshift({ text: '+' + (e.reward*wave) + '  ' + e.type.toUpperCase() + ' DOWN', timer: 2.5 });
              player.score = score;
              TC.Particles.spawnExplosion(e.x, e.y);
            }
          }
        });
      } else if (b.owner === 'enemy' && !player.dead) {
        var pdx = b.x - player.x, pdy = b.y - player.y;
        if (pdx*pdx + pdy*pdy < player.radius*player.radius) {
          player.takeDamage(b.damage);
          TC.HUD.triggerDamageFlash();
          b.dead = true;
        }
      }
    }

    // Enemies update
    enemies.forEach(function(e) {
      if (!e.dead) e.update(dt, map, player, bullets);
    });

    // Spawn from queue
    if (waveSpawnQueue.length > 0) {
      waveSpawnTimer -= dt;
      if (waveSpawnTimer <= 0) {
        var spawn = waveSpawnQueue.shift();
        enemies.push(new TC.Enemy(spawn.x, spawn.y, spawn.type));
        waveSpawnTimer = 0.6 + Math.random() * 0.5;
      }
    }

    // Check wave clear
    var aliveEnemies = enemies.filter(function(e){ return !e.dead && !e.dying; });
    if (aliveEnemies.length === 0 && waveSpawnQueue.length === 0) {
      if (!waveClear) {
        waveClear = true;
        betweenWaveTimer = 4;
        score += wave * 50; // wave clear bonus
        killFeed.unshift({ text: '★ WAVE ' + wave + ' CLEARED! +' + (wave*50), timer: 3 });
        TC.Audio.play('victory');
      }
      betweenWaveTimer -= dt;
      if (betweenWaveTimer <= 0 && waveClear) {
        wave++;
        startWave();
      }
    }

    // Particles
    TC.Particles.update(dt);

    // Camera — lerp toward player
    var targetCamX = player.x - TC.CANVAS_W / 2;
    var targetCamY = player.y - TC.CANVAS_H / 2;
    camX += (targetCamX - camX) * Math.min(1, dt * 8);
    camY += (targetCamY - camY) * Math.min(1, dt * 8);
    var clamped = map.clampCamera(camX, camY);
    camX = clamped.x; camY = clamped.y;
  }

  // ── Wave Spawning ─────────────────────────────────────────
  function startWave() {
    TC.Audio.play('waveStart');
    waveClear = false;
    waveAnnounceTimer = 2.5;

    var spawns = currentMapDef.enemySpawns;
    var count  = 3 + wave * 2;
    waveEnemyCount = count;

    enemies = enemies.filter(function(e){ return !e.dead; }); // clear dead
    waveSpawnQueue = [];

    for (var i = 0; i < count; i++) {
      var sp   = spawns[i % spawns.length];
      var type = i % 5 === 0 && wave >= 2 ? 'heavy' : i % 7 === 0 && wave >= 3 ? 'sniper' : 'soldier';
      // Offset spawn point slightly so they don't stack
      waveSpawnQueue.push({
        x: sp.x * TC.TILE + TC.TILE/2 + (Math.random()-0.5)*30,
        y: sp.y * TC.TILE + TC.TILE/2 + (Math.random()-0.5)*30,
        type: type
      });
    }
    waveSpawnTimer = 0.3;
  }

  function startGame() {
    var factionId  = TC.FACTIONS[selectedFaction].id;
    var mapDef     = TC.MAPS[selectedMap];
    currentMapDef  = mapDef;
    map            = new TC.Map(mapDef);

    var sp = mapDef.playerSpawn;
    player = new TC.Player(sp.x, sp.y, factionId);

    enemies   = [];
    bullets   = [];
    score     = 0;
    wave      = 1;
    totalKills= 0;
    killFeed  = [];
    TC.Particles.clear();

    // Initial camera position
    camX = player.x - TC.CANVAS_W/2;
    camY = player.y - TC.CANVAS_H/2;

    gameOver  = false;
    waveClear = false;
    state     = 'playing';
    startWave();
  }

  // ── Draw: Game ────────────────────────────────────────────
  function drawGame() {
    ctx.save();
    // Screen shake offset
    if (shakeDuration > 0) {
      ctx.translate(
        (Math.random()-0.5) * shakeX * (shakeDuration/0.3) * 0.5,
        (Math.random()-0.5) * shakeY * (shakeDuration/0.3) * 0.5
      );
    }

    // Clear
    ctx.fillStyle = currentMapDef ? currentMapDef.bgColor : '#111';
    ctx.fillRect(0, 0, TC.CANVAS_W, TC.CANVAS_H);

    // Map
    if (map) map.draw(ctx, camX, camY);

    // Bullets
    bullets.forEach(function(b){ b.draw(ctx, camX, camY); });

    // Particles behind entities
    TC.Particles.draw(ctx, camX, camY);

    // Enemies
    enemies.forEach(function(e){ e.draw(ctx, camX, camY); });

    // Player
    if (player) player.draw(ctx, camX, camY);

    ctx.restore();

    // HUD (no camera transform)
    if (player && !player.dead) {
      TC.HUD.draw(ctx, {
        player: player, map: map, enemies: enemies, score: score,
        wave: wave, camX: camX, camY: camY,
        waveAnnounceTimer: waveAnnounceTimer, waveEnemyCount: waveEnemyCount,
        killFeed: killFeed, weatherAlpha: weatherAlpha, weatherColor: weatherColor,
        currentMapDef: currentMapDef
      });
      TC.HUD.drawWaveAnnounce(ctx, {
        wave: wave, waveAnnounceTimer: waveAnnounceTimer, waveEnemyCount: waveEnemyCount
      });
      TC.HUD.drawKillFeed(ctx, { killFeed: killFeed });
    }
  }

  // ── Draw: Main Menu ───────────────────────────────────────
  function drawMenu() {
    var W = TC.CANVAS_W, H = TC.CANVAS_H;
    // Deep dark background
    ctx.fillStyle = '#050810';
    ctx.fillRect(0, 0, W, H);

    // Animated grid
    ctx.strokeStyle = 'rgba(0,80,180,0.1)';
    ctx.lineWidth = 1;
    var gs = 40;
    for (var gx = 0; gx < W; gx += gs) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
    }
    for (var gy = 0; gy < H; gy += gs) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
    }

    // Animated background particles
    menuParticles.forEach(function(p) {
      ctx.globalAlpha = p.alpha * 0.7;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Horizon glow
    var grad = ctx.createLinearGradient(0, H*0.4, 0, H*0.7);
    grad.addColorStop(0, 'rgba(255,60,0,0)');
    grad.addColorStop(0.5,'rgba(255,60,0,0.06)');
    grad.addColorStop(1, 'rgba(255,60,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Title
    var pulse = 0.7 + Math.sin(menuAnim * 2) * 0.3;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.shadowColor = '#ff5c00';
    ctx.shadowBlur  = 20 + pulse * 15;
    ctx.fillStyle   = '#ff5c00';
    ctx.font        = 'bold 64px "Courier New", monospace';
    ctx.fillText('TERRA CONFLICT', W/2, H/2 - 80);
    ctx.shadowBlur = 0;
    ctx.fillStyle  = '#8a8aaa';
    ctx.font       = '18px "Courier New", monospace';
    ctx.fillText('GLOBAL WARFARE', W/2, H/2 - 45);
    ctx.fillStyle  = 'rgba(255,255,255,0.3)';
    ctx.font       = '11px "Courier New", monospace';
    ctx.fillText('22 GLOBAL MAPS  |  14 FACTIONS  |  WAVE TACTICAL COMBAT', W/2, H/2 - 15);
    ctx.textAlign  = 'left';
    ctx.restore();

    // Menu buttons
    _menuBtn(ctx, W/2 - 120, H/2 + 20, 240, 44, 'DEPLOY', '#ff5c00', '#ff3a00', true);
    _menuBtn(ctx, W/2 - 120, H/2 + 74, 240, 36, TC.Audio.isMuted() ? '🔇 SOUND: OFF' : '🔊 SOUND: ON', '#2a4a2a', '#3a5a3a');
    _menuBtn(ctx, W/2 - 120, H/2 + 120, 240, 36, 'HOW TO PLAY', '#1a1a3a', '#2a2a4a');

    // Click detection
    if (TC.Input.consumeClick()) {
      var mx = TC.Input.mouse.x, my = TC.Input.mouse.y;
      if (_hitBtn(mx, my, W/2-120, H/2+20, 240, 44)) {
        TC.Audio.play('menuClick'); state = 'faction';
      }
      if (_hitBtn(mx, my, W/2-120, H/2+74, 240, 36)) {
        TC.Audio.play('menuClick'); TC.Audio.setMuted(!TC.Audio.isMuted());
      }
      if (_hitBtn(mx, my, W/2-120, H/2+120, 240, 36)) {
        TC.Audio.play('menuClick'); showHowToPlay();
      }
    }

    // Version
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.font = '10px monospace';
    ctx.fillText('v1.0  |  WASD + MOUSE  |  CLICK TO FIRE  |  R RELOAD  |  Q SWITCH WEAPON', 12, H - 10);
  }

  function showHowToPlay() {
    alert(
      'TERRA CONFLICT: GLOBAL WARFARE\n\n' +
      '🎮 CONTROLS:\n' +
      '  WASD / Arrow Keys — Move\n' +
      '  Mouse — Aim\n' +
      '  Left Click / Space — Fire\n' +
      '  R — Reload\n' +
      '  Q — Switch Weapon\n' +
      '  P / Esc — Pause\n\n' +
      '🎯 OBJECTIVE:\n' +
      '  Survive waves of enemies. Score increases with kills.\n' +
      '  Higher waves = more enemies = bigger rewards.\n\n' +
      '⚔️ ENEMY TYPES:\n' +
      '  Soldier (tan) — Basic infantry\n' +
      '  Heavy (red) — Tanky, high damage\n' +
      '  Sniper (dark green) — Long range, deadly\n\n' +
      '🌍 MAPS:\n' +
      '  Luangwa Shadow — Zambia Jungle\n' +
      '  Sandghost — Sahara Desert\n' +
      '  Iron Grid — Urban City\n\n' +
      'Good luck, soldier.'
    );
  }

  // ── Draw: Faction Select ──────────────────────────────────
  function drawFactionSelect() {
    var W = TC.CANVAS_W, H = TC.CANVAS_H;
    _drawMenuBg(ctx);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffaa00';
    ctx.font = 'bold 22px "Courier New", monospace';
    ctx.shadowColor = '#ffaa00'; ctx.shadowBlur = 10;
    ctx.fillText('SELECT YOUR FACTION', W/2, 42);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '12px "Courier New", monospace';
    ctx.fillText('Choose your global force', W/2, 62);
    ctx.textAlign = 'left';

    var cardW = 240, cardH = 290, gap = 20;
    var totalW = TC.FACTIONS.length * cardW + (TC.FACTIONS.length-1)*gap;
    var startX = (W - totalW) / 2;

    TC.FACTIONS.forEach(function(f, i) {
      var cx = startX + i*(cardW+gap);
      var cy = 80;
      var sel = selectedFaction === i;

      ctx.save();
      if (sel) {
        ctx.shadowColor = f.color;
        ctx.shadowBlur  = 16;
        ctx.translate(0, -4);
      }

      // Card background
      ctx.fillStyle = sel ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.6)';
      _roundRect2(ctx, cx, cy, cardW, cardH, 10);
      ctx.fill();

      // Border
      ctx.strokeStyle = sel ? f.color : 'rgba(255,255,255,0.15)';
      ctx.lineWidth = sel ? 2 : 1;
      ctx.stroke();

      // Faction icon circle
      ctx.fillStyle = f.color;
      ctx.shadowColor = f.color;
      ctx.shadowBlur = sel ? 20 : 5;
      ctx.beginPath();
      ctx.arc(cx + cardW/2, cy + 58, 35, 0, Math.PI*2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Operator silhouette
      ctx.fillStyle = f.darkColor;
      ctx.beginPath();
      ctx.arc(cx + cardW/2, cy + 50, 22, 0, Math.PI*2);
      ctx.fill();
      ctx.fillRect(cx + cardW/2 - 14, cy + 72, 28, 30);

      // Flag / icon
      ctx.font = '22px serif';
      ctx.textAlign = 'center';
      ctx.fillText(f.flag, cx + cardW/2, cy + 30);

      // Faction name
      ctx.fillStyle = sel ? f.color : '#dddddd';
      ctx.font = 'bold 13px "Courier New", monospace';
      ctx.fillText(f.name, cx + cardW/2, cy + 114);

      // Subtitle
      ctx.fillStyle = '#888888';
      ctx.font = '10px "Courier New", monospace';
      ctx.fillText(f.subtitle, cx + cardW/2, cy + 130);

      // Stats
      ctx.textAlign = 'left';
      var stats = [
        ['HEALTH',  f.health, 120],
        ['SPEED',   f.speed - 150, 35],
        ['DAMAGE',  Math.round(f.weapon.damage/0.7), 80],
        ['RANGE',   Math.round(f.weapon.range/5), 100]
      ];
      stats.forEach(function(s, si) {
        var sy = cy + 148 + si * 26;
        ctx.fillStyle = '#666';
        ctx.font = '9px "Courier New", monospace';
        ctx.fillText(s[0], cx + 14, sy);
        var barW2 = cardW - 28;
        ctx.fillStyle = '#111';
        ctx.fillRect(cx + 14, sy + 3, barW2, 8);
        ctx.fillStyle = f.color;
        ctx.fillRect(cx + 14, sy + 3, barW2 * Math.min(1, s[1]/s[2]), 8);
      });

      // Description
      ctx.fillStyle = '#999999';
      ctx.font = '9px "Courier New", monospace';
      ctx.textAlign = 'center';
      var words = f.description.split(' ');
      var line  = '', lineY = cy + 256;
      words.forEach(function(w) {
        var test = line + w + ' ';
        if (ctx.measureText(test).width > cardW - 20 && line !== '') {
          ctx.fillText(line, cx + cardW/2, lineY);
          line = w + ' '; lineY += 14;
        } else { line = test; }
      });
      if (line) ctx.fillText(line, cx + cardW/2, lineY);

      ctx.textAlign = 'left';
      ctx.restore();

      // Hover = select (highlight active card)
      if (_hitBtn(TC.Input.mouse.x, TC.Input.mouse.y, cx, cy, cardW, cardH)) {
        selectedFaction = i;
      }
    });

    _menuBtn(ctx, W/2 - 160, H - 54, 140, 38, '← BACK', '#1a1a1a', '#2a2a2a');
    _menuBtn(ctx, W/2 + 20,  H - 54, 140, 38, 'CONFIRM →', '#ff5c00', '#ff3a00', true);

    if (TC.Input.consumeClick()) {
      var mx = TC.Input.mouse.x, my = TC.Input.mouse.y;
      if (_hitBtn(mx, my, W/2-160, H-54, 140, 38)) { TC.Audio.play('menuClick'); state = 'menu'; }
      else if (_hitBtn(mx, my, W/2+20, H-54, 140, 38)) { TC.Audio.play('menuClick'); state = 'mapselect'; }
      else {
        TC.FACTIONS.forEach(function(f, i) {
          var cx = startX + i*(cardW+gap);
          if (_hitBtn(mx, my, cx, 80, cardW, 290)) { selectedFaction = i; TC.Audio.play('menuClick'); }
        });
      }
    }
  }

  // ── Draw: Map Select ──────────────────────────────────────
  function drawMapSelect() {
    var W = TC.CANVAS_W, H = TC.CANVAS_H;
    _drawMenuBg(ctx);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffaa00';
    ctx.font = 'bold 22px "Courier New", monospace';
    ctx.shadowColor = '#ffaa00'; ctx.shadowBlur = 10;
    ctx.fillText('SELECT BATTLEFIELD', W/2, 42);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '12px "Courier New", monospace';
    ctx.fillText('Choose your operational theatre', W/2, 62);
    ctx.textAlign = 'left';

    var cardW = 240, cardH = 300, gap = 20;
    var totalW = TC.MAPS.length * cardW + (TC.MAPS.length-1)*gap;
    var startX = (W - totalW) / 2;

    TC.MAPS.forEach(function(m, i) {
      var cx = startX + i*(cardW+gap);
      var cy = 78;
      var sel = selectedMap === i;

      ctx.save();
      if (sel) { ctx.shadowColor = '#ff5c00'; ctx.shadowBlur = 16; ctx.translate(0,-4); }

      ctx.fillStyle = sel ? 'rgba(0,0,0,0.9)' : 'rgba(0,0,0,0.65)';
      _roundRect2(ctx, cx, cy, cardW, cardH, 10);
      ctx.fill();
      ctx.strokeStyle = sel ? '#ff5c00' : 'rgba(255,255,255,0.15)';
      ctx.lineWidth = sel ? 2 : 1; ctx.stroke();
      ctx.shadowBlur = 0;

      // Map preview thumbnail (colored rect with pattern)
      var prevH = 130;
      ctx.save();
      ctx.beginPath(); _roundRect2(ctx, cx+8, cy+8, cardW-16, prevH, 6); ctx.clip();
      ctx.fillStyle = m.bgColor;
      ctx.fillRect(cx+8, cy+8, cardW-16, prevH);
      // Mini-grid preview
      var tc = TC[m.buildFn]();
      var ts = (cardW-16) / TC.MAP_W;
      var th = prevH / TC.MAP_H;
      var T = TC.T;
      for (var ty = 0; ty < TC.MAP_H; ty++) {
        for (var tx2 = 0; tx2 < TC.MAP_W; tx2++) {
          var tile = tc[ty][tx2];
          if (tile === T.WALL)  ctx.fillStyle = m.palette.wall[0];
          else if (tile===T.WATER) ctx.fillStyle = m.palette.water[0];
          else if (tile===T.VEG)   ctx.fillStyle = m.palette.veg[0];
          else if (tile===T.ROAD)  ctx.fillStyle = m.palette.road[0];
          else continue;
          ctx.fillRect(cx+8+tx2*ts, cy+8+ty*th, ts+0.5, th+0.5);
        }
      }
      // Overlay
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(cx+8, cy+8, cardW-16, prevH);
      ctx.restore();

      // Map icon
      ctx.font = '28px serif';
      ctx.textAlign = 'center';
      ctx.fillText(m.icon, cx+cardW/2, cy+55);

      // Name
      ctx.fillStyle = sel ? '#ff5c00' : '#dddddd';
      ctx.font = 'bold 13px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(m.name, cx+cardW/2, cy+155);

      ctx.fillStyle = '#888888';
      ctx.font = '10px "Courier New", monospace';
      ctx.fillText(m.subtitle, cx+cardW/2, cy+170);

      // Description
      ctx.fillStyle = '#999999';
      ctx.font = '9px "Courier New", monospace';
      var words = m.description.split(' ');
      var line  = '', lineY = cy + 192;
      words.forEach(function(w) {
        var test = line + w + ' ';
        if (ctx.measureText(test).width > cardW - 20 && line !== '') {
          ctx.fillText(line, cx + cardW/2, lineY);
          line = w + ' '; lineY += 13;
        } else { line = test; }
      });
      if (line) ctx.fillText(line, cx + cardW/2, lineY);

      // Features
      var features = m.ambience === 'jungle' ? ['Mud Physics','Wildlife Alarm','River Crossing'] :
                     m.ambience === 'desert' ? ['Sandstorm Events','Dune Ridges','Bunker Network'] :
                     ['Multi-Level','Urban Alleys','Plaza Combat'];
      lineY = cy + 245;
      features.forEach(function(feat) {
        ctx.fillStyle = sel ? '#66aa66' : '#556655';
        ctx.fillText('✓ ' + feat, cx + cardW/2, lineY);
        lineY += 14;
      });

      // Hover = highlight
      if (_hitBtn(TC.Input.mouse.x, TC.Input.mouse.y, cx, 78, cardW, 300)) {
        selectedMap = i;
      }

      ctx.textAlign = 'left';
      ctx.restore();
    });

    _menuBtn(ctx, W/2 - 160, H - 54, 140, 38, '← BACK', '#1a1a1a', '#2a2a2a');
    _menuBtn(ctx, W/2 + 20,  H - 54, 140, 38, '▶ DEPLOY!', '#ff5c00', '#cc2200', true);

    if (TC.Input.consumeClick()) {
      var mx = TC.Input.mouse.x, my = TC.Input.mouse.y;
      if (_hitBtn(mx, my, W/2-160, H-54, 140, 38)) { TC.Audio.play('menuClick'); state = 'faction'; }
      else if (_hitBtn(mx, my, W/2+20, H-54, 140, 38)) { TC.Audio.play('menuClick'); startGame(); }
      else {
        TC.MAPS.forEach(function(m, i) {
          var cx = startX + i*(cardW+gap);
          if (_hitBtn(mx, my, cx, 78, cardW, 300)) { selectedMap = i; TC.Audio.play('menuClick'); }
        });
      }
    }
  }

  // ── Draw: Pause ───────────────────────────────────────────
  function drawPause() {
    var W = TC.CANVAS_W, H = TC.CANVAS_H;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffaa00';
    ctx.shadowColor = '#ffaa00'; ctx.shadowBlur = 20;
    ctx.font = 'bold 36px "Courier New", monospace';
    ctx.fillText('PAUSED', W/2, H/2 - 60);
    ctx.shadowBlur = 0;
    _menuBtn(ctx, W/2-100, H/2-10, 200, 40, 'RESUME', '#ff5c00', '#cc3300', true);
    _menuBtn(ctx, W/2-100, H/2+58, 200, 40, 'MAIN MENU', '#1a1a2a', '#2a2a3a');
    ctx.textAlign = 'left';

    if (TC.Input.consumeClick()) {
      var mx = TC.Input.mouse.x, my = TC.Input.mouse.y;
      if (_hitBtn(mx, my, W/2-100, H/2-10, 200, 40)) { TC.Audio.play('menuClick'); state = 'playing'; }
      if (_hitBtn(mx, my, W/2-100, H/2+58, 200, 40)) { TC.Audio.play('menuClick'); state = 'menu'; }
    }
    if (TC.Input.isDown('Escape') || TC.Input.isDown('KeyP')) {
      if (!TC._pDown2) { state = 'playing'; TC._pDown2 = true; }
    } else { TC._pDown2 = false; }
  }

  // ── Draw: Game Over ───────────────────────────────────────
  function drawGameOver() {
    var W = TC.CANVAS_W, H = TC.CANVAS_H;
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#cc2222';
    ctx.shadowColor = '#cc2222'; ctx.shadowBlur = 30;
    ctx.font = 'bold 52px "Courier New", monospace';
    ctx.fillText('MISSION FAILED', W/2, H/2 - 100);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#888888';
    ctx.font = '14px "Courier New", monospace';
    ctx.fillText('SOLDIER DOWN', W/2, H/2 - 62);

    var stats = [
      ['FINAL SCORE', score],
      ['WAVES SURVIVED', wave - 1],
      ['TOTAL KILLS', totalKills],
      ['MAP', currentMapDef.name],
      ['FACTION', player ? player.faction.name : '']
    ];
    stats.forEach(function(s, i) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      _roundRect2(ctx, W/2-160, H/2-30+i*34, 320, 28, 5);
      ctx.fill();
      ctx.fillStyle = '#666';
      ctx.font = '11px "Courier New", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(s[0], W/2-150, H/2-13+i*34);
      ctx.fillStyle = '#ffcc44';
      ctx.font = 'bold 13px "Courier New", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(s[1], W/2+150, H/2-13+i*34);
    });

    ctx.textAlign = 'center';
    _menuBtn(ctx, W/2-160, H/2+160, 148, 40, 'PLAY AGAIN', '#ff5c00', '#cc2200', true);
    _menuBtn(ctx, W/2+12,  H/2+160, 148, 40, 'MAIN MENU', '#1a1a2a', '#2a2a3a');

    if (TC.Input.consumeClick()) {
      var mx = TC.Input.mouse.x, my = TC.Input.mouse.y;
      if (_hitBtn(mx, my, W/2-160, H/2+160, 148, 40)) { TC.Audio.play('menuClick'); startGame(); }
      if (_hitBtn(mx, my, W/2+12,  H/2+160, 148, 40)) { TC.Audio.play('menuClick'); state = 'menu'; }
    }
  }

  // ── UI Helpers ────────────────────────────────────────────
  function _drawMenuBg(c) {
    var W = TC.CANVAS_W, H = TC.CANVAS_H;
    c.fillStyle = '#050810';
    c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(0,80,180,0.08)';
    c.lineWidth = 1;
    for (var gx = 0; gx < W; gx += 40) { c.beginPath(); c.moveTo(gx,0); c.lineTo(gx,H); c.stroke(); }
    for (var gy = 0; gy < H; gy += 40) { c.beginPath(); c.moveTo(0,gy); c.lineTo(W,gy); c.stroke(); }
    menuParticles.forEach(function(p) {
      c.globalAlpha = p.alpha * 0.5;
      c.fillStyle = p.color;
      c.beginPath(); c.arc(p.x, p.y, p.size, 0, Math.PI*2); c.fill();
    });
    c.globalAlpha = 1;
  }

  function _menuBtn(c, x, y, w, h, text, bg, bgHover, primary) {
    var mx = TC.Input.mouse.x, my2 = TC.Input.mouse.y;
    var hover = _hitBtn(mx, my2, x, y, w, h);
    c.save();
    c.fillStyle = hover ? bgHover : bg;
    if (primary && hover) { c.shadowColor = bgHover; c.shadowBlur = 14; }
    _roundRect2(c, x, y, w, h, 6); c.fill();
    if (primary) {
      var g = c.createLinearGradient(x, y, x, y+h);
      g.addColorStop(0, 'rgba(255,255,255,0.1)');
      g.addColorStop(1, 'rgba(0,0,0,0.1)');
      c.fillStyle = g; c.fill();
    }
    c.strokeStyle = primary ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)';
    c.lineWidth = 1; c.stroke();
    c.fillStyle = '#ffffff';
    c.font = 'bold 13px "Courier New", monospace';
    c.textAlign = 'center';
    c.fillText(text, x + w/2, y + h/2 + 5);
    c.shadowBlur = 0;
    c.textAlign = 'left';
    c.restore();
  }

  function _hitBtn(mx, my, x, y, w, h) {
    return mx >= x && mx <= x+w && my >= y && my <= y+h;
  }

  function _roundRect2(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x+r,y); c.lineTo(x+w-r,y); c.arcTo(x+w,y,x+w,y+r,r);
    c.lineTo(x+w,y+h-r); c.arcTo(x+w,y+h,x+w-r,y+h,r);
    c.lineTo(x+r,y+h); c.arcTo(x,y+h,x,y+h-r,r);
    c.lineTo(x,y+r); c.arcTo(x,y,x+r,y,r); c.closePath();
  }

  // ── Public API ────────────────────────────────────────────
  return {
    init: init,
    get state() { return state; },
    get player()  { return player; },
    get enemies() { return enemies; },
    get bullets() { return bullets; },
    get map()     { return map; },
    get score()   { return score; },
    get wave()    { return wave; },
    get camX()    { return camX; },
    get camY()    { return camY; },
    get currentMapDef() { return currentMapDef; },
    get killFeed()  { return killFeed; },
    get weatherAlpha() { return weatherAlpha; },
    get weatherColor() { return weatherColor; },
    get waveAnnounceTimer() { return waveAnnounceTimer; },
    get waveEnemyCount()    { return waveEnemyCount; },
    screenShake: function(intensity, duration) {
      shakeX = intensity; shakeY = intensity; shakeDuration = duration;
    }
  };
})();

// Boot
window.addEventListener('load', function() {
  TC.Game.init();
});
