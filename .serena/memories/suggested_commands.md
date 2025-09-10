# Suggested Development Commands

## Setup & Environment
- `supabase start` - Start local Supabase environment
- `supabase db reset` - Reset local database with migrations and seed data
- `npm install` - Install dependencies
- `npm run dev` - Start Next.js development server (localhost:3000)

## Code Quality & Formatting
- `npm run biome:check:write` - Run Biome formatter and linter with auto-fix
- `npm run types` - Generate TypeScript types from Supabase schema
- `biome check --write .` - Format and lint entire codebase

## Testing
- `npm run test` - Run all tests (Jest + Playwright)
- `npm run test:unit` - Run Jest unit tests only
- `npm run test:rls` - Run Supabase RLS (Row Level Security) tests only
- `npm run test:e2e` - Run Playwright E2E tests
- `npm run test:e2e:ui` - Run E2E tests in UI mode (debugging)
- `npm run test:e2e:debug` - Run E2E tests in debug mode

## Build & Deploy
- `npm run build` - Build production Next.js application
- `npm run build:cloudflare` - Build for Cloudflare Pages deployment
- `npm run start` - Start production server
- `npm run clean` - Clean build artifacts

## Storybook
- `npm run storybook` - Start Storybook development server (localhost:6006)
- `npm run build-storybook` - Build production Storybook

## Database Operations
- `supabase migration new {name}` - Create new migration file
- `supabase migration up` - Apply pending migrations
- `npx supabase gen types typescript --local > lib/types/supabase.ts` - Generate types from schema

## Mission Data Management
- `npm run mission:sync` - Sync mission data
- `npm run mission:sync:dry` - Dry run mission sync
- `npm run mission:export` - Export mission data