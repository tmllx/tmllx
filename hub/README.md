# Hub

Private Next.js app for the household. It is meant to be its own Vercel project, separate from the public tmllx.com GitHub Pages site. Do not deploy it from this repository until the environment below is ready. The public HTML files at the repository root are not part of this app.

There is no analytics. Every response sends `X-Robots-Tag: noindex, nofollow`, and `robots.txt` disallows the whole app.

## What it does

- Email magic-link sign-in through Auth.js. There is no public sign-up. An address can sign in only when it is on the invite allowlist.
- Two roles, checked on the server for every page and API:
  - `household`: meals, notes, photos, and settings
  - `photos`: the photos page only
- Smash Week meal planner. The household shares one menu, thumbs, and shopping list in Postgres.
- Notes to the girls. Placeholder page, household only. Nothing is stored yet.
- Photos. Links and embeds for iCloud Shared Album URLs saved in settings. No uploads and no photo storage.

## Grocery ordering

The shopping tab builds a list. It does not connect to Amazon, Whole Foods, Instacart, or any store. It does not take payment, and it has nowhere to put store logins, cards, or order credentials. Do not add those secrets to the environment. The copied text and JSON are for a person to shop from.

## Local setup

1. Install dependencies from this folder:

```bash
cd hub
npm install
```

2. Create a Postgres database and copy the env template:

```bash
cp .env.example .env.local
```

Set `DATABASE_URL` and `AUTH_SECRET`. For a quick local database:

```bash
# example only, if you already have Postgres
createdb hub_dev
```

`DATABASE_URL=postgresql://hub:hub@127.0.0.1:5432/hub_dev`

3. Create tables and the starter meal plan:

```bash
npm run db:push
npm run db:seed
```

4. Start the app:

```bash
npm run dev
```

Open http://localhost:3000. With `AUTH_DEV_LOGIN=true` (and not production), the sign-in page can continue as the seeded household or photos address. Magic links are printed in the server log when `EMAIL_SERVER` is empty.

Seeded local addresses, until you change `SEED_ALLOWLIST`:

| Email | Role |
| --- | --- |
| household@local.test | household |
| photos@local.test | photos |

Household settings in the meal planner start as Adult 1, Adult 2, Child 1, and Child 2. Rename them in Meals, Settings. Those names are not sign-in accounts.

## Environment variables

| Name | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Neon or any Postgres connection string |
| `AUTH_SECRET` | Yes | Auth.js session secret |
| `AUTH_URL` | Yes in production | Origin of this app, such as `https://hub.example.com` |
| `EMAIL_SERVER` | Yes in production | SMTP URL for magic links. Resend: `smtp://resend:YOUR_KEY@smtp.resend.com:465` |
| `EMAIL_FROM` | Yes in production | From address, on a domain you control |
| `SEED_ALLOWLIST` | For seeding | `email:household,email:photos` |
| `AUTH_DEV_LOGIN` | No | `true` shows local dev sign-in. Ignored when `NODE_ENV=production` |
| `DATABASE_DRIVER` | No | Set to `neon` to use the Neon HTTP driver. `.neon.tech` URLs do this automatically |

The app uses `@neondatabase/serverless` for Neon hosts and `pg` for a normal Postgres URL, including local development.

## Allowlist and roles

Add someone:

```bash
npm run allow -- add person@example.com household
npm run allow -- add person@example.com photos
```

List or remove:

```bash
npm run allow -- list
npm run allow -- remove person@example.com
```

`household` can open every page. `photos` can open `/photos` and read album links. Changing or removing a row takes effect on the next request, even if an old session cookie is still in the browser. There is no sign-up form that inserts into this table.

Sign-in attempts are limited to 5 per email and 20 per IP address in a 15 minute window. Unknown addresses get the same "if you are on the list" message and do not receive a link.

Album links are edited by a household member under Meals, Settings. Only `https://www.icloud.com/...` and `https://share.icloud.com/...` URLs are accepted.

## Deploy on Vercel

Do this when you are ready. This repository does not deploy the hub for you.

1. In Vercel, create a new project from this Git repository. Set the root directory to `hub`. Leave the public GitHub Pages site alone.
2. Install Neon from the Vercel Marketplace on that project (`vercel integration add neon`, or the dashboard). It provides `DATABASE_URL`.
3. Add `AUTH_SECRET`, `AUTH_URL`, `EMAIL_FROM`, and `EMAIL_SERVER` for Production and Preview. Do not set `AUTH_DEV_LOGIN` in production.
4. Deploy.
5. From a machine with the production `DATABASE_URL`, run:

```bash
npm run db:push
npm run db:seed
```

Set `SEED_ALLOWLIST` to the real invited addresses before seeding production. The local `.env.example` addresses are only for development.

6. Point a subdomain, or a path you choose, at this Vercel project. The app does not assume a particular host.

SQL migrations can also be generated with `npm run db:generate` and applied with `npm run db:migrate`.

## Tests

Role checks, the allowlist, rate limits, and the meal-plan rules are covered by Vitest. The suite expects Postgres at `TEST_DATABASE_URL` or `postgresql://hub:hub@127.0.0.1:5432/hub_test`.

```bash
npm test
```
