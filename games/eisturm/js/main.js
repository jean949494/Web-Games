/**
 * Bootstrap: verdrahtet DOM-Overlays mit game.js, skaliert die Bühne
 * responsiv (feste Referenzauflösung 340x480) und initialisiert das
 * (austauschbare) Poki-SDK-Modul.
 */
(function (global, document) {
  'use strict';

  var ET = global.ET;
  var SG = global.SG;
  var C = ET.constants;

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
    var btnTilt = document.getElementById('btn-tilt');
    var hintControls = document.getElementById('hint-controls');
    var skinPicker = document.getElementById('skin-picker');
    var modeButtons = [document.getElementById('btn-mode-tilt'), document.getElementById('btn-mode-touch')];

    var bestScoreEl = document.getElementById('best-score');
    var goScoreEl = document.getElementById('go-score');
    var goFloorEl = document.getElementById('go-floor');
    var goBestEl = document.getElementById('go-best');

    SG.analytics.setGame(ET.GAME_ID);
    ET.game.init(canvas);
    ET.input.attach(stage);

    setSoundIcon(btnSoundMenu, SG.audio.isEnabled());
    setSoundIcon(btnSoundPause, SG.audio.isEnabled());
    bestScoreEl.textContent = 'Rekord: ' + SG.storage.getBest(ET.GAME_ID);

    // Skin-Auswahl: kleine Vorschau je Figur, Klick übernimmt sie sofort.
    var skins = ET.sprites.CHARACTERS;
    var currentSkin = ET.settings.getSkin(skins);

    function renderSkinPicker() {
      skinPicker.innerHTML = '';
      skins.forEach(function (ch) {
        var btn = document.createElement('button');
        btn.className = 'skin-btn' + (ch.id === currentSkin ? ' active' : '');
        var cv = document.createElement('canvas');
        cv.width = 40;
        cv.height = 46;
        var cx = cv.getContext('2d');
        cx.save();
        cx.translate(cv.width / 2, cv.height - 8);
        cx.scale(1.5, 1.5);
        ET.sprites.drawChar(cx, 0, 0, {
          vx: 0, vy: 0, grounded: true, facing: 1, squash: 0, runPhase: 0, speedFactor: 0,
        }, ch.id);
        cx.restore();
        btn.appendChild(cv);
        var label = document.createElement('span');
        label.textContent = ch.name;
        btn.appendChild(label);
        btn.addEventListener('click', function () {
          currentSkin = ch.id;
          ET.settings.setSkin(ch.id);
          ET.game.setSkin(ch.id);
          renderSkinPicker();
        });
        btn.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
        skinPicker.appendChild(btn);
      });
    }

    ET.game.setSkin(currentSkin);
    renderSkinPicker();

    var CONTROL_HINTS = {};
    CONTROL_HINTS[ET.settings.MODES.TILT] = 'Handy neigen zum Laufen &middot; Antippen zum Springen<br />Länger halten springt höher, Finger liegen lassen springt durchgehend';
    CONTROL_HINTS[ET.settings.MODES.TOUCH] = 'Springt von selbst &middot; linke/rechte Bildschirmhälfte drücken zum Laufen';

    function applyControlMode() {
      var mode = ET.settings.getControlMode();
      hintControls.innerHTML = CONTROL_HINTS[mode];
      modeButtons.forEach(function (btn) {
        btn.classList.toggle('active', btn.dataset.mode === mode);
      });
      ET.game.setAutoJump(mode === ET.settings.MODES.TOUCH);
      ET.game.setDirectSteering(mode === ET.settings.MODES.TOUCH);
    }

    modeButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        ET.settings.setControlMode(btn.dataset.mode);
        applyControlMode();
      });
    });

    applyControlMode();

    // Nur auf Geräten (v.a. iOS 13+) zeigen, die für Neigungssensoren
    // eine explizite Erlaubnis per Nutzer-Tap verlangen. Ohne diesen Tap
    // bleibt die Lenkung stumm – Antippen/Springen geht aber immer,
    // auch ohne diesen Button.
    if (ET.input.needsIosTiltPermission && ET.input.needsIosTiltPermission()) {
      btnTilt.hidden = false;
      btnTilt.addEventListener('click', function (e) {
        e.stopPropagation();
        ET.input.requestTiltPermission().then(function (granted) {
          btnTilt.textContent = granted ? '✅ Neigung aktiv' : '⚠️ Kein Zugriff';
        });
      });
    }

    function show(el) { el.hidden = false; }
    function hide(el) { el.hidden = true; }

    ET.game.onChange(function (payload) {
      hide(screenMenu);
      hide(screenPause);
      hide(screenGameOver);
      hide(btnPause);
      hide(hudScore);

      switch (payload.state) {
        case ET.game.STATES.MENU:
          show(screenMenu);
          bestScoreEl.textContent = 'Rekord: ' + payload.best;
          break;
        case ET.game.STATES.PLAYING:
          show(btnPause);
          show(hudScore);
          break;
        case ET.game.STATES.PAUSED:
          show(btnPause);
          show(hudScore);
          show(screenPause);
          break;
        case ET.game.STATES.GAMEOVER:
          goScoreEl.textContent = payload.score;
          goFloorEl.textContent = 'Etage ' + payload.floor;
          goBestEl.textContent = payload.newBest ? 'Neuer Rekord!' : ('Rekord: ' + payload.best);
          show(screenGameOver);
          break;
      }
    });

    (function updateScoreLoop() {
      if (ET.game.getState() === ET.game.STATES.PLAYING) {
        hudScore.textContent = ET.game.getDebugState().score;
      }
      global.requestAnimationFrame(updateScoreLoop);
    })();

    btnStart.addEventListener('click', function () { ET.game.start(); });
    btnRestart.addEventListener('click', function () {
      SG.poki.commercialBreak(function () { ET.game.restart(); });
    });
    btnRestartPause.addEventListener('click', function () { ET.game.restart(); });
    btnResume.addEventListener('click', function () { ET.game.resume(); });
    btnPause.addEventListener('click', function () { ET.game.togglePause(); });

    [btnSoundMenu, btnSoundPause].forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var on = ET.game.toggleSound();
        setSoundIcon(btnSoundMenu, on);
        setSoundIcon(btnSoundPause, on);
      });
    });

    // Diese Overlay-Buttons dürfen nicht gleichzeitig einen Sprung auslösen.
    [btnStart, btnResume, btnRestart, btnRestartPause, btnPause, btnSoundMenu, btnSoundPause, btnTilt,
      modeButtons[0], modeButtons[1]]
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
