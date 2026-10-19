// Must be imported first by every test file. It points the app at a throwaway SQLite database
// and a throwaway upload folder, so tests never touch the demo database or real uploads.
import { mkdirSync } from "node:fs";

process.env.DATABASE_URL = "file:./storage/test/voice-tests.db";
process.env.UPLOAD_DIR = "./storage/test/uploads";
process.env.SESSION_SECRET = "test-session-secret-0123456789abcdef";
(process.env as Record<string, string>).NODE_ENV = "test";
delete process.env.OPENAI_API_KEY;
process.env.VOICE_STT_PROVIDER = "browser";
process.env.VOICE_TTS_PROVIDER = "browser";
process.env.AI_PROVIDER = "mock";
process.env.VOICE_RATE_LIMIT_PER_MINUTE = "500";
mkdirSync("storage/test/uploads", { recursive: true });
