import { DISPLAY_SCALE } from '../utils/mazeData.js';

// Port of app/scripts/characters/pacman.js. Movement/collision math is
// untouched; only the rendering target changed from a DOM <p> with a CSS
// background-image to a Phaser spritesheet sprite (+ a separate "arrow"
// sprite that leads Pacman, exactly like the original).
export default class Pacman {
  constructor(scene, scaledTileSize, mazeArray, characterUtil) {
    this.scene = scene;
    this.scaledTileSize = scaledTileSize;
    this.mazeArray = mazeArray;
    this.characterUtil = characterUtil;

    this.animationTarget = scene.add.sprite(0, 0, 'pacman_left', 0);
    this.animationTarget.setOrigin(0, 0);
    this.animationTarget.setScale(DISPLAY_SCALE);
    this.animationTarget.setDepth(3);

    this.pacmanArrow = scene.add.image(0, 0, 'arrow_left');
    this.pacmanArrow.setOrigin(0, 0);
    this.pacmanArrow.setScale(DISPLAY_SCALE);
    this.pacmanArrow.setDepth(3);

    this.reset();
  }

  /**
   * Resets the character to its default state
   */
  reset() {
    this.setMovementStats(this.scaledTileSize);
    this.setSpriteAnimationStats();
    this.setStyleMeasurements();
    this.setDefaultPosition(this.scaledTileSize);
    this.setSpriteSheet(this.direction);
    this.pacmanArrow.setTexture(`arrow_${this.direction}`);
    this.pacmanArrow.setVisible(true);
  }

  /**
   * Sets various properties related to Pacman's movement
   */
  setMovementStats(scaledTileSize) {
    this.velocityPerMs = this.calculateVelocityPerMs(scaledTileSize);
    this.desiredDirection = this.characterUtil.directions.left;
    this.direction = this.characterUtil.directions.left;
    this.moving = false;
  }

  /**
   * Sets values pertaining to Pacman's spritesheet animation
   */
  setSpriteAnimationStats() {
    this.specialAnimation = false;
    this.display = true;
    this.animate = true;
    this.loopAnimation = true;
    this.msBetweenSprites = 50;
    this.msSinceLastSprite = 0;
    this.spriteFrames = 4;
    this.spriteFrame = 0;
    this.animationTarget.setFrame(0);
  }

  /**
   * Sets display size for Pacman and Pacman's Arrow. The source spritesheets
   * are 16px/tile; DISPLAY_SCALE upsizes them to the in-game tile size.
   */
  setStyleMeasurements() {
    this.measurement = this.scaledTileSize * 2;
  }

  /**
   * Sets the default position and direction for Pacman at the game's start
   */
  setDefaultPosition(scaledTileSize) {
    this.defaultPosition = {
      top: scaledTileSize * 22.5,
      left: scaledTileSize * 13,
    };
    this.position = { ...this.defaultPosition };
    this.oldPosition = { ...this.position };
  }

  /**
   * Calculates how fast Pacman should move in a millisecond
   */
  calculateVelocityPerMs(scaledTileSize) {
    // In the original game, Pacman moved at 11 tiles per second.
    const velocityPerSecond = scaledTileSize * 11;
    return velocityPerSecond / 1000;
  }

  /**
   * Chooses a movement spritesheet depending upon direction
   */
  setSpriteSheet(direction) {
    if (!this.specialAnimation) {
      this.animationTarget.setTexture(`pacman_${direction}`, this.spriteFrame);
    }
  }

  prepDeathAnimation() {
    this.loopAnimation = false;
    this.msBetweenSprites = 125;
    this.spriteFrames = 12;
    this.specialAnimation = true;
    this.spriteFrame = 0;
    this.animationTarget.setTexture('pacman_death', 0);
    this.pacmanArrow.setVisible(false);
  }

  /**
   * Changes Pacman's desiredDirection, updates the PacmanArrow sprite, and sets moving to true
   * @param {('up'|'down'|'left'|'right')} newDirection
   * @param {Boolean} startMoving - If true, Pacman will move upon key press
   */
  changeDirection(newDirection, startMoving) {
    this.desiredDirection = newDirection;
    this.pacmanArrow.setTexture(`arrow_${this.desiredDirection}`);

    if (startMoving) {
      this.moving = true;
    }
  }

