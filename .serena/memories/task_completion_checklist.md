# Task Completion Checklist

## Before Committing Code

### 1. Code Quality Checks
- **ALWAYS** run `npm run biome:check:write` to format and lint code
- Ensure no TypeScript errors: `npx tsc --noEmit`
- Fix all Biome warnings and errors

### 2. Type Safety
- If database schema changed: Run `npm run types` to regenerate types
- Verify all imports and type references are correct
- Check that path aliases (`@/*`) resolve properly

### 3. Testing Requirements
- **Unit tests**: Run `npm run test:unit` - ensure existing tests pass
- **RLS tests**: Run `npm run test:rls` if database changes were made
- **E2E tests**: Run `npm run test:e2e` for critical user flows
- **New features**: Add appropriate tests for new functionality

### 4. Database Changes
- New tables MUST have RLS policies and tests
- Run `supabase migration up` to verify migrations work
- Update seed data if necessary
- Test RLS policies with different user roles

### 5. Component Changes
- Update Storybook stories if UI components were modified
- Ensure components follow Radix UI + Tailwind patterns
- Test accessibility and responsive design

### 6. Edge Runtime Compatibility
- Ensure all new routes have `export const runtime = "edge";`
- Test compatibility with Cloudflare Pages environment
- Verify no Node.js-specific APIs are used in edge routes

### 7. Build Verification
- Run `npm run build` to ensure production build succeeds
- Check for any build warnings or errors
- Test critical functionality in production build

## Pre-Commit Automation
- Lefthook automatically runs Biome checks
- Fix any issues before committing
- Pre-commit hooks will prevent commits with code quality issues

## Documentation Updates
- Update component documentation if UI changes were made
- Update API documentation if new endpoints were added
- Ensure README or other docs reflect changes if necessary