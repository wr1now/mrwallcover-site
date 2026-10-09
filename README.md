# Mr Wallcover

Marketing site for [Mr Wallcover](https://www.mrwallcover.com), Dorin Burcus’s London practice for premium wallcoverings. Static files, built with Astro and Tailwind.

Surveying, management, supply, installation and aftercare for hotels, flagship retail and private homes.

## Run it locally

Node.js 22.12 or newer.

```bash
npm install
npm run dev
```

The dev server prints a local address. Production files are what you deploy:

```bash
npm run build
npm run preview
```

`npm run build` writes the site to `dist/`.

## Edit the copy

Wording lives in `src/content/`. The pages read those files. You do not need to touch the layout to change a sentence.

| File | What it holds |
| --- | --- |
| `src/content/home.json` | Home page |
| `src/content/services.json` | Services and materials |
| `src/content/aftercare.json` | Aftercare and the guarantee |
| `src/content/projects.json` | Portfolio |
| `src/content/about.json` | About |
| `src/content/faq.json` | Questions |
| `src/content/contact.json` | Quotation page |
| `src/content/privacy.json` | Privacy notice |
| `src/content/alts.json` | Image descriptions |
| `src/content/team.json` | Future team page. Not in the menu yet |
| `src/data/facts.json` | The fact sheet: brand, founder, email, coverage, profiles and the one description sentence (160 characters or fewer) |
| `src/config.ts` | Form, analytics, award line. Re-exports the fact sheet |

The public email address is `info@mrwallcover.com`, set once in `src/data/facts.json`. The footer, the form, the structured data and `llms.txt` all read that file. Paste its description sentence unchanged into every outside profile.

The phone number is not in the repository. See `SITE_PHONE` below.

The award line on the site is “Award-winning (2021)”. The award’s name will be added later. See the comment in `src/config.ts`. Do not invent a title.

Photographs are in `public/media/`. Hotel photographs that are not our own are used small, as project cards. Brown’s Hotel photographs and films were taken on site and are shown in full on that project.

## Enquiry form

The public site posts to FormSubmit, which forwards the note to `info@mrwallcover.com`. The endpoint in `src/config.ts` is FormSubmit’s alias, not a mailto link. The visitor chooses email or phone. There is no four-second wait.

A private lead store exists for when you run it yourself. It is off in the GitHub Pages build. Nothing on Pages can save a lead to disk.

```bash
LEAD_API_ENABLED=1 LEAD_STAFF_TOKEN=choose-a-long-token LEAD_NOTIFIER=file npm run lead-api
```

Then build the site with `PUBLIC_LEAD_API` set to that server’s origin, for example `http://127.0.0.1:8787`. Leads are written under `data/leads/`, which is not committed. A failed notification leaves the lead in place. See `docs/architecture.md` and `docs/owner-guide.md`.

| Variable | Value |
| --- | --- |
| `PUBLIC_FORM_PROVIDER` | `formsubmit` in the file. Also `mailto`, `netlify`, or `formspree` |
| `PUBLIC_FORM_ENDPOINT` | Overrides the FormSubmit alias |
| `PUBLIC_LEAD_API` | Origin of the private store. Empty on the live build |
| `PUBLIC_ANALYTICS_SRC` | Optional cookie-free analytics script. Empty means no script and no cookies |
| `SITE_PHONE` | Build-time only. UK mobile or international form. Never stored in the repository. Set it as the GitHub Actions secret `SITE_PHONE` to show the click-to-reveal phone and WhatsApp controls; leave it unset and those controls do not render at all |

Do not put lead files, room photographs or the staff token in the repository.

## Deploy to GitHub Pages

This is the intended host. DNS stays at names.co.uk.

1. Push this repository to GitHub.
2. In the repository, open **Settings → Pages → Build and deployment** and choose **GitHub Actions**.
3. The workflow `.github/workflows/pages.yml` builds the site and deploys `dist/` on every push to `main`.
4. Under **Custom domain**, enter `www.mrwallcover.com`. The file `public/CNAME` already contains that host, so the built site carries it.
5. After the certificate is issued, turn on **Enforce HTTPS**.

GitHub redirects the apex domain to `www` because the CNAME file names `www.mrwallcover.com`.

### DNS at names.co.uk

Leave the nameservers where they are. Do not point them at Cloudflare, Netlify or anywhere else. In the names.co.uk DNS panel for `mrwallcover.com`, remove any parking or old A, AAAA and CNAME records on the apex and on `www`, then add exactly these:

| Host | Type | Value |
| --- | --- | --- |
| `@` | A | `185.199.108.153` |
| `@` | A | `185.199.109.153` |
| `@` | A | `185.199.110.153` |
| `@` | A | `185.199.111.153` |
| `www` | CNAME | `YOUR_GITHUB_USERNAME.github.io` |

`@` is the apex (`mrwallcover.com`). If the panel uses a blank host for the apex, that is the same record.

The CNAME target is the GitHub Pages host of the account that publishes the site, the one you would open at `https://YOUR_GITHUB_USERNAME.github.io`. It is not the repository name. If an organisation owns the site, use that organisation’s `github.io` host.

DNS can take a few hours. HTTPS in the GitHub Pages settings will not succeed until these records are live.

## Cloudflare Pages or Netlify

The same build works on either host with no adapter and no extra config file beyond what is already here.

**Cloudflare Pages.** Create a project from the Git repository. Framework preset: Astro. Build command: `npm run build`. Output directory: `dist`. Do not add a Wrangler config. This does not change the names.co.uk instructions above. Those records point the domain at GitHub Pages. Use Cloudflare only if you later decide to move the site, and then replace the DNS, do not stack it on top.

**Netlify.** `netlify.toml` already sets the build command and the publish directory `dist`. Connect the repository and deploy. For stored form submissions, set `PUBLIC_FORM_PROVIDER` to `netlify` as described above.

## Pages

- `/` Home
- `/services/` Services
- `/aftercare/` Aftercare
- `/projects/` Work, with a page for each commission
- `/about/` Dorin Burcus
- `/contact/` Quotation
- `/faq/` Questions
- `/privacy/` Privacy notice
