# Job Alert Digest

Reads your LinkedIn / Indeed / Naukri job-alert emails from Gmail (read-only),
extracts the jobs, removes duplicates, scores them against your skills, and prints
(or sends to Telegram) a ranked list of NEW jobs. Every link opens the original listing.

No scraping, no platform passwords. It only reads emails you already receive.

## 1. Gmail setup
1. Create the alerts on each platform (daily).
2. In Gmail, create a filter for the alert senders and apply the label `Job Alerts`.
   Open one real alert email first and check the actual sender address.

## 2. Google Cloud setup (once)
1. console.cloud.google.com -> new project -> enable **Gmail API**.
2. OAuth consent screen: External, add your own email as a test user.
   NOTE: while the app is in "Testing", refresh tokens expire after 7 days.
   For personal use, set publishing status to "In production" (you will see an
   "unverified app" warning for your own account, which is fine) to avoid re-auth.
3. Credentials -> Create OAuth client ID -> type **Desktop app**.
4. Copy the client ID and secret into `.env` (see `.env.example`).

## 3. Run
```bash
npm install
npm run auth        # opens a URL, approve read-only Gmail access, saves tokens.json
npm start           # prints and saves out/jobs-YYYY-MM-DD.md, only NEW jobs
npm run start:all   # ignore the "already seen" list
```

## 4. Schedule daily (Linux/macOS cron)
```
0 8 * * * cd /path/to/job-alert-digest && /usr/bin/env npm start >> run.log 2>&1
```
On GitHub Actions or another CI, store the contents of tokens.json in a secret named
GOOGLE_TOKENS_JSON, and persist data/seen.json between runs (cache or commit to a private repo).

## 5. Tuning
- Skills, title rules, location rules, exclusions: `src/config.ts`.
- Email templates change. If a platform returns 0 jobs, save one alert email's HTML
  and adjust `canonical()` / the line extraction in `src/parsers.ts`.
- Alert emails only contain short snippets, so scores come mostly from title and
  location. For a deeper match, open the top links and paste the description into Claude.
