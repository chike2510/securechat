# Project TODO

- [x] Define SecureChat data model for users, conversations, participants, encrypted messages, message statuses, and in-app notifications
- [x] Build authentication-aware SecureChat entry flow for registered university users
- [x] Implement protected responsive two-pane chat workspace
- [x] Add user search and conversation list with online and last-seen indicators
- [x] Add mobile navigation and accessible responsive interaction states
- [x] Implement one-to-one message exchange with sent, delivered, and read states
- [x] Generate browser-side encryption key pairs and persist private key locally
- [x] Encrypt every message locally before transmission using authenticated encryption
- [x] Store ciphertext, IV/nonce, timestamps, and delivery metadata only on the server
- [x] Enforce participant-only conversation and encrypted-message access checks
- [x] Add conversation security view showing encrypted payload and client-side encryption flow
- [x] Handle empty conversations, reconnecting/offline recipients, sending failures, and unauthorized access
- [x] Add in-app notification when recipient receives a new encrypted message
- [x] Add in-app notification when an offline recipient returns to the platform
- [x] Add concise privacy and academic prototype limitations notice
- [x] Apply blueprint-inspired visual design with grid background, technical labels, formulas, wireframes, and subtle motion
- [x] Add unit tests for encryption, participant authorization, message lifecycle, and notification behaviour
- [x] Run type-check, tests, and visual verification
- [x] Review todo.md and save final project checkpoint
- [x] Enforce university-user eligibility in the auth flow instead of copy-only messaging
- [x] Implement actual real-time delivery with WebSocket or Socket.IO and recipient-driven delivered/read updates
- [x] Add explicit frontend unauthorized, query-error, send-failure, and reconnect states
- [x] Build visible in-app notifications for new encrypted messages and returning contacts, with read actions
- [x] Add executable Vitest coverage for crypto utilities, participant authorization, message lifecycle, and notifications
- [x] Drive delivered status when a recipient receives or opens an encrypted message
- [x] Surface explicit forbidden and protected-query error states in the frontend
- [x] Add executable tests for participant access, sent-to-delivered-to-read lifecycle, and notification read flow
- [x] Add explicit documentation and test coverage that delivered status is confirmed when a recipient opens a conversation; background unread notification remains pending until opened
- [x] Add runnable mocked-database tests for participant-only conversation and message access
- [x] Add runnable mocked-database tests for persisted sent-to-delivered-to-read updates
- [x] Add runnable mocked-database tests for marking notifications as read
- [x] Remove Manus OAuth routes, SDK dependencies, client redirects, and OAuth-only template artifacts
- [x] Implement local signed-session authentication with FUPRE matric number and university email validation
- [x] Run final checks and commit the OAuth-free SecureChat project to chike2510/securechat
- [x] Remove the incorrect FUPRE email-domain requirement and support normal student email addresses with matric-number identity
- [x] Update authentication copy and security documentation to distinguish identity verification from email-domain validation
- [x] Update tests, verify the corrected auth flow, and synchronize the fix to chike2510/securechat
- [x] Replace dramatic/report-style landing copy with concise natural SecureChat app copy
- [x] Keep registration fields as email, matric number, name, and password
- [x] Keep login fields as matric number and password
- [x] Improve mobile landing layout by reducing vertical content and removing unnecessary technical badges/explanations
- [x] Verify and synchronize the simplified entry experience
- [x] Fix Vercel deployment serving raw source files instead of the built SecureChat application
- [x] Verify Vercel build output, SPA fallback, and backend routing configuration
- [x] Commit and push the deployment fix to chike2510/securechat
- [x] Verify the live Vercel URL after redeployment instead of relying only on local build output
- [x] Confirm backend hosting strategy for tRPC, local sessions, and Socket.IO; do not claim Vercel hosts the full server until validated
- [x] Verify root and non-root SPA routes on the deployed URL
- [x] Revisit the live Vercel deployment after the user redeploys commit aeda6ce and confirm `/chat` renders SecureChat (superseded by the later Supabase deployment)
- [x] Test a protected `/api/trpc` call and local-session behavior on the actual hosted backend (local sessions superseded by Supabase bearer auth)
- [x] Document the confirmed hosting split for Vercel frontend and backend/Socket.IO services
- [x] Add a Vercel-compatible serverless `/api/trpc` handler for the SecureChat backend
- [x] Configure Vercel rewrites so `/api/trpc/*` reaches the serverless handler while SPA routes reach `index.html`
- [x] Add a polling-compatible refresh path for conversations, messages, presence, and notifications when Socket.IO is unavailable
- [x] Document the Vercel limitation: serverless deployment does not provide persistent Socket.IO connections
- [x] Verify the deployed `/api/trpc/auth.me` endpoint and commit the Vercel backend adaptation (deployment status confirmed through Vercel Git integration)
- [x] Fix Vercel TypeScript errors in localAuth request/response typing and cookie handling
- [x] Fix Vercel serverless handler typing, context `info`, and cookie serialization
- [x] Re-run the Vercel-style production build and push the corrected API
- [x] Fix deployed account creation so non-JSON Vercel errors are handled clearly and successful registration returns a valid response (Supabase Auth superseded the failing custom endpoint)
- [x] Replace the initial “preparing workspace” loading copy with a concise SecureChat loading state
- [x] Verify registration, login entry, and initial loading behavior after the Vercel redeployment (auth UI verified; protected deployment is Vercel-login gated)
- [x] Fix Vercel ESM resolution for server/routers in the deployed tRPC function
- [x] Verify the corrected Vercel API response and registration path (Supabase deployment superseded the old path)
- [x] Replace `api/trpc/[...path].ts` extensionless re-export with a self-contained Vercel handler
- [x] Verify the deployed tRPC endpoint after the wrapper replacement (deployment status confirmed through Vercel Git integration)
- [x] Add GitHub Actions workflow to deploy SecureChat to Vercel on pushes to main
- [x] Document required Vercel GitHub repository secrets and one-time setup
- [x] Validate and commit the automatic-deployment workflow to chike2510/securechat
- [x] Fix GitHub Actions pnpm setup failure caused by duplicate pnpm version declarations
- [x] Re-run the automatic-deployment workflow through dependency installation and Vercel build stages (CI dependency/type-check/test stages pass; Vercel Git integration handles production deploy)
- [x] Fix CI participant-access test failure where unauthorized status update resolves instead of rejecting
- [x] Re-run the complete test suite and automatic-deployment workflow after the correction
- [x] Diagnose why account creation still returns “SecureChat is temporarily unavailable” after Vercel secrets were added (Supabase Auth replaced the failing custom flow)
- [x] Verify the latest GitHub Actions run and deployed Vercel commit (Vercel Git integration deployment succeeded for commit `458eb1e`)
- [x] Fix and verify the live registration endpoint (Supabase Auth endpoint is now the registration path)
- [x] Diagnose the backend failure on the successfully redeployed e7ca530 Vercel deployment (old local-auth backend superseded)
- [x] Fix account creation without changing the requested matric-number login flow
- [x] Verify the live registration endpoint after the backend fix (Vercel Git integration reports production success)
- [x] Replace custom local auth with Supabase email/password authentication
- [x] Keep matric number as a required unique user profile field
- [x] Add Supabase setup documentation, tests, and deployment environment requirements
- [x] Update SecureChat to use the Vercel Supabase integration’s public environment variables
- [x] Ensure service-role credentials are never read by browser code
- [x] Verify and document the environment-variable mapping before redeployment
- [x] Add the Supabase-authenticated user profile upsert helper to the database layer
- [x] Replace AuthLanding registration/login mutations with Supabase Auth calls
- [x] Send the Supabase access token with protected tRPC requests
- [x] Make useAuth subscribe to Supabase sessions and sign out through Supabase
- [x] Support Supabase sign-in with either matric number or email as the login identifier
- [x] Remove obsolete local session implementation and cookie constant after Supabase migration
- [x] Deploy runtime config and verify the exact production alias no longer shows the missing-auth message; fresh registration response remains user verification
- [x] Convert the Vercel tRPC entrypoint to a runtime-compatible handler with native tRPC errors and an explicit fallback
- [x] Remove the duplicate top-level Vercel catch-all API route to avoid deployment ambiguity
- [x] Include Vercel API files in local type-checking
- [x] Confirm the exact Vercel Supabase public variable names are supported by the client bundle (sentinel build covers publishable and anon key names)
- [x] Map Vercel `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_ANON_KEY` into Vite’s client-safe variables without exposing service-role secrets
- [x] Fix Vercel’s compiled ESM import of `server/routers` from the tRPC function and verify the deployed `auth.me` route
- [x] Add an explicit Vercel tRPC error boundary around the native handler and validate its fallback response
- [x] Force the Vercel tRPC catch path in a controlled test and verify the 500 JSON fallback response
- [x] Resolve the mismatch between Vercel’s `NEXT_PUBLIC_SUPABASE_*` variables and the deployed client’s Supabase configuration detection
- [x] Add a runtime endpoint that exposes only the Supabase URL and publishable/anon key to the browser
- [x] Initialize the browser Supabase client from runtime configuration and cover the loading/error states
- [x] Trace why the connected Supabase integration values are absent from the deployed Vercel function without requesting new credentials from the user
- [x] Support the `supabase-blue-arrow` `STORAGE_SUPABASE_URL` and public anon/publishable key variables without exposing `STORAGE_SUPABASE_SECRET_KEY`
- [x] Set Supabase `emailRedirectTo` to the deployed SecureChat origin instead of localhost
- [x] Document the Supabase Auth email-template and sender-branding steps for SecureChat
- [x] Verify the deployed confirmation destination and redirect configuration return users to SecureChat’s `/auth/confirmed` page
- [x] Add a dedicated SecureChat email-confirmed landing route and point Supabase confirmation links to it
- [x] Add an actual email OTP verification state after Supabase registration
- [x] Verify the submitted OTP with Supabase and allow resend without exposing credentials
- [x] Replace the misleading registration success message with clear OTP states and errors
- [x] Diagnose and fix the deployed `auth.me` 500 shown in Vercel logs
- [x] Add tests for OTP state handling and the auth.me failure boundary
- [x] Deploy the latest OTP/auth.me changes and verify repeated unauthenticated production auth.me requests return HTTP 200
- [x] Add component-level coverage for registration-to-OTP transition, six-digit validation, resend, and verification errors
- [x] Remove the Supabase expiry implementation detail from the confirmation email template copy
- [x] Align SecureChat OTP input and copy with the eight-digit Supabase token delivered by the configured email template
- [x] Prevent the post-OTP session-hydration race that returns verified users to the login screen
- [ ] Verify post-OTP success end to end: verified user stays authenticated and active chat opens
- [x] Add integration coverage for successful OTP verification through the auth bootstrap and Home auth gate
- [x] Deploy the session-hydration fix and confirm the production alias no longer bounces verified users to login
- [x] Diagnose the remaining production OTP verification bounce after the session-hydration fix
- [ ] Verify the final OTP-to-chat path with a real production session before closing the auth bug
- [x] Test the supplied production account and capture the exact login/OTP redirect failure
- [x] Remove the supplied credential from the test browser session after testing and advise a password change
- [x] Deploy the verifier environment fallback and retest the authorized account’s authenticated auth.me response
- [x] Fix `/api/config` so Vite-prefixed Supabase URL and public-key variables load the deployed auth screen
- [x] Superseded: Storage Postgres driver migration was replaced with the verified Supabase private-store adapter
- [x] Superseded: Storage Postgres schema provisioning was replaced with private Supabase profile storage
- [x] Add a safe production database-readiness diagnostic to identify the remaining Storage Postgres provisioning failure
- [x] Ensure the database readiness endpoint returns a safe structured failure response when initialization fails
- [x] Superseded: Storage Postgres application-URL selection is no longer used by the Supabase private-store adapter
- [x] Confirm which Vercel Storage Postgres connection sources are available and attempted in production
- [x] Superseded: the failing Storage Postgres credentials are no longer used by the verified Supabase private-store adapter
- [x] Allow a verified Supabase session to enter the SecureChat workspace even when profile provisioning is temporarily unavailable
- [x] Show a clear in-workspace database limitation state instead of returning a verified user to login
- [x] Restore production database/profile provisioning so verified Supabase users reach the full Messages chat workspace instead of the signed-in fallback shell
- [ ] Verify a real OTP-confirmed production account loads conversations and can enter active chat without returning to login
- [x] Replace the failing Vercel Storage Postgres chat dependency with the existing Supabase-backed project integration
- [x] Deploy the Supabase-backed encrypted message store and verify production readiness without exposing any server key
- [ ] Verify real OTP-to-active-chat flow, including profile creation, conversation listing, encrypted send, and read state
- [x] Fix the profile control so tapping the signed-in user does not sign out
- [x] Remove the unnecessary “University communications / v1.0” workspace subtitle
- [x] Remove the unexplained “Local key present” strip from the Messages sidebar
- [x] Prevent the misleading signed-in fallback screen from flashing during authenticated page refresh
- [x] Define and confirm a compact pre-report SecureChat feature set that strengthens the live project demonstration
- [x] Add a profile and settings screen with privacy controls
- [x] Add first-contact message requests with accept and decline actions
- [x] Add user blocking that prevents direct contact and future message delivery
- [x] Add per-conversation pin, mute, and clear-view actions
- [x] Add secure group chat creation, membership management, and group delivery
- [x] Add browser-encrypted attachment sharing with private media persistence
- [x] Add browser-encrypted recorded voice notes with in-chat playback
- [x] Deploy and verify the expanded SecureChat platform feature set before beginning report preparation
- [x] Expand Profile & Settings into a fuller editable account page
- [x] Support an optional built-in avatar style or uploaded profile picture
- [x] Replace “Create encrypted group” and repetitive encryption copy with simpler group language
- [ ] Deploy and verify the profile presentation and profile-picture choice on mobile
- [x] Create and approve a mobile profile mockup with a clear back-to-chat control before changing the live profile design
- [x] Add an explicit Back to chat control to the mobile profile experience after mockup approval
- [x] Use casual everyday avatar styles rather than academic-looking portraits in the approved profile design
- [x] Use an icon-only return arrow rather than “Back to chat” text in the approved profile design
- [x] Apply the approved casual-profile layout and icon-only return control to the live SecureChat profile experience
- [x] Add a persistent light/dark mode switch for the full SecureChat interface
- [x] Replace the initial text loading screen with a logo-only SecureChat loading state
- [x] Repair registered-student discovery so another active SecureChat account appears in contact search
- [x] Add a dedicated People view for browsing registered students and sending a message request
- [x] Rename contact discovery and message-request language to Find friend and Friend request
- [x] Match the Find friend action button size to New group on mobile
- [x] Show a visible pending friend-request state on a person’s card after it is sent
- [x] Prevent duplicate friend requests while the recipient has not accepted or declined
- [x] Create and approve a proper SecureChat logo before replacing the SC loading mark
- [x] Create and approve a mockup for another person’s profile with friend and message actions
- [x] Create and approve a mockup for the direct chat interface
- [x] Add a username field and show usernames instead of emails in friend discovery after mockup approval
- [x] Replace the first logo concept with a more distinctive SecureChat mark before using it in the app
- [x] Implement the approved tap-to-open other-user profile with Message and friend-status actions
- [x] Apply the approved direct-chat visual direction after the unique logo is approved
- [x] Replace the plain SC mark with the approved signal-knot logo across loading, header, and app identity
- [ ] Verify the approved logo, profile, username, and chat presentation on mobile before deployment
- [x] Confirm the primary Supabase integration remains intact after the stale Preview Branch event; a later Vercel deployment completed successfully
- [x] Confirm the People directory is live after the successful later deployment
- [ ] Visually verify on production that the initial loader shows only the SC logo with no visible loading text
- [ ] Verify with two real production accounts that a person appears in People, a message request is accepted, and a direct chat opens


