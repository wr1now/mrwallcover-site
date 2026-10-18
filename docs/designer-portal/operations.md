# Private-service setup and verification

## Environments

Use separate staging and production Supabase projects. Select the specific London region `eu-west-2`; a general European region does not guarantee London. Review provider data handling rather than treating region selection as a compliance certificate.

Apply the designer migrations in order: `202610180002_designer_portal.sql`, `202610180003_designer_notifications.sql`, then `202610180004_designer_learning.sql`. Set up verified email OTP with a real transactional sender and the approved website origin. Bootstrap the business owner through the private SQL `designer_set_staff` function after checking the actual verified Auth user ID/email. A studio owner is not automatically a Mr Wallcover pricing administrator.

Deploy `supabase/functions/designer-portal/index.ts`. Keep private service credentials in platform secrets. Configure exact allowed origins, public site URL and the disabled/enabled switches documented in that entry point. Build-time browser variables are only `PUBLIC_DESIGNER_PORTAL_ENABLED`, `PUBLIC_DESIGNER_PORTAL_URL` and `PUBLIC_DESIGNER_PORTAL_ANON_KEY`. The URL is the Supabase project origin, not a service key or storage URL.

Private API variables: `DESIGNER_PORTAL_ENABLED=true`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DESIGNER_PORTAL_ALLOWED_ORIGINS` (comma-separated exact origins), `DESIGNER_PORTAL_SITE_URL` and the verified owner/staff email allowlists `DESIGNER_PORTAL_OWNER_EMAILS` / `DESIGNER_PORTAL_STAFF_EMAILS`. Never put service credentials into an Astro `PUBLIC_` variable. `supabase/config.toml` deliberately disables gateway JWT verification for the two public share actions; the handler independently authenticates every other action with Auth and server-derived permissions. Its localhost Auth settings are development defaults and must be replaced for staging/production.

The public guide can build without cloud services. In that mode the workspace honestly supports preparing a draft and explicitly downloading/reopening it. It must not report saved cloud files, completed submissions or generated budgets.

### Email-code templates for new and existing users

Install the supplied code-bearing templates before enabling sign-in. The workspace requests an email OTP and verifies the entered value with `type: "email"`. Supabase documents using `{{ .Token }}` for this flow; the portal does not consume a magic-link callback. [Passwordless email sign-in](https://supabase.com/docs/guides/auth/auth-email-passwordless), [email template variables and verification](https://supabase.com/docs/guides/auth/auth-email-templates).

`supabase/config.toml` binds `auth.email.template.confirmation` to [confirmation.html](../../supabase/templates/confirmation.html) and `auth.email.template.magic_link` to [magic-link.html](../../supabase/templates/magic-link.html). Both templates contain only generic workspace wording and the OTP; they include no user metadata, email address, project content, external images or authentication links. Existing signup/confirmation gates, expiry and rate limits are preserved. Restart the local Supabase stack after changing these files. [Local template configuration](https://supabase.com/docs/guides/local-development/customizing-email-templates).

For **each hosted staging or production project**, select the exact project in the Supabase Dashboard and open **Authentication → Email Templates**:

1. Open **Confirm sign up**. Set the subject to `Your Mr Wallcover email confirmation code`, replace the HTML body with `supabase/templates/confirmation.html`, and save. This covers the initial email confirmation when the account is new.
2. Open **Magic Link** (the passwordless email/OTP template). Set the subject to `Your Mr Wallcover sign-in code`, replace the HTML body with `supabase/templates/magic-link.html`, and save. This covers returning verified users.
3. Keep email confirmations enabled, configure the approved sender/SMTP service and the environment's actual Site URL/redirect allowlist, then inspect the saved templates. Retain the literal `{{ .Token }}` placeholder; do not paste a real code or add user/project metadata. Configuring local templates, applying database migrations or deploying the Edge Function does not install these hosted Dashboard templates. [Hosted template editing](https://supabase.com/docs/guides/auth/auth-email-templates).

The offline cloud contract test renders each configured template with a synthetic code and checks that the portal submits that code through email verification. It sends no email. Before activation, an operator must separately verify both a new-account confirmation and a returning-account sign-in using owner-controlled staging recipients, including invalid, expired and reused code rejection. Do not infer actual delivery or hosted template installation from the offline check.

## Workers

The `workers/designer_portal` Python service pulls jobs directly from the database. Its Modal definition uses UK containers and European routing. It passes no raw documents or OCR output as invocation arguments. Set the `mrwallcover-designer-portal` secret with `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `DESIGNER_PORTAL_WORKERS_ENABLED=false` until staging verification succeeds.

