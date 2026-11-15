# CineMind Editor: reliability-first product plan

## Product truth

CineMind is not ready to advertise itself as a replacement for Adobe Premiere Pro or DaVinci Resolve. The codebase has a working foundation—projects, a frame-based timeline engine, browser media import, a local FFmpeg export path, an AI proposal flow, and an API for persistence—but those parts have not yet been proven together in a real browser session. Feature labels and a premium interface do not establish reliability or professional parity.

The near-term goal is a dependable editor for creators making social videos, interviews, music edits, and short films. Advanced color, audio, effects, and desktop workflows should follow only when the underlying edit/render contract is correct.

## Audit snapshot

Verified from the current frontend repository:

- The web production build compiles and TypeScript passes.
- The timeline-engine unit suite passes: 10 tests, 0 failures.
- Timeline edits are frame based, validated, undoable, and sent to the API for saved projects.
- Web export runs FFmpeg WebAssembly on the user's computer. Projects using server media fetch the required source file for local rendering.
- Media can be stored on the device or, when the project API reports server mode, on the CineMind Hetzner Volume.
- The preview used to show only the highest active video track, while export composites every visible video track. It also used `scaleX` but ignored `scaleY`. The current local change fixes both mismatches; it has not yet been published to the website.
- Storage status errors used to fall back silently to device mode. This could make an upload go to a different location than the user expected. The current local change stops that silent fallback and reports that the storage location could not be verified; it has not yet been published to the website.
- Transition types are presented separately in the UI, but the render graph currently routes all of them through the same alpha fade behavior. A cross dissolve and a dip-to-black are therefore not yet distinct professional transitions.
- The current tests exercise the timeline engine. They do not exercise browser media decode, multi-track preview, API persistence, FFmpeg WebAssembly export, downloads, or a complete import-to-export session.
- The web app still contains disabled or incomplete workspaces such as Generate, Motion, Graphics, and Plugins. They must not be marketed as working features.

## Release gates

Every editing capability follows this contract:

1. The control changes a validated timeline document.
2. Undo and redo restore the prior state.
3. The preview reflects the current state.
4. The local MP4 renderer produces the same intended result.
5. Saved projects survive reload; media-storage location is clearly stated.
6. Unsupported media, missing files, quota failures, unavailable APIs, and render failures explain what failed and how to recover.

No feature is advertised as working until its relevant gates pass. A successful website build alone only proves the application compiles.

## Phased implementation

### Phase 0 — Make the current build trustworthy

**Priority: immediate.**

- Complete the preview/export parity fix for all active video layers and both transform axes.
- Keep media storage checks authoritative. Never silently switch between device and server storage when the API check fails.
- Replace static “media stays on device” copy with the actual project storage mode in the editor, media bin, and export dialog.
- Add automated browser coverage for: create project → import video/audio/image → add to tracks → play/scrub → split/trim/move → save → reload → export → download.
- Exercise server media upload on the Hetzner Volume and device-local import separately; verify file location, authentication, quota errors, and relinking behavior.
- Run real FFmpeg WebAssembly smoke renders for every advertised render preset and every effect filter. Report unsupported filters instead of producing a failed or misleading export.
- Add a render diagnostic panel with the failed stage, concise error, retry action, and copyable diagnostic ID. Never expose tokens or secrets.

**Exit criteria:** A creator can complete the whole import-to-export journey in a supported desktop browser, close/reopen the project, and reproduce the same result. Every failure path has a clear recovery path.

### Phase 1 — Editing fundamentals that feel predictable

- Correct clip selection and multi-select, keyboard focus, drag/drop hit targets, snapping, and trim handles.
- Add explicit selection feedback, clip source/duration, track state, and playhead timecode.
- Implement insert, overwrite, ripple delete, ripple trim, gap close, duplicate, and track targeting as separate named operations.
- Add track creation, reorder, rename, lock, hide, mute, solo, and height/zoom controls.
- Add proper split-at-playhead, blade mode, range selection, and keyboard shortcuts without hijacking text inputs.
- Implement autosave state with pending/saved/error states and safe retry; detect stale server versions before applying changes.
- Support project package export/import that includes the timeline and a manifest of required media, with optional media inclusion when storage policy permits.

**Exit criteria:** Core operations are discoverable, keyboard operable, undoable, saved, and behave the same after reload.

### Phase 2 — Preview and timeline render correctness

- Make multi-track preview composite every visible clip in the same order as FFmpeg export.
- Align crop, fit/fill, x/y, scaleX/scaleY, opacity, keyframes, title position, and frame rate between preview and export.
- Replace fake transition equivalence with distinct dissolve, fade-through-black, dip-to-color, wipe, and slide implementations. Define source-handle rules where transitions need extra frames; show a clear warning when handles are unavailable.
- Add deterministic preview seeks and audio/video synchronization checks at clip boundaries, split points, and transitions.
- Add proxy generation and resolution controls for low-end machines; clearly label proxy preview versus final export.
- Use a worker or browser media pipeline for decode/render tasks that should not block UI interaction.

**Exit criteria:** Golden sample projects render frames/audio that match preview within defined tolerances at cuts, effects, transforms, and transitions.

