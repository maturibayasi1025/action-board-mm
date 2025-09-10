# Cloudflare Pages Deployment Fixes

## Issues Resolved

### 1. Static Icon Files Dynamic Route Issue
**Problem**: Next.js 15 automatically converts static icon files (icon.png, apple-icon.png) in `/app` directory to dynamic route handlers as part of the metadata API. Cloudflare Pages requires all routes to have `export const runtime = "edge";`.

**Root Cause**: This is **not a bug** but Next.js 15's intended behavior. The metadata API converts static files to special route handlers for optimal meta tag generation.

**Solution**: 
- Replaced static `app/icon.png` and `app/apple-icon.png` with dynamic `app/icon.tsx` and `app/apple-icon.tsx`
- Used Next.js `ImageResponse` API from `next/og` to generate icons dynamically
- Added `export const runtime = "edge";` to both icon files
- Icons maintain the same teal color (#4fd1c7) with "MM" text overlay

### 2. Bundle Size Exceeded (50MB → 49KB)
**Problem**: Cloudflare Pages Functions bundle size was 47.7MB, exceeding the 25MB limit.

**Root Cause**: Many packages were moved from `devDependencies` to `dependencies` during earlier build error fixes, causing unnecessary packages to be included in the runtime bundle.

**Solution**: Optimized package.json by moving runtime-unnecessary packages back to devDependencies:
- **Testing packages**: jest, @playwright/test, playwright, vitest, @vitest/*
- **Development tools**: @biomejs/biome, tsx, @types/* packages
- **Storybook packages**: All @storybook/* packages
- **Build tools**: Kept essential ones (typescript, tailwindcss, postcss, autoprefixer) in dependencies

**Result**: Final bundle size reduced to 49KB (99.9% size reduction).

## Key Files Modified
- `package.json` - Dependency optimization
- `app/icon.tsx` - Edge runtime compatible icon generation  
- `app/apple-icon.tsx` - Edge runtime compatible Apple icon generation
- Removed: `app/icon.png`, `app/apple-icon.png`

## Build Commands That Work
- `npm run build:cloudflare` - Next.js build for Cloudflare
- `npx @cloudflare/next-on-pages` - Generate Cloudflare Pages Functions

## Important Notes
- The icon approach is the correct solution for Next.js 15 + Cloudflare Pages
- Bundle size optimization was critical for deployment success
- All edge runtime routes are now properly configured
- Build process maintains all functionality while being deployment-ready