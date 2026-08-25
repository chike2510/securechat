# SecureChat Supabase email setup

SecureChat uses Supabase Auth for email/password accounts, but confirmation is completed with a **six-digit code inside the app**. The registration form only opens the code screen after Supabase successfully accepts the registration request.

## Authentication URL settings

In the Supabase dashboard, open **Authentication → URL Configuration** and set the production **Site URL** to:

```text
https://securechat-peach-two.vercel.app
```

The OTP flow does not depend on a confirmation-link redirect. You may keep the deployed origin in **Redirect URLs** for other Supabase Auth flows:

```text
https://securechat-peach-two.vercel.app/auth/confirmed
```

## SecureChat email branding and OTP template

In **Authentication → Email Templates → Confirm signup**, change the subject to:

```text
Confirm your SecureChat account
```

Replace the link-only body with a token-based message. The important value is `{{ .Token }}`; do not use only `{{ .ConfirmationURL }}` because the application is expecting a six-digit code.

```html
<h2>Confirm your SecureChat account</h2>
<p>Thanks for joining SecureChat. Enter this six-digit code in the app to finish creating your account:</p>
<p style="font-size: 28px; letter-spacing: 8px; font-weight: 700;">{{ .Token }}</p>
<p>Enter this code in SecureChat to confirm your account. If you did not create this account, you can ignore this email.</p>
```

In **Project Settings → General**, set the project name to **SecureChat** where available. The sender may continue to display Supabase Auth on the free default mail service; changing the visible sender address/name requires configuring a custom SMTP provider in Supabase. The application cannot safely change the provider-level sender identity from browser code.

## Confirmation behavior

After a new registration, Supabase sends the signup email only when the request succeeds. SecureChat then displays the code entry state, calls `supabase.auth.verifyOtp({ email, token, type: "signup" })`, creates the session, and opens the chat workspace. The user can request another code from the same state with **Resend code**.
