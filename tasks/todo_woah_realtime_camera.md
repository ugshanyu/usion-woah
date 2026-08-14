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
- [ ] Verify the real Usion Share -> Join path on two clients/devices.
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
- [ ] Remove this task file after every item is complete and verified.

Architecture decision (2026-08-12): ship one Railway service with STUN-only direct P2P video. Usion owns identity, invite/room lifecycle, signaling, the essential action journal, and result integration. Railway serves the app/models and authenticated ICE configuration. No Cloudflare, AWS, managed TURN, or self-hosted coturn is part of v1. Direct video may fail on symmetric NAT/mobile-carrier networks; the game must stop before round start and explain the incompatibility instead of silently degrading fairness.

Input decision (2026-08-13): both players run only on-device face-direction detection. The current pointer chooses a cardinal direction with four timestamped touch buttons; the looker turns their head on the synchronized WOAH beat. Pose/arm inference and calibration are not part of the game.

Turn decision (2026-08-13): the host randomly selects the first pointer. A correct guess scores one point and keeps the pointer's turn; a wrong guess swaps roles. Missing the timed input subtracts one point from the inactive player, clamped at zero, and swaps roles. The first player to three wins.
