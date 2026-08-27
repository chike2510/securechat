# Live verification

- Production URL shown by the user: https://securechat-peach-two.vercel.app
- The landing page loads and displays the SecureChat auth UI.
- A browser-safe GET request to `/api/trpc/auth.me?batch=1&input=%7B%7D` returned HTTP 500 with `FUNCTION_INVOCATION_FAILED`.
- The Vite public-variable fix has been committed locally and pushed to the GitHub repository as commit `0c109ad`; the live alias may still be serving the preceding deployment.
- Do not submit credentials from the user screenshot during debugging.

- The final runtime fix commit `1ff5084` was deployed successfully by Vercel Git integration at `https://securechat-7kjn4cs6a-chikeziri-emmanuel-onovo-s-projects.vercel.app`.
- The user-facing alias `https://securechat-peach-two.vercel.app` now loads the updated sign-in UI after deployment.

- The native tRPC handler commit `8795ca4` deployed successfully at `https://securechat-51x95upmf-chikeziri-emmanuel-onovo-s-projects.vercel.app`.
- The user-facing alias still returned HTTP 500 `FUNCTION_INVOCATION_FAILED` for an unauthenticated `auth.me` request after that deployment; the request shape is being checked next.

- The final client mapping commit `cc90916` deployed successfully at `https://securechat-bezudki07-chikeziri-emmanuel-onovo-s-projects.vercel.app`.
- After that deployment, the user-facing alias still returned HTTP 500 `FUNCTION_INVOCATION_FAILED` for a valid unauthenticated `auth.me` request. The browser registration flow therefore remains blocked by the hosted API failure, and no successful account submission has been claimed.

- After commit `0dd53fc`, the user-facing alias returned HTTP 200 with valid tRPC JSON for unauthenticated `auth.me`: `[{"result":{"data":{"json":null}}}]` (terminal styling removed in the saved record). This confirms the Vercel ESM module-resolution failure is fixed.

- After commit `8f08d07`, Vercel deployed successfully at `https://securechat-d4givjxlx-chikeziri-emmanuel-onovo-s-projects.vercel.app`.
- The user-facing alias returned HTTP 200 with valid tRPC JSON for unauthenticated `auth.me`: `[{"result":{"data":{"json":null}}}]`. The compiled ESM import failure is resolved.

- After commit `41a834e`, Vercel deployed successfully at `https://securechat-owt1bxjod-chikeziri-emmanuel-onovo-s-projects.vercel.app`.
- The user-facing alias returned HTTP 200 with valid tRPC JSON for unauthenticated `auth.me`: `[{"result":{"data":{"json":null}}}]`. The final production serverless path is healthy.

- After commit `d4748c2`, Vercel deployed successfully at `https://securechat-6vrij6lvm-chikeziri-emmanuel-onovo-s-projects.vercel.app`.
- On the public `securechat-peach-two.vercel.app` alias, `/api/config` returned the connected Supabase URL and a publishable key using the `STORAGE_SUPABASE_*` fallback. The page now renders the normal SecureChat sign-in form instead of the runtime setup failure screen.

- Deployment `9862e675...` completed successfully and the public alias now serves JavaScript containing the deployed-origin confirmation redirect logic.
- The live page renders the normal SecureChat sign-in screen. The remaining confirmation-link test requires a fresh registration email; no further Supabase integration setup is needed from the code side.

- Deployment `24759db` completed successfully. The production route `https://securechat-peach-two.vercel.app/auth/confirmed` renders SecureChat’s dedicated “Email confirmed — You’re ready to sign in” page with a link back to the app.
- A fresh confirmation email click-through is still not independently exercised because it requires creating another account and opening the email; the deployed destination itself is verified.

