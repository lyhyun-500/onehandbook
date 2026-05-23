import { test as base, type Browser, type Page } from '@playwright/test';
import { ensureStorageState, type TestRole } from './auth';

type WriterUser = {
  page: Page;
  role: 'writer';
  email: string;
  userId: number;
  authUserId: string;
  seededWorkId: number;
};

type AdminUser = {
  page: Page;
  role: 'admin';
  email: string;
  userId: number;
  authUserId: string;
};

type EmptyUser = {
  page: Page;
  role: 'empty';
  email: string;
  userId: number;
  authUserId: string;
};

type Fixtures = {
  writer: WriterUser;
  admin: AdminUser;
  empty: EmptyUser;
};

async function provideUser<T extends WriterUser | AdminUser | EmptyUser>(
  role: TestRole,
  browser: Browser,
  use: (value: T) => Promise<void>,
  build: (page: Page, meta: Awaited<ReturnType<typeof ensureStorageState>>['meta']) => T,
): Promise<void> {
  const { storageStatePath, meta } = await ensureStorageState(role);
  const context = await browser.newContext({ storageState: storageStatePath });
  const page = await context.newPage();
  try {
    await use(build(page, meta));
  } finally {
    await context.close();
  }
}

export const test = base.extend<Fixtures>({
  writer: async ({ browser }, use) => {
    await provideUser<WriterUser>('writer', browser, use, (page, meta) => {
      if (meta.seededWorkId === undefined) {
        throw new Error('writer fixture meta missing seededWorkId');
      }
      return {
        page,
        role: 'writer',
        email: meta.email,
        userId: meta.userId,
        authUserId: meta.authUserId,
        seededWorkId: meta.seededWorkId,
      };
    });
  },
  admin: async ({ browser }, use) => {
    await provideUser<AdminUser>('admin', browser, use, (page, meta) => ({
      page,
      role: 'admin',
      email: meta.email,
      userId: meta.userId,
      authUserId: meta.authUserId,
    }));
  },
  empty: async ({ browser }, use) => {
    await provideUser<EmptyUser>('empty', browser, use, (page, meta) => ({
      page,
      role: 'empty',
      email: meta.email,
      userId: meta.userId,
      authUserId: meta.authUserId,
    }));
  },
});

export { expect } from '@playwright/test';
