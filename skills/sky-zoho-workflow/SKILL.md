---
name: sky-zoho-workflow
description: "Use configured Zoho Books and Mail integrations for invoices, contacts, payments, reminders and email. Activate only for a requested Zoho workflow."
tags: [zoho, invoice, email, billing, crm]
---

# Zoho workflow

Use optional, authorized Zoho Books/Mail tools or the official APIs directly. There is no framework business server or dashboard. Discover the configured integration/tools for the current user and project; never assume a vendor MCP tool name or another user's account.

## Account and authorization

1. Confirm the selected user/project integration is enabled; obtain credentials through secure configuration, never prompts, source, logs or another project's environment.
2. Resolve the Zoho organization/contact/mail account using the authorized account's actual API data. Match recipients/contacts unambiguously. Do not inherit original client mappings, signatures, account defaults or history.
3. Check scopes before attempting the requested operation. Use the user's explicit instruction as the authorization boundary. Draft operations and sends/deletes/financial changes are distinct actions; do not infer permission for additional external mutations.
4. On missing configuration, report exactly what is missing. On failure, inspect the provider error, correct supported parameters and use bounded retries; avoid duplicate invoices/emails through provider-supported idempotency or a verified draft/message identifier.

## Zoho Books

Preserve create, edit, send and void invoice operations; list/search by client, status and date; items, tax, contact and expense management; sent/paid status, payment records and reminders; PDFs, recurring invoices and credit notes. Complete the authorized operation rather than merely describing it, and report actual provider identifiers/results.

Retain the original template choices as configurable integration-level drafts:

- `monthly_retainer`: configured retainer/service lines and applicable usage credits.
- `simple_service`: configured single-service line.
- `project_deposit`: configured upfront percentage and proposal reference.
- `project_balance`: remaining agreed project balance linked to the prior deposit.

Resolve amounts, terms, contacts, currencies and tax treatment from authorized project/vendor configuration and the user's request. Never invent a tax jurisdiction/rate, contact mapping or payment status. Template calculation and equivalent behavior reconstructed from the available contract must be tested; unavailable original server behavior is inferred, not verified parity.

## Zoho Mail

Preserve inbox/sent/draft/folder reads; sends and replies; move, label and organization actions; sender/subject/date searches; invoice PDF attachments and cover emails; payment reminders. Use the selected authorized mail account and user-configured signature. A Books invoice draft and a cover-email draft remain separately reviewable; sending either requires the relevant authorization.

## Email formatting

Use professional, concise, direct language. Apply the configured sender identity/signature, preserve thread/attachment context, avoid decorative horizontal rules or emojis by default, and follow any explicitly selected project communication style. Never load a prior user's signature or private knowledge file as the new user's identity.

## Completion and errors

Report the selected account/organization, operation, provider object identifier and actual delivery/payment state where relevant. Do not claim a draft was sent, a reminder was delivered or an invoice paid without provider evidence. Preserve a recoverable local draft/context on failure, redact credentials, and expose required reauthorization without contacting unrelated accounts.
