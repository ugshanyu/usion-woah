# Usion Woah Challenge

A two-player, realtime camera game for Usion. One player points; the other turns their head. If both player-centric directions match on **WOAH**, the pointer scores. A different direction is a dodge. First to three wins.

This is the standalone game repository. The Usion monorepo contains only the service registry entry and the exact web camera-origin delegation—never this game's code, models, or deployment files.

## Fairness and privacy contract

- Pose and head direction are inferred on each player's device. Landmark samples and camera frames are never sent to Usion.
- Camera video uses a WebRTC peer connection protected by DTLS-SRTP. A credentialed TURN server relays encrypted packets when a direct path is unavailable.
- Usion provides the authenticated room, invitation flow, targeted WebRTC signaling, and an essential event journal.
- Verdicts use the camera source-frame timestamp carried through inference. Network arrival time and inference completion time do not affect the movement window.
- The guest estimates host clock offset from the lowest-RTT probes. If uncertainty exceeds 50 ms, a round is replayed instead of awarding a point.
- A valid gesture needs a neutral rearm, two stable samples, adequate landmark quality, and both players' onsets within 180 ms.
- Client-side inference is suitable for casual play, not wagered or cheat-proof ranked competition.

## Data flow

```text
front camera -> on-device MediaPipe Worker -> direction + source timestamp
       |                                           |
       +---- encrypted WebRTC video to peer        +---- compact observation
                                                            |
Usion Share/invite -> authenticated room -> signal/control -> host verdict
```

The local preview is CSS-mirrored, but inference always receives the raw frame. Left/right labels are the photographed player's anatomical directions.

## Local development

Requirements: Node.js 22.12 or newer and HTTPS/localhost camera access.

```bash
npm ci
npm run dev
```

`postinstall` copies the pinned MediaPipe WASM runtime and verifies the SHA-256 of the pinned pose and face model files. The app expects the Usion SDK host handshake; use the Usion development host for a complete room flow.

Verification:

```bash
npm test
npm run lint
npm run build
```

## Production deployment

The included Dockerfile is the supported deployment path. Production refuses to start without all of:

- `USION_SERVICE_ID=woah-challenge`
- `USION_API_URL=https://mobile.mongolai.mn`
- `TURN_URLS` containing credentialed coturn endpoints; include TLS/TCP 443 and UDP where possible
- `TURN_SHARED_SECRET` matching coturn `static-auth-secret`
- optional `TURN_TTL_SECONDS`, 60–3600 seconds, default 600

`POST /api/ice` accepts only an iframe-scoped bearer token for this service, verifies current room membership with Usion, rate-limits issuance, and returns short-lived coturn REST credentials. Permanent TURN credentials must never be shipped to the browser.

After deployment:

1. Confirm `/health` returns `ok: true` and `turnConfigured: true`.
2. Confirm the response CSP allows `frame-ancestors https://usions.com` and does not block camera access.
3. Add the exact HTTPS production origin to Usion web's camera-only Permissions-Policy allowlist. Never wildcard preview origins.
4. Register `woah-challenge` through the idempotent Usion seed, initially unpublished.
5. Verify Share → Join on two signed-in real devices, including Wi-Fi-to-cellular forced TURN.
6. Publish only after camera permission, video, synchronization, background/resume, disconnect/rejoin, and replay behavior pass on iOS and Android.

## Timing protocol

The host schedules each cue at least two seconds into the future in host-monotonic time. The camera Worker may finish later, but the captured source timestamp is retained. Each device submits the first stable gesture after a neutral pre-window. Missing vision, low confidence, stale generations, high clock uncertainty, or a timing gap over 180 ms produces `void`/replay.

Essential ready/session/round/observation/verdict events are deduplicated and journaled through Usion actions while also using the reliable WebRTC control channel when open. SDP/ICE uses only the targeted `signal` realtime action; raw video and landmarks never use the Usion relay.

## Real-device release checklist

- iOS and Android production WebViews show the OS camera prompt only after **Enable camera**.
- Calibration passes with glasses, facial hair/head coverings, varied skin tones and body sizes, portrait and landscape.
- Both cameras connect on same Wi-Fi, separate Wi-Fi, and Wi-Fi ↔ cellular; TURN relay is confirmed.
- Synthetic 150 ms latency, 60 ms jitter, and 5% signaling/control loss cannot turn an invalid sample into a win/loss.
- Backgrounding clears samples, camera, calibration, and the active round; foreground requires a new user gesture and calibration.
- A held point/head pose before the cue is replayed; stale or reordered events cannot produce a second verdict.
- No camera frames, landmarks, tokens, SDP, or TURN credentials appear in application logs.

## Third-party assets

See [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md). Models and WASM are pinned and served from this app's own origin; no runtime model CDN is used.
