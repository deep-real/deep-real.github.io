# DeepREAL public application service

The public pages in `opportunities/` preserve the existing DeepREAL application design. This service receives their PDF uploads and forwards validated applications to the existing **DeepREAL Application Intake Standard** Power Automate flow. It requires a Cloudflare account, a D1 database, private R2 storage, and the private `APPLICATION_WEBHOOK_URL` secret. None is configured by this draft.

## Complete hosting setup before merging

1. Sign in to the selected Cloudflare account and confirm Workers, D1, and R2 are available. Review any plan or billing requirements in that account before enabling a service.
2. In this directory, install the pinned Wrangler dependency. Create the `deepreal-applications` D1 database and `deepreal-application-backups` R2 bucket. Replace `REQUIRES_ACCOUNT_SETUP` in `wrangler.jsonc` with the returned database ID.
3. Set `APPLICATION_WEBHOOK_URL` using Wrangler's interactive secret input. Use the existing Microsoft flow URL privately; never commit it or put it in public page code.
4. Apply `migrations/0001_applications.sql` to the remote D1 database, then deploy the service.
5. Set `opportunities/assets/config.js` to the actual public service address ending in `/api/applications`. This address is public; it must contain no credential or signature.
6. Verify anonymous submissions, the notification in `naq5rd@virginia.edu`, and the CSV row and PDF in the OneDrive folder below. Then switch the three links in `opening.html` to `/opportunities/apply/phd/`, `/opportunities/apply/postdoc/`, and `/opportunities/apply/student/`.

Keep the original public form active until the replacement passes the live check.

## Data and delivery

- Destination mailbox: `naq5rd@virginia.edu`.
- OneDrive destination: `/80-DeepREAL & UVA/801-DeepREAL PhD Application/2026 PhD Application All`.
- The register remains `applications.csv`, with its existing 21 columns. Existing application data stays in OneDrive.
- The service preserves new records and PDFs privately before forwarding. Repeat requests with the same idempotency key return the original application ID.
- The browser origin is restricted to `https://deep-real.github.io`; applicant sign-in is not required.
- Keep the Microsoft flow enabled with concurrency one. Reauthenticate its existing Outlook and OneDrive connections if delivery stops. Check application IDs before replaying any failed run.

The leading underscore in this directory's repository name keeps server source out of the Jekyll output. It contains no runtime secrets or applicant data.

## Validation

`npm test` requires a Node version supporting TypeScript stripping (Node 24 is suitable). Tests cover all three form branches, input and PDF validation, CSV formatting, and the Microsoft delivery payload. The equivalent UVA-hosted copy passed an end-to-end notification and OneDrive delivery test on November 18, 2026. This standalone Cloudflare deployment still needs its own live verification after account setup.
