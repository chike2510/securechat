# SecureChat

SecureChat is a university-focused secure academic document-exchange platform for registered FUPRE student users. It provides authenticated profiles, controlled conversations, encrypted text and attachment handling, private storage, and responsive academic communication.

## Project topic

**Design and Implementation of a Secure Academic Document Exchange Platform for FUPRE Students**

## Problem focus

FUPRE students exchange project reports, assignments, academic records, recommendation documents, and departmental files through general-purpose messaging platforms. SecureChat provides a focused environment for registered users to exchange these materials within controlled conversations, without claiming official institutional identity verification or replacing general-purpose platforms.

## Run locally

Use the existing VS Code Run and Debug configuration or run `pnpm run dev` from the integrated terminal. Configure the required Supabase values using the project environment setup before testing authenticated flows.

## Scope of this implementation

The existing encrypted conversation, attachment, private storage, access-control, profile, friend-request, group, and recovery flows are preserved. The interface now presents the product as an academic-document exchange platform, with document-oriented labels and user guidance. Expiring links, revocation, departmental roles, approval workflows, and audit logs remain future enhancements unless separately implemented.
