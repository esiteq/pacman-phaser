# Pac-Man — Phaser 3 edition

Переписаний з нуля [pacman-js](https://github.com/bward2/pacman-js) (Brent Ward) на **Phaser 3**.
Та ж графіка, ті ж звуки, той самий лабіринт і той самий ШІ привидів — просто тепер усе
малюється через WebGL/Canvas спрайти замість CSS/DOM, і крутиться на Vite dev-сервері.

Без титульного екрану і прелоадера — відкрив сторінку, і за пару секунд уже граєш.

## Запуск

Знадобиться [Node.js](https://nodejs.org/) (18+).

```bash
npm install
npm run dev
```

Відкриється щось типу `http://localhost:8080` — тисни і грай.

Інші команди:

```bash
npm run build    # продакшн-збірка у dist/
npm run preview  # підняти локальний сервер і подивитись на зібраний dist/
```

Це звичайний статичний сайт (HTML + JS + assets) — після `npm run build` папку `dist/`
можна закинути на будь-який хостинг (GitHub Pages, Netlify, свій сервер тощо).

## Керування

- **Стрілки** або **WASD** — рух
- **Esc** — пауза
- **Q** — звук вкл/викл (або кнопки у верхньому правому куті)
- На мобільних — свайпи по екрану

## Що всередині

- 4 привиди з індивідуальним ШІ (Blinky женеться напряму, Pinky цілить на 4 клітинки
  вперед по курсу Пакмана, Inky рахує вектор від Blinky, Clyde тікає, коли підходить
  близько) + режими scatter/chase/scared/eyes
- Cruise Elroy — Blinky прискорюється, коли дотів залишається мало
  - Бонусні фрукти, комбо за з'їдених привидів (100/200/400/800/1600), додаткове життя
    на 10000 очок
  - Рекорд зберігається в `localStorage`
  - Прогресія рівнів з тим самим лабіринтом (244 крапки/пелети — той самий maze-масив,
    що і в оригіналі)

## Структура проєкту

```
src/
  entities/     Pacman, Ghost, Pickup — рендер через Phaser-спрайти
  scenes/       GameScene — фіксований таймстеп (порт gameEngine.js) +
                вся ігрова логіка (порт gameCoordinator.js)
  utils/        CharacterUtil (математика руху/колізій), Timer (таймер з
                паузою), SoundManager (Web Audio), дані лабіринту
public/assets/  графіка (PNG) і звук (MP3) — окремі файли, без base64
```

Ассети та лабіринт узяті напряму з оригінального репозиторію
[bward2/pacman-js](https://github.com/bward2/pacman-js) (MIT-ліцензія, див. `LICENSE`).

## Документація

- [TECHNICAL_DESCRIPTION.md](TECHNICAL_DESCRIPTION.md) — детальний технічний опис архітектури, ігрового циклу, ШІ привидів
- [CLAUDE.md](CLAUDE.md) — інструкції для роботи з кодовою базою через Claude Code
- [CHANGELOG.md](CHANGELOG.md) — історія версійних змін
- [DEVELOPMENT_LOG.md](DEVELOPMENT_LOG.md) — журнал сесій розробки
