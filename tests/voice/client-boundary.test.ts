import "../helpers/env";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { pickVoice, pickRecorderMime, recognitionLanguage, speechLanguage } from "@/lib/voice/browser-speech";

const ROOT = process.cwd();

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(path.join(ROOT, dir))) {
    const full = path.join(ROOT, dir, entry);
    if (statSync(full).isDirectory()) out.push(...filesUnder(path.join(dir, entry)));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(path.join(dir, entry));
  }
  return out;
}

/** Files that run in the browser: anything marked "use client" plus the modules they import. */
function clientFiles(): string[] {
  const candidates = [...filesUnder("components"), ...filesUnder("app"), ...filesUnder("lib/voice"), ...filesUnder("lib/i18n")];
  return candidates.filter((file) => readFileSync(path.join(ROOT, file), "utf8").includes('"use client"') || file.startsWith("components/") || file.startsWith("lib/voice/browser-speech") || file.startsWith("lib/voice/client-state") || file.startsWith("lib/i18n"));
}

describe("nothing secret or server-only reaches the browser bundle", () => {
  test("no client file reads a provider key or a non-public environment variable", () => {
    for (const file of clientFiles()) {
      const source = readFileSync(path.join(ROOT, file), "utf8");
      assert.ok(!/OPENAI_API_KEY|sk-[A-Za-z0-9]/.test(source), `${file} must not mention the provider key`);
      const envReads = [...source.matchAll(/process\.env\.([A-Z_]+)/g)].map((match) => match[1] ?? "");
      const nonPublic = envReads.filter((name) => !name.startsWith("NEXT_PUBLIC_") && name !== "NODE_ENV");
      assert.deepEqual(nonPublic, [], `${file} reads server-only environment variables`);
    }
  });

  test("client components import the server voice providers and config only as types", () => {
    for (const file of [...filesUnder("components/voice"), ...filesUnder("components/assistant"), "app/(app)/assistant/page.tsx"]) {
      const source = readFileSync(path.join(ROOT, file), "utf8");
      const imports = source.split("\n").filter((line) => /from "@\/lib\/voice\/(providers|config|speech-token|rate-limit|auth|answer|grounding)"/.test(line));
      for (const line of imports) {
        const isPage = file.startsWith("app/");
        assert.ok(isPage || line.startsWith("import type"), `${file}: ${line.trim()}`);
      }
    }
  });

  test("the browser never receives the speech token secret or the raw SESSION_SECRET", () => {
    for (const file of clientFiles()) {
      const source = readFileSync(path.join(ROOT, file), "utf8");
      assert.ok(!source.includes("SESSION_SECRET"), file);
    }
  });
});

describe("browser voice selection", () => {
  const voices = [
    { name: "Google US", lang: "en-US" },
    { name: "Google हिन्दी", lang: "hi-IN" },
    { name: "Aditi", lang: "en_IN" },
    { name: "UK", lang: "en-GB" },
  ];

  test("English prefers an Indian English voice, then British, then any English", () => {
    assert.equal(pickVoice(voices, "en")?.name, "Aditi");
    assert.equal(pickVoice(voices.filter((v) => v.name !== "Aditi"), "en")?.name, "UK");
    assert.equal(pickVoice([{ name: "US", lang: "en-US" }], "en")?.name, "US");
  });

  test("Hindi only accepts a Hindi voice, so Devanagari is never read by an English voice", () => {
    assert.equal(pickVoice(voices, "hi")?.name, "Google हिन्दी");
    assert.equal(pickVoice([{ name: "US", lang: "en-US" }], "hi"), null);
  });

  test("recognition and synthesis use the matching language tags", () => {
    assert.equal(recognitionLanguage("hi"), "hi-IN");
    assert.equal(recognitionLanguage("en"), "en-IN");
    assert.equal(speechLanguage("hi"), "hi-IN");
  });

  test("the recorder picks the first supported container", () => {
    assert.equal(pickRecorderMime((type) => type === "audio/mp4"), "audio/mp4");
    assert.equal(pickRecorderMime(() => false), null);
    assert.equal(pickRecorderMime(() => true), "audio/webm;codecs=opus");
  });
});
