# Lessons

- Treat a managed service subscription or payment method as an explicit product decision. Surface the account and billing gate before integrating that provider, and keep provider adapters replaceable behind the authenticated ICE endpoint.
- Do not assume any external managed TURN provider is acceptable. Establish infrastructure ownership constraints first; when the requirement is first-party-only, design for a Usion-owned coturn relay from the start.
