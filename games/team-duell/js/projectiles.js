/**
 * Projektile: Schuss (Geradeausfeuer, von der gegnerischen Mauer
 * blockierbar) und Wurf (Lob, fliegt über jede Mauer hinweg, trifft nur
 * nah am Zielpunkt). Siehe Spec-Abschnitt "Konzept".
 *
 * Beide Typen kennen nur die Seite ihres Schützen ('player' oder
 * 'enemy') und richten Schaden gegen die jeweils andere Seite an – so
 * gilt dieselbe Logik für den Menschen, die eigenen Teammates UND die
 * Gegner-KI.
 */
(function (global) {
  'use strict';

  var TD = global.TD = global.TD || {};
  var C = TD.constants;

  function otherSide(side) {
    return side === 'player' ? 'enemy' : 'player';
  }

  function spawnBullet(list, x, y, angle, side) {
    list.push({
      x: x, y: y,
      vx: Math.cos(angle) * C.BULLET_SPEED,
      vy: Math.sin(angle) * C.BULLET_SPEED,
      side: side,
      checkedWall: false,
    });
  }

  // targetX/Y: bereits berechneter Zielpunkt (beim Spieler aus dem
  // Wurf-Stick, bei der KI mit Vorhalten auf die aktuelle Zielgeschwindigkeit
  // vorausberechnet). dist/THROW_FLIGHT_SPEED ergibt die Flugzeit.
  function spawnThrow(list, x, y, targetX, targetY, side) {
    var dist = Math.max(1, Math.hypot(targetX - x, targetY - y));
    var totalFrames = dist / C.THROW_FLIGHT_SPEED;
    list.push({
      x0: x, y0: y, x: x, y: y,
      targetX: targetX, targetY: targetY,
      side: side,
      frame: 0, totalFrames: totalFrames,
    });
  }

  // onDamage(info) wird bei jedem Treffer aufgerufen; info.kind ist
  // 'wall' | 'unit'. Bei 'unit' trägt info.unit die konkret getroffene
  // Einheit (für Treffer-Flash o.ä.), bei 'wall' info.justBroke, ob genau
  // dieser Treffer das Segment zerstört hat (für einen größeren Effekt).
  function updateBullets(bullets, world, onDamage) {
    for (var i = bullets.length - 1; i >= 0; i--) {
      var b = bullets[i];
      b.x += b.vx;
      b.y += b.vy;

      if (b.x < 0 || b.x > C.CANVAS_W || b.y < 0 || b.y > C.CANVAS_H) {
        bullets.splice(i, 1);
        continue;
      }

      // Mauer der GEGNERISCHEN Seite blockiert (Spec: "wird von der Mauer
      // blockiert"). Die eigene Mauer ignoriert der Schuss.
      if (!b.checkedWall) {
        var targetWall = b.side === 'player' ? world.wallEnemy : world.wallPlayer;
        var res = TD.wall.tryBlock(targetWall, b.x, b.y);
        if (res.inBand) {
          b.checkedWall = true;
          if (res.blocked) {
            onDamage({ defSide: null, amount: 0, x: b.x, y: targetWall.y, kind: 'wall', justBroke: res.justBroke });
            bullets.splice(i, 1);
            continue;
          }
        }
      }

      // Trefferprüfung gegen Einheiten der gegnerischen Seite.
      var defSide = otherSide(b.side);
      var units = defSide === 'player' ? world.playerUnits : world.enemyUnits;
      var hit = false;
      for (var u = 0; u < units.length; u++) {
        var unit = units[u];
        var dx = b.x - unit.x, dy = b.y - unit.y;
        if (dx * dx + dy * dy <= C.BULLET_HIT_RADIUS * C.BULLET_HIT_RADIUS) {
          var dmg = defSide === 'player' ? C.SHOT_DAMAGE_TO_PLAYER : C.SHOT_DAMAGE_TO_ENEMY;
          onDamage({ defSide: defSide, amount: dmg, x: b.x, y: b.y, kind: 'unit', unit: unit });
          hit = true;
          break;
        }
      }
      if (hit) bullets.splice(i, 1);
    }
  }

  // onLand(info) beim Aufschlag des Wurfs; info.wasHit, info.unit ist bei
  // einem Treffer die getroffene Einheit (für Treffer-Flash), sonst leer.
  function updateThrows(throws, world, onLand) {
    for (var i = throws.length - 1; i >= 0; i--) {
      var t = throws[i];
      t.frame++;
      var progress = Math.min(1, t.frame / t.totalFrames);
      t.x = t.x0 + (t.targetX - t.x0) * progress;
      t.y = t.y0 + (t.targetY - t.y0) * progress;

      if (progress >= 1) {
        var defSide = otherSide(t.side);
        var units = defSide === 'player' ? world.playerUnits : world.enemyUnits;
        var bestDist = Infinity, bestUnit = null;
        for (var u = 0; u < units.length; u++) {
          var d = Math.hypot(units[u].x - t.targetX, units[u].y - t.targetY);
          if (d < bestDist) { bestDist = d; bestUnit = units[u]; }
        }
        var wasHit = bestDist <= C.THROW_HIT_RADIUS;
        onLand({
          defSide: defSide, amount: wasHit ? C.THROW_HIT_DAMAGE : 0,
          x: t.targetX, y: t.targetY, wasHit: wasHit, unit: wasHit ? bestUnit : null,
        });
        throws.splice(i, 1);
      }
    }
  }

  function drawBullets(ctx, bullets) {
    for (var i = 0; i < bullets.length; i++) {
      var b = bullets[i];
      ctx.fillStyle = b.side === 'player' ? C.PLAYER_COLOR : C.ENEMY_COLOR;
      ctx.beginPath();
      ctx.arc(b.x, b.y, C.BULLET_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Wurf wird als wachsender/schrumpfender Kreis mit Schatten gezeichnet,
  // um die Lob-Flugbahn (hoch in der Mitte, tief an den Enden) abstrakt
  // anzudeuten (Spec-Reskin: abstrakte Form statt Rakete/Geschoss).
  function drawThrows(ctx, throws) {
    for (var i = 0; i < throws.length; i++) {
      var t = throws[i];
      var progress = Math.min(1, t.frame / t.totalFrames);
      var arc = Math.sin(progress * Math.PI); // 0 an den Enden, 1 in der Mitte
      var color = t.side === 'player' ? C.PLAYER_COLOR : C.ENEMY_COLOR;

      // Schatten am Boden (Zielpfad), wandert mit, wird bei Scheitelpunkt kleiner.
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(t.x, t.y, 5 - arc * 2, 2.4 - arc * 1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      var radius = 4 + arc * 5;
      var liftY = t.y - arc * 22; // visuell "höher" auf dem Scheitel
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(t.x, liftY, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  TD.projectiles = {
    spawnBullet: spawnBullet,
    spawnThrow: spawnThrow,
    updateBullets: updateBullets,
    updateThrows: updateThrows,
    drawBullets: drawBullets,
    drawThrows: drawThrows,
  };
})(window);
