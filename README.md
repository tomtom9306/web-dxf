# Web DXF Viewer

A lightweight, browser-based DXF viewer built with Vite + React + Three.js. It supports dragging and dropping any DXF file (ASCII or binary) and renders common entities like lines, polylines, circles, and arcs directly in the browser.

## Running locally

```bash
npm install
npm run dev
```

Then open the printed local URL in your browser.

## Building for production

```bash
npm run build
npm run preview
```

When deploying to GitHub Pages, the Vite base path is set to `/web-dxf/` so assets resolve correctly on the project site. You can publish the generated `dist/` directory to the `gh-pages` branch to update https://tomtom9306.github.io/web-dxf/.

## Features

- Drag & drop DXF loading or file picker
- Entity breakdown and quick metadata (version, extents, counts)
- Orthographic view with re-center control for large files