## Live verification correction — 2026-08-27

- [ ] User reports the public app still shows the old logo, missing profile photo, and old chat layout
- [ ] Reconcile the public deployment and re-test the actual authenticated screens before claiming the fixes are live

- [x] Replace Vercel-only managed asset paths that return 404 on the public domain with deployment-safe logo/avatar assets
- [ ] Re-test the public logo and authenticated screens after the asset delivery correction

- [x] Remove the unnecessary “Encrypted on this device before sending” footer copy from the chat composer
- [x] Change the Security control to a padlock-only button with an accessible label
- [x] Stop displaying stale or incorrect online presence in direct-chat headers
- [x] Render the other user’s authorized uploaded profile photo in the direct-chat header
- [x] Improve light-mode chat surfaces, spacing, message bubbles, and composer contrast to match the approved mockup
- [ ] Re-test the corrected direct-chat states on mobile and redeploy

- [x] Replace the tiny incorrect chat-header logo with the approved signal-knot mark in the actual rendered component
- [x] Trace the active conversation payload and render the recipient’s uploaded profile photo instead of the EO fallback
- [x] Finish the remaining light-mode chat proportions and header polish against the approved mockup
- [ ] Re-run production checks and verify a fresh mobile deployment after these corrections

- [x] Replace browser-native voice-note playback with a curved custom voice-note card matching the approved mockup
- [x] Capture speech loudness samples during recording and persist a compact waveform with the encrypted voice-note metadata
- [x] Render louder speech as taller waveform bars and quieter speech as shorter bars during playback
- [x] Add responsive playback progress and controls without losing the curved mobile layout
- [ ] Test voice recording, encrypted upload/download, waveform rendering, and playback on mobile

