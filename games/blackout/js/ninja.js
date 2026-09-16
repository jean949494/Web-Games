/**
 * Blackout – Spielfigur.
 *
 * EXAKTER PORT der N++-Ninja-Physik (nclone/nsim.py, Klasse Ninja).
 * Die Reihenfolge der Schritte pro Frame ist bewusst identisch zum Original:
 *
 *   integrate()      Dämpfung, Schwerkraft, Positionsupdate
 *   preCollision()   Zähler zurücksetzen, alte Geschwindigkeit merken
 *   collideVsTiles() Sweep gegen Tunneln, dann bis zu 32x entpenetrieren;
 *                    die Geschwindigkeit wird dabei NUR auf die Oberfläche
 *                    projiziert - kein Abprall, kein Tempoverlust. Deshalb
 *                    behält man beim Landen und Streifen sein Momentum.
 *   postCollision()  Wand-/Boden-/Deckenerkennung, Aufpralltod
 *   think()          Eingaben, Reibung, Beschleunigung, Sprünge, Puffer
 *
 * Wer an den Konstanten dreht, verliert das Originalgefühl - sie sind
 * aufeinander abgestimmt (z.B. Schwerkraft beim Halten exakt 1/6 der
 * Fallschwerkraft, Luftbeschleunigung exakt 2/3 der Bodenbeschleunigung).
 */
