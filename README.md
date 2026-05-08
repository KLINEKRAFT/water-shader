# OCEAN // PATH B — Three.js Water Pro

Premium FFT-based ocean simulation. Compute-shader waves, Gerstner swells, atmospheric sky, post-processing bloom.

## Files

```
path-b/
├── index.html          ← Entry point with import map for three.js@0.181 (WebGPU)
├── lib/
│   └── index.js        ← Water Pro library (2.7MB, minified)
├── src/
│   └── main.js         ← Scene setup + slider UI
└── assets/
    └── klinekraft_logo_white.png   ← (Drop in manually)
```

## Deploy to Vercel / Cloudflare Pages

1. Create a new GitHub repo via the web UI.
2. Upload all four folders (root files + `lib/`, `src/`, `assets/`) using GitHub's web UI drag-and-drop.
3. Connect Vercel or Cloudflare Pages to the repo. **No build step needed** — these are static files.
4. Point your custom domain (e.g. `water-pro.colinkline.com`) at the deployment.

## Requirements

**Desktop Chrome or Edge 113+** is required (WebGPU). Safari support is partial. Mobile is not officially supported.

If WebGPU is unavailable, the page shows a fallback message directing the user to Path C.

## Local testing

The page uses ES modules, so it must be served over HTTP. Quick options:

```bash
python3 -m http.server 8080
# or
npx serve .
```

Then open `http://localhost:8080`.

## Controls

- Drag — orbit camera
- Scroll — zoom
- H — toggle controls panel
- Preset dropdown — load any of 10 built-in environments (tropical, storm, sunset, moonlit, etc.)
- Sliders — wind speed, wave size, choppiness, speed, swell height/length, sun position

## License note

The `lib/index.js` file is Three.js Water Pro v2.1.2, licensed commercially from DRG Software Solutions LLC. You may bundle/minify it in your end products. Do **not** publish the source files in a public repository — keep this repo private.
