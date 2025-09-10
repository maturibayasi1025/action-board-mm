# Code Style & Conventions

## Code Formatting & Linting
- **Tool**: Biome (replaces ESLint + Prettier)
- **Config**: `biome.json` with strict rules
- **Style**: 2-space indentation, double quotes for JavaScript/TypeScript
- **Auto-fix**: Use `npm run biome:check:write` to format code automatically
- **Pre-commit**: Lefthook runs Biome checks before commits

## TypeScript
- **Strict mode**: Enabled with comprehensive type checking
- **Path aliases**: `@/*` maps to project root for clean imports
- **Type generation**: Auto-generated from Supabase schema via `npm run types`
- **Type safety**: All database interactions are type-safe

## Component Architecture
- **Base**: Radix UI components for accessibility
- **Pattern**: Follow shadcn/ui patterns for component structure
- **Location**: Base UI components in `/components/ui/`
- **Styling**: Tailwind CSS with component variants using `class-variance-authority`
- **Documentation**: Storybook for component development and testing

## File Naming & Structure
- **Components**: PascalCase for component files (e.g., `UserProfile.tsx`)
- **Pages**: kebab-case for page files following Next.js App Router conventions
- **Tests**: `{component}.test.(ts|tsx)` alongside the component
- **Stories**: `{component}.stories.tsx` in `/stories/` directory

## Database & API
- **RLS**: All tables must have Row Level Security policies with corresponding tests
- **Migrations**: Use `supabase migration new {name}` for schema changes
- **Type sync**: Always run `npm run types` after schema changes
- **Testing**: RLS tests in `/tests/rls/` are mandatory for new tables

## Edge Runtime
- **Requirement**: All routes must export `export const runtime = "edge";` for Cloudflare Pages
- **Compatibility**: Code must be compatible with Cloudflare Workers environment

## Git & Branching
- **Main branch**: `develop` (default for PRs)
- **Feature branches**: `feat/feature-name` from `develop`
- **Integration**: `develop` → `main` for production releases
- **Commits**: Use conventional commits, Lefthook enforces quality