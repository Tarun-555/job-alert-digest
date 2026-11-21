import 'dotenv/config';
import fs from 'node:fs';
import { config } from './config.js';
import { fetchAlertEmails } from './gmail.js';
import { parseEmail, type Job } from './parsers.js';
import { scoreJob, type ScoredJob } from './score.js';

const SEEN_PATH = './data/seen.json';
const showAll = process.argv.includes('--all');

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);

function loadSeen(): Set<string> {
  try {
    return new Set(JSON.parse(fs.readFileSync(SEEN_PATH, 'utf8')));
  } catch {
    return new Set();
  }
}

function saveSeen(seen: Set<string>) {
  fs.mkdirSync('./data', { recursive: true });
  fs.writeFileSync(SEEN_PATH, JSON.stringify([...seen], null, 2));
}

// Same title+company across LinkedIn/Indeed/Naukri = one job, with merged sources.
function dedupe(jobs: Job[]): Job[] {
  const map = new Map<string, Job>();
  for (const j of jobs) {
    const key = `${norm(j.title)}|${norm(j.company)}`;
    const existing = map.get(key);
    if (!existing) map.set(key, { ...j });
    else if (!existing.source.includes(j.source)) existing.source += `, ${j.source}`;
  }
  return [...map.values()];
}

function toMarkdown(jobs: ScoredJob[]): string {
  const cell = (s: string) => s.replace(/\|/g, '/');
  const rows = jobs.map(
    (j) =>
      `| ${j.score} | [${cell(j.title)}](${j.url}) | ${cell(j.company)} | ${cell(j.location)} | ${j.source} | ${j.matched.join(', ')} |`,
  );
  return [
    `# Job digest ${new Date().toISOString().slice(0, 10)}`,
    '',
    '| Score | Title | Company | Location | Source | Matched |',
    '|---|---|---|---|---|---|',
    ...rows,
  ].join('\n');
}

async function sendTelegram(jobs: ScoredJob[]) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId || jobs.length === 0) return;

  const lines = jobs.map(
    (j, i) =>
      `${i + 1}. <a href="${j.url}">${esc(j.title)}</a> - ${esc(j.company)}, ${esc(j.location)} (${j.score}, ${esc(j.source)})`,
  );
  let chunk = `<b>${jobs.length} new matching jobs</b>\n`;
  const chunks: string[] = [];
  for (const line of lines) {
    if (chunk.length + line.length > 3800) {
      chunks.push(chunk);
      chunk = '';
    }
    chunk += line + '\n';
  }
  chunks.push(chunk);

  for (const text of chunks) {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) console.error('Telegram error', res.status, await res.text());
  }
}

async function main() {
  const emails = await fetchAlertEmails(config.gmailQuery);
  console.log(`Fetched ${emails.length} alert emails`);

  const parsed = emails.flatMap(parseEmail);
  console.log(`Parsed ${parsed.length} job links`);

  const scored = dedupe(parsed)
    .map(scoreJob)
    .filter((j): j is ScoredJob => j !== null && j.score >= config.minScore);

  const seen = loadSeen();
  const fresh = scored.filter((j) => showAll || !seen.has(j.url));
  const top = fresh.sort((a, b) => b.score - a.score).slice(0, config.topN);

  const md = toMarkdown(top);
  fs.mkdirSync('./out', { recursive: true });
  fs.writeFileSync(`./out/jobs-${new Date().toISOString().slice(0, 10)}.md`, md);
  console.log(top.length ? '\n' + md : '\nNo new matching jobs.');

  await sendTelegram(top);

  if (!showAll) {
    top.forEach((j) => seen.add(j.url));
    saveSeen(seen);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
