# SecureChat Platform Feature Design

## Scope

This feature set extends SecureChat without changing its authentication model. Supabase Auth continues to establish identity. SecureChat’s private server-side store persists only structured profile data, conversation metadata, encrypted message payloads, and encrypted attachment bytes.

## Conversation Model

Every conversation has a `kind` of `direct` or `group`, a participant list, timestamps, and an optional group name. A direct conversation becomes visible to its recipient only after they accept the initial message request. Group conversations are visible to members when the creator adds them.

For a group, the creator generates a random AES-GCM conversation key in the browser. The raw group key is separately encrypted for each participant with the creator’s existing ECDH shared key and saved as a recipient-specific key envelope. Group message text and attachments use the group AES key. The server cannot decrypt the conversation key, messages, attachments, or voice notes.

## Safety and Control Model

Message requests are private inbox objects. Accepting a request creates the recipient’s conversation index; declining removes the request. A block record is private to the blocking account. Creating a direct request and delivering new messages checks both participant block records.

Each participant can maintain private conversation preferences: pinned, muted, and hidden from their own inbox. Hiding a conversation changes only the user’s own index and never deletes a shared conversation or another user’s history.

## Attachment Model

The browser encrypts file bytes or recorded audio bytes using AES-GCM before they are sent. The server stores only ciphertext bytes in the private bucket and stores attachment metadata (encrypted object reference, byte count, declared media type, and display name) with the encrypted message. A recipient fetches the ciphertext through an authenticated procedure and decrypts it locally before downloading or playing it.

To stay within browser and serverless request limits, attachments and voice notes are capped at **3 MB**. Voice notes are recorded in a browser-supported audio format and use the same encrypted-attachment path.

## Profile and Privacy Model

The profile panel shows the authenticated user’s name, email, and matric number. It allows a user to choose whether SecureChat should send delivered/read acknowledgements. This preference does not reveal message content and applies only to their own status updates.
