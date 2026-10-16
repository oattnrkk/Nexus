# NEXUS

Official source repository for the NEXUS media discovery website.

## Deployment

Static site: `index.html` at repository root. Netlify production site: https://n1r4n.netlify.app/

Production branch: `main`; publish directory: `.`; no build command required.

**Important:** Upload and verify `index.html` before connecting the existing Netlify site to GitHub Continuous Deployment. Do not create a new Netlify site.

## Release

NEXUS 5.0 is the current review build. Verify Google OAuth, Supabase account sync, Like/Dislike history, My List, and backup/restore before publishing to production.
