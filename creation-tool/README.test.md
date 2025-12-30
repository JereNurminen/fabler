# Testing Setup

This project uses Playwright for end-to-end testing with a special setup that allows testing the Tauri application.

## Architecture

### Test Mode Components

1. **HTTP Test Server** (`src-tauri/src/test_server.rs`)
   - Exposes all Tauri commands as HTTP endpoints on port 3001
   - Uses Axum web framework with CORS enabled
   - Wraps the same database logic used by Tauri commands

2. **Frontend API Layer** (`src/api.ts`, `src/api-http.ts`)
   - Automatically switches between Tauri IPC and HTTP based on `VITE_USE_HTTP_API` env var
   - Maintains identical API interface for both modes
   - HTTP implementation uses fetch with JSON

3. **Playwright Configuration** (`playwright.config.ts`)
   - Configured to start Vite dev server with `VITE_USE_HTTP_API=true`
   - Runs tests against the web frontend which calls HTTP endpoints
   - Single worker to avoid database conflicts

## Running Tests

### Prerequisites

```bash
# Install Playwright browsers (first time only)
npx playwright install
```

### Run Tests

```bash
# Run all tests (headless)
npm run test:e2e

# Run with UI mode (interactive)
npm run test:e2e:ui

# Run in headed mode (see browser)
npm run test:e2e:headed
```

### How It Works

1. Script builds Tauri app with `--features test-server`
2. Starts Tauri app in background (runs both GUI and HTTP server on port 3001)
3. Waits for HTTP server to be ready
4. Runs Playwright tests against Vite dev server (port 1420)
5. Frontend uses HTTP API to communicate with test server
6. Cleans up by killing Tauri app

## Writing Tests

Tests are in `e2e/*.spec.ts`. Example:

```typescript
import { test, expect } from '@playwright/test';

test('should create a story', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: /new story/i }).click();
  await page.getByPlaceholder(/title/i).fill('My Story');
  await page.getByRole('button', { name: /create/i }).click();

  await expect(page).toHaveURL(/\/story\/\d+/);
});
```

## API Endpoints

The test server exposes these endpoints:

**Stories**
- `GET /api/stories` - List all stories
- `POST /api/stories` - Create story
- `GET /api/stories/:id` - Get story details
- `DELETE /api/stories/:id` - Delete story
- `POST /api/stories/patch` - Update story

**Pages**
- `GET /api/pages/:id` - Get page
- `POST /api/pages` - Create page
- `POST /api/pages/patch` - Update page

**Choices**
- `POST /api/choices` - Create choice
- `POST /api/choices/delete` - Delete choice
- `POST /api/choices/patch` - Update choice

**Flags**
- `GET /api/stories/:story_id/flags` - Get story flags
- `POST /api/flags` - Create flag
- `POST /api/flags/patch` - Update flag
- `DELETE /api/flags/:id` - Delete flag
- `POST /api/flags/operation` - Set flag operation
- `POST /api/flags/operation/remove` - Remove flag operation
- `POST /api/flags/condition` - Set choice condition
- `POST /api/flags/condition/remove` - Remove choice condition

## Troubleshooting

**Tests fail immediately**
- Check if port 3001 is already in use: `lsof -i :3001`
- Ensure Rust toolchain is installed: `rustc --version`

**Tests timeout**
- Increase timeout in `test-with-backend.sh` (default 30s)
- Check Tauri app logs for errors

**Database issues**
- Each test run uses a fresh database
- Tests run sequentially (workers: 1) to avoid conflicts

**Frontend can't connect**
- Verify test server started: `curl http://localhost:3001/api/stories`
- Check browser console for CORS errors
- Ensure `VITE_USE_HTTP_API=true` is set
