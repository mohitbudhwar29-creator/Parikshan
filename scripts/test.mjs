// Runs the automated tests with Node's built-in test runner (no extra test framework).
// Deletes the throwaway test database first so every run starts from the same state.
import { rmSync } from "node:fs";
import { spawnSync } from "node:child_process";

rmSync("storage/test", { recursive: true, force: true });
const result = spawnSync(
  process.execPath,
  ["--import", "tsx", "--test", "--test-concurrency=1", "tests/**/*.test.ts"],
  { stdio: "inherit" },
);
process.exit(result.status ?? 1);
