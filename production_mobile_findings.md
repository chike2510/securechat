# Production mobile verification findings — 2026-09-01

The public alias `https://securechat-peach-two.vercel.app` is reachable without Vercel SSO. The supplied SecureChat account signed in successfully and loaded the inbox and the existing Elisha Onovo conversation.

At the inspected browser viewport, the authenticated direct-chat header displayed the peer name and username but the peer avatar rendered only the initials `EO`. DOM inspection showed the peer conversation-list button contained a Radix avatar fallback and no image element, confirming that `profileImageUrl` was absent from the production conversation payload before rendering. The app’s own chat fetch includes the Supabase bearer token, while a bare `fetch('/api/trpc/secureChat.conversations')` without that header returns 401; the active Supabase session is stored under a localStorage key beginning `sb-jgaqpayjklojsciyflde-auth-token`.

Existing encrypted messages displayed `Unable to decrypt on this device`, which is expected because the browser’s local identity differs from the device that created those messages. The project now includes a passphrase-wrapped recovery bundle flow under Profile & Settings to move that identity securely to another device.

The screenshot captured by browser automation was desktop-sized; a narrow authenticated mobile capture remains useful after the peer-photo payload issue is fixed or the API response is directly inspected with the app’s bearer token.


Additional authenticated checks: `/api/health` returned HTTP 200 with the Supabase private-storage driver `status: ready`. Authenticated `secureChat.conversations` returned Elisha’s peer record with `profileImageUrl: null`; authenticated `secureChat.friendProfile` returned the same. The signed-in user’s `profileSettings` also returned `profileImageUrl: null`. Therefore the public alias is healthy, but the current stored profile metadata does not contain a usable image path or signed URL. The issue must be corrected by saving/re-uploading the peer’s picture through the current Profile & Settings flow or by migrating any legacy profile-image metadata; changing CSS or `<img>` behavior alone cannot make the missing URL render.
