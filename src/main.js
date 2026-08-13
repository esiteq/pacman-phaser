import Phaser from 'phaser';
import GameScene from './scenes/GameScene.js';
import {
  BASE_TILE, DISPLAY_SCALE, TOP_UI_ROWS, BOTTOM_UI_ROWS,
} from './utils/mazeData.js';

const scaledTileSize = BASE_TILE * DISPLAY_SCALE;
const MAZE_COLS = 28;
const MAZE_ROWS = 31;
const width = scaledTileSize * MAZE_COLS;
const height = scaledTileSize * (MAZE_ROWS + TOP_UI_ROWS + BOTTOM_UI_ROWS);

function boot() {
  // eslint-disable-next-line no-new
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game-frame',
    backgroundColor: '#000000',
    pixelArt: true,
    antialias: false,
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.FIT,
      // Centering is handled by the flexbox rules on #game-container in
      // style.css. Phaser's own CENTER_BOTH also nudges the canvas via
      // margin-left/margin-top -- combined with flex's own centering, the
      // two offsets stack and push the canvas off-center, so autoCentering
      // is left to CSS only.
      autoCenter: Phaser.Scale.NO_CENTER,
      width,
      height,
    },
    scene: [GameScene],
  });
}

const headerPause = document.getElementById('pause-button');
const headerSound = document.getElementById('sound-button');
headerPause.addEventListener('click', () => window.dispatchEvent(new Event('requestPause')));
headerSound.addEventListener('click', () => window.dispatchEvent(new Event('requestSoundToggle')));

// Make sure the retro font is loaded before Phaser renders any Text objects,
// otherwise the HUD briefly renders in a fallback font.
if (document.fonts && document.fonts.load) {
  document.fonts.load("16px 'Press Start 2P'")
    .catch(() => {})
    .finally(boot);
} else {
  boot();
}
