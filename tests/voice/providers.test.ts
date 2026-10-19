import "../helpers/env";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { transcribeWithOpenAI, synthesizeWithOpenAI, MAX_SPOKEN_CHARACTERS } from "@/lib/voice/providers/openai";
import { VoiceProviderError } from "@/lib/voice/types";

const audio = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3]);

describe("OpenAI speech adapter", () => {
  test("transcription sends the audio with the chosen model and language and returns the text", async () => {
    let seen: { url: string; init: RequestInit } | null = null;
    const text = await transcribeWithOpenAI({
      audio,
      format: "webm",
      locale: "en",
      apiKey: "sk-test",
      model: "whisper-1",
      fetchImpl: async (url, init) => {
        seen = { url, init };
        return Response.json({ text: "hello" });
      },
    });
    assert.equal(text, "hello");
    assert.equal(seen!.url, "https://api.openai.com/v1/audio/transcriptions");
    assert.equal((seen!.init.body as FormData).get("language"), "en");
  });

  test("a response without text is an invalid response, not an empty transcript", async () => {
    await assert.rejects(
      transcribeWithOpenAI({ audio, format: "webm", locale: "en", apiKey: "k", model: "m", fetchImpl: async () => Response.json({ other: 1 }) }),
      (error: unknown) => error instanceof VoiceProviderError && error.code === "invalid_response",
    );
  });

  test("a non-JSON success body is an invalid response", async () => {
    await assert.rejects(
      transcribeWithOpenAI({ audio, format: "webm", locale: "en", apiKey: "k", model: "m", fetchImpl: async () => new Response("<html>") }),
      (error: unknown) => error instanceof VoiceProviderError && error.code === "invalid_response",
    );
  });

  test("an HTTP error keeps the status but not the upstream message", async () => {
    try {
      await transcribeWithOpenAI({
        audio,
        format: "webm",
        locale: "en",
        apiKey: "sk-secret",
        model: "m",
        fetchImpl: async () => new Response("secret detail", { status: 401 }),
      });
      assert.fail("should have thrown");
    } catch (error) {
      assert.ok(error instanceof VoiceProviderError);
      assert.equal(error.code, "provider");
      assert.equal(error.status, 401);
      assert.ok(!error.message.includes("sk-secret") && !error.message.includes("secret detail"));
    }
  });

  test("an abort is reported as a timeout", async () => {
    await assert.rejects(
      transcribeWithOpenAI({
        audio,
        format: "webm",
        locale: "en",
        apiKey: "k",
        model: "m",
        timeoutMs: 5,
        fetchImpl: (_url, init) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => {
              const error = new Error("aborted");
              error.name = "AbortError";
              reject(error);
            });
          }),
      }),
      (error: unknown) => error instanceof VoiceProviderError && error.code === "timeout",
    );
  });

  test("speech synthesis refuses text over the limit before calling the provider", async () => {
    let called = false;
    await assert.rejects(
      synthesizeWithOpenAI({
        text: "a".repeat(MAX_SPOKEN_CHARACTERS + 1),
        apiKey: "k",
        model: "tts-1",
        voice: "alloy",
        fetchImpl: async () => {
          called = true;
          return new Response(new Uint8Array(1));
        },
      }),
      (error: unknown) => error instanceof VoiceProviderError && error.code === "invalid_response",
    );
    assert.equal(called, false);
  });

  test("speech synthesis sends the voice and model and returns the audio bytes", async () => {
    let body: Record<string, unknown> | null = null;
    const bytes = await synthesizeWithOpenAI({
      text: "Hemoglobin was 11.0 g/dL.",
      apiKey: "k",
      model: "tts-1",
      voice: "alloy",
      fetchImpl: async (_url, init) => {
        body = JSON.parse(String(init.body));
        return new Response(new Uint8Array([9, 8, 7]));
      },
    });
    assert.equal(new Uint8Array(bytes)[0], 9);
    assert.equal(body!.model, "tts-1");
    assert.equal(body!.voice, "alloy");
    assert.equal(body!.response_format, "mp3");
  });
});
