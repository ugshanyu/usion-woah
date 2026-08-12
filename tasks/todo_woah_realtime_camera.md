# Woah realtime camera game

- [x] Scaffold the standalone repository and production build.
- [x] Implement on-device pose and face-direction detection with calibration.
- [x] Implement camera capture and privacy-safe local processing.
- [x] Implement Usion room lifecycle and solo-to-multiplayer promotion.
- [x] Implement P2P WebRTC video with Usion signaling and credentialed TURN support.
- [x] Implement clock synchronization and host-authoritative beat verdicts.
- [x] Implement responsive Mongolian/English UI and accessibility states.
- [x] Add classifier, rules, clock, protocol, and integration tests.
- [ ] Test build under latency, jitter, loss, disconnect, and reconnect.
- [ ] Deploy and verify the public iframe URL.
- [x] Add only registry and camera-origin integration to `usionthemobile`.
- [ ] Verify the real Usion Share -> Join path on two clients/devices.
- [ ] Remove this task file after every item is complete and verified.

Blocked release gates (2026-08-12): the private GitHub remote is created and pushed, and Railway login is available. A production credentialed TURN endpoint/secret is still absent; do not reuse the platform-wide coturn secret in another service without explicit approval. A stable HTTPS origin cannot be published, camera-delegated, or tested on two real signed-in devices until TURN is configured and the Railway deployment is healthy.
