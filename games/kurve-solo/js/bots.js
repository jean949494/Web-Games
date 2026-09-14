/**
 * Bot-KI (Prototyp-Niveau, siehe Spec "Bot-KI"):
 * Schaut ein Stück voraus (BOT_LOOKAHEAD) in Bewegungsrichtung. Erkennt
 * sie dort eine Wand oder eigene/fremde Linie, weicht sie in eine
 * Richtung aus (zufällig gewählt beim ersten Erkennen, dann kurz
 * gehalten). Sonst gelegentlich kleine zufällige Richtungsänderungen
 * für organisches statt rein reaktives Wirken.
 */
(function (global) {
  'use strict';

  var KS = global.KS = global.KS || {};
  var C = KS.constants;

  function isWallDanger(x, y) {
    var m = C.FIELD_MARGIN;
    return x < m || x > C.CANVAS_W - m || y < m || y > C.CANVAS_H - m;
  }

  // Etwas großzügigere Schwelle als die exakte Kollisionsgrenze (siehe
  // BOT_LOOKAHEAD_FACTOR_SQ in constants.js), damit Bots vorausschauend
  // abdrehen statt die Linie/Wand erst im letzten Frame zu berühren.
  function isLineDanger(x, y, players, selfId) {
    var thresholdSq = C.BOT_LOOKAHEAD_FACTOR_SQ * C.THICK * C.THICK;
    for (var p = 0; p < players.length; p++) {
      var player = players[p];
      var trail = player.trail;
      var ignoreFrom = player.id === selfId ? trail.length - C.SELF_IGNORE_RECENT_POINTS : trail.length;
      for (var i = 0; i < ignoreFrom; i++) {
        var pt = trail[i];
        if (!pt.draw) continue; // Lücke -> kein Hindernis
        var dx = x - pt.x, dy = y - pt.y;
        if (dx * dx + dy * dy < thresholdSq) return true;
      }
    }
    return false;
  }

  function decideTurn(bot, players) {
    var lx = bot.x + Math.cos(bot.angle) * C.BOT_LOOKAHEAD;
    var ly = bot.y + Math.sin(bot.angle) * C.BOT_LOOKAHEAD;
    var danger = isWallDanger(lx, ly) || isLineDanger(lx, ly, players, bot.id);

    if (danger) {
      if (bot.avoidHold <= 0) {
        bot.avoidDir = Math.random() < 0.5 ? -1 : 1;
        bot.avoidHold = C.BOT_AVOID_HOLD_FRAMES;
      } else {
        bot.avoidHold--;
      }
      bot.wobbleHold = 0;
      return bot.avoidDir;
    }
    bot.avoidHold = 0;

    if (bot.wobbleHold > 0) {
      bot.wobbleHold--;
      return bot.wobbleDir;
    }
    if (Math.random() < C.BOT_WOBBLE_CHANCE) {
      bot.wobbleDir = Math.random() < 0.5 ? -1 : 1;
      bot.wobbleHold = C.BOT_WOBBLE_FRAMES;
      return bot.wobbleDir;
    }
    return 0;
  }

  KS.bots = { decideTurn: decideTurn };
})(window);
