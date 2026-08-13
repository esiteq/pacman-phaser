import { FRUIT_IMAGES } from '../utils/mazeData.js';

// Port of app/scripts/pickups/pickup.js. The original created an absolutely
// positioned <div> with a CSS background-image; here we create a Phaser
// Image at the same maze-local coordinates. All of the proximity/collision
// math is untouched.
export default class Pickup {
  constructor(scene, type, scaledTileSize, column, row, pacman, points) {
    this.scene = scene;
    this.type = type;
    this.pacman = pacman;
    this.points = points;
    this.nearPacman = false;

    this.setStyleMeasurements(type, scaledTileSize, column, row, points);
  }

  /**
   * Resets the pickup's visibility
   */
  reset() {
    this.animationTarget.setVisible(this.type !== 'fruit');
  }

  /**
   * Sets various style measurements for the pickup depending on its type
   */
  setStyleMeasurements(type, scaledTileSize, column, row, points) {
    if (type === 'pacdot') {
      this.size = scaledTileSize * 0.25;
      this.x = (column * scaledTileSize) + ((scaledTileSize / 8) * 3);
      this.y = (row * scaledTileSize) + ((scaledTileSize / 8) * 3);
    } else if (type === 'powerPellet') {
      this.size = scaledTileSize;
      this.x = (column * scaledTileSize);
      this.y = (row * scaledTileSize);
    } else {
      this.size = scaledTileSize * 2;
      this.x = (column * scaledTileSize) - (scaledTileSize * 0.5);
      this.y = (row * scaledTileSize) - (scaledTileSize * 0.5);
    }

    this.center = {
      x: column * scaledTileSize,
      y: row * scaledTileSize,
    };

    const textureKey = this.determineImage(type, points);
    this.animationTarget = this.scene.add.image(
      this.scene.mazeOriginX + this.x,
      this.scene.mazeOriginY + this.y,
      textureKey,
    );
    this.animationTarget.setOrigin(0, 0);
    this.animationTarget.setDisplaySize(this.size, this.size);
    this.animationTarget.setDepth(1);

    if (type === 'powerPellet') {
      // Original CSS: `animation: blink .3s infinite` (50% duty cycle).
      this.scene.tweens.add({
        targets: this.animationTarget,
        alpha: { from: 1, to: 0 },
        duration: 150,
        yoyo: true,
        repeat: -1,
        ease: 'Step',
      });
    }

    this.reset();
  }

  /**
   * Determines the Pickup texture key based on type and point value
   */
  determineImage(type, points) {
    if (type === 'fruit') {
      return FRUIT_IMAGES[points] || 'cherry';
    }
    return type;
  }

  /**
   * Shows a bonus fruit, resetting its point value and image
   * @param {number} points
   */
  showFruit(points) {
    this.points = points;
    this.animationTarget.setTexture(this.determineImage(this.type, points));
    this.animationTarget.setVisible(true);
  }

  /**
   * Makes the fruit invisible (happens if Pacman was too slow)
   */
  hideFruit() {
    this.animationTarget.setVisible(false);
  }

  /**
   * Returns true if the Pickup is touching a bounding box at Pacman's center
   */
  checkForCollision(pickup, originalPacman) {
    const pacman = { ...originalPacman };

    pacman.x += (pacman.size * 0.25);
    pacman.y += (pacman.size * 0.25);
    pacman.size /= 2;

    return (pickup.x < pacman.x + pacman.size
      && pickup.x + pickup.size > pacman.x
      && pickup.y < pacman.y + pacman.size
      && pickup.y + pickup.size > pacman.y);
  }

  /**
   * Checks to see if the pickup is close enough to Pacman to be considered for collision detection
   */
  checkPacmanProximity(maxDistance, pacmanCenter) {
    if (this.animationTarget.visible) {
      const distance = Math.sqrt(
        ((this.center.x - pacmanCenter.x) ** 2)
        + ((this.center.y - pacmanCenter.y) ** 2),
      );

      this.nearPacman = (distance <= maxDistance);
    }
  }

  /**
   * Checks if the pickup is visible and close to Pacman
   */
  shouldCheckForCollision() {
    return this.animationTarget.visible && this.nearPacman;
  }

  /**
   * If the Pickup is still visible, it checks to see if it is colliding with Pacman.
   * It will turn itself invisible and cease collision-detection after the first
   * collision with Pacman.
   */
  update() {
    if (this.shouldCheckForCollision()) {
      if (this.checkForCollision({
        x: this.x,
        y: this.y,
        size: this.size,
      }, {
        x: this.pacman.position.left,
        y: this.pacman.position.top,
        size: this.pacman.measurement,
      })) {
        this.animationTarget.setVisible(false);
        window.dispatchEvent(new CustomEvent('awardPoints', {
          detail: {
            points: this.points,
            type: this.type,
          },
        }));

        if (this.type === 'pacdot') {
          window.dispatchEvent(new Event('dotEaten'));
        } else if (this.type === 'powerPellet') {
          window.dispatchEvent(new Event('dotEaten'));
          window.dispatchEvent(new Event('powerUp'));
        }
      }
    }
  }
}