  /**
   * Updates the position of the leading arrow in front of Pacman
   */
  updatePacmanArrowPosition(position, scaledTileSize) {
    this.pacmanArrow.setPosition(
      this.scene.mazeOriginX + position.left - scaledTileSize,
      this.scene.mazeOriginY + position.top - scaledTileSize,
    );
  }

  /**
   * Handle Pacman's movement when he is snapped to the x-y grid of the Maze Array
   */
  handleSnappedMovement(elapsedMs) {
    const desired = this.characterUtil.determineNewPositions(
      this.position,
      this.desiredDirection,
      this.velocityPerMs,
      elapsedMs,
      this.scaledTileSize,
    );
    const alternate = this.characterUtil.determineNewPositions(
      this.position,
      this.direction,
      this.velocityPerMs,
      elapsedMs,
      this.scaledTileSize,
    );

    if (this.characterUtil.checkForWallCollision(desired.newGridPosition, this.mazeArray, this.desiredDirection)) {
      if (this.characterUtil.checkForWallCollision(alternate.newGridPosition, this.mazeArray, this.direction)) {
        this.moving = false;
        return this.position;
      }
      return alternate.newPosition;
    }
    this.direction = this.desiredDirection;
    this.setSpriteSheet(this.direction);
    return desired.newPosition;
  }

  /**
   * Handle Pacman's movement when he is inbetween tiles on the x-y grid of the Maze Array
   */
  handleUnsnappedMovement(gridPosition, elapsedMs) {
    const desired = this.characterUtil.determineNewPositions(
      this.position,
      this.desiredDirection,
      this.velocityPerMs,
      elapsedMs,
      this.scaledTileSize,
    );
    const alternate = this.characterUtil.determineNewPositions(
      this.position,
      this.direction,
      this.velocityPerMs,
      elapsedMs,
      this.scaledTileSize,
    );

    if (this.characterUtil.turningAround(this.direction, this.desiredDirection)) {
      this.direction = this.desiredDirection;
      this.setSpriteSheet(this.direction);
      return desired.newPosition;
    } if (this.characterUtil.changingGridPosition(gridPosition, alternate.newGridPosition)) {
      return this.characterUtil.snapToGrid(gridPosition, this.direction, this.scaledTileSize);
    }
    return alternate.newPosition;
  }

  /**
   * Updates the on-screen position, hides if there is a stutter, and animates the spritesheet
   * @param {number} interp - The animation accuracy as a percentage
   */
  draw(interp) {
    const newTop = this.characterUtil.calculateNewDrawValue(interp, 'top', this.oldPosition, this.position);
    const newLeft = this.characterUtil.calculateNewDrawValue(interp, 'left', this.oldPosition, this.position);

    this.animationTarget.setPosition(
      this.scene.mazeOriginX + newLeft,
      this.scene.mazeOriginY + newTop,
    );

    const visible = this.display
      ? this.characterUtil.checkForStutter(this.position, this.oldPosition) === 'visible'
      : false;
    this.animationTarget.setVisible(visible);
    this.pacmanArrow.setVisible(visible && !this.specialAnimation);

    this.updatePacmanArrowPosition(this.position, this.scaledTileSize);

    const updatedProperties = this.characterUtil.advanceSpriteSheet(this);
    this.msSinceLastSprite = updatedProperties.msSinceLastSprite;
    this.spriteFrame = updatedProperties.spriteFrame;
  }

  /**
   * Handles movement logic for Pacman
   * @param {number} elapsedMs - The amount of MS that have passed since the last update
   */
  update(elapsedMs) {
    this.oldPosition = { ...this.position };

    if (this.moving) {
      const gridPosition = this.characterUtil.determineGridPosition(this.position, this.scaledTileSize);

      if (JSON.stringify(this.position) === JSON.stringify(
        this.characterUtil.snapToGrid(gridPosition, this.direction, this.scaledTileSize),
      )) {
        this.position = this.handleSnappedMovement(elapsedMs);
      } else {
        this.position = this.handleUnsnappedMovement(gridPosition, elapsedMs);
      }

      this.position = this.characterUtil.handleWarp(this.position, this.scaledTileSize, this.mazeArray);
    }

    if (this.moving || this.specialAnimation) {
      this.msSinceLastSprite += elapsedMs;
    }
  }
}
