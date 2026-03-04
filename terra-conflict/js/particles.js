/* ============================================================
   particles.js — Visual effects particle system
   ============================================================ */
'use strict';

var TC = window.TC || {};

TC.Particles = (function() {
  var pool = [];

  function spawn(x, y, opts) {
    pool.push({
      x: x, y: y,
      vx: opts.vx || 0,
      vy: opts.vy || 0,
      life: opts.life || 0.5,
      maxLife: opts.life || 0.5,
      size: opts.size || 4,
      color: opts.color || '#ffffff',
      gravity: opts.gravity || 0,
      fade: opts.fade !== false,
      shrink: opts.shrink || 0,
      dead: false
    });
  }

  function spawnMuzzleFlash(x, y, angle, color) {
    var c = color || '#ffee44';
    // Main flash
    spawn(x, y, { life:0.06, size:12, color:c, vx:0, vy:0, fade:true });
    // Sparks
    for (var i = 0; i < 5; i++) {
      var a   = angle + (Math.random()-0.5) * 0.8;
      var spd = 80 + Math.random() * 160;
      spawn(x, y, {
        vx: Math.cos(a)*spd, vy: Math.sin(a)*spd,
        life: 0.08 + Math.random()*0.08,
        size: 2 + Math.random()*2,
        color: '#ffcc22',
        fade: true, shrink: 0.02
      });
    }
  }

  function spawnBlood(x, y, count) {
    for (var i = 0; i < count; i++) {
      var a   = Math.random() * Math.PI * 2;
      var spd = 30 + Math.random() * 100;
      spawn(x, y, {
        vx: Math.cos(a)*spd, vy: Math.sin(a)*spd,
        life: 0.3 + Math.random()*0.4,
        size: 2 + Math.random()*4,
        color: i % 3 === 0 ? '#cc1111' : '#aa0000',
        gravity: 80,
        fade: true, shrink: 0.015
      });
    }
  }

  function spawnExplosion(x, y) {
    // Fire
    for (var i = 0; i < 20; i++) {
      var a = Math.random() * Math.PI * 2;
      var spd = 40 + Math.random() * 180;
      var colors = ['#ff6600','#ff4400','#ffaa00','#ff2200','#ffcc44'];
      spawn(x, y, {
        vx: Math.cos(a)*spd, vy: Math.sin(a)*spd,
        life: 0.3 + Math.random()*0.4,
        size: 4 + Math.random()*8,
        color: colors[Math.floor(Math.random()*colors.length)],
        gravity: 30, fade: true, shrink: 0.02
      });
    }
    // Smoke
    for (var j = 0; j < 8; j++) {
      var sa = Math.random() * Math.PI * 2;
      spawn(x, y, {
        vx: Math.cos(sa)*30, vy: Math.sin(sa)*30 - 20,
        life: 0.6 + Math.random()*0.5,
        size: 8 + Math.random()*12,
        color: 'rgba(80,80,80,0.6)',
        gravity: -15, fade: true, shrink: -0.01 // grows slightly
      });
    }
  }

  function spawnHitSpark(x, y) {
    for (var i = 0; i < 4; i++) {
      var a = Math.random() * Math.PI * 2;
      spawn(x, y, {
        vx: Math.cos(a)*80, vy: Math.sin(a)*80,
        life: 0.12,
        size: 3,
        color: '#ffcc44',
        fade: true
      });
    }
  }

  function spawnDustCloud(x, y, color) {
    var c = color || 'rgba(180,150,100,0.5)';
    for (var i = 0; i < 5; i++) {
      var a = Math.random() * Math.PI * 2;
      var spd = 20 + Math.random() * 50;
      spawn(x, y, {
        vx: Math.cos(a)*spd, vy: Math.sin(a)*spd,
        life: 0.4 + Math.random()*0.3,
        size: 5 + Math.random()*8,
        color: c,
        gravity: -10, fade: true, shrink: -0.008
      });
    }
  }

  function update(dt) {
    for (var i = pool.length - 1; i >= 0; i--) {
      var p = pool[i];
      if (p.dead) { pool.splice(i, 1); continue; }
      p.x    += p.vx * dt;
      p.y    += p.vy * dt;
      p.vy   += p.gravity * dt;
      p.vx   *= 0.92;
      p.life -= dt;
      p.size = Math.max(0, p.size - p.shrink * 60 * dt);
      if (p.life <= 0 || p.size <= 0) p.dead = true;
    }
  }

  function draw(ctx, camX, camY) {
    for (var i = 0; i < pool.length; i++) {
      var p = pool[i];
      if (p.dead) continue;
      var alpha = p.fade ? Math.max(0, p.life / p.maxLife) : 1;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur  = p.size > 6 ? 8 : 3;
      ctx.beginPath();
      ctx.arc(p.x - camX, p.y - camY, p.size, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.globalAlpha  = 1;
    ctx.shadowBlur   = 0;
  }

  function clear() { pool = []; }

  return {
    spawn: spawn,
    spawnMuzzleFlash: spawnMuzzleFlash,
    spawnBlood: spawnBlood,
    spawnExplosion: spawnExplosion,
    spawnHitSpark: spawnHitSpark,
    spawnDustCloud: spawnDustCloud,
    update: update,
    draw: draw,
    clear: clear
  };
})();
