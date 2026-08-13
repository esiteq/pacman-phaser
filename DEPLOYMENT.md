# Деплой демо на GitHub Pages

Ціль: опублікувати гру за адресою **https://esiteq.github.io/pacman-phaser/**
(project page GitHub Pages для репозиторію `esiteq/pacman-phaser`).

## Передумови (вже виконано в цьому репозиторії)

- Репозиторій — `esiteq/pacman-phaser` на GitHub, гілка `main`.
- `vite.config.js` вже має `base: './'` (відносні шляхи до асетів) — це
  критично для project-сторінок GitHub Pages, бо гра живе не в корені
  домену (`esiteq.github.io/`), а в підпапці (`esiteq.github.io/pacman-phaser/`).
  Якби `base` був `/` (абсолютний), усі запити до `assets/...` йшли б у
  корінь домену і повертали 404. Нічого міняти тут не треба.
- `npm run build` компілює у `dist/` — це і є те, що публікується.

## Рекомендований спосіб: GitHub Actions (автодеплой при push)

Найнадійніший варіант — офіційний workflow GitHub Pages: при кожному push
у `main` збирається `dist/` і публікується автоматично, без ручного
кроку "збери й запуш кудись". Не потребує `gh-pages`-гілки чи токенів.

### Крок 1 — додати workflow-файл

Створи файл `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

### Крок 2 — закомітити і запушити

```bash
git add .github/workflows/deploy.yml
git commit -m "Add GitHub Pages deploy workflow"
git push origin main
```

### Крок 3 — увімкнути GitHub Pages в налаштуваннях репозиторію (один раз)

Це єдиний крок, який не можна зробити з командного рядка без токена — робиться
в браузері:

1. Відкрий https://github.com/esiteq/pacman-phaser/settings/pages
2. У розділі **Build and deployment → Source** вибери **GitHub Actions**
   (не "Deploy from a branch").
3. Збережи. Більше нічого налаштовувати не треба — джерело збірки вже
   визначено файлом workflow.

### Крок 4 — перевірити деплой

1. Відкрий вкладку **Actions** репозиторію — після push має запуститись
   workflow "Deploy to GitHub Pages". Дочекайся зеленої галочки (~1 хв).
2. Відкрий https://esiteq.github.io/pacman-phaser/ — має завантажитись гра.
3. Якщо бачиш 404 від GitHub Pages (не від гри) — перевір, що крок 3
   виконано і що workflow дійсно завершився успішно (вкладка Actions).

Після цього кожен наступний `git push origin main` автоматично оновлює
демо за 1-2 хвилини — окремих ручних кроків більше не потрібно.

## Альтернатива: ручний деплой через пакет `gh-pages`

Простіше налаштувати, але кожен реліз треба публікувати вручну командою
(або через свій CI). Підходить, якщо не хочеш заводити GitHub Actions.

### Крок 1 — встановити `gh-pages`

```bash
npm install --save-dev gh-pages
```

### Крок 2 — додати скрипт у `package.json`

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "deploy": "vite build && gh-pages -d dist"
}
```

### Крок 3 — задеплоїти

```bash
npm run deploy
```

Це збере проєкт і запушить вміст `dist/` у гілку `gh-pages` (створить її
автоматично, якщо не існує).

### Крок 4 — увімкнути Pages з гілки `gh-pages`

1. https://github.com/esiteq/pacman-phaser/settings/pages
2. **Source** → **Deploy from a branch**
3. **Branch** → `gh-pages` / `/ (root)` → Save

Після цього https://esiteq.github.io/pacman-phaser/ стане доступним за
~1 хвилину. Для оновлення демо після наступних змін — просто повторюй
`npm run deploy`.

## Типові проблеми

| Симптом | Причина | Рішення |
|---|---|---|
| GitHub 404 на всій сторінці | Pages не увімкнено або вказано не те джерело | Перевір крок "увімкнути Pages" вище |
| Сторінка відкривається, але чорний екран / 404 на `assets/*.png` | `base` у `vite.config.js` не `'./'` (абсолютний шлях) | Переконайся, що `base: './'` лишився не зміненим |
| Стара версія гри після оновлення | Кеш браузера або деплой ще не завершився | Почекай завершення workflow в Actions, зроби hard refresh (Ctrl+Shift+R) |
| Workflow падає на `npm ci` | Немає `package-lock.json` у репозиторії | Переконайся, що `package-lock.json` закомічений (не в `.gitignore`) |

## Кастомний домен (не потрібно для esiteq.github.io, для довідки)

Якщо колись знадобиться свій домен замість `esiteq.github.io/pacman-phaser/`
— додається файл `public/CNAME` з доменом, і DNS CNAME-запис на
`esiteq.github.io`. У цьому проєкті не налаштовано і не потрібно для
поточної мети.
