/* ============================================================
   input.js — Keyboard + Mouse input state
   ============================================================ */
'use strict';

var TC = window.TC || {};

TC.Input = (function() {
  var keys   = {};
  var mouse  = { x: 0, y: 0, down: false, clicked: false };
  var canvas = null;

  function init(cnv) {
    canvas = cnv;

    window.addEventListener('keydown', function(e) {
      keys[e.code] = true;
      // prevent page scroll with arrow/space keys during gameplay
      if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].indexOf(e.code) > -1) {
        if (TC.Game && TC.Game.state === 'playing') e.preventDefault();
      }
    });
    window.addEventListener('keyup', function(e) {
      keys[e.code] = false;
    });

    canvas.addEventListener('mousemove', function(e) {
      var r = canvas.getBoundingClientRect();
      var scaleX = canvas.width  / r.width;
      var scaleY = canvas.height / r.height;
      mouse.x = (e.clientX - r.left) * scaleX;
      mouse.y = (e.clientY - r.top)  * scaleY;
    });

    canvas.addEventListener('mousedown', function(e) {
      if (e.button === 0) { mouse.down = true; mouse.clicked = true; }
    });

    canvas.addEventListener('mouseup', function(e) {
      if (e.button === 0) mouse.down = false;
    });

    // Prevent context menu on right click
    canvas.addEventListener('contextmenu', function(e) { e.preventDefault(); });
  }

  function consumeClick() {
    var c = mouse.clicked;
    mouse.clicked = false;
    return c;
  }

  function isDown(code)  { return !!keys[code]; }
  function isAny(codes)  { return codes.some(function(c){ return keys[c]; }); }

  return {
    init: init,
    isDown: isDown,
    isAny: isAny,
    mouse: mouse,
    consumeClick: consumeClick,
    getDir: function() {
      return {
        x: (isDown('KeyD') || isDown('ArrowRight') ? 1 : 0) - (isDown('KeyA') || isDown('ArrowLeft') ? 1 : 0),
        y: (isDown('KeyS') || isDown('ArrowDown')  ? 1 : 0) - (isDown('KeyW') || isDown('ArrowUp')   ? 1 : 0)
      };
    }
  };
})();
