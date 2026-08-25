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

- After commit `0dd53fc`, the user-facing alias returned HTTP 200 with valid tRPC JSON for unauthenticated `auth.me`: `[{[0m"result":{"data":{"json":null}}}]` (terminal styling removed in the saved record). This confirms the Vercel ESM module-resolution failure is fixed.

- After commit `8f08d07`, Vercel deployed successfully at `https://securechat-d4givjxlx-chikeziri-emmanuel-onovo-s-projects.vercel.app`.
- The user-facing alias returned HTTP 200 with valid tRPC JSON for unauthenticated `auth.me`: `[{"result":{"data":{"json":null}}}]`. The compiled ESM import failure is resolved.

- After commit `41a834e`, Vercel deployed successfully at `https://securechat-owt1bxjod-chikeziri-emmanuel-onovo-s-projects.vercel.app`.
- The user-facing alias returned HTTP 200 with valid tRPC JSON for unauthenticated `auth.me`: `[{"result":{"data":{"json":null}}}]`. The final production serverless path is healthy.

- After commit `d4748c2`, Vercel deployed successfully at `https://securechat-6vrij6lvm-chikeziri-emmanuel-onovo-s-projects.vercel.app`.
- On the public `securechat-peach-two.vercel.app` alias, `/api/config` returned the connected Supabase URL and a publishable key using the `STORAGE_SUPABASE_*` fallback. The page now renders the normal SecureChat sign-in form instead of the runtime setup failure screen.

- Deployment `9862e675...` completed successfully and the public alias now serves JavaScript containing the deployed-origin confirmation redirect logic.
- The live page renders the normal SecureChat sign-in screen. The remaining confirmation-link test requires a fresh registration email; no further Supabase integration setup is needed from the code side.
