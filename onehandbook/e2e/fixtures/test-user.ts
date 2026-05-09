import { test as base, type Browser, type Page } from '@playwright/test';
import { ensureStorageState, getTestEmail, type TestRole } from './auth';

type SeededUser = {
  page: Page;
  email: string;
  role: TestRole;
};

type Fixtures = {
  writer: SeededUser;
  admin: SeededUser;
};

async function provideUser(
  role: TestRole,
  browser: Browser,
  use: (value: SeededUser) => Promise<void>,
): Promise<void> {
  const path = await ensureStorageState(role);
  const context = await browser.newContext({ storageState: path });
  const page = await context.newPage();
  try {
    await use({ page, email: getTestEmail(role), role });
  } finally {
    await context.close();
  }
}

export const test = base.extend<Fixtures>({
  writer: async ({ browser }, use) => {
    await provideUser('writer', browser, use);
  },
  admin: async ({ browser }, use) => {
    await provideUser('admin', browser, use);
  },
});

export { expect } from '@playwright/test';
