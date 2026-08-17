# Woah realtime camera game

- [x] Scaffold the standalone repository and production build.
- [x] Implement on-device face-direction detection with calibration (pose support was later removed by product decision).
- [x] Implement camera capture and privacy-safe local processing.
- [x] Implement Usion room lifecycle and solo-to-multiplayer promotion.
- [x] Convert P2P WebRTC video to the approved STUN-only production mode.
- [x] Surface a deterministic network-incompatible state when direct P2P cannot connect.
- [x] Implement clock synchronization and host-authoritative beat verdicts.
- [x] Implement responsive Mongolian/English UI and accessibility states.
- [x] Add classifier, rules, clock, protocol, and integration tests.
- [x] Fix the production MediaPipe Worker loader/CSP and request camera permission before model startup.
- [x] Show distinct camera-permission, camera-device, and movement-detector startup errors.
- [x] Verify the built Worker boots with the bundled MediaPipe assets before redeploying.
- [x] Remove Pose Landmarker and arm-direction calibration; keep face-only on-device vision.
- [x] Add timestamped four-direction touch input for the pointer role.
- [x] Verify Share promotion and two-player synchronized touch-vs-head verdicts.
- [x] Redeploy the face-only touch build to production and verify it in Usions.
- [x] Make face calibration recognition-driven instead of advancing on a fixed timer.
- [x] Require stable, correct neutral/left/right/up/down recognition before showing the next prompt.
- [x] Improve face acquisition on slower devices and varied framing, then verify and redeploy.
- [x] Randomize the first pointer and make successful guesses retain the turn while misses swap it.
- [x] Replace gesture input with four timestamped direction buttons and penalize missing movement.
- [x] Focus the looker's camera full-screen with the pointer in a top-right picture-in-picture tile.
- [x] Add a persistent proportional score bar, explicit turn state, and first-to-three flow.
- [x] End the visible countdown exactly on WOAH and add procedural music/cue/result sounds.
- [x] Add rules, protocol, layout-state, input, and audio tests; build and redeploy to Railway/Usions.
- [ ] Test build under latency, jitter, loss, disconnect, and reconnect.
- [x] Deploy and verify the public iframe URL on Railway.
- [x] Add only registry and camera-origin integration to `usionthemobile`.
- [x] Verify the real Usion Share -> Join path on two clients/devices (confirmed through the production friend flow).
- [x] Stop treating the initial room state as a reconnect and remove the duplicate Share-path join.
- [x] Recover the UI and timing state after a bounded P2P ICE restart.
- [x] Add regressions for solo -> Share auto-join, initial connection state, and P2P recovery.
- [x] Deploy the reconnect fix and verify the public Railway/Usions build.
- [x] Treat the pointer button as a pre-WOAH guess, not a synchronized physical gesture.
- [x] Lock all four buttons after the first accepted guess and close input exactly at WOAH.
- [x] Show both chosen directions in the verdict so a correct guess is unmistakable.
- [x] Add guess-window/verdict regressions, then rebuild and publish the fix.
- [x] Align the head-gesture stability gap with the adaptive inference cadence.
- [x] Widen the capture-time evidence window and remove the duplicate confidence gate without accepting jitter or held poses.
- [x] Add slow-device/head-direction timing regressions, then rebuild and publish the vision fix.
- [x] Replace the five-stage directional calibration with a short neutral-only automatic baseline.
- [x] Canonicalize raw yaw/pitch signs and use fixed head-turn ranges for all four directions.
- [x] Add neutral-only calibration and player-centric direction regressions, then rebuild and publish.
- [x] Pin the actual MediaPipe Web transformation-matrix layout and camera-axis convention used by the bundled 1.0.1 runtime.
- [x] Fix player-centric UP/DOWN and LEFT/RIGHT extraction with landmark sign validation, without restoring directional calibration prompts.
- [x] Improve low-confidence face-direction acquisition while preserving neutral/diagonal rejection.
- [x] Add real-convention matrix, opposite-direction verdict, missing-detection, and slow-device temporal regressions.
- [x] Rebuild, redeploy, update the Usion iframe version, and verify the corrected production asset.
- [x] Replace the fixed post-WOAH observation close with an evidence-driven 0–5 second recognition window.
- [x] Send the pointer choice at WOAH, but withhold the verdict until the looker's stable camera evidence arrives or the full timeout expires.
- [x] Retain the pre-WOAH neutral evidence for the entire recognition window and show a live face-processing state.
- [x] Add immediate, delayed, exact-boundary, timeout, duplicate, and reconnect timing regressions.
- [x] Rebuild, redeploy, update the Usion iframe version, and verify the recognition-driven production release.
- [x] Make the MediaPipe 3D head matrix authoritative instead of letting the 2D nose proxy veto it.
- [x] Replace exact session-neutral round rearm with face-present, direction-specific held-pose protection.
- [x] Add baseline-drift, no-face, held-pose, and landmark-contradiction regressions.
- [x] Rebuild, redeploy, update the Usion iframe version, and verify face recognition in production.
- [x] Decouple the shared round generation from each device's local MediaPipe generation.
- [x] Add a regression where calibration offsets the local vision generation from the protocol round.
- [x] Rebuild, redeploy, update the Usion iframe version, and verify the generation fix in production.
- [x] Change face capture to the first stable direction recognized within 3 seconds after WOAH.
- [x] Update looker instructions, visible recognition countdown, timeout, and boundary/order regressions.
- [x] Rebuild, redeploy, update the Usion iframe version, and verify the 3-second release in production.
- [x] Open face recognition when countdown 1 appears and move the held-pose rearm interval before it.
- [x] Replace result-driven role swapping/first-to-3 with fixed rounds 1–5 and 6–10 pointer blocks.
- [x] End after round 10 with higher-score winner or draw, and update HUD/game-over/reporting/protocol limits.
- [x] Add timing, five-round block, ten-round completion, winner/draw regressions and publish production (`c92a51a`, Railway deployment `c305c0ad-d77e-4456-8870-8f8ce5eaf699`).
- [x] Replace the placeholder melody with a rights-clean original procedural challenge soundtrack.
- [x] Add a synchronized countdown buildup and synthesized WOAH vocal/bass drop at the host beat.
- [x] Add deterministic music-pattern/audio-timing regressions and verify test/lint/build/runtime preview.
- [x] Publish the original soundtrack release to Railway and update the Usion iframe version (`9840e1f`, Railway deployment `c75f3862-720b-4cfc-819d-e0466b3583d5`).
- [x] Import the user-supplied MP3 into the standalone game with an auditable content hash.
- [x] Play the bundled song without delaying camera startup, retain the procedural fallback, and preserve host-clock WOAH timing.
- [x] Add audio-loader regressions and verify the real browser decode/playback path (123.4 s decoded in Chromium).
- [x] Publish the bundled-song release to Railway and update the Usion iframe version (`9879f41`, Railway deployment `5939f783-bbaa-49b5-be82-90f950758b48`).
- [x] Replace free-running full-song playback with ten verified per-round WHOA vocal markers.
- [x] Schedule each MP3 excerpt so its real vocal onset lands on the shared host-clock target.
- [x] Keep the synthetic countdown/WOAH only as an explicit asset/decode/late-schedule fallback.
- [x] Add marker, source-offset, target-alignment, late-schedule, and fallback regressions.
- [x] Verify the real browser AudioBuffer source path, then publish Railway/Usions production (`465e849`, Railway deployment `51e7bdd2-a8fb-4835-9880-a6796e904d02`).
- [x] Pin one player-centric presentation contract across local camera, remote camera, direction buttons, and verdict arrows.
- [x] Mirror both camera tiles consistently and add a regression for visible right/left matching the selected/result arrow.
- [ ] Verify test/lint/build/browser presentation, then publish the direction-UI fix to Railway/Usions production.
- [ ] Remove this task file after every item is complete and verified.

