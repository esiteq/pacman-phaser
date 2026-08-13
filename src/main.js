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

// Vertical center (in scaledTileSize units) of the "1UP"/"HIGH SCORE" HUD
// text block drawn in GameScene.buildHud() -- label at y=0.5*s, value at
// y=1.3*s, ~0.45*s tall, so the block spans roughly [0.5s, 1.75s]. This is
// NOT the center of the full TOP_UI_ROWS (3 tiles) band: that band has
// empty space below the text as breathing room before the maze border, so
// centering against the whole band would visibly sit the header lower than
// the HUD text itself.
const HUD_TEXT_CENTER = 1.125;

// The header (GitHub link + pause/sound) is a plain HTML element, positioned
// independently of the canvas. Since the canvas is letterboxed/centered by
// Phaser's Scale.FIT, its on-screen box rarely matches the full browser
// viewport -- so instead of spanning the whole window, the header is kept in
// sync with the canvas's actual bounding box on every resize: aligned
// horizontally with the maze, and vertically centered (via CSS
// translateY(-50%), see style.css) on the "1UP"/"HIGH SCORE" text.
function syncHeaderToCanvas(game) {
  const header = document.getElementById('header-buttons');
  if (!header || !game.canvas) return;

  const rect = game.canvas.getBoundingClientRect();
  const onScreenScale = rect.height / height;

  header.style.left = `${rect.left}px`;
  header.style.width = `${rect.width}px`;
  header.style.top = `${rect.top + (HUD_TEXT_CENTER * scaledTileSize * onScreenScale)}px`;
}

function boot() {
  const game = new Phaser.Game({
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

  game.events.once(Phaser.Core.Events.READY, () => syncHeaderToCanvas(game));
  game.scale.on(Phaser.Scale.Events.RESIZE, () => syncHeaderToCanvas(game));
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