### Phase 3 — Professional edit, title, and motion controls

- Add aspect-aware titles with font, size, weight, color, stroke, shadow, alignment, safe-area guides, and title templates.
- Add transform keyframe editing in the inspector and timeline: position, scale, rotation, opacity, easing, copy/paste, and keyframe navigation.
- Add speed changes, reverse, freeze frame, and speed ramps with explicit audio pitch behavior.
- Add crop, rotate, flip, stabilize controls, masks, and chroma key with preview/export parity.
- Add captions/subtitles as editable tracks with import/export formats (SRT/VTT), timing correction, style presets, and safe-area previews.
- Add transitions as visible timeline objects with duration and adjustable parameters rather than only inspector actions.

**Exit criteria:** A user can build and revise a complete short-form edit without leaving the editor for titles, captions, motion, or ordinary transitions.

### Phase 4 — Color and effect system

- Keep color correction controls separate from creative looks: exposure, lift/gamma/gain, white balance, hue/sat, curves, scopes, and LUT import.
- Establish a shared effect registry: parameter schema, preview renderer, export renderer, capability flags, default values, and tests for each effect.
- Treat effects as ordered stacks with enable/disable, reorder, bypass, reset, copy/paste, and per-effect keyframes.
- Make stack preview and final render use the same implementation or label any preview approximation clearly.
- Add masks and tracking only with a real tracking implementation; do not show decorative controls.
- Keep third-party LUTs, overlays, transitions, and sound packs out of the shared catalog unless the exact license permits distribution. Preserve provenance for user-imported media.

**Exit criteria:** Every visible effect is renderable, parameterized, undoable, persisted, and tested against preview and output. The current 20 presets are a start, not proof of a professional effects library.

### Phase 5 — Audio post-production

- Provide multi-track gain, pan, fades, keyframes, waveform zoom, meters, mute/solo, and bus routing.
- Add real-time preview for EQ, compressor, limiter, de-esser, gate, noise reduction, reverb, delay, pitch, and voice effects.
- Use audio analysis workers for loudness, silence, clipping, beat grid, and speech regions; let users review automatic edits before applying them.
- Match preview and export DSP settings and show loudness/peak information after export.

**Exit criteria:** Users can mix dialogue, music, and effects without clipping, and exported levels match the controls they heard in preview.

### Phase 6 — Reliable export and performance

- Add a renderer capability probe at startup; list codecs/filters available in the current web, desktop, or mobile target.
- Stream large input files into the renderer instead of retaining duplicate full-size buffers in memory.
- Add cancellation, resume where possible, disk-space checks, estimated output size, and useful error categories.
- Validate H.264/AAC, HEVC where supported, ProRes desktop path, frame rates, color tags, audio sample rates, and social presets against real players.
- Move long renders to native desktop FFmpeg; keep web export local and enforce file/memory limits.
- Produce an export summary with the exact resolution, frame rate, codec, bitrate/quality, audio format, and timeline version.

**Exit criteria:** Supported machines can render representative projects reliably; unsupported exports fail before long work begins and identify the exact limitation.

### Phase 7 — AI as an assistant, not a substitute for editing

- Keep AI proposals reviewable, reversible, and anchored to selected media, playhead, and timeline context.
- Build deterministic fallback actions for common requests and return a specific explanation when a prompt is unsupported.
- Add scene detection, silence removal, beat cuts, captions, reframing, and rough-cut suggestions as reviewable operations.
- Let AI use the same validated timeline operations as manual editing; never mutate source files.
- Show provider availability, latency, rate limits, and per-request failures with retry/edit-manually paths.

**Exit criteria:** Every AI change is previewed, explainable, undoable, and passes the same edit/save/render checks as manual work.

### Phase 8 — Desktop, mobile, collaboration, and release

- Desktop: native FFmpeg, proxy/cache management, file-system relinking, crash recovery, installer/update/signing process.
- Mobile: a purpose-designed touch timeline with limited, tested workflows—not a desktop layout squeezed onto a phone.
- Collaboration: presence, conflict-safe timeline operations, comments/review links, and explicit server-versus-device media policy.
- Accessibility: keyboard-only editing, screen-reader labels, contrast, focus states, and motion preferences.
- Release: telemetry only with consent, crash diagnostics without media content, support workflow, privacy disclosures, and a public capability matrix.

**Exit criteria:** Each client has a defined supported workflow, device matrix, release process, privacy policy, and support path.

## First execution order

1. Finish and deploy Phase 0 preview/storage fixes.
2. Add browser end-to-end tests using the repository's existing tiny video/audio fixtures.
3. Fix transition semantics and verify output in real FFmpeg WebAssembly renders.
4. Fix autosave conflict and recovery behavior; test project reloads.
5. Only then expand edit controls and effect count.

## Product claims

Until release gates pass, describe CineMind as an AI-assisted video editor in active development. Do not claim that it replaces Adobe or DaVinci Resolve, that every effect works, or that web/mobile/desktop feature parity exists. Publish a capability matrix that distinguishes shipped, beta, and planned features.
