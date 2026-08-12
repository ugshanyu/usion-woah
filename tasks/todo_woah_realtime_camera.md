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
- [ ] Deploy and verify the public iframe URL (Railway project/service/domain created; app release is gated below).
- [x] Add only registry and camera-origin integration to `usionthemobile`.
- [ ] Verify the real Usion Share -> Join path on two clients/devices.
- [ ] Remove this task file after every item is complete and verified.

Blocked release gates (2026-08-12): Railway project/service `usion-woah` and stable origin `https://usion-woah-production.up.railway.app` exist, and Usion registry draft `woah-challenge-b0406313` points to it but remains unpublished. Platform integration PR #34 is merged, deployed, and the live `usions.com` Permissions-Policy delegates camera to the exact Railway origin only. Product direction rejects all third-party TURN services. The existing Usion coturn cannot be used yet: its hostname resolves away from the Usion EC2 host, public UDP/STUN is unreachable, TLS/TCP 443 is absent, and its committed global secret must not be reused. Provision a dedicated Usion-owned relay secret, correct DNS/firewall/TLS, configure Railway, deploy, verify `/health`, run a forced-relay two-device test, and only then publish the registry draft.