- [x] Remove visible button boxes behind the attachment and microphone icons in the mobile composer
- [x] Prevent text and voice-note messages from overflowing the mobile chat panel
- [x] Replace the redundant SecureChat label in the chat header with the active other-user username
- [ ] Re-test the corrected mobile chat layout and deploy it

## Verification boundary — 2026-08-31

- [x] Push the mobile chat correction checkpoint to `chike2510/securechat` main
- [x] Confirm GitHub’s Vercel status reports the production deployment as successful for commit `30505d7`
- [x] Re-run the final automated validation: 50 Vitest tests, TypeScript check, and production client build
- [ ] Complete authenticated production mobile inspection after the owner provides an accessible public alias or browser session; the generated Vercel deployment is protected by SSO and the local sandbox has no Supabase integration variables

## Deployment workflow correction — 2026-08-31

- [x] Fix the GitHub Actions Vercel deployment workflow failure caused by passing an empty `--token=""` value during `vercel pull`
- [x] Validate the corrected workflow configuration and push it to `chike2510/securechat`


## Deployment workflow verification — 2026-08-31

- [x] Confirm the corrected GitHub Actions workflow completed successfully for commit `912b441`
- [x] Confirm Vercel’s GitHub deployment status completed successfully for commit `912b441`

## Mobile responsiveness and multi-device recovery — 2026-08-31