The scheduled trigger calls the regional processing function synchronously with no arguments. Only the small claimed/enabled result returns through the trigger's default control route; document bytes and private project data remain on the direct Storage path. This follows the current [Modal regional-routing invocation restrictions](https://modal.com/docs/guide/region-selection). Validate the deployed provider setup and logs; routing selection alone is not a claim about all provider metadata residency.

Build the worker image with the pinned requirements and ClamAV/Tesseract. The build updates scanner definitions with `freshclam`; rebuild regularly to keep them current and monitor definition age. A missing scanner or scanner error keeps the document quarantined and retries within the job limit. Do not bypass scanning to make an upload appear successful.

The worker requires both the environment switch and database settings. Configure processing limits and provider billing controls before enabling it. Database/storage/email charges need provider-level controls in addition to job limits. Optional hosted AI has no active integration or credential in this implementation.

The owner's processing screen sets `uploadsEnabled`, `workerEnabled`, `monthlyBudgetPence` and `worstCaseJobPence`. Job claims reserve three worst-case attempt allowances atomically against the monthly ceiling. This is a conservative budget reservation, not an assertion of actual provider charges. Set the worst-case figure using measured parser/OCR/PDF costs before enabling claims. An absent budget prevents processing. Missing antivirus definitions or network errors do not verify a document.

## Commercial activation

Use the owner configuration screen to publish a versioned rate card. Review product/type evidence and scope eligibility. Enter current package labour/setup allowances, survey and management rates, relevant logistics allowances and the project agreements needed for contract vinyl. Empty values stay unapproved. Keep private internal cost data out of public guide records.

Product approvals require the source instructions, date and explicit installation profile. Unknown technical facts remain blank; they are not inferred from a product photograph. Quantity-only approvals bind the product instructions and handling assumptions, wall height, openings, access, programme and logistics; changing those requires fresh review. Small-package labour uses fixed approved hours and an hourly rate, plus the approved setup/service allowances. Area limits determine eligibility, not package labour cost.

The legacy fixed package-price field is reference only. An approved package requires explicit setup, positive labour hours/rate, surveying and management components, including zero where genuinely included/not required. A small wide-vinyl scope can use an eligible approved package with project/prepared-wall approval; it cannot inherit the large-contract £26 area rate. Additional preparation uses linked, approved scope/service entries. Known unresolved preparation checklist actions cannot silently price as ordinary preparation.

Standard road charges require an approved effective-date window. Defaults deliberately have no approved end date, so an owner must establish the usable tariff window or approve a sourced vehicle/day amount. Discounts and exemptions never silently become standard charges. The public price guide is separately reviewed source content; changing private rates does not automatically publish new public prices.

Reprice representative historical *scopes* with the current card and compare the result with a fresh owner-prepared estimate. Do not use an old quotation total as the target for today's prices. Enable profile coverage incrementally after those comparisons. The older quantity-calculator calibration waiver does not establish pricing calibration for this new system.

### Historical imports and pilot evidence

