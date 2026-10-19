# Private API contract

POST JSON `{ "action": "project.get", "payload": { "projectId": "…" } }` to the Supabase Edge Function `/functions/v1/designer-portal`. Pass the public project API key and the user's Auth bearer token. Responses are `{ "ok": true, "data": … }` or a bounded error `{ "ok": false, "error": { "code": "…", "message": "…" } }`. Request bodies are bounded to 2 MiB; document bytes use signed private Storage uploads.

| Capability | Actions | Permission / behaviour |
| --- | --- | --- |
| Account | `session`, `studio.create` | Verified email required; business staff role is independent of studio ownership. |
| Studio team | `studio.members.list`, `.save`, `.remove` | Studio owner manages editor/viewer membership; own owner membership cannot be removed this way. Existing verified user identity required. No invitation email is sent. |
| Catalogue | `catalog.products` | Approved product metadata only; no private pricing configuration. |
| Projects | `project.list`, `.get`, `.create`, `.save` | Server membership checks; viewer cannot mutate. Save requires `expectedRevision`. Incomplete but structurally valid drafts are allowed. |
| Documents | `upload.reserve`, `.complete`, `.status`, `document.status`, `.url`, `.extract` | Reserve declares filename, bytes and SHA-256; optional `priorDocumentId` starts a retained revision. Completion queues verification. Downloads require verification; extraction never confirms measurements. |
| Evidence | `evidence.confirm` | Explicit source check against the saved project revision. A later revision does not silently inherit confirmation. |
| Processing | `jobs.status` | Returns authorised status and sanitised errors; private worker inputs are not exposed. |
| Budgets | `estimate.preview`, `.issue`, `.list`, `.get`, `.pdf` | Preview can return information/review required with specific reasons. Only ready snapshots can issue. Issuance requires expected revision and idempotency key; current configuration is checked atomically. PDF remains pending until a successful worker result. |
| Client links | `share.create`, `.revoke` | A specific issued estimate, bounded expiry and a revocable hashed token. Reopening a project lists grants for revocation without recovering tokens. |
| Client read | `share.get`, `.pdf` | Token capability, no account sign-in. Both recheck expiry/revocation. PDF is proxied after checking the grant, rather than exposing a reusable private Storage URL. |
| Owner settings | `admin.config.get`, `.save`, `admin.agreement.save`, `admin.operations.get`, `.save` | Business owner only. Versioned, validated configuration; explicit project approvals; quota/processing flags. |
| Private history | `admin.history.list`, `.import` | Business owner only. Reviewed, bounded records with source hash/citations and amount roles; idempotent by source/reference. No current rate changes or source-file fetch. |
| Completion evidence | `admin.actuals.list`, `.save`, `.review` | Business staff can append revision-bound actual time/vehicle evidence and explicit correction chains. Only the business owner can review proposals. Selling rates are unchanged. |
| Pilot comparisons | `admin.pilot.list`, `.save` | Business owner only. Immutable comparison of an issued estimate with an independent current-price breakdown; optional historical reference or verified project document. |

The SQL migration implements the underlying transaction, role, revision, immutability and lease boundaries. The API keeps service-role credentials on the server. Direct anonymous/authenticated table writes or worker-function calls are not permitted.

The worker's three job types are `document.verify`, `document.extract` and `estimate.pdf`. Workers claim a bounded lease, download/upload through private Storage, and finish with the current lease token. Source hashes, file counts and PDF paths are checked when publishing results. Job retry exhaustion becomes visible; it never changes a failed operation into a success message.

Project drafts support `buildingType`, a wall/ceiling `surfaceKind`, dimensioned `ceiling` scope, `programme.materialReadiness`, and typed `resources` lists for material requirements, preparation, sample approvals and aftercare. Incomplete geometry is valid draft data but not complete pricing evidence. Resource document IDs cannot reference another project or turn a quarantined source into an approved sample.

`admin.agreement.save` binds approval to the current source/profile/scope fingerprint. Without explicitly approved wider quantity bounds it binds exact measured quantities. Changing the address, product, instructions, preparation, access, programme or logistics requires review. Structured `serviceEntries` price current approved hours/days/visits for surveying, management or additional preparation; conflicting duplicate legacy allowances are rejected.