- [x] Correct the mobile chat shell so the viewport is never wider than the device and message cards remain fully visible
- [x] Preserve a polished responsive layout at desktop widths while using mobile-first sizing constraints
- [ ] Repair peer profile-photo rendering in the direct-chat header and retain a safe avatar fallback only when the photo genuinely fails
- [x] Define a secure multi-device chat-recovery flow so encrypted history can be recovered without storing plaintext or exposing private keys
- [x] Add regression coverage for responsive chat constraints, peer-photo URL handling, and encrypted recovery behavior


## Mobile follow-up verification — 2026-09-01

- [x] Run 52 automated tests, TypeScript check, and production build after the responsive and recovery changes
- [x] Capture a narrow mobile preview; the sandbox displays the expected public-auth setup fallback because its Supabase variables are unavailable
- [ ] Confirm the uploaded peer profile photo renders in the authenticated production chat on the owner’s public alias


## Production peer-photo result — 2026-09-01

- [x] Inspect the authenticated production conversation and friend-profile payload
- [x] Confirm private storage readiness is healthy
- [ ] Have the peer account upload and save its profile picture again through Profile & Settings, then recheck that the signed URL appears in the conversation payload


## Peer-photo fallback implementation — 2026-09-01

- [x] Add a private-storage lookup for the newest valid `profile-images/<subject>/*.bin` object when profile metadata is missing or stale
- [x] Cover the fallback object selection with a server regression test
- [x] Re-run the complete 53-test suite and TypeScript check
- [ ] Deploy the fallback and verify `profileImageUrl` is non-null in the authenticated production conversation payload