(function (global) {
  'use strict';

  var BO = global.BO = global.BO || {};
  var C = BO.constants;

  function Ninja(world, x, y, opts) {
    opts = opts || {};
    this.world = world;
    this.xpos = x;
    this.ypos = y;
    this.xposOld = x;
    this.yposOld = y;
    this.xspeed = 0;
    this.yspeed = 0;
    this.xspeedOld = 0;
    this.yspeedOld = 0;
    this.appliedGravity = C.GRAVITY_FALL;
    this.appliedDrag = C.DRAG_REGULAR;
    this.state = C.ST_IMMOBILE;
    this.airborn = false;
    this.airbornOld = false;
    this.walled = false;
    this.wallNormal = 0;
    this.jumpInput = 0;
    this.jumpInputOld = 0;
    this.horInput = 0;
    this.jumpDuration = 0;
    this.jumpBuffer = -1;
    this.floorBuffer = -1;
    this.wallBuffer = -1;
    this.launchPadBuffer = -1;
    this.floorCount = 0;
    this.ceilingCount = 0;
    this.floorNormalX = 0;
    this.floorNormalY = 0;
    this.ceilingNormalX = 0;
    this.ceilingNormalY = 0;
    this.floorNormalizedX = 0;
    this.floorNormalizedY = -1;
    this.ceilingNormalizedX = 0;
    this.ceilingNormalizedY = 1;
    this.facing = 1;
    this.dead = false;
    this.deathReason = null;
    // Einziger bewusster Eingriff gegenüber dem Original: die Aufprallschwelle
    // ist umschaltbar, damit sich "original hart" und "mild" vergleichen lassen.
    this.impactLimit = opts.impactLimit != null ? opts.impactLimit : C.IMPACT_LIMIT_MILD;
  }

  Ninja.prototype.setInput = function (horInput, jumpInput) {
    this.horInput = horInput;
    this.jumpInput = jumpInput ? 1 : 0;
  };

  Ninja.prototype.integrate = function () {
    this.xspeed *= this.appliedDrag;
    this.yspeed *= this.appliedDrag;
    this.yspeed += this.appliedGravity;
    this.xposOld = this.xpos;
    this.yposOld = this.ypos;
    this.xpos += this.xspeed;
    this.ypos += this.yspeed;
  };

  Ninja.prototype.preCollision = function () {
    this.xspeedOld = this.xspeed;
    this.yspeedOld = this.yspeed;
    this.floorCount = 0;
    this.ceilingCount = 0;
    this.floorNormalX = 0;
    this.floorNormalY = 0;
    this.ceilingNormalX = 0;
    this.ceilingNormalY = 0;
  };

  Ninja.prototype.collideVsTiles = function () {
    // Kontinuierliche Kollision: Kreis mit halbem Radius entlang der
    // Frame-Bewegung sweepen, damit man bei hohem Tempo nicht durch Wände fällt.
    var dx = this.xpos - this.xposOld;
    var dy = this.ypos - this.yposOld;
    var time = this.world.sweepCircle(this.xposOld, this.yposOld, dx, dy, C.RADIUS * 0.5);
    this.xpos = this.xposOld + time * dx;
    this.ypos = this.yposOld + time * dy;

    for (var i = 0; i < C.DEPEN_ITERATIONS; i++) {
      var cp = this.world.getSingleClosestPoint(this.xpos, this.ypos, C.RADIUS);
      if (cp.result === 0) break;
      var ddx = this.xpos - cp.a;
      var ddy = this.ypos - cp.b;
      if (Math.abs(ddx) <= 0.0000001) ddx = 0;
      var dist = Math.sqrt(ddx * ddx + ddy * ddy);
      var depenLen = C.RADIUS - dist * cp.result;
      if (dist === 0 || depenLen < 0.0000001) return;
      this.xpos += ddx / dist * depenLen;
      this.ypos += ddy / dist * depenLen;

      // Geschwindigkeit auf die Oberfläche projizieren - nur wenn man sich
      // auf sie zubewegt. Die Tangentialkomponente bleibt VOLLSTÄNDIG
      // erhalten: kein Abprall, keine Landungsstrafe, kein Tempoverlust.
      var dot = this.xspeed * ddx + this.yspeed * ddy;
      if (dot < 0) {
        var distSq = dist * dist;
        var common = (this.xspeed * ddy - this.yspeed * ddx) / distSq;
        this.xspeed = common * ddy;
        this.yspeed = common * -ddx;
      }

      if (ddy >= -0.0001) {
        this.ceilingCount++;
        this.ceilingNormalX += ddx / dist;
        this.ceilingNormalY += ddy / dist;
      } else {
        this.floorCount++;
        this.floorNormalX += ddx / dist;
        this.floorNormalY += ddy / dist;
      }
    }
  };

  Ninja.prototype.postCollision = function () {
    // Wandkontakt: ein fast exakt senkrechtes Segment in Reichweite RADIUS+0.1
    var wallNormal = null;
    var rad = C.RADIUS + 0.1;
    var segments = this.world.gatherSegments(
      this.xpos - rad, this.ypos - rad, this.xpos + rad, this.ypos + rad
    );
    for (var i = 0; i < segments.length; i++) {
      var cp = BO.closestPointOnSegment(segments[i], this.xpos, this.ypos);
      var dx = this.xpos - cp.a;
      var dy = this.ypos - cp.b;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (Math.abs(dy) < 0.00001 && dist > 0 && dist <= rad && wallNormal === null) {
        wallNormal = dx / dist;
      }
    }

    this.airbornOld = this.airborn;
    this.airborn = true;
    this.walled = false;
    if (wallNormal !== null && wallNormal !== 0) {
      this.walled = true;
      this.wallNormal = wallNormal;
    }

    if (this.floorCount > 0) {
      this.airborn = false;
      var floorScalar = Math.sqrt(this.floorNormalX * this.floorNormalX + this.floorNormalY * this.floorNormalY);
      if (floorScalar === 0) {
        this.floorNormalizedX = 0;
        this.floorNormalizedY = -1;
      } else {
        this.floorNormalizedX = this.floorNormalX / floorScalar;
        this.floorNormalizedY = this.floorNormalY / floorScalar;
      }
      if (this.airbornOld) {
        // Aufpralltod: die Schwelle hängt von der Steilheit der Landefläche ab.
        // Auf Schrägen überlebt man härtere Landungen als auf flachem Boden.
        var impactVel = -(this.floorNormalizedX * this.xspeedOld + this.floorNormalizedY * this.yspeedOld);
        if (impactVel > this.impactLimit - 4 / 3 * Math.abs(this.floorNormalizedY)) {
          this.xspeed = this.xspeedOld;
          this.yspeed = this.yspeedOld;
          this.kill('impact');
          return;
        }
      }
    }

    if (this.ceilingCount > 0) {
      var ceilScalar = Math.sqrt(this.ceilingNormalX * this.ceilingNormalX + this.ceilingNormalY * this.ceilingNormalY);
      if (ceilScalar === 0) {
        this.ceilingNormalizedX = 0;
        this.ceilingNormalizedY = 1;
      } else {
        this.ceilingNormalizedX = this.ceilingNormalX / ceilScalar;
        this.ceilingNormalizedY = this.ceilingNormalY / ceilScalar;
      }
      var impactVelC = -(this.ceilingNormalizedX * this.xspeedOld + this.ceilingNormalizedY * this.yspeedOld);
      if (impactVelC > this.impactLimit - 4 / 3 * Math.abs(this.ceilingNormalizedY)) {
        this.xspeed = this.xspeedOld;
        this.yspeed = this.yspeedOld;
        this.kill('impact');
      }
    }
  };

  Ninja.prototype.floorJump = function () {
    this.jumpBuffer = -1;
    this.floorBuffer = -1;
    this.launchPadBuffer = -1;
    this.state = C.ST_JUMPING;
    this.appliedGravity = C.GRAVITY_JUMP;
    var jx, jy;
    if (this.floorNormalizedX === 0) {
      jx = 0;
      jy = -2;
    } else {
      var dx = this.floorNormalizedX;
      var dy = this.floorNormalizedY;
      if (this.xspeed * dx >= 0) { // bergab
        if (this.xspeed * this.horInput >= 0) {
          jx = 2 / 3 * dx;
          jy = 2 * dy;
        } else {
          jx = 0;
          jy = -1.4;
        }
      } else { // bergauf
        if (this.xspeed * this.horInput > 0) {
          jx = 0;
          jy = -1.4;
        } else {
          this.xspeed = 0;
          jx = 2 / 3 * dx;
          jy = 2 * dy;
        }
      }
    }
    if (this.yspeed > 0) this.yspeed = 0;
    this.xspeed += jx;
    this.yspeed += jy;
    this.xpos += jx;
    this.ypos += jy;
    this.jumpDuration = 0;
    if (this.onJump) this.onJump('floor');
  };

  Ninja.prototype.wallJump = function () {
    var jx, jy;
    // Aus dem Rutschen heraus (Richtung in die Wand gedrückt) ist der
    // Absprung schwächer als der normale Wandsprung.
    if (this.horInput * this.wallNormal < 0 && this.state === C.ST_WALL_SLIDING) {
      jx = 2 / 3;
      jy = -1;
    } else {
      jx = 1;
      jy = -1.4;
    }
    this.state = C.ST_JUMPING;
    this.appliedGravity = C.GRAVITY_JUMP;
    if (this.xspeed * this.wallNormal < 0) this.xspeed = 0;
    // Nur Abwärtstempo wird genullt. Aufwärtstempo bleibt und der Impuls
    // addiert sich obendrauf - dadurch schraubt man sich in einem engen
    // Schacht mit jeder Wiederholung schneller nach oben.
    if (this.yspeed > 0) this.yspeed = 0;
    this.xspeed += jx * this.wallNormal;
    this.yspeed += jy;
    this.xpos += jx * this.wallNormal;
    this.ypos += jy;
    this.jumpBuffer = -1;
    this.wallBuffer = -1;
    this.launchPadBuffer = -1;
    this.jumpDuration = 0;
    if (this.onJump) this.onJump('wall');
  };

  Ninja.prototype.think = function () {
    var newJumpCheck = this.jumpInput ? (this.jumpInputOld === 0) : false;
    this.jumpInputOld = this.jumpInput;

    if (this.launchPadBuffer > -1 && this.launchPadBuffer < 3) this.launchPadBuffer++;
    else this.launchPadBuffer = -1;
    if (this.jumpBuffer > -1 && this.jumpBuffer < C.BUF_JUMP) this.jumpBuffer++;
    else this.jumpBuffer = -1;
    var inJumpBuffer = this.jumpBuffer > -1 && this.jumpBuffer < C.BUF_JUMP;
    if (this.wallBuffer > -1 && this.wallBuffer < C.BUF_WALL) this.wallBuffer++;
    else this.wallBuffer = -1;
    var inWallBuffer = this.wallBuffer > -1 && this.wallBuffer < C.BUF_WALL;
    if (this.floorBuffer > -1 && this.floorBuffer < C.BUF_FLOOR) this.floorBuffer++;
    else this.floorBuffer = -1;
    var inFloorBuffer = this.floorBuffer > -1 && this.floorBuffer < C.BUF_FLOOR;

    if (newJumpCheck && this.airborn) this.jumpBuffer = 0;
    if (this.walled) this.wallBuffer = 0;
    if (!this.airborn) this.floorBuffer = 0;

    if (this.state === C.ST_DEAD) return;

    if (this.horInput !== 0) this.facing = this.horInput > 0 ? 1 : -1;

    if (!this.airborn) {
      // ---- am Boden ----
      var xspeedNew = this.xspeed + C.GROUND_ACCEL * this.horInput;
      if (Math.abs(xspeedNew) < C.MAX_HOR_SPEED) this.xspeed = xspeedNew;
      if (this.state > C.ST_GROUND_SLIDING) {
        if (this.xspeed * this.horInput <= 0) {
          if (this.state === C.ST_JUMPING) this.appliedGravity = C.GRAVITY_FALL;
          this.state = C.ST_GROUND_SLIDING;
        } else {
          if (this.state === C.ST_JUMPING) this.appliedGravity = C.GRAVITY_FALL;
          this.state = C.ST_RUNNING;
        }
      }
      if (!inJumpBuffer && !newJumpCheck) {
        var projection;
        if (this.state === C.ST_GROUND_SLIDING) {
          projection = Math.abs(this.yspeed * this.floorNormalizedX - this.xspeed * this.floorNormalizedY);
          if (this.horInput * projection * this.xspeed > 0) {
            this.state = C.ST_RUNNING;
            return;
          }
          if (projection < 0.1 && this.floorNormalizedX === 0) {
            this.state = C.ST_IMMOBILE;
            return;
          }
          if (this.yspeed < 0 && this.floorNormalizedX !== 0) {
            // Bergauf-Reibung (im Original wörtlich "very dumb but that's how it is")
            var speedScalar = Math.sqrt(this.xspeed * this.xspeed + this.yspeed * this.yspeed);
            var fricForce = Math.abs(this.xspeed * (1 - C.FRICTION_GROUND) * this.floorNormalizedY);
            var fricForce2 = speedScalar - fricForce * this.floorNormalizedY * this.floorNormalizedY;
            this.xspeed = this.xspeed / speedScalar * fricForce2;
            this.yspeed = this.yspeed / speedScalar * fricForce2;
            return;
          }
          this.xspeed *= C.FRICTION_GROUND;
          return;
        }
        if (this.state === C.ST_RUNNING) {
          projection = Math.abs(this.yspeed * this.floorNormalizedX - this.xspeed * this.floorNormalizedY);
          if (this.horInput * projection * this.xspeed > 0) {
            if (this.horInput * this.floorNormalizedX >= 0) return;
            if (Math.abs(xspeedNew) < C.MAX_HOR_SPEED) {
              // Bergauf-Schub: hält das Tempo an Steigungen
              var boost = C.GROUND_ACCEL / 2 * this.horInput;
              this.xspeed += boost * this.floorNormalizedY * this.floorNormalizedY;
              this.yspeed += boost * this.floorNormalizedY * -this.floorNormalizedX;
            }
            return;
          }
          this.state = C.ST_GROUND_SLIDING;
          return;
        }
        // Zustand 0: Stillstand
        if (this.horInput) {
          this.state = C.ST_RUNNING;
          return;
        }
        projection = Math.abs(this.yspeed * this.floorNormalizedX - this.xspeed * this.floorNormalizedY);
        if (projection < 0.1) {
          this.xspeed *= C.FRICTION_GROUND_SLOW;
          return;
        }
        this.state = C.ST_GROUND_SLIDING;
        return;
      }
      this.floorJump();
      return;
    }

    // ---- in der Luft ----
    var xspeedNewAir = this.xspeed + C.AIR_ACCEL * this.horInput;
    if (Math.abs(xspeedNewAir) < C.MAX_HOR_SPEED) this.xspeed = xspeedNewAir;
    if (this.state < C.ST_JUMPING) {
      this.state = C.ST_FALLING;
      return;
    }
    if (this.state === C.ST_JUMPING) {
      this.jumpDuration++;
      // Solange die Taste gehalten wird (max. 45 Frames), wirkt nur ein
      // Sechstel der Schwerkraft - das ist die variable Sprunghöhe.
      if (!this.jumpInput || this.jumpDuration > C.MAX_JUMP_DURATION) {
        this.appliedGravity = C.GRAVITY_FALL;
        this.state = C.ST_FALLING;
        return;
      }
    }
    if (inJumpBuffer || newJumpCheck) {
      // Feste Rangfolge: Wandsprung schlägt Bodensprung.
      if (this.walled || inWallBuffer) {
        this.wallJump();
        return;
      }
      if (inFloorBuffer) {
        this.floorJump();
        return;
      }
    }
    if (!this.walled) {
      if (this.state === C.ST_WALL_SLIDING) this.state = C.ST_FALLING;
    } else if (this.state === C.ST_WALL_SLIDING) {
      // Rutschen hält nur an, solange man nicht aktiv wegdrückt.
      if (this.horInput * this.wallNormal <= 0) this.yspeed *= C.FRICTION_WALL;
      else this.state = C.ST_FALLING;
    } else if (this.yspeed > 0 && this.horInput * this.wallNormal < 0) {
      // In die Wand drücken, während man fällt -> greifen und rutschen.
      if (this.state === C.ST_JUMPING) this.appliedGravity = C.GRAVITY_FALL;
      this.state = C.ST_WALL_SLIDING;
    }
  };

  Ninja.prototype.kill = function (reason) {
    if (this.state === C.ST_DEAD) return;
    this.state = C.ST_DEAD;
    this.dead = true;
    this.deathReason = reason;
    if (this.onDeath) this.onDeath(reason);
  };

  /** Ein kompletter Simulationsschritt in Originalreihenfolge. */
  Ninja.prototype.tick = function () {
    if (this.state === C.ST_DEAD) return;
    this.integrate();
    this.preCollision();
    for (var pass = 0; pass < C.COLLISION_PASSES; pass++) {
      this.collideVsTiles();
    }
    this.postCollision();
    if (this.state === C.ST_DEAD) return;
    this.think();
  };

  BO.Ninja = Ninja;
})(typeof window !== 'undefined' ? window : globalThis);