Use `scripts/prepare-designer-history.py --review /private/review.json --out /private/import.json` with the worker Python dependencies available. The input is an explicitly reviewed list of original `.xlsx` paths, source-cell references and amount roles; it is not a folder-wide crawler or a current-rate extractor. The preparer reads cached values, records the original SHA-256 and exact sheet/cell locations, bounds archives, rejects macros/active embedded content, and never follows external workbook links. Missing numeric caches require review. Output must be outside this public repository, is created exclusively with private permissions, and is not printed to the console.

The owner's Private historical scopes panel reviews the local JSON before an explicit import. It requires classification/provenance acknowledgment and preserves alternatives, worker costs, unpriced values and duplicate totals. It does not fetch archive paths, upload original workbooks or set selling rates. A successful local preparation is not proof of database import. Keep the real source review/export and import receipt in private research.

Use the Current-price pilot panel against a complete issued budget. Enter the owner's independently prepared current labour/service breakdown, scope checks, VAT and tolerance; do not prefill it from the calculated result or an old quotation. Preserve mismatch reviews as well as matches. Completed-project observations record actual person-time, installation dates and separately attended vehicle dates/costs. Corrections append to the evidence chain. Owner review produces proposals only; changing selling rates still requires a separate approved configuration version.

## Staging acceptance

Run the bounded [staging verification harness](staging-verification.md) against an isolated synthetic-data project after provisioning. Its automatic checks complement the following provider/manual scenarios and cannot establish full acceptance alone. Keep receipt files private; no credentials, signed URLs, file contents or customer fields belong in a public CI artifact.

Use synthetic documents and separate test users, never customer recipients, for delivery tests:

1. Verify OTP delivery, expiry, logout and origin restrictions.
2. Prove studio A cannot read/update/upload/download studio B's project; viewers cannot edit and ordinary studio owners cannot approve prices.
3. Reserve, upload and verify a file. Confirm mismatched bytes/hash, malware/scanner failure, unsupported active content and exhausted quotas cannot become ready.
4. Extract a PDF/Office/image source; confirm evidence references and manual confirmation. Test unsupported native source retention and missing PDF scale/height.
5. Calculate each pricing mode against a manually approved result, including partial estimates, changed specifications, property-service review and delivery/storage logistics.
6. Generate a multi-page PDF; compare its totals with the issued snapshot and ensure no private notes or cost configuration leaks.
7. Expire/revoke a share and verify access stops. Originals must remain inaccessible through shares.
8. Interrupt a worker, reclaim the lease and prove stale output cannot publish or delete the replacement result.
9. Exercise budget/queue limits, backups and restore. Establish the business retention/deletion policy before admitting client records; do not silently reuse a consumer room editor's short expiry policy.

Uploaded revisions retain their original sources and confirmation provenance. Abandoned reservations conservatively retain quota; a staff cleanup/purge procedure is required before ongoing client use. Automated retention and full project export/deletion are not delivered by this change. Transactional notifications have a separate disabled-by-default implementation described below. A draft download is a scope export, not an archive of the project's documents and issued records. Handle any deletion request through a verified staff workflow that accounts for storage, revisions, backups and required business records.

## Monitoring

Watch queued-job age, exhausted retries, quarantined documents, OCR/manual-review frequency, estimate review reasons, PDF failures, private storage growth and spending limits. Logs must contain IDs/status/error codes, not file contents, email codes, signed URLs, share tokens or property values. Disable workers on a processing incident; preserve drafts and issued snapshots for review.

Notifications are not claimed as delivered merely because an outbox record exists or a provider accepts a request. Review the separate notification state, cap, provider and delivery checks below.


## Transactional notifications — implemented, unconfigured

`notifications.py` provides an independent pull worker and Modal dispatch function. It resolves only current studio members with verified Auth email addresses for issued-estimate and document-processing completion/failure events. It does not use project-contact fields or accept browser-supplied recipients. A pending recipient is checked at claim time and again immediately before the provider call. Revoked memberships, changed verified addresses or changed sender configuration stop that send.

