/**
 * Blackout – Bootstrap: verdrahtet die Overlays, skaliert die Bühne auf
 * die Bildschirmgröße (Querformat 640x360) und blendet bei hochkant
 * gehaltenem Handy den Dreh-Hinweis ein.
 */
(function (global, document) {
  'use strict';

  var BO = global.BO;
  var SG = global.SG;
  var C = BO.constants;

  var SCHEME_LABEL = { halves: 'Bildschirmhälften', stick: 'Joystick' };

  function fitStage() {
    var stage = document.getElementById('stage');
    var vw = global.innerWidth;
    var vh = global.innerHeight;
    var scale = Math.min(vw / C.CANVAS_W, vh / C.CANVAS_H);
    stage.style.transform = 'translate(-50%, -50%) scale(' + scale + ')';

    // Hochkant auf einem Touchgerät: Spiel pausieren und Drehen anregen.
    var hint = document.getElementById('rotate-hint');
    var portraitPhone = vh > vw && Math.min(vw, vh) < 900 && 'ontouchstart' in global;
    hint.hidden = !portraitPhone;
    if (portraitPhone && BO.game.getState() === BO.game.STATES.PLAYING) BO.game.pause();
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
    var btnPause = document.getElementById('btn-pause');
    var touchGuide = document.getElementById('touch-guide');

    var btnStart = document.getElementById('btn-start');
    var btnResume = document.getElementById('btn-resume');
    var btnRestart = document.getElementById('btn-restart');
    var btnRestartPause = document.getElementById('btn-restart-pause');
    var btnSoundMenu = document.getElementById('btn-sound-menu');
    var btnSoundPause = document.getElementById('btn-sound-pause');
    var btnScheme = document.getElementById('btn-scheme');
    var btnSchemePause = document.getElementById('btn-scheme-pause');
    var btnImpact = document.getElementById('btn-impact');
    var btnImpactPause = document.getElementById('btn-impact-pause');

    var bestScoreEl = document.getElementById('best-score');
    var goScoreEl = document.getElementById('go-score');
    var goBestEl = document.getElementById('go-best');

    SG.analytics.setGame(BO.GAME_ID);
    BO.game.init(canvas);
    BO.input.attach(stage);

    setSoundIcon(btnSoundMenu, SG.audio.isEnabled());
    setSoundIcon(btnSoundPause, SG.audio.isEnabled());
    bestScoreEl.textContent = 'Rekord: ' + SG.storage.getBest(BO.GAME_ID) + ' Räume';

    function refreshSettingLabels() {
      var s = SCHEME_LABEL[BO.game.settings.scheme] || 'Bildschirmhälften';
      btnScheme.textContent = s;
      btnSchemePause.textContent = s;
      var imp = BO.game.settings.impactOriginal ? 'original (hart)' : 'mild';
      btnImpact.textContent = imp;
      btnImpactPause.textContent = imp;
    }
    refreshSettingLabels();

    function show(el) { el.hidden = false; }
    function hide(el) { el.hidden = true; }

    BO.game.onChange(function (payload) {
      hide(screenMenu);
      hide(screenPause);
      hide(screenGameOver);
      hide(btnPause);

      switch (payload.state) {
        case BO.game.STATES.MENU:
          show(screenMenu);
          bestScoreEl.textContent = 'Rekord: ' + payload.best + ' Räume';
          break;
        case BO.game.STATES.PLAYING:
          show(btnPause);
          break;
        case BO.game.STATES.PAUSED:
          show(btnPause);
          show(screenPause);
          break;
        case BO.game.STATES.GAMEOVER:
          goScoreEl.textContent = payload.score;
          goBestEl.textContent = payload.newBest
            ? 'Neuer Rekord!'
            : ('Rekord: ' + payload.best + ' Räume');
          show(screenGameOver);
          break;
      }
    });

    function startWithGuide() {
      BO.game.start();
      // Zonen-Hilfe nur beim Halbierungs-Schema und nur kurz
      if (BO.game.settings.scheme === 'halves') {
        touchGuide.hidden = false;
        setTimeout(function () { touchGuide.hidden = true; }, 2600);
      }
    }

    btnStart.addEventListener('click', startWithGuide);
    btnRestart.addEventListener('click', function () {
      SG.poki.commercialBreak(function () { startWithGuide(); });
    });
    btnRestartPause.addEventListener('click', startWithGuide);
    btnResume.addEventListener('click', function () { BO.game.resume(); });
    btnPause.addEventListener('click', function () { BO.game.togglePause(); });

    [btnSoundMenu, btnSoundPause].forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var on = BO.game.toggleSound();
        setSoundIcon(btnSoundMenu, on);
        setSoundIcon(btnSoundPause, on);
      });
    });

    [btnScheme, btnSchemePause].forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        BO.game.setScheme(BO.game.settings.scheme === 'halves' ? 'stick' : 'halves');
        refreshSettingLabels();
      });
    });

    [btnImpact, btnImpactPause].forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        BO.game.setImpactOriginal(!BO.game.settings.impactOriginal);
        refreshSettingLabels();
      });
    });

    // Overlay-Knöpfe dürfen nicht gleichzeitig als Spieleingabe zählen
    [btnStart, btnResume, btnRestart, btnRestartPause, btnPause,
     btnSoundMenu, btnSoundPause, btnScheme, btnSchemePause, btnImpact, btnImpactPause]
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
})(typeof window !== 'undefined' ? window : globalThis, typeof document !== 'undefined' ? document : null);
