/**
 * KI: Bewegung + Angriffsentscheidungen für alle nicht vom Menschen
 * gesteuerten Einheiten (2 eigene Teammates, 3 Gegner). Prototyp-Niveau,
 * analog zu den Bots in Kurve Solo: nachvollziehbar, nicht perfekt.
 *
 * Teammates folgen dem aktuell aktiven Team-Kommando (Spec: Rückzug /
 * Angriff / Deckung) relativ zur Spielerposition. Gegner haben kein
 * eigenes Kommando-System (die Spec beschreibt nur Kommandos für das
 * eigene Team) – sie halten stattdessen eine lockere Formation mit
 * leichtem organischem Drift und ziehen sich zurück, sobald ihr
 * Team-HP-Pool niedrig ist (Annahme, siehe README).
 */
(function (global) {
  'use strict';

  var TD = global.TD = global.TD || {};
  var C = TD.constants;

  function clamp(v, min, max) { return v < min ? min : v > max ? max : v; }

  // laneIndex: eigener Index innerhalb der Seite (0..2 bei Gegnern, 0..1
  // bei Teammates) – legt fest, welche gegnerische Einheit diese Einheit
  // BEVORZUGT anvisiert (siehe pickFireTarget). Für den Menschen ohne
  // Bedeutung (er feuert nicht über decideFire).
  function makeUnit(id, side, role, x, y, color, laneIndex) {
    return {
      id: id, side: side, role: role, laneIndex: laneIndex || 0,
      x: x, y: y, prevX: x, prevY: y, vx: 0, vy: 0,
      color: color, flashFrames: 0,
      // Schonfrist zu Rundenbeginn (siehe AI_START_GRACE_MS) + etwas
      // Streuung, damit nicht alle Einheiten exakt gleichzeitig loslegen.
      fireTimer: C.AI_START_GRACE_MS + Math.random() * 500,
      throwTimer: C.AI_START_GRACE_MS + 1200 + Math.random() * 1500,
      wobblePhase: Math.random() * Math.PI * 2,
    };
  }

  function updateVelocity(unit) {
    unit.vx = unit.x - unit.prevX;
    unit.vy = unit.y - unit.prevY;
    unit.prevX = unit.x;
    unit.prevY = unit.y;
  }

  function steerToward(unit, targetX, targetY, speed, xMin, xMax, yMin, yMax) {
    var dx = targetX - unit.x, dy = targetY - unit.y;
    var dist = Math.hypot(dx, dy);
    if (dist > 0.5) {
      var step = Math.min(speed, dist);
      unit.x += (dx / dist) * step;
      unit.y += (dy / dist) * step;
    }
    unit.x = clamp(unit.x, xMin, xMax);
    unit.y = clamp(unit.y, yMin, yMax);
  }

  // Zielposition eines Teammates: Spieler-Position + Kommando-abhängiger
  // Offset (Spec: Rückzug = hinter die eigene Position zurückziehen,
  // Angriff = weit vor/exponiert, Deckung = eng an der Spielerposition).
  // Konkrete Offset-Werte sind eine Annahme, siehe README.
  function teammateFormationTarget(index, player, command) {
    var side = index === 0 ? -1 : 1; // Teammate A links, B rechts
    var x, y;
    switch (command) {
      case C.COMMANDS.RETREAT:
        x = player.x + side * 46;
        y = clamp(player.y + 70, C.PLAYER_ZONE_Y_MIN, C.PLAYER_ZONE_Y_MAX);
        break;
      case C.COMMANDS.ATTACK:
        x = player.x + side * 70;
        y = C.PLAYER_ZONE_Y_MIN + 14; // dicht an der eigenen Mauer, exponiert
        break;
      case C.COMMANDS.COVER:
      default:
        x = player.x + side * 34;
        y = player.y + 8;
        break;
    }
    return { x: clamp(x, C.FIELD_X_MIN, C.FIELD_X_MAX), y: clamp(y, C.PLAYER_ZONE_Y_MIN, C.PLAYER_ZONE_Y_MAX) };
  }

  function updateTeammate(unit, index, player, command) {
    var target = teammateFormationTarget(index, player, command);
    steerToward(unit, target.x, target.y, C.TEAMMATE_SPEED,
      C.FIELD_X_MIN, C.FIELD_X_MAX, C.PLAYER_ZONE_Y_MIN, C.PLAYER_ZONE_Y_MAX);
    updateVelocity(unit);
  }

  // Gegner-Formation: feste Fahrspuren mit leichtem Sinus-Drift für
  // organisches Wirken (Annahme, keine Spec-Vorgabe). Bei niedrigem
  // eigenem Team-HP weicht die Formation näher an den eigenen Rand zurück.
  function updateEnemy(unit, index, frameCount, enemyHpFrac) {
    var lane = C.ENEMY_START_X[index];
    var driftX = Math.sin(frameCount * 0.01 + unit.wobblePhase) * 30;
    var baseY = enemyHpFrac < 0.4
      ? C.ENEMY_ZONE_Y_MIN + 10 // vorsichtig, zieht sich weit zurück
      : C.ENEMY_ZONE_Y_MIN + 10 + Math.sin(frameCount * 0.008 + unit.wobblePhase) * 20;
    var target = { x: clamp(lane + driftX, C.FIELD_X_MIN, C.FIELD_X_MAX), y: clamp(baseY, C.ENEMY_ZONE_Y_MIN, C.ENEMY_ZONE_Y_MAX) };
    steerToward(unit, target.x, target.y, C.ENEMY_SPEED,
      C.FIELD_X_MIN, C.FIELD_X_MAX, C.ENEMY_ZONE_Y_MIN, C.ENEMY_ZONE_Y_MAX);
    updateVelocity(unit);
  }

  function nearestOpponent(unit, opponents) {
    var best = null, bestDist = Infinity;
    for (var i = 0; i < opponents.length; i++) {
      var d = Math.hypot(opponents[i].x - unit.x, opponents[i].y - unit.y);
      if (d < bestDist) { bestDist = d; best = opponents[i]; }
    }
    return best;
  }

  // Zielwahl fürs Feuer: meist (AI_LANE_TARGET_CHANCE) die "Lane" – das
  // gegnerische Gegenstück nach Index – statt strikt des nächsten Ziels.
  // Grund (siehe Kommentar bei AI_LANE_TARGET_CHANCE in constants.js):
  // "immer das nächste Ziel" lässt alle KI-Einheiten auf dieselbe
  // gegnerische Einheit einprügeln und reißt dadurch binnen Sekunden eine
  // einzelne Mauer-Spalte auf, statt dass sich der Beschuss über die
  // Mauerbreite verteilt. Der Rest-Anteil bleibt "nächstes Ziel", damit
  // sich die KI nicht komplett mechanisch anfühlt.
  function pickFireTarget(unit, opponents) {
    if (Math.random() < C.AI_LANE_TARGET_CHANCE) {
      var lane = opponents[Math.min(unit.laneIndex, opponents.length - 1)];
      if (lane) return lane;
    }
    return nearestOpponent(unit, opponents);
  }

  // Feuerentscheidung: fester Countdown pro Einheit (Annahme,
  // AI_FIRE_INTERVAL_*), zielt mit leichter Streuung auf das gewählte
  // Ziel (siehe pickFireTarget). Gibt {angle} zurück, wenn geschossen
  // werden soll.
  function decideFire(unit, opponents, dtMs) {
    unit.fireTimer -= dtMs;
    if (unit.fireTimer > 0) return null;
    unit.fireTimer = C.AI_FIRE_INTERVAL_MIN_MS + Math.random() * (C.AI_FIRE_INTERVAL_MAX_MS - C.AI_FIRE_INTERVAL_MIN_MS);
    var target = pickFireTarget(unit, opponents);
    if (!target) return null;
    var spread = (Math.random() - 0.5) * C.AI_AIM_SPREAD;
    var angle = Math.atan2((target.y + spread) - unit.y, (target.x + spread) - unit.x);
    return { angle: angle };
  }

  // Wurfentscheidung: seltener Countdown (AI_THROW_INTERVAL_*), zielt mit
  // Vorhalten auf die anhand der Zielgeschwindigkeit vorausberechnete
  // Position (Spec: "Vorhalten nötig", gilt symmetrisch auch für die KI).
  function decideThrow(unit, opponents, dtMs) {
    unit.throwTimer -= dtMs;
    if (unit.throwTimer > 0) return null;
    unit.throwTimer = C.AI_THROW_INTERVAL_MIN_MS + Math.random() * (C.AI_THROW_INTERVAL_MAX_MS - C.AI_THROW_INTERVAL_MIN_MS);
    var target = opponents[Math.floor(Math.random() * opponents.length)];
    if (!target) return null;
    var dist = Math.hypot(target.x - unit.x, target.y - unit.y);
    var leadFrames = dist / C.THROW_FLIGHT_SPEED;
    var tx = clamp(target.x + target.vx * leadFrames, C.FIELD_X_MIN, C.FIELD_X_MAX);
    var ty = clamp(target.y + target.vy * leadFrames, 0, C.CANVAS_H);
    return { x: tx, y: ty };
  }

  TD.ai = {
    makeUnit: makeUnit,
    updateVelocity: updateVelocity, // vom Spieler-Movement in game.js direkt aufgerufen
    updateTeammate: updateTeammate,
    updateEnemy: updateEnemy,
    decideFire: decideFire,
    decideThrow: decideThrow,
    teammateFormationTarget: teammateFormationTarget,
  };
})(window);
