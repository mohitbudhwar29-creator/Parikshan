import "../helpers/env";
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/database/prisma";
import { answerFromRecords } from "@/lib/voice/answer";
import { checkNumericGrounding } from "@/lib/voice/grounding";
import { buildHealthContext } from "@/lib/health/context";
import { createOtherAccount, cleanupOtherAccounts, demoUserAndSelfProfile, ensureTestDatabase } from "../helpers/db";
import { translate } from "@/lib/i18n";
import type { HealthContext } from "@/lib/ai/types";
import type { HealthAIProvider } from "@/lib/ai/types";

let profile: { id: string; name: string; relationship: string };
let userId: string;
const created: string[] = [];

before(async () => {
  await ensureTestDatabase();
  const demo = await demoUserAndSelfProfile();
  userId = demo.user.id;
  profile = demo.profile;
});

after(async () => {
  await cleanupOtherAccounts(created);
  await prisma.$disconnect();
});

describe("answers match the stored record", () => {
  test("a hemoglobin question is answered from the latest saved lab row, with its date, unit and citation", async () => {
    const latest = await prisma.labResult.findFirstOrThrow({
      where: { metricName: "hemoglobin", record: { profileId: profile.id, status: "SAVED" } },
      orderBy: { date: "desc" },
      include: { record: true },
    });
    const answer = await answerFromRecords({ userId, profile, question: "What was my hemoglobin last time?", locale: "en" });

    assert.equal(answer.found, true);
    assert.equal(answer.grounded, true);
    assert.equal(answer.blocked, null);
    assert.ok(answer.answer.includes(latest.value), `answer should contain the stored value ${latest.value}`);
    assert.ok(answer.answer.includes(latest.unit ?? "??"), "answer should contain the stored unit");

    const citation = answer.citations.find((item) => item.recordId === latest.healthRecordId && item.testName === latest.testName);
    assert.ok(citation, "a citation should point at the record that holds the lab row");
    assert.equal(citation.value, latest.value);
    assert.equal(citation.unit, latest.unit);
    assert.equal(citation.reportDate, latest.record.recordDate.toISOString().slice(0, 10));
    assert.equal(citation.reportTitle, latest.record.title);
  });

  test("a Hindi question is answered in Hindi from the same records", async () => {
    const answer = await answerFromRecords({ userId, profile, question: "मेरी हीमोग्लोबिन कितनी है?", locale: "hi" });
    assert.equal(answer.found, true);
    assert.ok(answer.citations.length > 0);
    assert.ok(answer.answer.includes("g/dL"));
  });

  test("the history line cites every reading it lists, so no value is uncited", async () => {
    const answer = await answerFromRecords({ userId, profile, question: "How has my hemoglobin changed since my first report?", locale: "en" });
    assert.equal(answer.found, true);
    const readingCount = await prisma.labResult.count({ where: { metricName: "hemoglobin", record: { profileId: profile.id, status: "SAVED" } } });
    const citedRecords = new Set(answer.citations.map((item) => item.recordId));
    assert.ok(citedRecords.size >= Math.min(readingCount, 3), "every listed reading should have a citation");
  });
});

describe("missing, ambiguous or unsupported data is explicit", () => {
  test("a question about something not in the records says so and cites nothing", async () => {
    const answer = await answerFromRecords({ userId, profile, question: "What is my vitamin B12 level?", locale: "en" });
    assert.equal(answer.found, false);
    assert.equal(answer.grounded, false);
    assert.deepEqual(answer.citations, []);
    assert.ok(answer.limitations.includes("voice.limit.missing"));
    assert.ok(answer.answer.startsWith(translate("en", "ai.notFound")));
  });

  test("a vague pronoun question with no earlier turn is reported as ambiguous", async () => {
    const answer = await answerFromRecords({ userId, profile, question: "What does that mean?", locale: "en" });
    assert.ok(answer.limitations.includes("voice.limit.ambiguous"), "the user must be told the question was unclear");
  });

  test("a follow-up is answered using the previous question's subject", async () => {
    const answer = await answerFromRecords({
      userId,
      profile,
      question: "and what about that one?",
      locale: "en",
      history: [{ question: "What was my hemoglobin last time?" }],
    });
    assert.equal(answer.found, true);
    assert.ok(answer.citations.some((item) => item.testName !== null));
  });

  test("a limitation is returned when a cited value has no printed reference range", async () => {
    const owner = await createOtherAccount("norange");
    created.push(owner.user.id);
    await prisma.labResult.updateMany({ where: { healthRecordId: owner.record.id }, data: { referenceRange: null, flag: "UNKNOWN" } });
    const answer = await answerFromRecords({ userId: owner.user.id, profile: owner.profile, question: "What was my hemoglobin?", locale: "en" });
    assert.equal(answer.found, true);
    assert.ok(answer.limitations.includes("voice.limit.noRange"));
    assert.ok(!answer.answer.toLowerCase().includes("normal range"), "must not claim the value is normal");
  });

  test("a report with extraction warnings is flagged as low confidence", async () => {
    const owner = await createOtherAccount("warned");
    created.push(owner.user.id);
    await prisma.healthRecord.update({
      where: { id: owner.record.id },
      data: { extractedJson: JSON.stringify({ warnings: ["Haemoglobin line was unclear."] }) },
    });
    const answer = await answerFromRecords({ userId: owner.user.id, profile: owner.profile, question: "What was my hemoglobin?", locale: "en" });
    assert.ok(answer.limitations.includes("voice.limit.lowConfidence"));
  });

  test("a new account with no saved records gets the no-records message, not an invented answer", async () => {
    const empty = await prisma.user.create({ data: { email: `empty-${Date.now()}@example.test`, name: "Empty" } });
    created.push(empty.id);
    const emptyProfile = await prisma.healthProfile.create({ data: { userId: empty.id, name: "Empty", relationship: "SELF" } });
    const answer = await answerFromRecords({ userId: empty.id, profile: emptyProfile, question: "What was my hemoglobin?", locale: "en" });
    assert.equal(answer.found, false);
    assert.deepEqual(answer.citations, []);
  });
});

