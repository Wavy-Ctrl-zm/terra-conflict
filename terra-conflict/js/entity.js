/* ============================================================
   entity.js — Player, Enemy, Bullet classes
   ============================================================ */
'use strict';

var TC = window.TC || {};

// ═══════════════════════════════════ BULLET ══════════════════
TC.Bullet = function(x, y, angle, opts) {
  this.x      = x;
  this.y      = y;
  this.angle  = angle;
  this.speed  = opts.speed  || 650;
  this.damage = opts.damage || 20;
  this.owner  = opts.owner  || 'player'; // 'player' | 'enemy'
  this.color  = opts.color  || '#ffdd44';
  this.life   = 0;
  this.maxLife= opts.range  ? opts.range / (opts.speed||650) : 1.8;
  this.spread = opts.spread || 0;
  // Apply spread
  this.angle += (Math.random() - 0.5) * this.spread;
  this.vx = Math.cos(this.angle) * this.speed;
  this.vy = Math.sin(this.angle) * this.speed;
  this.trail  = [];
  this.dead   = false;
  this.hit    = false;
};
TC.Bullet.prototype.update = function(dt, map) {
  if (this.dead) return;
  // Store trail
  this.trail.push({x: this.x, y: this.y});
  if (this.trail.length > 5) this.trail.shift();

  this.x += this.vx * dt;
  this.y += this.vy * dt;
  this.life += dt;

  if (this.life >= this.maxLife) { this.dead = true; return; }
  if (map.isSolid(this.x, this.y)) { this.dead = true; this.hit = true; }
};
TC.Bullet.prototype.draw = function(ctx, camX, camY) {
  if (this.dead) return;
  var sx = this.x - camX;
  var sy = this.y - camY;
  // Trail
  if (this.trail.length > 1) {
    ctx.strokeStyle = this.color.replace(')', ',0.3)').replace('rgb','rgba').replace('#','');
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.moveTo(this.trail[0].x - camX, this.trail[0].y - camY);
    for (var i = 1; i < this.trail.length; i++)
      ctx.lineTo(this.trail[i].x - camX, this.trail[i].y - camY);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // Bullet dot
  ctx.fillStyle = this.color;
  ctx.shadowColor = this.color;
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.arc(sx, sy, 3, 0, Math.PI*2);
  ctx.fill();
  ctx.shadowBlur = 0;
};

// ═══════════════════════════════════ PLAYER ══════════════════
TC.Player = function(x, y, factionId) {
  this.x        = x;
  this.y        = y;
  this.angle    = 0;
  this.radius   = 11;
  var faction   = TC.FACTIONS.find(function(f){ return f.id === factionId; });
  this.faction  = faction;
  this.speed    = faction.speed;
  this.health   = faction.health;
  this.maxHealth= faction.health;

  this.weapon   = Object.assign({}, faction.weapon);
  this.secondary= Object.assign({}, faction.secondary);
  this.activeWpn= 'primary'; // 'primary'|'secondary'

  this.ammo     = { primary: faction.weapon.clip, secondary: faction.secondary.clip };
  this.maxAmmo  = { primary: faction.weapon.clip, secondary: faction.secondary.clip };

  this.fireCooldown = 0;
  this.reloading    = false;
  this.reloadTimer  = 0;

  this.footTimer    = 0;
  this.footInterval = 0.35;
  this.moving       = false;

  this.invincible   = 0; // brief iframes after taking hit
  this.dead         = false;
  this.score        = 0;
};

TC.Player.prototype.getCurrentWeapon = function() {
  return this.activeWpn === 'primary' ? this.weapon : this.secondary;
};

TC.Player.prototype.switchWeapon = function() {
  this.activeWpn = this.activeWpn === 'primary' ? 'secondary' : 'primary';
  this.reloading = false;
  TC.Audio.play('menuClick');
};

TC.Player.prototype.update = function(dt, map) {
  if (this.dead) return;
  this.invincible = Math.max(0, this.invincible - dt);

  // Movement
  var dir = TC.Input.getDir();
  var len = Math.sqrt(dir.x*dir.x + dir.y*dir.y);
  this.moving = len > 0;
  if (len > 0) {
    dir.x /= len; dir.y /= len;
    var spd = this.speed * dt;
    // slow down in water
    if (map.isWater(this.x, this.y)) spd *= 0.4;

    this._move(dir.x * spd, dir.y * spd, map);

    this.footTimer += dt;
    if (this.footTimer >= this.footInterval) {
      this.footTimer = 0;
      var terrain = map.isWater(this.x,this.y) ? 'water' : map.tileAt(this.x,this.y) === TC.T.ROAD ? 'road' : 'grass';
      TC.Audio.play('footstep', terrain);
    }
  }

  // Aim at mouse
  var mx  = TC.Input.mouse.x + TC.Game.camX;
  var my  = TC.Input.mouse.y + TC.Game.camY;
  this.angle = Math.atan2(my - this.y, mx - this.x);

  // Reload logic
  if (this.reloading) {
    this.reloadTimer -= dt;
    if (this.reloadTimer <= 0) {
      this.reloading = false;
      this.ammo[this.activeWpn] = this.maxAmmo[this.activeWpn];
    }
  }

  // Fire cooldown
  this.fireCooldown = Math.max(0, this.fireCooldown - dt);

  // Key: R = reload, Q = switch weapon
  if (TC.Input.isDown('KeyR') && !this.reloading) this.startReload();
  if (TC.Input.isDown('KeyQ')) {
    if (!this._qDown) { this.switchWeapon(); this._qDown = true; }
  } else { this._qDown = false; }
};

TC.Player.prototype._move = function(dx, dy, map) {
  var r = this.radius - 2;
  var nx = this.x + dx;
  if (!map.isSolid(nx+r, this.y) && !map.isSolid(nx-r, this.y) &&
      !map.isSolid(nx, this.y+r) && !map.isSolid(nx, this.y-r))
    this.x = nx;
  var ny = this.y + dy;
  if (!map.isSolid(this.x+r, ny) && !map.isSolid(this.x-r, ny) &&
      !map.isSolid(this.x, ny+r) && !map.isSolid(this.x, ny-r))
    this.y = ny;
};

TC.Player.prototype.tryShoot = function(bullets) {
  if (this.dead || this.reloading || this.fireCooldown > 0) return false;
  var wpn = this.getCurrentWeapon();
  if (this.ammo[this.activeWpn] <= 0) {
    TC.Audio.play('emptyGun');
    this.startReload();
    return false;
  }
  this.ammo[this.activeWpn]--;
  this.fireCooldown = wpn.fireRate;

  var type = wpn === this.secondary && this.faction.secondary.name.includes('Shotgun') ? 'shotgun' : wpn.name.includes('Marksman') ? 'sniper' : 'rifle';
  TC.Audio.play('gunshot', type);

  var muzzleX = this.x + Math.cos(this.angle) * (this.radius + 8);
  var muzzleY = this.y + Math.sin(this.angle) * (this.radius + 8);

  var shotCount = type === 'shotgun' ? 6 : 1;
  for (var i = 0; i < shotCount; i++) {
    bullets.push(new TC.Bullet(muzzleX, muzzleY, this.angle, {
      speed:  760,
      damage: type === 'shotgun' ? Math.round(wpn.damage / 3) : wpn.damage,
      owner:  'player',
      color:  '#ffee55',
      range:  type === 'shotgun' ? 140 : wpn.range,
      spread: wpn.spread
    }));
  }

  // Muzzle flash particle
  TC.Particles.spawnMuzzleFlash(muzzleX, muzzleY, this.angle);
  return true;
};

TC.Player.prototype.startReload = function() {
  if (this.reloading) return;
  if (this.ammo[this.activeWpn] === this.maxAmmo[this.activeWpn]) return;
  this.reloading  = true;
  this.reloadTimer= this.getCurrentWeapon().reloadTime;
  TC.Audio.play('reload');
};

TC.Player.prototype.takeDamage = function(dmg) {
  if (this.invincible > 0 || this.dead) return;
  this.health -= dmg;
  this.invincible = 0.3;
  TC.Audio.play('playerHit');
  TC.Game.screenShake(6, 0.25);
  if (this.health <= 0) {
    this.health = 0;
    this.dead   = true;
  }
};

TC.Player.prototype.draw = function(ctx, camX, camY) {
  var sx = this.x - camX;
  var sy = this.y - camY;
  var r  = this.radius;
  var f  = this.faction;

  // Shadow
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(sx+3, sy+4, r*0.9, r*0.5, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();

  // Body
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(this.angle);

  // Flash when hit
  if (this.invincible > 0 && Math.floor(this.invincible * 20) % 2 === 0) {
    ctx.globalAlpha = 0.5;
  }

  // Torso
  ctx.fillStyle = f.bodyColor;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI*2);
  ctx.fill();

  // Helmet
  ctx.fillStyle = f.helmetColor;
  ctx.beginPath();
  ctx.arc(0, 0, r*0.65, 0, Math.PI*2);
  ctx.fill();

  // Faction color stripe
  ctx.fillStyle = f.color;
  ctx.fillRect(1, -r*0.15, r*0.6, r*0.3);

  // Gun barrel
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(r*0.4, -2.5, r*0.8, 5);
  ctx.fillStyle = '#555';
  ctx.fillRect(r*0.4, -1.5, r*0.8, 3);

  ctx.restore();

  // Reload arc
  if (this.reloading) {
    var prog = 1 - this.reloadTimer / this.getCurrentWeapon().reloadTime;
    ctx.save();
    ctx.strokeStyle = '#ffaa00';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#ffaa00';
    ctx.shadowBlur  = 6;
    ctx.beginPath();
    ctx.arc(sx, sy, r + 5, -Math.PI/2, -Math.PI/2 + Math.PI*2*prog);
    ctx.stroke();
    ctx.restore();
  }
};

// ═══════════════════════════════════ ENEMY ═══════════════════
TC.Enemy = function(x, y, type) {
  this.x      = x;
  this.y      = y;
  this.type   = type || 'soldier'; // 'soldier'|'heavy'|'sniper'
  this.angle  = Math.random() * Math.PI * 2;
  this.radius = this.type === 'heavy' ? 14 : 10;
  this.dead   = false;
  this.dying  = false;
  this.dyingTimer = 0;

  switch(this.type) {
    case 'heavy':
      this.health = this.maxHealth = 80;
      this.speed  = 90;
      this.color  = '#8a2020';
      this.helmetColor = '#5a1010';
      this.weapon = { damage:22, fireRate:0.6, range:200, spread:0.18, speed:550 };
      this.reward = 30;
      break;
    case 'sniper':
      this.health = this.maxHealth = 25;
      this.speed  = 80;
      this.color  = '#204a20';
      this.helmetColor = '#103010';
      this.weapon = { damage:50, fireRate:1.8, range:480, spread:0.01, speed:820 };
      this.reward = 40;
      break;
    default: // soldier
      this.health = this.maxHealth = 35;
      this.speed  = 115;
      this.color  = '#5a3a20';
      this.helmetColor = '#3a2010';
      this.weapon = { damage:15, fireRate:0.5, range:260, spread:0.10, speed:620 };
      this.reward = 15;
  }

  this.state        = 'patrol';
  this.fireCooldown = Math.random() * 1.5 + 0.5; // stagger initial shots
  this.patrolTarget = { x: x, y: y };
  this.patrolTimer  = 0;
  this.alertFlash   = 0;
  this.lostTimer    = 0;
  this.stuckTimer   = 0;
  this.lastPos      = { x: x, y: y };
};

TC.Enemy.prototype.update = function(dt, map, player, bullets) {
  if (this.dead) return;

  if (this.dying) {
    this.dyingTimer -= dt;
    if (this.dyingTimer <= 0) this.dead = true;
    return;
  }

  var dx   = player.x - this.x;
  var dy   = player.y - this.y;
  var dist = Math.sqrt(dx*dx + dy*dy);
  var los  = map.lineOfSight(this.x, this.y, player.x, player.y);
  var sightRange  = this.type === 'sniper' ? 380 : 230;
  var attackRange = this.type === 'sniper' ? 350 : 140;

  // State machine
  switch(this.state) {
    case 'patrol':
      this._doPatrol(dt, map);
      if (dist < sightRange && los) {
        this.state = 'alert';
        this.alertFlash = 0.4;
        TC.Audio.play('alert');
      }
      break;

    case 'alert':
      this.alertFlash -= dt;
      this.angle = Math.atan2(dy, dx);
      if (this.alertFlash <= 0) this.state = 'chase';
      break;

    case 'chase':
      this._moveToward(player.x, player.y, dt, map);
      this.angle = Math.atan2(dy, dx);
      if (dist < attackRange && los) this.state = 'attack';
      if (!los || dist > sightRange + 80) {
        this.lostTimer += dt;
        if (this.lostTimer > 2.5) { this.state = 'patrol'; this.lostTimer = 0; }
      } else {
        this.lostTimer = 0;
      }
      break;

    case 'attack':
      this.angle = Math.atan2(dy, dx);
      // Strafe a bit while attacking
      if (this.type !== 'sniper') {
        var strafeAngle = this.angle + Math.PI/2;
        var sd = Math.sin(Date.now() / 1000) * 60 * dt;
        this._move(Math.cos(strafeAngle)*sd, Math.sin(strafeAngle)*sd, map);
      }
      this.fireCooldown -= dt;
      if (this.fireCooldown <= 0 && los && !player.dead) {
        this._shoot(bullets);
        this.fireCooldown = this.weapon.fireRate + Math.random()*0.3;
      }
      if (dist > attackRange + 30 || !los) this.state = 'chase';
      break;
  }

  // Stuck check — nudge if not moving
  this.stuckTimer += dt;
  if (this.stuckTimer > 1.0) {
    var movedDist = Math.abs(this.x - this.lastPos.x) + Math.abs(this.y - this.lastPos.y);
    if (movedDist < 4 && (this.state === 'chase' || this.state === 'patrol')) {
      // Random nudge to get unstuck
      this.x += (Math.random()-0.5) * 20;
      this.y += (Math.random()-0.5) * 20;
    }
    this.lastPos = { x: this.x, y: this.y };
    this.stuckTimer = 0;
  }
};

TC.Enemy.prototype._doPatrol = function(dt, map) {
  var dx = this.patrolTarget.x - this.x;
  var dy = this.patrolTarget.y - this.y;
  var dist = Math.sqrt(dx*dx + dy*dy);
  if (dist < 8 || this.patrolTimer <= 0) {
    // Pick a new patrol point
    this.patrolTimer = 3 + Math.random() * 4;
    var attempts = 0;
    do {
      this.patrolTarget = {
        x: this.x + (Math.random()-0.5) * 160,
        y: this.y + (Math.random()-0.5) * 160
      };
      attempts++;
    } while(map.isSolid(this.patrolTarget.x, this.patrolTarget.y) && attempts < 8);
  }
  this.patrolTimer -= dt;
  this.angle = Math.atan2(dy, dx);
  this._moveToward(this.patrolTarget.x, this.patrolTarget.y, dt * 0.55, map);
};

TC.Enemy.prototype._moveToward = function(tx, ty, dt, map) {
  var dx = tx - this.x;
  var dy = ty - this.y;
  var dist = Math.sqrt(dx*dx+dy*dy);
  if (dist < 4) return;
  dx /= dist; dy /= dist;
  this._move(dx * this.speed * dt, dy * this.speed * dt, map);
};

TC.Enemy.prototype._move = function(dx, dy, map) {
  var r  = this.radius - 2;
  var nx = this.x + dx;
  if (!map.isSolid(nx+r, this.y) && !map.isSolid(nx-r, this.y)) this.x = nx;
  var ny = this.y + dy;
  if (!map.isSolid(this.x, ny+r) && !map.isSolid(this.x, ny-r)) this.y = ny;
};

TC.Enemy.prototype._shoot = function(bullets) {
  var mx = this.x + Math.cos(this.angle) * (this.radius + 6);
  var my = this.y + Math.sin(this.angle) * (this.radius + 6);
  bullets.push(new TC.Bullet(mx, my, this.angle, {
    speed:  this.weapon.speed,
    damage: this.weapon.damage,
    owner:  'enemy',
    color:  '#ff4422',
    range:  this.weapon.range,
    spread: this.weapon.spread
  }));
  TC.Audio.play('enemyGunshot');
  TC.Particles.spawnMuzzleFlash(mx, my, this.angle, '#ff4422');
};

TC.Enemy.prototype.takeDamage = function(dmg) {
  if (this.dying || this.dead) return;
  this.health -= dmg;
  TC.Audio.play('hit');
  TC.Particles.spawnBlood(this.x, this.y, 6);
  if (this.health <= 0) {
    this.health  = 0;
    this.dying   = true;
    this.dyingTimer = 0.5;
    TC.Audio.play('enemyDeath');
    TC.Particles.spawnBlood(this.x, this.y, 14);
    return true; // killed
  }
  return false;
};

TC.Enemy.prototype.draw = function(ctx, camX, camY) {
  if (this.dead) return;
  var sx = this.x - camX;
  var sy = this.y - camY;
  var r  = this.radius;

  var alpha = this.dying ? Math.max(0, this.dyingTimer * 2) : 1;
  ctx.globalAlpha = alpha;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(sx+3, sy+4, r*0.9, r*0.5, 0, 0, Math.PI*2);
  ctx.fill();

  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(this.angle);

  // Alert flash (yellow glow)
  if (this.state === 'alert') {
    ctx.shadowColor = '#ffee00';
    ctx.shadowBlur  = 15;
  } else if (this.state === 'attack') {
    ctx.shadowColor = '#ff2200';
    ctx.shadowBlur  = 10;
  }

  // Body
  ctx.fillStyle = this.color;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI*2);
  ctx.fill();

  // Helmet
  ctx.fillStyle = this.helmetColor;
  ctx.beginPath();
  ctx.arc(0, 0, r*0.65, 0, Math.PI*2);
  ctx.fill();

  // Enemy mark (X)
  ctx.strokeStyle = 'rgba(255,60,60,0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r*0.3, -r*0.3); ctx.lineTo(r*0.3, r*0.3);
  ctx.moveTo(r*0.3, -r*0.3);  ctx.lineTo(-r*0.3, r*0.3);
  ctx.stroke();

  // Gun
  ctx.fillStyle = '#333';
  ctx.fillRect(r*0.3, -2, r*0.9, 4);

  ctx.restore();
  ctx.shadowBlur = 0;

  // Health bar
  var barW = r * 2.2;
  var barH = 4;
  var barX = sx - barW/2;
  var barY = sy - r - 10;
  ctx.fillStyle = '#300';
  ctx.fillRect(barX, barY, barW, barH);
  var pct = this.health / this.maxHealth;
  ctx.fillStyle = pct > 0.6 ? '#3a3' : pct > 0.3 ? '#aa3' : '#a33';
  ctx.fillRect(barX, barY, barW * pct, barH);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(barX, barY, barW, barH);

  ctx.globalAlpha = 1;
};
