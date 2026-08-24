# Live verification

- Production URL shown by the user: https://securechat-peach-two.vercel.app
- The landing page loads and displays the SecureChat auth UI.
- A browser-safe GET request to `/api/trpc/auth.me?batch=1&input=%7B%7D` returned HTTP 500 with `FUNCTION_INVOCATION_FAILED`.
- The Vite public-variable fix has been committed locally and pushed to the GitHub repository as commit `0c109ad`; the live alias may still be serving the preceding deployment.
- Do not submit credentials from the user screenshot during debugging.
