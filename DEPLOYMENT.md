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

## Important hosting note

The Vercel workflow deploys the frontend and serverless API functions. Persistent Socket.IO connections are not guaranteed on Vercel’s serverless runtime; the client should use the polling-compatible refresh path when a persistent socket is unavailable. Database and runtime environment variables required by the API must also be configured in the Vercel project settings.
