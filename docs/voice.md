# Voice assistant

The AI Health Assistant can take spoken questions and read answers aloud. It answers only from the
**signed-in user's active profile**: the saved records of that profile, nothing else. Typed questions take
exactly the same path, and the text box is always available.

## What it does

- **Ask by voice:** press the microphone button. The browser asks for microphone access only after that click.
  A first-time notice explains where the audio goes; accepting it is part of the same click.
- **Transcript:** the browser's live transcript is shown while you speak. The final question appears as your message.
- **Answers:** every answer lists its sources (report name, date, test, value, unit, printed reference range).
  Missing, ambiguous, or low-confidence data is stated as a limitation. Values are never rounded or converted.
- **Listen:** answers are never read aloud automatically. Press *Listen to answer*, then *Replay* or *Stop speaking*.
- **Controls:** stop speaking, interrupt and ask again, replay, mute (remembered in this browser), and switch
  between voice and text (*Type instead*).
- **Languages:** English and Hindi, following the app's language setting. Hindi speech needs a Hindi voice on
  the device (browser mode). If there is none, the answer is shown as text and the app says so.

## Safety rules (enforced on the server)

| Situation | Behaviour |
|---|---|
| Emergency wording (chest pain, breathing trouble, overdose, etc.) | No records lookup. Shows the emergency instruction to call 112 or go to an emergency department. |
| Asking to change, delete, share, export, confirm, or take a dose | Refused. Voice never performs these; the user must use the page's own button, which asks for confirmation. |
| Instructions inside a question that try to override the rules, or ask for other people's records | Refused before any records lookup. |
| Asking about a family member by name | Answered only from the active profile. Other profiles are never searched. |
| Answer contains a number that is not in the profile's data | Replaced with "couldn't check that answer against your records". The number is not shown. |
| Answer cites a record outside the active profile | Dropped. The answer is not treated as grounded. |
| Medical questions | Answers explain the records only. No diagnosis, no dosing or stopping advice. Every answer carries the disclaimer. |

Transcripts and report text are treated as untrusted data. The AI provider receives the question and the
profile's structured records; it is not asked to follow any instruction found inside them.

## Authorization

- `POST /api/voice/ask`, `/api/voice/transcribe`, and `/api/voice/speak` require a valid signed session
  (`phc_session`) for a user who still exists. Otherwise they return 401.
- The profile is chosen on the server. An explicit `profileId` must belong to the signed-in user; otherwise the
  response is "not found", the same as for a profile that does not exist. Without one, the active profile is
  resolved from the `phc_profile` cookie with the same ownership rules as the rest of the app. The browser cannot
  name another user's profile, and extra fields in the request body are ignored.
- Spoken answers are read by `/api/voice/speak` only if the request carries a token the server issued for that
  exact answer text, to that user, in the last 15 minutes. The server appends the spoken disclaimer itself.

## Providers

| Setting | Speech to text | Text to speech | Credentials |
|---|---|---|---|
| `browser` (default) | Web Speech API in the browser (Chrome and Edge send audio to their speech service; Safari and Firefox differ) | `speechSynthesis` with a voice for the language | None |
| `openai` | Server sends the clip to the OpenAI transcription API | Server requests MP3 audio from the OpenAI speech API | `OPENAI_API_KEY` on the server |
| `off` | Not available; text only | Not available; text only | None |

The provider is chosen by configuration (`lib/voice/config.ts`), and the browser only receives the resolved mode.
Adding a vendor means a new adapter in `lib/voice/providers/` and a branch in `getVoiceConfig()`.

Server speech to text is attempted only when `VOICE_STT_PROVIDER=openai` and a key is set. Answer text is
synthesized by the provider's voice model; quality for Hindi depends on the model and is not verified by this app.

## Audio, transcripts, and retention

- **Raw audio is not stored by default.** Server speech to text holds the recording in memory for one provider
  call, then discards it. Nothing is written to disk or to the database. The route tests check that no file is
  created and no record is added.
- **Browser mode:** the browser handles the audio, not this app. Its provider's policy applies (for example, Chrome
  may send audio to Google). The consent notice says so.
- **Transcripts are not persisted.** A question is kept in the page while the tab is open, along with the answer,
  and is cleared by *Clear*, reloading, or leaving the page. Questions are sent to the answer endpoint like any
  typed question; they are not saved as records.
- **Speech output is not stored.** Audio for an answer is held in the browser's memory while it plays and then
  released. The server does not keep it.
- **Consent** is stored as `phc_voice_consent=1` in this browser's local storage. Clearing site data withdraws it.
- **Mute** is stored as `phc_voice_muted` in local storage.
- **Deletion:** voice stores no records of its own, so deleting a profile or account deletes everything voice
  could show. Clearing the browser's site data removes the consent and mute settings and any open transcript.
- **Logs:** voice errors are logged with a short message only. Questions, transcripts, answers, audio, keys,
  and provider error bodies are not logged.

If a future version stores audio or transcripts (for example, for quality review), it must first add a consent
step, a retention period, and a deletion path to this document. That is not implemented.

## Limits and known gaps

- **Rate limit is in memory, per server process.** It does not hold across multiple instances or restarts. A shared
  store (for example Redis) is needed before running several instances.
- **Grounding check is a heuristic.** It checks that each number in an answer appears in the profile's data and
  that each cited record belongs to the profile. It does not check each claim against its source sentence.
  Small integers (0 to 20) are allowed because they can match labels or counts. Treat voice answers as reading aids.
- **Recording limit:** 30 seconds per question in server mode; in browser mode, a question ends when the browser
  detects a pause.
- **Maximum audio:** `VOICE_MAX_AUDIO_BYTES`, default 5 MB, capped at 20 MB. Accepted formats are WebM, Ogg, MP4,
  WAV, and MP3, detected from the file's own signature.
- **Browser support:** speech recognition is not available in Firefox. Those users can still type, and the app says so.
- **No clinician review.** Every answer is AI-generated from saved records and is not checked or verified by a clinician.
- **Demo data is fictional.** The demo ABHA identifier is a demo value. Voice does not connect to ABDM or ABHA.
