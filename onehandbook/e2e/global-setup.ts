import type { FullConfig } from '@playwright/test';
import { ensureStorageState } from './fixtures/auth';

// Provision both roles serially before any test runs.
// Without this, 4 parallel workers race on cold-compile + storageState write;
// each worker independently follows a magic link, multiplying setup cost.
async function globalSetup(_config: FullConfig): Promise<void> {
  await ensureStorageState('writer');
  await ensureStorageState('admin');
}

export default globalSetup;
