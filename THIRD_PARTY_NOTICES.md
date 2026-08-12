# Third-party notices

This project uses `@mediapipe/tasks-vision` and the Google MediaPipe Pose Landmarker Lite and Face Landmarker model bundles. MediaPipe is distributed under the Apache License 2.0. Review the package license and model documentation before redistribution.

Pinned model sources:

- Pose Landmarker Lite, float16, version 1: SHA-256 `59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a`
- Face Landmarker, float16, version 1: SHA-256 `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff`

The build downloads those exact versioned files only when absent, then verifies their hashes. MediaPipe WASM files are copied from the pinned npm package.
