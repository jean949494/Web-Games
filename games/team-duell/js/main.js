/**
 * Bootstrap: verdrahtet DOM-Overlays + die Steuerungsleiste mit game.js,
 * skaliert die Bühne responsiv (feste Referenzauflösung 340x480, wie in
 * der Spec) und initialisiert das (austauschbare) Poki-SDK-Modul.
 *
 * Die Sticks/Kommando-Buttons in #controls skalieren bewusst NICHT mit
 * der Bühne mit (siehe style.css) – sie werden nur ein-/ausgeblendet.
 */
(function (global, document) {
  'use strict';

  var TD = global.TD;
  var SG = global.SG;
  var C = TD.constants;

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
    var controls = document.getElementById('controls');

    var screenMenu = document.getElementById('screen-menu');
    var screenPause = document.getElementById('screen-pause');
    var screenGameOver = document.getElementById('screen-gameover');
    var btnPause = document.getElementById('btn-pause');

    var btnStart = document.getElementById('btn-start');
    var btnResume = document.getElementById('btn-resume');
    var btnRestartPause = document.getElementById('btn-restart-pause');
    var btnRestart = document.getElementById('btn-restart');
    var btnSoundMenu = document.getElementById('btn-sound-menu');
    var btnSoundPause = document.getElementById('btn-sound-pause');

    var bestScoreEl = document.getElementById('best-score');
    var goTitleEl = document.getElementById('go-title');
    var goScoreEl = document.getElementById('go-score');
    var goBestEl = document.getElementById('go-best');

    SG.analytics.setGame(TD.GAME_ID);
    TD.game.init(canvas);
    TD.input.attach();

    setSoundIcon(btnSoundMenu, SG.audio.isEnabled());
    setSoundIcon(btnSoundPause, SG.audio.isEnabled());
    bestScoreEl.textContent = 'Bester Sieg-Vorsprung: ' + SG.storage.getBest(TD.GAME_ID) + ' HP';

    function show(el) { el.hidden = false; }
    function hide(el) { el.hidden = true; }

    TD.game.onChange(function (payload) {
      hide(screenMenu);
      hide(screenPause);
      hide(screenGameOver);
      hide(btnPause);
      hide(controls);

      switch (payload.state) {
        case TD.game.STATES.MENU:
          show(screenMenu);
          bestScoreEl.textContent = 'Bester Sieg-Vorsprung: ' + payload.best + ' HP';
          break;
        case TD.game.STATES.PLAYING:
          show(btnPause);
          show(controls);
          if (TD.input._refreshCommandButtons) TD.input._refreshCommandButtons();
          break;
        case TD.game.STATES.PAUSED:
          show(btnPause);
          show(screenPause);
          break;
        case TD.game.STATES.GAMEOVER:
          if (payload.result === 'win') {
            goTitleEl.textContent = '🎉 Sieg!';
            goScoreEl.textContent = payload.score + ' HP übrig';
            goBestEl.textContent = payload.newBest ? 'Neuer Rekord!' : ('Rekord: ' + payload.best + ' HP');
          } else {
            goTitleEl.textContent = 'Niederlage';
            goScoreEl.textContent = '';
            goBestEl.textContent = 'Rekord: ' + payload.best + ' HP';
          }
          show(screenGameOver);
          break;
      }
    });

    btnStart.addEventListener('click', function () { TD.game.start(); });
    btnRestart.addEventListener('click', function () { TD.game.restart(); });
    btnRestartPause.addEventListener('click', function () { TD.game.restart(); });
    btnResume.addEventListener('click', function () { TD.game.resume(); });
    btnPause.addEventListener('click', function () { TD.game.togglePause(); });

    [btnSoundMenu, btnSoundPause].forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var on = TD.game.toggleSound();
        setSoundIcon(btnSoundMenu, on);
        setSoundIcon(btnSoundPause, on);
      });
    });

    // Overlay-Buttons dürfen keine Klicks an dahinterliegende Elemente
    // durchreichen.
    [btnStart, btnResume, btnRestartPause, btnRestart, btnPause, btnSoundMenu, btnSoundPause]
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
