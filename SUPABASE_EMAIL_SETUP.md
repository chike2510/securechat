# SecureChat Supabase email setup

The registration flow passes the current SecureChat origin as `emailRedirectTo`, so confirmation links return to the deployed app instead of `localhost`. Supabase must allow that URL in its redirect list.

## Authentication URL settings

In the Supabase dashboard, open **Authentication → URL Configuration** and set the production **Site URL** to:

```text
https://securechat-peach-two.vercel.app
```

Add the same URL under **Redirect URLs**. Keep the local development URL only if local testing is still needed.

## SecureChat email branding

In **Authentication → Email Templates → Confirm signup**, change the subject to:

```text
Confirm your SecureChat account
```

Use SecureChat in the heading and body, for example:

```html
<h2>Confirm your SecureChat account</h2>
<p>Thanks for joining SecureChat. Confirm your email address to finish creating your account.</p>
<p><a href="{{ .ConfirmationURL }}">Confirm email address</a></p>
<p>If you did not create this account, you can ignore this email.</p>
```

In **Project Settings → General**, set the project name to **SecureChat** where available. The sender may continue to display Supabase Auth on the free default mail service; changing the visible sender address/name requires configuring a custom SMTP provider in Supabase. The application cannot safely change the provider-level sender identity from browser code.

## Confirmation behavior

After a new registration, the user should receive the branded confirmation email, open the confirmation link, return to SecureChat, and then sign in with either their email address or matric number. The redirect URL must be added to Supabase before testing a fresh registration.
