# Coding Quagsire

Single-page fan site: an animated SVG Quagsire typing in the rain. Inspired by hostrider.com (Coding Cat).

## Stack
- Plain HTML/CSS/JS, no build step, no dependencies
- `index.html` — page + inline SVG drawing
- `style.css` — theme tokens on `:root`, all animation is CSS keyframes
- `script.js` — keyboard input drives the arms and terminal; sounds and the lo-fi loop are generated with the Web Audio API (no audio files)

## Run
`python3 -m http.server 8000` then open http://localhost:8000

## Conventions
- Keep it dependency-free and deployable as static files (GitHub Pages)
- Respect `prefers-reduced-motion`
