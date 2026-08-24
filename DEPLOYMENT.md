# SecureChat deployment

SecureChat uses GitHub Actions to deploy to Vercel whenever a commit is pushed to the `main` branch. The workflow runs type-checking and tests before creating a production deployment.

## Required GitHub repository secrets

Add these secrets under **GitHub → Settings → Secrets and variables → Actions** for `chike2510/securechat`:

| Secret | Purpose |
|---|---|
| `VERCEL_TOKEN` | A Vercel access token used by GitHub Actions to authenticate deployments. |
| `VERCEL_ORG_ID` | The Vercel team or account identifier that owns the project. |
| `VERCEL_PROJECT_ID` | The Vercel project identifier for SecureChat. |

The values must be added as GitHub Actions secrets. Do not place them in the repository, workflow file, frontend code, or committed `.env` files.

## One-time setup

In Vercel, make sure the project points to the `chike2510/securechat` repository, uses the `main` production branch, and has the repository root as its root directory. The `vercel.json` file supplies the client build command, output directory, and SPA rewrite.

After the three secrets are saved, push a commit to `main` or open the workflow under **GitHub → Actions** and choose **Run workflow**. The workflow will install dependencies, run `pnpm check`, run `pnpm test`, pull the Vercel project settings, build the project, and deploy the prebuilt output to production.

## Supabase Auth configuration

Connect Supabase to the Vercel project and make the following public environment variables available to both Preview and Production deployments:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_URL` | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `SUPABASE_PUBLISHABLE_KEY` | Supabase publishable/anon key used by the browser and server token verifier. |

The application also accepts the older `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `SUPABASE_ANON_KEY` names. The browser only reads the URL and publishable/anon key. **Never expose `SUPABASE_SERVICE_ROLE_KEY` or any other privileged secret to browser code.**

Enable the Email provider in Supabase Auth. Registration sends the user’s `name` and `matricNumber` as Supabase user metadata; the SecureChat API then provisions or updates the matching local profile after validating the Supabase access token. If email confirmation is enabled, the user must confirm the message before signing in. For a controlled defense demonstration, either complete that confirmation step for each test account or disable email confirmation temporarily in the Supabase Auth settings.

SecureChat supports both sign-in forms required for the prototype: users can enter their email directly, or enter their matric number. For matric-number sign-in, the server resolves the matric number to the existing profile email and performs the password exchange through Supabase; passwords are not stored in the SecureChat database.

## Required Vercel project variables

In addition to the Supabase variables above, configure the existing application variables used by the database and API, especially `DATABASE_URL`. The deployed API must be able to reach the MySQL/TiDB database, and the database schema must contain the unique `users.matricNumber` field used by the registration profile.

## Important hosting note

The Vercel workflow deploys the frontend and serverless API functions. Persistent Socket.IO connections are not guaranteed on Vercel’s serverless runtime; the client should use the polling-compatible refresh path when a persistent socket is unavailable. Database and runtime environment variables required by the API must also be configured in the Vercel project settings.

## Security boundary

Supabase handles account credentials and issues access tokens. SecureChat verifies those tokens on the server, maps the Supabase identity to a local profile, and authorizes conversation access by participant membership. Message plaintext is encrypted in the browser; only ciphertext, IV/nonce, timestamps, and delivery metadata are sent to or stored by the SecureChat server.
