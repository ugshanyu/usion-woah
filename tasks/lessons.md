# Lessons

- Treat a managed service subscription or payment method as an explicit product decision. Surface the account and billing gate before integrating that provider, and keep provider adapters replaceable behind the authenticated ICE endpoint.
- Treat NAT traversal reliability as a product tradeoff, not an implicit infrastructure mandate. This product explicitly chose STUN-only direct P2P and accepts that some restrictive networks cannot start a match; preserve that choice unless the owner asks to revisit TURN.
