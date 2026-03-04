/* ============================================================
   audio.js — Procedural Web Audio sound engine
   No audio files required — all sounds generated via Web Audio API
   ============================================================ */
'use strict';

var TC = window.TC || {};

TC.Audio = (function() {
  var ctx = null;
  var muted = false;

  function init() {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch(e) { console.warn('Web Audio not available'); }
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  // ── Low-level helpers ──────────────────────────────────
  function gain(vol) {
    var g = ctx.createGain();
    g.gain.setValueAtTime(vol, ctx.currentTime);
    return g;
  }

  function connect(nodes) {
    for (var i = 0; i < nodes.length - 1; i++)
      nodes[i].connect(nodes[i+1]);
    nodes[nodes.length-1].connect(ctx.destination);
  }

  function noise(duration, vol, color) {
    // color: 'white'|'pink' — creates noise burst
    var bufSize  = Math.ceil(ctx.sampleRate * duration);
    var buf      = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    var data     = buf.getChannelData(0);
    var b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
    for (var i = 0; i < bufSize; i++) {
      var w = Math.random() * 2 - 1;
      if (color === 'pink') {
        b0=0.99886*b0+w*0.0555179; b1=0.99332*b1+w*0.0750759;
        b2=0.96900*b2+w*0.1538520; b3=0.86650*b3+w*0.3104856;
        b4=0.55000*b4+w*0.5329522; b5=-0.7616*b5-w*0.0168980;
        data[i] = (b0+b1+b2+b3+b4+b5+b6+w*0.5362)/7; b6=w*0.115926;
      } else {
        data[i] = w;
      }
    }
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var g = gain(vol);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    connect([src, g]);
    src.start(); src.stop(ctx.currentTime + duration);
  }

  function tone(freq, type, dur, vol, attack, decay) {
    var osc = ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    var g = gain(0.0001);
    g.gain.linearRampToValueAtTime(vol, ctx.currentTime + (attack||0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    connect([osc, g]);
    osc.start(); osc.stop(ctx.currentTime + dur + 0.05);
  }

  // ── Sound definitions ──────────────────────────────────
  var sounds = {
    gunshot: function(weaponType) {
      if (!ctx) return;
      resume();
      if (muted) return;
      var vol = weaponType === 'sniper' ? 0.7 : weaponType === 'shotgun' ? 0.6 : 0.5;
      noise(0.12, vol, 'white');
      // body thud
      var osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      var f0  = weaponType === 'sniper' ? 180 : weaponType === 'shotgun' ? 90 : 130;
      osc.frequency.setValueAtTime(f0, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.08);
      var g = gain(0.0001);
      g.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.1);
      connect([osc, g]);
      osc.start(); osc.stop(ctx.currentTime + 0.15);
    },

    enemyGunshot: function() {
      if (!ctx || muted) return;
      resume();
      noise(0.08, 0.25, 'white');
    },

    hit: function() {
      if (!ctx || muted) return;
      resume();
      noise(0.06, 0.3, 'pink');
      tone(200, 'sine', 0.1, 0.2, 0.005, 0.1);
    },

    playerHit: function() {
      if (!ctx || muted) return;
      resume();
      noise(0.15, 0.5, 'pink');
      tone(80, 'sawtooth', 0.2, 0.3, 0.01, 0.2);
    },

    reload: function() {
      if (!ctx || muted) return;
      resume();
      // click sound
      tone(800, 'square', 0.03, 0.15, 0.001, 0.03);
      setTimeout(function(){
        if(!ctx||muted) return;
        tone(600, 'square', 0.05, 0.2, 0.001, 0.05);
      }, 300);
      setTimeout(function(){
        if(!ctx||muted) return;
        tone(900, 'square', 0.04, 0.25, 0.001, 0.04);
      }, 600);
    },

    explosion: function() {
      if (!ctx || muted) return;
      resume();
      noise(0.5, 0.8, 'pink');
      tone(60, 'sawtooth', 0.4, 0.6, 0.01, 0.4);
    },

    alert: function() {
      if (!ctx || muted) return;
      resume();
      tone(440, 'square', 0.1, 0.15, 0.01, 0.1);
      setTimeout(function(){
        if(!ctx||muted) return;
        tone(550, 'square', 0.1, 0.15, 0.01, 0.1);
      }, 120);
    },

    enemyDeath: function() {
      if (!ctx || muted) return;
      resume();
      noise(0.12, 0.35, 'pink');
      tone(180, 'sine', 0.2, 0.2, 0.005, 0.2);
    },

    waveStart: function() {
      if (!ctx || muted) return;
      resume();
      [220, 277, 330, 440].forEach(function(f, i){
        setTimeout(function(){
          if(!ctx||muted) return;
          tone(f, 'sawtooth', 0.3, 0.25, 0.02, 0.3);
        }, i * 150);
      });
    },

    victory: function() {
      if (!ctx || muted) return;
      resume();
      [330, 440, 550, 660, 880].forEach(function(f, i){
        setTimeout(function(){
          if(!ctx||muted) return;
          tone(f, 'sine', 0.4, 0.3, 0.02, 0.4);
        }, i * 120);
      });
    },

    menuClick: function() {
      if (!ctx || muted) return;
      resume();
      tone(660, 'square', 0.05, 0.2, 0.001, 0.05);
    },

    emptyGun: function() {
      if (!ctx || muted) return;
      resume();
      tone(200, 'square', 0.04, 0.15, 0.001, 0.04);
    },

    footstep: function(terrain) {
      if (!ctx || muted) return;
      var vol = 0.04;
      var freq = terrain === 'water' ? 300 : terrain === 'road' ? 600 : 400;
      noise(0.03, vol, 'white');
      tone(freq, 'sine', 0.04, vol*2, 0.001, 0.04);
    }
  };

  return {
    init: init,
    play: function(name, arg) {
      if (sounds[name]) sounds[name](arg);
    },
    setMuted: function(m) { muted = m; },
    isMuted: function() { return muted; }
  };
})();
