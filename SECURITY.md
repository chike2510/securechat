# SecureChat security boundary

SecureChat is an academic prototype. Plaintext is encrypted in the browser with AES-GCM before the message mutation is sent. The server stores ciphertext, the IV, timestamps, and delivery metadata only. The server does not receive the readable message body.

Conversation and message procedures require an authenticated university-eligible account and verify membership in the conversation before reading or writing encrypted data. Delivered status is confirmed when the recipient opens the conversation and the client receives the message list; an unopened background notification remains pending until that conversation is opened. Read status is then recorded from the recipient client.

The Socket.IO channel provides room-level update notifications, while tRPC remains the authoritative persistence and authorization boundary. This prototype is not a production audited messenger: it does not claim protection against compromised endpoints, malicious browser extensions, advanced traffic analysis, or weak device security. Private keys are kept in browser local storage for demonstration and should use hardened platform key storage in production.
