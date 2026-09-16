/**
 * Bootstrap: verdrahtet DOM-Overlays mit game.js, skaliert die Bühne
 * responsiv (feste Referenzauflösung 340x480, wie in der Spec) und
 * initialisiert das (austauschbare) Poki-SDK-Modul.
 */
(function (global, document) {
  'use strict';

  var AA = global.AA;
  var SG = global.SG;
  var C = AA.constants;

  function fitStage() {
    var stage = document.getElementById('stage');
    var vw = global.innerWidth;
    var vh = global.innerHeight;
    var scale = Math.min(vw / C.CANVAS_W, vh / C.CANVAS_H);
    stage.style.transform = 'translate(-50%, -50%) scale(' + scale + ')';
    stage.style.position = 'fixed';
    stage.style.left = '50%';
    stage.style.top = '50%';
  }

  function setSoundIcon(el, enabled) {
    el.textContent = enabled ? '🔊' : '🔇';
  }

  function init() {
    var canvas = document.getElementById('game');
    var stage = document.getElementById('stage');

    var screenMenu = document.getElementById('screen-menu');
    var screenPause = document.getElementById('screen-pause');
    var screenGameOver = document.getElementById('screen-gameover');
    var hudScore = document.getElementById('hud-score');
    var btnPause = document.getElementById('btn-pause');

    var btnStart = document.getElementById('btn-start');
    var btnResume = document.getElementById('btn-resume');
    var btnRestart = document.getElementById('btn-restart');
    var btnRestartPause = document.getElementById('btn-restart-pause');
    var btnSoundMenu = document.getElementById('btn-sound-menu');
    var btnSoundPause = document.getElementById('btn-sound-pause');

    var bestScoreEl = document.getElementById('best-score');
    var goScoreEl = document.getElementById('go-score');
    var goBestEl = document.getElementById('go-best');

    SG.analytics.setGame(AA.GAME_ID);
    AA.game.init(canvas);
    AA.input.attach(stage);

    setSoundIcon(btnSoundMenu, SG.audio.isEnabled());
    setSoundIcon(btnSoundPause, SG.audio.isEnabled());
    bestScoreEl.textContent = 'Rekord: ' + SG.storage.getBest(AA.GAME_ID);

    function show(el) { el.hidden = false; }
    function hide(el) { el.hidden = true; }

    AA.game.onChange(function (payload) {
      hide(screenMenu);
      hide(screenPause);
      hide(screenGameOver);
      hide(btnPause);
      hide(hudScore);

      switch (payload.state) {
        case AA.game.STATES.MENU:
          show(screenMenu);
          bestScoreEl.textContent = 'Rekord: ' + payload.best;
          break;
        case AA.game.STATES.PLAYING:
          show(btnPause);
          show(hudScore);
          break;
        case AA.game.STATES.PAUSED:
          show(btnPause);
          show(hudScore);
          show(screenPause);
          break;
        case AA.game.STATES.GAMEOVER:
          goScoreEl.textContent = payload.score;
          goBestEl.textContent = payload.newBest ? 'Neuer Rekord!' : ('Rekord: ' + payload.best);
          show(screenGameOver);
          break;
      }
    });

    // laufenden Score anzeigen
    (function updateScoreLoop() {
      if (AA.game.getState() === AA.game.STATES.PLAYING) {
        hudScore.textContent = AA.game.getDebugState().score;
      }
      global.requestAnimationFrame(updateScoreLoop);
    })();

    btnStart.addEventListener('click', function () { AA.game.start(); });
    btnRestart.addEventListener('click', function () {
      SG.poki.commercialBreak(function () { AA.game.restart(); });
    });
    btnRestartPause.addEventListener('click', function () { AA.game.restart(); });
    btnResume.addEventListener('click', function () { AA.game.resume(); });
    btnPause.addEventListener('click', function () { AA.game.togglePause(); });

    [btnSoundMenu, btnSoundPause].forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var on = AA.game.toggleSound();
        setSoundIcon(btnSoundMenu, on);
        setSoundIcon(btnSoundPause, on);
      });
    });

    // Diese Overlay-Buttons dürfen nicht gleichzeitig einen Ladesprung auslösen
    [btnStart, btnResume, btnRestart, btnRestartPause, btnPause, btnSoundMenu, btnSoundPause]
      .forEach(function (btn) {
        btn.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
      });

    fitStage();
    global.addEventListener('resize', fitStage);
    global.addEventListener('orientationchange', fitStage);

    SG.poki.init().then(function () {
      SG.poki.gameLoadingFinished();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window, document);
