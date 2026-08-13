// Original 28x31 maze layout from bward2/pacman-js (app/scripts/core/gameCoordinator.js).
// 'X' = wall, 'o' = pacdot, 'O' = power pellet, ' ' = empty walkable space (ghost house / tunnel).
const RAW_MAZE = [
  'XXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  'XooooooooooooXXooooooooooooX',
  'XoXXXXoXXXXXoXXoXXXXXoXXXXoX',
  'XOXXXXoXXXXXoXXoXXXXXoXXXXOX',
  'XoXXXXoXXXXXoXXoXXXXXoXXXXoX',
  'XooooooooooooooooooooooooooX',
  'XoXXXXoXXoXXXXXXXXoXXoXXXXoX',
  'XoXXXXoXXoXXXXXXXXoXXoXXXXoX',
  'XooooooXXooooXXooooXXooooooX',
  'XXXXXXoXXXXX XX XXXXXoXXXXXX',
  'XXXXXXoXXXXX XX XXXXXoXXXXXX',
  'XXXXXXoXX          XXoXXXXXX',
  'XXXXXXoXX XXXXXXXX XXoXXXXXX',
  'XXXXXXoXX X      X XXoXXXXXX',
  '      o   X      X   o      ',
  'XXXXXXoXX X      X XXoXXXXXX',
  'XXXXXXoXX XXXXXXXX XXoXXXXXX',
  'XXXXXXoXX          XXoXXXXXX',
  'XXXXXXoXX XXXXXXXX XXoXXXXXX',
  'XXXXXXoXX XXXXXXXX XXoXXXXXX',
  'XooooooooooooXXooooooooooooX',
  'XoXXXXoXXXXXoXXoXXXXXoXXXXoX',
  'XoXXXXoXXXXXoXXoXXXXXoXXXXoX',
  'XOooXXooooooo  oooooooXXooOX',
  'XXXoXXoXXoXXXXXXXXoXXoXXoXXX',
  'XXXoXXoXXoXXXXXXXXoXXoXXoXXX',
  'XooooooXXooooXXooooXXooooooX',
  'XoXXXXXXXXXXoXXoXXXXXXXXXXoX',
  'XoXXXXXXXXXXoXXoXXXXXXXXXXoX',
  'XooooooooooooooooooooooooooX',
  'XXXXXXXXXXXXXXXXXXXXXXXXXXXX',
];

export function buildMazeArray() {
  return RAW_MAZE.map((row) => row.split(''));
}

// Every asset in the original project was exported at 8px-per-tile resolution.
export const BASE_TILE = 8;

// Display multiplier applied on top of BASE_TILE. Phaser's Scale Manager (FIT)
// takes care of fitting this internal resolution to whatever screen the game
// runs on, so this only needs to be "big enough" to look crisp.
export const DISPLAY_SCALE = 4;

export const TOP_UI_ROWS = 3;
export const BOTTOM_UI_ROWS = 2;

export const FRUIT_POINTS = {
  1: 100,
  2: 300,
  3: 500,
  4: 700,
  5: 1000,
  6: 2000,
  7: 3000,
  8: 5000,
};

export const FRUIT_IMAGES = {
  100: 'cherry',
  300: 'strawberry',
  500: 'orange',
  700: 'apple',
  1000: 'melon',
  2000: 'galaxian',
  3000: 'bell',
  5000: 'key',
};
