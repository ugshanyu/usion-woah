# Usion Woah Challenge

A two-player, realtime camera game for Usion. One player presses one of four direction buttons; the other turns their head. If both player-centric directions match on **WOAH**, the guesser scores and keeps the turn. A miss swaps roles. The first player is selected randomly and the first to three wins.

This is the standalone game repository. The Usion monorepo contains only the service registry entry and the exact web camera-origin delegation—never this game's code, models, or deployment files.

## Fairness and privacy contract

- Only face/head direction is inferred on each player's device. Face landmarks and camera frames are never sent to Usion.
- Camera video uses a direct WebRTC peer connection protected by DTLS-SRTP. V1 is intentionally STUN-only and does not use a media relay.
- Usion provides the authenticated room, invitation flow, targeted WebRTC signaling, and an essential event journal.
- Verdicts use the camera source-frame timestamp for the head turn and a monotonic timestamp to enforce the guess deadline. Network arrival time and inference completion time do not affect the movement window.
- The guest estimates host clock offset from the lowest-RTT probes. If uncertainty exceeds 50 ms, a round is replayed instead of awarding a point.
- Calibration never advances on elapsed time: each prompt must be recognized in eight consecutive stable face samples before the next direction appears. A valid in-round head turn needs a neutral rearm, two stable samples, and adequate face quality. The guesser chooses exactly one direction during the countdown; that first choice locks immediately and the deadline closes at WOAH.
- A correct guess adds one point and keeps the guesser's turn. A miss swaps roles without awarding the defender. Missing a timed button/head movement subtracts one point from the inactive player (clamped at zero) and swaps roles. Clock uncertainty causes a score-neutral replay.
- The looker's camera is the full-screen stage; the guesser's camera remains in the top-right picture-in-picture tile. A persistent proportional score bar and turn banner stay visible.
- Client-side inference is suitable for casual play, not wagered or cheat-proof ranked competition.

## Data flow

```text
front camera -> on-device Face Landmarker -> head direction + source timestamp
       |                                                   |
       +---- encrypted WebRTC video to peer                +---- looker observation
four buttons -> cardinal choice + monotonic timestamp ---------- pointer observation
                                                                   |
Usion Share/invite -> authenticated room -> signal/control ------ host verdict
```

The local preview is CSS-mirrored, but inference always receives the raw frame. Left/right labels are the photographed player's anatomical directions.

## Local development

Requirements: Node.js 22.12 or newer and HTTPS/localhost camera access.

```bash
npm ci
npm run dev
```

`postinstall` copies the pinned MediaPipe WASM runtime and verifies the SHA-256 of the pinned face model file. The app expects the Usion SDK host handshake; use the Usion development host for a complete room flow.

Verification:

```bash
npm test
npm run lint
npm run build
```

## Production deployment

The included Dockerfile is the supported deployment path. Production requires:

- `USION_SERVICE_ID=woah-challenge-b0406313`
- `USION_API_URL=https://mobile.mongolai.mn`
- optional `STUN_URLS`, a comma-separated list; defaults to two public Google STUN endpoints

Production intentionally uses STUN-only direct P2P:

- No Cloudflare, AWS, managed TURN, or self-hosted coturn is required.
- Some symmetric-NAT, mobile-carrier, corporate, or restrictive firewall combinations cannot establish direct video.
- If the encrypted P2P camera and control channel do not open within 15 seconds, the match does not start and both players are told to switch networks.

`POST /api/ice` accepts only an iframe-scoped bearer token for this service, verifies current room membership with Usion, rate-limits requests, and returns only the configured STUN URLs.

After deployment:

1. Confirm `/health` returns `ok: true`, `iceMode: "stun-only"`, `visionMode: "face-only"`, `calibrationMode: "recognition-driven"`, `pointerInput: "four-buttons"`, `turnMode: "hit-keeps-turn"`, and `scoreTarget: 3`.
2. Confirm the response CSP allows `frame-ancestors https://usions.com` and does not block camera access.
3. Add the exact HTTPS production origin to Usion web's camera-only Permissions-Policy allowlist. Never wildcard preview origins.
4. Register `woah-challenge` through the idempotent Usion seed, initially unpublished.
5. Verify Share → Join on two signed-in real devices across same Wi-Fi, separate Wi-Fi, and Wi-Fi-to-cellular. Confirm incompatible networks stop before the first round with the explicit network message.
6. Publish only after camera permission, video, synchronization, background/resume, disconnect/rejoin, and replay behavior pass on iOS and Android.

## Timing protocol

The host schedules a three-second countdown in host-monotonic time. Procedural music starts only after the camera-start gesture; synchronized 3/2/1 tones lead to the exact zero-time WOAH cue, with result stingers after judging. The face Worker may finish later, but the captured source timestamp is retained. The pointer locks one cardinal guess before the cue; the looker submits the first stable head turn after a neutral pre-window. Missing input produces the defined score penalty; stale generations, high clock uncertainty, or unfair camera timing produce a score-neutral replay.

Face inference runs continuously after calibration with one frame in flight and an adaptive 50-160 ms target interval. For each WOAH beat `T`, neutral rearm evidence is read from `T-600` through `T-100` ms and cardinal head-direction evidence from `T-100` through `T+360` ms. The winning direction needs two matching classified frames no more than 240 ms apart. The observation is summarized at `T+600` ms so a slow Worker's last source frame can finish without changing its capture timestamp; the host then allows 250 ms for the peer observation before finalizing.

Essential ready/session/round/observation/verdict events are deduplicated and journaled through Usion actions while also using the reliable WebRTC control channel when open. SDP/ICE uses only the targeted `signal` realtime action; raw video and landmarks never use the Usion relay.

## Real-device release checklist

- iOS and Android production WebViews show the OS camera prompt only after **Enable camera**.
- Face calibration passes with glasses, facial hair/head coverings, varied skin tones, portrait and landscape.
- Both cameras connect on same Wi-Fi and representative direct-P2P networks; an intentionally incompatible ICE fixture stops before round start.
- Synthetic 150 ms latency, 60 ms jitter, and 5% signaling/control loss cannot turn an invalid sample into a win/loss.
- Backgrounding clears samples, camera, calibration, and the active round; foreground requires a new user gesture and calibration.
- A held head turn is rejected; the pointer's first countdown choice locks all four buttons, WOAH closes the deadline, and stale or reordered events cannot produce a second verdict.
- No camera frames, landmarks, tokens, or SDP appear in application logs.

## Third-party assets

See [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md). The face model and WASM are pinned and served from this app's own origin; no runtime model CDN is used.
