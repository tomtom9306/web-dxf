# Web DXF Viewer

A zero-setup DXF viewer that runs entirely in the browser. Open `index.html` directly (no build step, servers, or bundlers) and drag any DXF file onto the canvas to see it rendered with Three.js.

## How to use

1. Download or clone this repository.
2. Open `index.html` in any modern browser (double-click it or drag it into a tab).
3. Choose a DXF file with the button or drag-and-drop it onto the viewer.

The page pulls Three.js and dxf-parser from public CDNs, so nothing needs to be installed locally.

## Features

- Works offline after the first load—just open the HTML file.
- Drag & drop DXF loading or file picker.
- Entity breakdown and quick metadata (version, extents, counts).
- Orthographic view with recenter control for large drawings.

## Deploying

For static hosting (e.g., GitHub Pages), serve `index.html` as-is. No build output is required.