Architecture decision (2026-08-12): ship one Railway service with STUN-only direct P2P video. Usion owns identity, invite/room lifecycle, signaling, the essential action journal, and result integration. Railway serves the app/models and authenticated ICE configuration. No Cloudflare, AWS, managed TURN, or self-hosted coturn is part of v1. Direct video may fail on symmetric NAT/mobile-carrier networks; the game must stop before round start and explain the incompatibility instead of silently degrading fairness.

Input decision (2026-08-13): both players run only on-device face-direction detection. The current pointer chooses a cardinal direction with four timestamped touch buttons; the looker turns their head on the synchronized WOAH beat. Pose/arm inference and calibration are not part of the game.

Match-format decision (2026-08-14): the host randomly selects the first pointer. That player guesses in rounds 1–5, then the other player guesses in rounds 6–10 regardless of prior verdicts. A correct guess adds one point; missing timed input subtracts one point from the player who missed, clamped at zero. After round 10, the higher score wins and equal scores are a draw.

Audio decision (2026-08-17): the owner supplied and authorized the exact MP3 for this release. Bundle that file locally in the standalone repository and load/decode it asynchronously after the user gesture so camera startup is never blocked. Keep the original procedural soundtrack as the offline/decode fallback, and keep the synchronized countdown/WOAH target driven by capture-time match timing rather than media playback position.

Vocal-sync decision (2026-08-17): two independent local word-timestamp passes found the first ten WHOA onsets at 13.680, 16.720, 20.120, 23.440, 26.760, 30.220, 33.360, 36.800, 40.180, and 43.480 seconds. Round N schedules the source three seconds before marker N; the decoded vocal onset must land at the shared host-clock target. The gain opens 2.45 seconds before target so the previous repeating WHOA tail is never audible. Do not run rounds from a free-running media position, because inference/verdict latency is variable.
