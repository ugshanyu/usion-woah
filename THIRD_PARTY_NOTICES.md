# Third-party notices

This project uses `@mediapipe/tasks-vision` and the Google MediaPipe Face Landmarker model bundle. MediaPipe is distributed under the Apache License 2.0. Review the package license and model documentation before redistribution.

Pinned model sources:

- Face Landmarker, float16, version 1: SHA-256 `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff`

The build downloads that exact versioned file only when absent, then verifies its hash. MediaPipe WASM files are copied from the pinned npm package.