describe("grounding guard rejects invented numbers and foreign sources", () => {
  const invented: Pick<HealthAIProvider, "name" | "answerQuestion"> = {
    name: "fake-invented",
    async answerQuestion({ context }) {
      const source = context.records[0];
      return {
        answer: "Hemoglobin was 9.9 g/dL on the report.",
        found: true,
        sources: source ? [{ recordId: source.id, label: source.title }] : [],
      };
    },
  };

  test("an answer with a number that is not in the profile's data is replaced by a limitation", async () => {
    const answer = await answerFromRecords({ userId, profile, question: "What was my hemoglobin?", locale: "en", provider: invented });
    assert.equal(answer.found, false);
    assert.equal(answer.grounded, false);
    assert.deepEqual(answer.citations, []);
    assert.ok(!answer.answer.includes("9.9"), "the invented value must not reach the user");
    assert.equal(answer.answer, translate("en", "voice.groundingFailed"));
  });

  test("a source that belongs to another profile is dropped, so the answer is not grounded", async () => {
    const owner = await createOtherAccount("foreign");
    created.push(owner.user.id);
    const foreign: Pick<HealthAIProvider, "name" | "answerQuestion"> = {
      name: "fake-foreign",
      async answerQuestion() {
        return { answer: "Hemoglobin was 7.1 g/dL.", found: true, sources: [{ recordId: owner.record.id, label: "Other" }] };
      },
    };
    const answer = await answerFromRecords({ userId, profile, question: "What was my hemoglobin?", locale: "en", provider: foreign });
    assert.equal(answer.found, false);
    assert.ok(!answer.answer.includes("7.1"), "a value from another profile must never be returned");
    assert.deepEqual(answer.citations, []);
  });

  test("the numeric check accepts values that exist in the data and flags the rest", async () => {
    const context: HealthContext = await buildHealthContext(profile);
    assert.equal(checkNumericGrounding("Hemoglobin was 11.0 g/dL on 12 Sept 2026.", context).ok, true);
    const bad = checkNumericGrounding("Hemoglobin was 42.5 g/dL.", context);
    assert.equal(bad.ok, false);
    assert.deepEqual(bad.unsupported, ["42.5"]);
  });

  test("provider timeouts surface as a timeout error rather than a partial answer", async () => {
    const slow: Pick<HealthAIProvider, "name" | "answerQuestion"> = {
      name: "fake-slow",
      answerQuestion: () => new Promise((resolve) => setTimeout(() => resolve({ answer: "late", found: true, sources: [] }), 200)),
    };
    await assert.rejects(
      answerFromRecords({ userId, profile, question: "What was my hemoglobin?", locale: "en", provider: slow, timeoutMs: 20 }),
      (error: unknown) => error instanceof Error && error.name === "VoiceProviderError" && (error as { code?: string }).code === "timeout",
    );
  });
});

describe("refusals never reach the records or the provider", () => {
  test("emergency wording returns the emergency message with no citations and no provider call", async () => {
    let called = false;
    const spy: Pick<HealthAIProvider, "name" | "answerQuestion"> = {
      name: "spy",
      async answerQuestion() {
        called = true;
        return { answer: "", found: false, sources: [] };
      },
    };
    const answer = await answerFromRecords({ userId, profile, question: "I have chest pain", locale: "en", provider: spy });
    assert.equal(answer.blocked, "emergency");
    assert.ok(answer.answer.includes("112"));
    assert.equal(called, false);
  });

  test("a request to change a record is refused and the database is unchanged", async () => {
    const before = await prisma.healthRecord.count({ where: { profileId: profile.id } });
    const answer = await answerFromRecords({ userId, profile, question: "Delete my blood report from September", locale: "en" });
    assert.equal(answer.blocked, "action");
    assert.equal(answer.answer, translate("en", "voice.actionBlocked"));
    assert.equal(await prisma.healthRecord.count({ where: { profileId: profile.id } }), before);
  });

  test("a dosage decision is answered with the safe refusal, not a recommendation", async () => {
    const answer = await answerFromRecords({ userId, profile, question: "Should I stop taking amoxicillin?", locale: "en" });
    assert.equal(answer.found, false);
    assert.ok(!/take .* instead|you should stop/i.test(answer.answer));
  });
});
