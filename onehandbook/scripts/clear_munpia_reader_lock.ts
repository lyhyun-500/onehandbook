/**
 * 강제 종료 등으로 `munpia-reader` 락이 남았을 때 제거합니다.
 * 실행: npm run munpia:unlock  (onehandbook 디렉터리에서)
 */
import { unlink } from "fs/promises";
import { join } from "path";

const LOCK_PATH = join(
  process.cwd(),
  "data",
  "trends",
  "locks",
  "munpia-reader.lock.json"
);

async function main(): Promise<void> {
  try {
    await unlink(LOCK_PATH);
    console.info("[munpia:unlock] 제거됨:", LOCK_PATH);
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      console.info("[munpia:unlock] 락 파일 없음:", LOCK_PATH);
      return;
    }
    throw e;
  }
}

main().catch((e) => {
  console.error("[munpia:unlock] 실패:", e);
  process.exit(1);
});