Messages contain one generic workspace-update sentence and the configured sign-in link. They contain no project name, address, price, original document, attachment, authentication code or share capability. These are transactional workspace updates; no marketing, contact-list import or bulk outreach path exists.

The owner-only `admin.notifications.get` / `admin.notifications.save` API reads/sets this configuration: `enabled`, `provider` (`resend`), `sender` (plain email), `workspaceUrl` (HTTPS URL ending `/designer-portal/`), `monthlyCap`, `dailyStudioCap`, `monthlyBudgetPence` and `worstCaseAttemptPence`. Defaults are disabled with null sender/caps/budget. Null values can be saved while disabled; enabling requires all values and a budget covering three maximum attempt allowances. Usage reserves counts and money atomically before the first send attempt and conservatively commits the complete ceiling once execution begins. Set this allowance from measured full-cycle costs, including worker runtime, provider requests and up to twelve delivery checks; it is not a provider invoice. Apply provider billing and account limits as well.

Set these **private worker** variables only after activation review: `DESIGNER_PORTAL_NOTIFICATIONS_ENABLED=true`, `DESIGNER_PORTAL_NOTIFICATION_PROVIDER=resend`, `DESIGNER_PORTAL_NOTIFICATION_FROM`, `DESIGNER_PORTAL_NOTIFICATION_SITE_URL` and `RESEND_API_KEY`, plus the existing Supabase private service variables. The sender and workspace URL must exactly match the DB configuration. Keys or configured DB flags alone do not activate the worker. Verify the domain/sender and API permissions for sending and retrieving email status through the provider; no sender provisioning or credential was created by this implementation.

The [Resend idempotency contract](https://resend.com/docs/dashboard/emails/idempotency-keys) retains keys for 24 hours. Each DB notification freezes one payload and key; at most three send attempts run within a conservative 23-hour window. Ambiguous acceptance after retries or that window becomes `uncertain`; it requires manual provider reconciliation and is never automatically resent with a new key. A timeout while saving provider acceptance can be retried with the same key. A payload conflict also becomes `uncertain`.

`provider_accepted` means the API accepted the request. It does not mean inbox delivery or reading. The worker uses the documented [retrieve-email endpoint](https://resend.com/docs/api-reference/emails/retrieve-email), with up to twelve leased checks, to record an explicit `delivered`, `bounced` or `complained` event. Exhausted or unavailable checks retain `provider_accepted`; they do not invent delivery. There is no webhook receiver in this implementation. `notifications.status` and `project.get` expose a safe status projection to authorized studio members, excluding recipient emails and provider payloads. Raw delivery records and provider IDs remain service-only.

**Resend storage is a separate activation decision.** Its [security FAQ](https://resend.com/security) says stored data is in the United States and a European sending region does not change storage location. Review its DPA, transfers, retention and subprocessors, and update the relevant privacy notice before enabling this adapter. A UK Modal container does not make notification-provider storage UK-resident. If UK-only storage is required, keep this adapter disabled and select a compatible provider instead.

Staging must use synthetic, owner-controlled recipients: verify recipient removal, stable-key retry after an ambiguous request, lease fencing, count/money caps, permanent provider rejection, the 23-hour cutoff, accepted-versus-delivered status and provider-event reconciliation. No notification was sent or provider account created during local verification.

## CI workflow installation

The application and local checks are included in this branch. The intended additional pricing/database, Python-worker and portal browser CI steps are supplied in [ci-workflow.patch](ci-workflow.patch). GitHub rejected the original push because the connected OAuth credential lacked the `workflow` scope. The active workflow therefore remains the published main version; this patch has not been applied to GitHub's workflow.

Apply it from the repository root using `git apply docs/designer-portal/ci-workflow.patch`, review the result, then commit/push with a credential authorised to update workflows. Run the dedicated commands in README locally until the hosted steps are installed. Do not treat an existing site CI pass as evidence that the additional private-service checks ran.
