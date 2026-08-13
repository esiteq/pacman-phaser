import Phaser from 'phaser';
import CharacterUtil from '../utils/CharacterUtil.js';
import Timer from '../utils/Timer.js';
import SoundManager from '../utils/SoundManager.js';
import Pacman from '../entities/Pacman.js';
import Ghost from '../entities/Ghost.js';
import Pickup from '../entities/Pickup.js';
import {
  buildMazeArray, BASE_TILE, DISPLAY_SCALE, TOP_UI_ROWS, FRUIT_POINTS,
} from '../utils/mazeData.js';

const GHOST_NAMES = ['blinky', 'pinky', 'inky', 'clyde'];
const DIRECTIONS = ['up', 'down', 'left', 'right'];
const POINT_TEXT_KEYS = ['100', '200', '300', '400', '500', '700', '800', '1000', '1600', '2000', '3000', '5000'];

// Port of app/scripts/core/gameCoordinator.js + gameEngine.js from
// bward2/pacman-js, adapted to run as a single Phaser 3 Scene instead of
// driving raw DOM elements. Game rules, timings, and event flow are kept
// as close to the original as possible.
export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  preload() {
    const g = 'assets/graphics/';

    // Pacman
    this.load.spritesheet('pacman_up', `${g}characters/pacman/pacman_up.png`, { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('pacman_down', `${g}characters/pacman/pacman_down.png`, { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('pacman_left', `${g}characters/pacman/pacman_left.png`, { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('pacman_right', `${g}characters/pacman/pacman_right.png`, { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('pacman_death', `${g}characters/pacman/pacman_death.png`, { frameWidth: 16, frameHeight: 16 });
    DIRECTIONS.forEach((dir) => {
      this.load.image(`arrow_${dir}`, `${g}characters/pacman/arrow_${dir}.png`);
    });

    // Ghosts
    GHOST_NAMES.forEach((name) => {
      DIRECTIONS.forEach((dir) => {
        this.load.spritesheet(`${name}_${dir}`, `${g}characters/ghosts/${name}/${name}_${dir}.png`, { frameWidth: 16, frameHeight: 16 });
        if (name === 'blinky') {
          this.load.spritesheet(`${name}_${dir}_angry`, `${g}characters/ghosts/${name}/${name}_${dir}_angry.png`, { frameWidth: 16, frameHeight: 16 });
          this.load.spritesheet(`${name}_${dir}_annoyed`, `${g}characters/ghosts/${name}/${name}_${dir}_annoyed.png`, { frameWidth: 16, frameHeight: 16 });
        }
      });
    });
    DIRECTIONS.forEach((dir) => {
      this.load.spritesheet(`eyes_${dir}`, `${g}characters/ghosts/eyes_${dir}.png`, { frameWidth: 16, frameHeight: 16 });
    });
    this.load.spritesheet('scared_blue', `${g}characters/ghosts/scared_blue.png`, { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('scared_white', `${g}characters/ghosts/scared_white.png`, { frameWidth: 16, frameHeight: 16 });

    // Pickups
    this.load.image('pacdot', `${g}pickups/pacdot.png`);
    this.load.image('powerPellet', `${g}pickups/powerPellet.png`);
    ['cherry', 'strawberry', 'orange', 'apple', 'melon', 'galaxian', 'bell', 'key'].forEach((fruit) => {
      this.load.image(fruit, `${g}pickups/${fruit}.png`);
    });

    // Maze + misc
    this.load.image('maze_blue', `${g}maze/maze_blue.png`);
    this.load.image('maze_white', `${g}maze/maze_white.png`);
    this.load.image('extra_life', `${g}extra_life.png`);

    // Score / text popups
    this.load.image('ready', `${g}text/ready.png`);
    this.load.image('game_over', `${g}text/game_over.png`);
    POINT_TEXT_KEYS.forEach((key) => this.load.image(key, `${g}text/${key}.png`));
  }

  create() {
    this.mazeArray = buildMazeArray();
    this.tileSize = BASE_TILE;
    this.scaledTileSize = BASE_TILE * DISPLAY_SCALE;
    this.mazeOriginX = 0;
    this.mazeOriginY = TOP_UI_ROWS * this.scaledTileSize;

    this.maxFps = 120;
    this.timestep = 1000 / this.maxFps;
    this.elapsedMs = 0;
    this.engineRunning = false;

    window.__scene = this; // debug hook, harmless in production

    this.fruitPoints = FRUIT_POINTS;

    this.movementKeys = {
      w: 'up', s: 'down', a: 'left', d: 'right',
      arrowup: 'up', arrowdown: 'down', arrowleft: 'left', arrowright: 'right',
    };

    this.touchStartX = 0;
    this.touchStartY = 0;

    this.buildMazeVisual();
    this.buildHud();

    this.soundManager = new SoundManager();
    this.setSoundButtonIcon(1);

    this.firstGame = true;
    this.waitingForRestart = false;

    this.registerEventListeners();
    this.registerTouchListeners();

    this.time.addEvent({
      delay: 500,
      loop: true,
      callback: () => this.collisionDetectionLoop(),
    });

    this.newGame();
  }

  // ---------------------------------------------------------------------
  // Scene / visual scaffolding
  // ---------------------------------------------------------------------

  buildMazeVisual() {
    this.mazeImage = this.add.image(this.mazeOriginX, this.mazeOriginY, 'maze_blue');
    this.mazeImage.setOrigin(0, 0);
    this.mazeImage.setScale(DISPLAY_SCALE);
    this.mazeImage.setDepth(0);

    this.mazeCover = this.add.rectangle(
      this.mazeOriginX,
      this.mazeOriginY,
      this.scaledTileSize * 28,
      this.scaledTileSize * 31,
      0x000000,
    );
    this.mazeCover.setOrigin(0, 0);
    this.mazeCover.setDepth(5);
    this.mazeCover.setVisible(false);
  }

  textStyle(size, color = '#ffffff') {
    return {
      fontFamily: "'Press Start 2P', monospace",
      fontSize: `${size}px`,
      color,
    };
  }

  // The game config sets pixelArt:true (nearest-neighbor filtering) so the
  // sprite art stays crisp at any zoom. Phaser Text objects are rendered to
  // their own dynamic texture though, and nearest-neighbor filtering turns
  // small text into mangled blocks -- so every text texture gets switched
  // back to linear filtering (plus 2x resolution for sharpness) here.
  makeText(x, y, text, style) {
    const t = this.add.text(x, y, text, style);
    t.setResolution(2);
    if (t.texture && t.texture.setFilter) {
      t.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
    return t;
  }

  buildHud() {
    const s = this.scaledTileSize;

    this.oneUpText = this.makeText(s * 2, s * 0.5, '1UP', this.textStyle(s * 0.45, '#ffffff')).setDepth(6);
    this.pointsText = this.makeText(s * 2, s * 1.3, '00', this.textStyle(s * 0.45, '#ffffff')).setDepth(6);
    this.highScoreLabel = this.makeText(s * 12, s * 0.5, 'HIGH SCORE', this.textStyle(s * 0.45, '#ffffff')).setDepth(6);
    this.highScoreText = this.makeText(s * 15.5, s * 1.3, '00', this.textStyle(s * 0.45, '#ffffff')).setDepth(6);

    this.tweens.add({
      targets: this.oneUpText,
      alpha: { from: 1, to: 0 },
      duration: 300,
      yoyo: true,
      repeat: -1,
      ease: 'Step',
    });

    this.pausedText = this.makeText(
      this.scaledTileSize * 14,
      this.mazeOriginY + this.scaledTileSize * 15.5,
      'PAUSED',
      this.textStyle(s * 0.9, '#ffdf00'),
    ).setOrigin(0.5, 0.5).setDepth(7);
    this.pausedText.setVisible(false);

    // Covers the whole canvas (score/lives rows included) while paused --
    // stands in for the original's `filter: blur(5px)` on the whole UI.
    this.pauseOverlay = this.add.rectangle(
      0,
      0,
      this.scale.width,
      this.scale.height,
      0x000000,
      0.55,
    ).setOrigin(0, 0).setDepth(6.5);
    this.pauseOverlay.setVisible(false);

    this.restartText = this.makeText(
      this.scaledTileSize * 14,
      this.mazeOriginY + this.scaledTileSize * 20,
      'НАТИСНИ БУДЬ-ЯКУ КЛАВІШУ',
      this.textStyle(s * 0.28, '#ffdf00'),
    ).setOrigin(0.5, 0.5).setDepth(7);
    this.restartText.setVisible(false);

    const bottomY = this.mazeOriginY + this.scaledTileSize * 31;
    this.livesIcons = [];
    this.livesY = bottomY + this.scaledTileSize * 0.5;
    this.fruitIcons = [];
    this.fruitY = bottomY + this.scaledTileSize * 0.5;
  }

  setSoundButtonIcon(volume) {
    const icon = document.querySelector('#sound-button .material-icons');
    if (icon) icon.textContent = volume === 0 ? 'volume_off' : 'volume_up';
  }

  // ---------------------------------------------------------------------
  // Game (re)start
  // ---------------------------------------------------------------------

  newGame() {
    this.waitingForRestart = false;
    this.restartText.setVisible(false);
    this.reset();

    if (this.firstGame) {
      this.firstGame = false;
      this.init();
    }

    this.startGameplay(true);
  }

  reset() {
    this.activeTimers = [];
    this.points = 0;
    this.level = 1;
    this.lives = 2;
    this.extraLifeGiven = false;
    this.remainingDots = 0;
    this.allowKeyPresses = true;
    this.allowPacmanMovement = false;
    this.allowPause = false;
    this.cutscene = true;
    this.highScore = parseInt(localStorage.getItem('pacmanPhaserHighScore') || '0', 10);

    if (this.firstGame) {
      this.characterUtil = new CharacterUtil(this.scaledTileSize);
      this.pacman = new Pacman(this, this.scaledTileSize, this.mazeArray, this.characterUtil);
      this.blinky = new Ghost(this, this.scaledTileSize, this.mazeArray, this.pacman, 'blinky', this.level, new CharacterUtil(this.scaledTileSize));
      this.pinky = new Ghost(this, this.scaledTileSize, this.mazeArray, this.pacman, 'pinky', this.level, new CharacterUtil(this.scaledTileSize));
      this.inky = new Ghost(this, this.scaledTileSize, this.mazeArray, this.pacman, 'inky', this.level, new CharacterUtil(this.scaledTileSize), this.blinky);
      this.clyde = new Ghost(this, this.scaledTileSize, this.mazeArray, this.pacman, 'clyde', this.level, new CharacterUtil(this.scaledTileSize));
      this.fruit = new Pickup(this, 'fruit', this.scaledTileSize, 13.5, 17, this.pacman, 100);
    }

    this.entityList = [
      this.pacman, this.blinky, this.pinky, this.inky, this.clyde, this.fruit,
    ];
    this.ghosts = [this.blinky, this.pinky, this.inky, this.clyde];

    this.scaredGhosts = [];
    this.eyeGhosts = 0;

    if (this.firstGame) {
      this.drawMaze(this.mazeArray, this.entityList);
    } else {
      this.pacman.reset();
      this.ghosts.forEach((ghost) => ghost.reset(true));
      this.pickups.forEach((pickup) => {
        if (pickup.type !== 'fruit') {
          this.remainingDots += 1;
          pickup.reset();
          this.entityList.push(pickup);
        }
      });
    }

    this.pointsText.setText('00');
    this.highScoreText.setText(String(this.highScore || '00'));
    this.clearFruitDisplay();

    const volumePreference = parseInt(localStorage.getItem('pacmanPhaserVolume') || '1', 10);
    this.setSoundButtonIcon(volumePreference);
    this.soundManager.setMasterVolume(volumePreference);
  }

  init() {
    this.engineRunning = true;
  }

  drawMaze(mazeArray, entityList) {
    this.pickups = [this.fruit];

    mazeArray.forEach((row, rowIndex) => {
      row.forEach((block, columnIndex) => {
        if (block === 'o' || block === 'O') {
          const type = block === 'o' ? 'pacdot' : 'powerPellet';
          const points = block === 'o' ? 10 : 50;
          const dot = new Pickup(this, type, this.scaledTileSize, columnIndex, rowIndex, this.pacman, points);

          entityList.push(dot);
          this.pickups.push(dot);
          this.remainingDots += 1;
        }
      });
    });
  }

  // ---------------------------------------------------------------------
  // Fixed-timestep engine (port of gameEngine.js), driven by Phaser's
  // own update() ticker instead of a private requestAnimationFrame loop.
  // ---------------------------------------------------------------------

  update(time, delta) {
    if (!this.engineRunning) return;

    this.elapsedMs += delta;
    this.processFrames();
    this.draw(this.elapsedMs / this.timestep);
  }

  processFrames() {
    let steps = 0;
    while (this.elapsedMs >= this.timestep) {
      this.entityList.forEach((entity) => {
        if (typeof entity.update === 'function') entity.update(this.timestep);
      });
      this.elapsedMs -= this.timestep;
      steps += 1;
      if (steps >= this.maxFps) {
        this.elapsedMs = 0;
        break;
      }
    }
  }

  draw(interp) {
    this.entityList.forEach((entity) => {
      if (typeof entity.draw === 'function') entity.draw(interp);
    });
  }

  // ---------------------------------------------------------------------
  // Collision detection (dots/pellets/fruit proximity check)
  // ---------------------------------------------------------------------

  collisionDetectionLoop() {
    if (this.pacman.position) {
      const maxDistance = this.pacman.velocityPerMs * 750;
      const pacmanCenter = {
        x: this.pacman.position.left + this.scaledTileSize,
        y: this.pacman.position.top + this.scaledTileSize,
      };

      this.pickups.forEach((pickup) => {
        pickup.checkPacmanProximity(maxDistance, pacmanCenter);
      });
    }
  }

  // ---------------------------------------------------------------------
  // Round start / "READY!" sequence
  // ---------------------------------------------------------------------

  startGameplay(initialStart, playMelody = initialStart) {
    if (playMelody) {
      this.soundManager.play('game_start');
    }

    this.scaredGhosts = [];
    this.eyeGhosts = 0;
    this.allowPacmanMovement = false;

    const left = this.scaledTileSize * 11;
    const top = this.scaledTileSize * 16.5;
    const duration = initialStart ? 4500 : 2000;
    const width = this.scaledTileSize * 6;
    const height = this.scaledTileSize * 2;

    this.displayText({ left, top }, 'ready', duration, width, height);
    this.updateExtraLivesDisplay();

    new Timer(() => {
      this.allowPause = true;
      this.cutscene = false;
      this.soundManager.setCutscene(this.cutscene);
      this.soundManager.setAmbience(this.determineSiren(this.remainingDots));

      this.allowPacmanMovement = true;
      this.pacman.moving = true;

      this.ghosts.forEach((ghost) => {
        ghost.moving = true;
      });

      this.ghostCycle('scatter');

      this.idleGhosts = [this.pinky, this.inky, this.clyde];
      this.releaseGhost();
    }, duration);
  }

  updateExtraLivesDisplay() {
    this.livesIcons.forEach((icon) => icon.destroy());
    this.livesIcons = [];

    for (let i = 0; i < this.lives; i += 1) {
      const icon = this.add.image(
        this.scaledTileSize * (2 + i * 2.2),
        this.livesY,
        'extra_life',
      );
      icon.setOrigin(0, 0);
      icon.setDisplaySize(this.scaledTileSize * 2, this.scaledTileSize * 2);
      icon.setDepth(6);
      this.livesIcons.push(icon);
    }
  }

  clearFruitDisplay() {
    this.fruitIcons.forEach((icon) => icon.destroy());
    this.fruitIcons = [];
  }

  updateFruitDisplay(textureKey) {
    if (this.fruitIcons.length === 7) {
      const oldest = this.fruitIcons.shift();
      oldest.destroy();
    }

    const s = this.scaledTileSize;
    const index = this.fruitIcons.length;
    const icon = this.add.image(
      s * (26 - index * 2.2),
      this.fruitY,
      textureKey,
    );
    icon.setOrigin(0, 0);
    icon.setDisplaySize(s * 2, s * 2);
    icon.setDepth(6);
    this.fruitIcons.push(icon);
  }

  ghostCycle(mode) {
    const delay = mode === 'scatter' ? 7000 : 20000;
    const nextMode = mode === 'scatter' ? 'chase' : 'scatter';

    this.ghostCycleTimer = new Timer(() => {
      this.ghosts.forEach((ghost) => ghost.changeMode(nextMode));
      this.ghostCycle(nextMode);
    }, delay);
  }

  releaseGhost() {
    if (this.idleGhosts.length > 0) {
      const delay = Math.max((8 - (this.level - 1) * 4) * 1000, 0);

      this.endIdleTimer = new Timer(() => {
        this.idleGhosts[0].endIdleMode();
        this.idleGhosts.shift();
      }, delay);
    }
  }

  // ---------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------

  registerEventListeners() {
    this._onKeyDown = this.handleKeyDown.bind(this);
    this._onSwipe = this.handleSwipe.bind(this);
    this._onAwardPoints = this.awardPoints.bind(this);
    this._onDeathSequence = this.deathSequence.bind(this);
    this._onDotEaten = this.dotEaten.bind(this);
    this._onPowerUp = this.powerUp.bind(this);
    this._onEatGhost = this.eatGhost.bind(this);
    this._onRestoreGhost = this.restoreGhost.bind(this);
    this._onAddTimer = this.addTimer.bind(this);
    this._onRemoveTimer = this.removeTimer.bind(this);
    this._onReleaseGhost = this.releaseGhost.bind(this);
    this._onRequestPause = this.handlePauseKey.bind(this);
    this._onRequestSound = this.soundButtonClick.bind(this);
    this._onFirstInput = () => { this.soundManager.unlock(); };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('swipe', this._onSwipe);
    window.addEventListener('awardPoints', this._onAwardPoints);
    window.addEventListener('deathSequence', this._onDeathSequence);
    window.addEventListener('dotEaten', this._onDotEaten);
    window.addEventListener('powerUp', this._onPowerUp);
    window.addEventListener('eatGhost', this._onEatGhost);
    window.addEventListener('restoreGhost', this._onRestoreGhost);
    window.addEventListener('addTimer', this._onAddTimer);
    window.addEventListener('removeTimer', this._onRemoveTimer);
    window.addEventListener('releaseGhost', this._onReleaseGhost);
    window.addEventListener('requestPause', this._onRequestPause);
    window.addEventListener('requestSoundToggle', this._onRequestSound);
    window.addEventListener('keydown', this._onFirstInput, { once: true });
    window.addEventListener('pointerdown', this._onFirstInput, { once: true });
  }

  registerTouchListeners() {
    document.addEventListener('touchstart', this.handleTouchStart.bind(this));
    document.addEventListener('touchend', this.handleTouchEnd.bind(this));
  }

  handleTouchStart(event) {
    this.touchStartX = event.touches[0].clientX;
    this.touchStartY = event.touches[0].clientY;
  }

  handleTouchEnd(event) {
    const touchEndX = event.changedTouches[0].clientX;
    const touchEndY = event.changedTouches[0].clientY;
    const diffX = touchEndX - this.touchStartX;
    const diffY = touchEndY - this.touchStartY;
    let direction;

    if (Math.abs(diffX) < 10 && Math.abs(diffY) < 10) {
      this.handleRestartInput();
      return;
    }

    if (Math.abs(diffX) > Math.abs(diffY)) {
      direction = diffX > 0 ? 'right' : 'left';
    } else {
      direction = diffY > 0 ? 'down' : 'up';
    }

    window.dispatchEvent(new CustomEvent('swipe', { detail: { direction } }));
  }

  changeDirection(direction) {
    if (this.allowKeyPresses && this.engineRunning) {
      this.pacman.changeDirection(direction, this.allowPacmanMovement);
    }
  }

  handleKeyDown(e) {
    if (this.waitingForRestart) {
      this.handleRestartInput();
      return;
    }

    if (e.key === 'Escape') {
      this.handlePauseKey();
    } else if (e.key && e.key.toLowerCase() === 'q') {
      this.soundButtonClick();
    } else if (this.movementKeys[e.key ? e.key.toLowerCase() : '']) {
      this.changeDirection(this.movementKeys[e.key.toLowerCase()]);
    }
  }

  handleRestartInput() {
    if (this.waitingForRestart) {
      this.newGame();
    }
  }

  handleSwipe(e) {
    if (this.waitingForRestart) {
      this.handleRestartInput();
      return;
    }
    const { direction } = e.detail;
    this.changeDirection(direction);
  }

  handlePauseKey() {
    if (!this.allowPause) return;

    this.allowPause = false;
    setTimeout(() => {
      if (!this.cutscene) this.allowPause = true;
    }, 500);

    this.soundManager.play('pause');
    this.engineRunning = !this.engineRunning;

    const pauseIcon = document.querySelector('#pause-button .material-icons');

    if (this.engineRunning) {
      this.soundManager.resumeAmbience();
      this.pauseOverlay.setVisible(false);
      this.pausedText.setVisible(false);
      if (pauseIcon) pauseIcon.textContent = 'pause';
      this.activeTimers.forEach((timer) => timer.resume());
    } else {
      this.soundManager.stopAmbience();
      this.soundManager.setAmbience('pause_beat', true);
      this.pauseOverlay.setVisible(true);
      this.pausedText.setVisible(true);
      if (pauseIcon) pauseIcon.textContent = 'play_arrow';
      this.activeTimers.forEach((timer) => timer.pause());
    }
  }

  soundButtonClick() {
    const newVolume = this.soundManager.masterVolume === 1 ? 0 : 1;
    this.soundManager.setMasterVolume(newVolume);
    localStorage.setItem('pacmanPhaserVolume', String(newVolume));
    this.setSoundButtonIcon(newVolume);
  }

  // ---------------------------------------------------------------------
  // Scoring / life / round-flow events
  // ---------------------------------------------------------------------

  awardPoints(e) {
    this.points += e.detail.points;
    this.pointsText.setText(String(this.points));
    if (this.points > (this.highScore || 0)) {
      this.highScore = this.points;
      this.highScoreText.setText(String(this.points));
      localStorage.setItem('pacmanPhaserHighScore', String(this.highScore));
    }

    if (this.points >= 10000 && !this.extraLifeGiven) {
      this.extraLifeGiven = true;
      this.soundManager.play('extra_life');
      this.lives += 1;
      this.updateExtraLivesDisplay();
    }

    if (e.detail.type === 'fruit') {
      const left = e.detail.points >= 1000
        ? this.scaledTileSize * 12.5
        : this.scaledTileSize * 13;
      const top = this.scaledTileSize * 16.5;
      const width = e.detail.points >= 1000
        ? this.scaledTileSize * 3
        : this.scaledTileSize * 2;
      const height = this.scaledTileSize * 2;

      this.displayText({ left, top }, e.detail.points, 2000, width, height);
      this.soundManager.play('fruit');
      this.updateFruitDisplay(this.fruit.determineImage('fruit', e.detail.points));
    }
  }

  deathSequence() {
    this.allowPause = false;
    this.cutscene = true;
    this.soundManager.setCutscene(this.cutscene);
    this.soundManager.stopAmbience();
    this.removeTimer({ detail: { timer: this.fruitTimer } });
    this.removeTimer({ detail: { timer: this.ghostCycleTimer } });
    this.removeTimer({ detail: { timer: this.endIdleTimer } });
    this.removeTimer({ detail: { timer: this.ghostFlashTimer } });

    this.allowKeyPresses = false;
    this.pacman.moving = false;
    this.ghosts.forEach((ghost) => { ghost.moving = false; });

    new Timer(() => {
      this.ghosts.forEach((ghost) => { ghost.display = false; });
      this.pacman.prepDeathAnimation();
      this.soundManager.play('death');

      if (this.lives > 0) {
        this.lives -= 1;

        new Timer(() => {
          this.mazeCover.setVisible(true);
          new Timer(() => {
            this.allowKeyPresses = true;
            this.mazeCover.setVisible(false);
            this.pacman.reset();
            this.ghosts.forEach((ghost) => ghost.reset());
            this.fruit.hideFruit();

            this.startGameplay();
          }, 500);
        }, 2250);
      } else {
        this.gameOver();
      }
    }, 750);
  }

  gameOver() {
    localStorage.setItem('pacmanPhaserHighScore', String(this.highScore || 0));

    new Timer(() => {
      this.displayText(
        { left: this.scaledTileSize * 9, top: this.scaledTileSize * 16.5 },
        'game_over',
        4000,
        this.scaledTileSize * 10,
        this.scaledTileSize * 2,
      );
      this.fruit.hideFruit();

      new Timer(() => {
        this.waitingForRestart = true;
        this.restartText.setVisible(true);
        this.tweens.add({
          targets: this.restartText,
          alpha: { from: 1, to: 0.2 },
          duration: 500,
          yoyo: true,
          repeat: -1,
        });
      }, 2500);
    }, 2250);
  }

  dotEaten() {
    this.remainingDots -= 1;

    this.soundManager.playDotSound();

    if (this.remainingDots === 174 || this.remainingDots === 74) {
      this.createFruit();
    }

    if (this.remainingDots === 40 || this.remainingDots === 20) {
      this.speedUpBlinky();
    }

    if (this.remainingDots === 0) {
      this.advanceLevel();
    }
  }

  createFruit() {
    this.removeTimer({ detail: { timer: this.fruitTimer } });
    this.fruit.showFruit(this.fruitPoints[this.level] || 5000);
    this.fruitTimer = new Timer(() => {
      this.fruit.hideFruit();
    }, 10000);
  }

  speedUpBlinky() {
    this.blinky.speedUp();

    if (this.scaredGhosts.length === 0 && this.eyeGhosts === 0) {
      this.soundManager.setAmbience(this.determineSiren(this.remainingDots));
    }
  }

  determineSiren(remainingDots) {
    let sirenNum;
    if (remainingDots > 40) {
      sirenNum = 1;
    } else if (remainingDots > 20) {
      sirenNum = 2;
    } else {
      sirenNum = 3;
    }
    return `siren_${sirenNum}`;
  }

  advanceLevel() {
    this.allowPause = false;
    this.cutscene = true;
    this.soundManager.setCutscene(this.cutscene);
    this.allowKeyPresses = false;
    this.soundManager.stopAmbience();

    this.entityList.forEach((entity) => { entity.moving = false; });

    this.removeTimer({ detail: { timer: this.fruitTimer } });
    this.removeTimer({ detail: { timer: this.ghostCycleTimer } });
    this.removeTimer({ detail: { timer: this.endIdleTimer } });
    this.removeTimer({ detail: { timer: this.ghostFlashTimer } });

    new Timer(() => {
      this.ghosts.forEach((ghost) => { ghost.display = false; });

      this.mazeImage.setTexture('maze_white');
      new Timer(() => {
        this.mazeImage.setTexture('maze_blue');
        new Timer(() => {
          this.mazeImage.setTexture('maze_white');
          new Timer(() => {
            this.mazeImage.setTexture('maze_blue');
            new Timer(() => {
              this.mazeImage.setTexture('maze_white');
              new Timer(() => {
                this.mazeImage.setTexture('maze_blue');
                new Timer(() => {
                  this.mazeCover.setVisible(true);
                  new Timer(() => {
                    this.mazeCover.setVisible(false);
                    this.level += 1;
                    this.allowKeyPresses = true;
                    this.entityList.forEach((entity) => {
                      if (entity.level) entity.level = this.level;
                      entity.reset();
                      if (entity instanceof Ghost) entity.resetDefaultSpeed();
                      if (entity instanceof Pickup && entity.type !== 'fruit') {
                        this.remainingDots += 1;
                      }
                    });
                    // New level: replay the start jingle, but keep the
                    // shorter (non-initial) "READY!" display duration --
                    // only the very first level should linger on it.
                    this.startGameplay(false, true);
                  }, 500);
                }, 250);
              }, 250);
            }, 250);
          }, 250);
        }, 250);
      }, 250);
    }, 2000);
  }

  flashGhosts(flashes, maxFlashes) {
    if (flashes === maxFlashes) {
      this.scaredGhosts.forEach((ghost) => ghost.endScared());
      this.scaredGhosts = [];
      if (this.eyeGhosts === 0) {
        this.soundManager.setAmbience(this.determineSiren(this.remainingDots));
      }
    } else if (this.scaredGhosts.length > 0) {
      this.scaredGhosts.forEach((ghost) => ghost.toggleScaredColor());

      this.ghostFlashTimer = new Timer(() => {
        this.flashGhosts(flashes + 1, maxFlashes);
      }, 250);
    }
  }

  powerUp() {
    if (this.remainingDots !== 0) {
      this.soundManager.setAmbience('power_up');
    }

    this.removeTimer({ detail: { timer: this.ghostFlashTimer } });

    this.ghostCombo = 0;
    this.scaredGhosts = [];

    this.ghosts.forEach((ghost) => {
      if (ghost.mode !== 'eyes') this.scaredGhosts.push(ghost);
    });

    this.scaredGhosts.forEach((ghost) => ghost.becomeScared());

    const powerDuration = Math.max((7 - this.level) * 1000, 0);
    this.ghostFlashTimer = new Timer(() => {
      this.flashGhosts(0, 9);
    }, powerDuration);
  }

  determineComboPoints() {
    return 100 * (2 ** this.ghostCombo);
  }

  eatGhost(e) {
    const pauseDuration = 1000;
    const { position, measurement } = e.detail.ghost;

    this.pauseTimer({ detail: { timer: this.ghostFlashTimer } });
    this.pauseTimer({ detail: { timer: this.ghostCycleTimer } });
    this.pauseTimer({ detail: { timer: this.fruitTimer } });
    this.soundManager.play('eat_ghost');

    this.scaredGhosts = this.scaredGhosts.filter((ghost) => ghost.name !== e.detail.ghost.name);
    this.eyeGhosts += 1;

    this.ghostCombo += 1;
    const comboPoints = this.determineComboPoints();
    window.dispatchEvent(new CustomEvent('awardPoints', { detail: { points: comboPoints } }));
    this.displayText(position, comboPoints, pauseDuration, measurement);

    this.allowPacmanMovement = false;
    this.pacman.display = false;
    this.pacman.moving = false;
    e.detail.ghost.display = false;
    e.detail.ghost.moving = false;

    this.ghosts.forEach((ghost) => {
      ghost.animate = false;
      ghost.pause(true);
      ghost.allowCollision = false;
    });

    new Timer(() => {
      this.soundManager.setAmbience('eyes');

      this.resumeTimer({ detail: { timer: this.ghostFlashTimer } });
      this.resumeTimer({ detail: { timer: this.ghostCycleTimer } });
      this.resumeTimer({ detail: { timer: this.fruitTimer } });
      this.allowPacmanMovement = true;
      this.pacman.display = true;
      this.pacman.moving = true;
      e.detail.ghost.display = true;
      e.detail.ghost.moving = true;
      this.ghosts.forEach((ghost) => {
        ghost.animate = true;
        ghost.pause(false);
        ghost.allowCollision = true;
      });
    }, pauseDuration);
  }

  restoreGhost() {
    this.eyeGhosts -= 1;

    if (this.eyeGhosts === 0) {
      const sound = this.scaredGhosts.length > 0
        ? 'power_up'
        : this.determineSiren(this.remainingDots);
      this.soundManager.setAmbience(sound);
    }
  }

  /**
   * Creates a temporary popup image (READY!, GAME OVER, score values) at a
   * maze-local {left, top} position for `duration` ms.
   */
  displayText(position, amount, duration, width, height) {
    const key = String(amount);
    const img = this.add.image(
      this.mazeOriginX + position.left,
      this.mazeOriginY + position.top,
      key,
    );
    img.setOrigin(0, 0);
    img.setDisplaySize(width, height || width);
    img.setDepth(4);

    new Timer(() => {
      img.destroy();
    }, duration);
  }

  // ---------------------------------------------------------------------
  // Timer bookkeeping (mirrors gameCoordinator.js's addTimer/removeTimer/etc)
  // ---------------------------------------------------------------------

  addTimer(e) {
    this.activeTimers.push(e.detail.timer);
  }

  timerExists(e) {
    return !!(e.detail.timer || {}).timerId;
  }

  pauseTimer(e) {
    if (this.timerExists(e)) e.detail.timer.pause(true);
  }

  resumeTimer(e) {
    if (this.timerExists(e)) e.detail.timer.resume(true);
  }

  removeTimer(e) {
    if (this.timerExists(e)) {
      window.clearTimeout(e.detail.timer.timerId);
      this.activeTimers = this.activeTimers.filter((timer) => timer.timerId !== e.detail.timer.timerId);
    }
  }
}
