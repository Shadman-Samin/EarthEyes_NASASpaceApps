# EarthEyes

**See ice change. See sea rise.**

EarthEyes is a browser-based visualization concept for the NASA Space Apps Challenge 2026, challenge “Dancing with the SARs.” The current download contains the React interface and sample visual content. It is a static frontend; it does not include a server, NASA data pipeline, or hosted AI/chat service.

## Run locally

Requires Node.js 22 (or a compatible current LTS release) and npm.

```sh
npm ci
npm run dev
```

Vite prints the local development URL. To make a production build locally:

```sh
npm run build
npm run preview
```

## Publish on GitHub Pages

The workflow in `.github/workflows/deploy.yml` builds and deploys the site whenever code is pushed to `main`.

1. Push this project to the `main` branch of `Shadman-Samin/EarthEyes_NASASpaceApps`.
2. On GitHub, open **Settings → Pages** and set **Build and deployment → Source** to **GitHub Actions**.
3. Open the **Actions** tab and wait for “Deploy EarthEyes to GitHub Pages” to finish.
4. The site will be available at `https://shadman-samin.github.io/EarthEyes_NASASpaceApps/`.

## What is included

- React 19 interface built with Vite and Tailwind CSS.
- GitHub Actions deployment workflow for GitHub Pages.
- Relative asset paths configured for the repository’s Pages URL.

## Current limits

The included UI uses externally hosted sample imagery and does not fetch or process NASA/NISAR datasets. Any buttons or visualizations that depend on real data, an API, or a model need those services and configuration added before they can provide production data.
