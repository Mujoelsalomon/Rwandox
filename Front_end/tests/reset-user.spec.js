const { test, expect } = require('@playwright/test');

test('admin can edit fields while resetting a user and see temporary password', async ({ page }) => {
  // Assumes dev server running and admin user already authenticated for e2e testing.
  // Set base URL in playwright.config or use E2E_BASE_URL env variable.

  await page.goto('/');
  // Navigate to System Administration -> User access
  await page.click('text=Model Administration');
  await page.click('text=User access');

  // Wait for users table
  await page.waitForSelector('table');

  // Click the first Edit button to enable controls
  await page.click('button[aria-label^="Edit"]');

  // Find first user Reset button and click
  const resetButton = await page.locator('button:has-text("Reset")').first();
  await resetButton.click();

  // Fill temporary password and change name
  await page.fill('input[placeholder="Full name"]', 'E2E Test User');
  await page.fill('input[placeholder="Optional username"]', 'e2e-test-user');
  await page.fill('input[placeholder="name@hospital.org"]', 'e2e-user@example.com');
  await page.fill('input[placeholder="Blank auto-generates"]', 'TempPass!234');

  // Submit reset
  await page.click('button:has-text("Reset")');

  // Expect temporary password panel to appear
  await expect(page.locator('text=Temporary password for')).toBeVisible();
});