- After the OTP/auth.me checkpoint was pushed to GitHub main at commit `abe3352`, the public alias rendered the normal SecureChat sign-in form after the bootstrap completed. The production browser showed the registration entry button, not the old static success state.
- After commit `abe3352`, five consecutive unauthenticated requests to `https://securechat-peach-two.vercel.app/api/trpc/auth.me?batch=1&input=%7B%7D` each returned HTTP 200, `application/json`, and `[ {"result":{"data":{"json":null}}} ]` with whitespace removed in the raw response. No intermittent 500 occurred in this check.
- After the post-OTP session-hydration fix was pushed at commit `24c7e46`, the public alias loaded the SecureChat sign-in UI after bootstrap. The deployed bundle was `assets/index-zPCw5C3e.js`; an unauthenticated `/api/trpc/auth.me?batch=1&input=%7B%7D` request returned HTTP 200 `application/json` with a 35-byte response. The actual fresh-account OTP-to-chat path still requires the user’s mailbox/session and cannot be exercised from the sandbox browser.
- After commit `040f177` was pushed, `/api/config` returned the real Supabase URL and publishable key with HTTP 200 on five consecutive requests, and the public alias loaded the normal sign-in page instead of the setup error. Using the authorized test account, the browser persisted a Supabase session and direct Supabase `/auth/v1/user` returned HTTP 200 with confirmed email and name/matric metadata. The browser sent an Authorization header to SecureChat `auth.me`, but `auth.me` still returned `[{"result":{"data":{"json":null}}}]`. Database queries found no local profile row by email, Supabase openId, or matric number. The remaining production blocker is the Vercel API’s database/profile provisioning configuration, most likely missing or unreachable `DATABASE_URL`.

- The Storage Postgres dependency was replaced with the already connected private Supabase storage integration. On the public alias, `/api/health` returned HTTP 200 with `driver: "supabase-private-storage"`, `source: "storage-supabase"`, and `status: "ready"`.
- A verified production Supabase session now opens the normal Messages workspace rather than returning to login. The user confirmed the workspace opens; no production message request, multi-user group, encrypted attachment, or voice-note exchange has yet been claimed as independently verified.
- The expanded platform feature bundle was deployed at Git commit `51c5846`: profile privacy settings, message requests, blocking, conversation actions, group creation/member management, encrypted file sharing, and encrypted voice-note controls are present in the live JavaScript bundle.
- The latest refinement was deployed at Git commit `a91ce79`: group copy uses “Create group” rather than “Create encrypted group”; the full profile page includes editable display name, illustrated avatar choices, optional JPG/PNG/WebP photo upload, and a “Use avatar” option to return from a photo to the built-in style. The live storage health response remained HTTP 200 after deployment. The user still needs to open the refreshed mobile profile UI to confirm its presentation and photo-upload interaction.

- Vercel recorded the older logo-loader commit `1ca782d` as failed because the optional `supabase-blue-arrow: Supabase Preview Branch` provisioning stage became stale. This was not an application build failure.
- The later Git commit `5134f4b` completed successfully on Vercel. The production alias now serves the People directory controls; that deployment outcome confirms the stale preview-branch event did not disable the primary Supabase integration.

- The Find friend refinement is implemented and locally validated: its control now matches New group, all contact and profile-menu language uses “Friend request,” a sent card changes to “Request sent,” and the action is disabled while pending.
- The server now preserves the deterministic request record and returns an explicit already-pending result, preventing a duplicate request from being written or presented as new. Full local validation passed: type-check, 45 Vitest tests, and production build. A real two-account production acceptance and conversation test remains open.

- The approved signal-knot SecureChat logo is now used in the bootstrap loader, authenticated loading state, main header, sign-in screen, confirmed-email screen, and signed-in fallback header. The normal bootstrap loader is logo-only, retaining only an accessible loading label.
- Usernames are now collected during registration, materialized safely for existing profiles, editable under Profile & settings, searchable with or without @, and displayed in friend discovery and group selection instead of an email address. The existing email remains private account information.
- The approved friend-profile and direct-chat directions are implemented locally: a Find friend row opens a recipient profile with username, friend status, and a Message action that is available only after acceptance; direct-chat headers open the same profile and outgoing message bubbles use the approved mint treatment. Full local validation passed: type-check, 46 Vitest tests, and production build. Production mobile presentation and a real two-account acceptance/message exchange remain open.
