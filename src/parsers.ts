import * as cheerio from 'cheerio';
import type { AlertEmail } from './gmail.js';

export interface Job {
  source: string; // "LinkedIn" | "Indeed" | "Naukri" (merged after dedupe)
  title: string;
  company: string;
  location: string;
  url: string;
  snippet: string;
  receivedAt: string;
}

type Src = 'LinkedIn' | 'Indeed' | 'Naukri';

function detectSource(from: string): Src | null {
  const f = from.toLowerCase();
  if (f.includes('linkedin')) return 'LinkedIn';
  if (f.includes('indeed')) return 'Indeed';
  if (f.includes('naukri')) return 'Naukri';
  return null;
}

// Returns a clean, tracking-free job URL, or null if the link is not a job link.
function canonical(src: Src, href: string): string | null {
  try {
    if (src === 'LinkedIn') {
      const m = href.match(/linkedin\.com\/(?:comm\/)?jobs\/view\/(?:[^/?]*?-)?(\d{6,})/i);
      return m ? `https://www.linkedin.com/jobs/view/${m[1]}` : null;
    }
    const u = new URL(href);
    if (src === 'Indeed') {
      if (!/indeed\./i.test(u.hostname)) return null;
      const jk = u.searchParams.get('jk');
      return jk ? `${u.origin}/viewjob?jk=${jk}` : null;
    }
    if (src === 'Naukri') {
      if (!u.hostname.endsWith('naukri.com') || !u.pathname.includes('job-listings')) return null;
      return u.origin + u.pathname;
    }
  } catch {
    /* malformed href */
  }
  return null;
}

const NOISE =
  /^(view jobs?|view|apply( now)?|easy apply|see all jobs|actively recruiting|be an early applicant|promoted|new|save|\d+\+? (applicants?|connections?|school alumni.*)|unsubscribe.*)$/i;

function textLines(html: string): string[] {
  const withBreaks = html.replace(/<\s*(br|\/p|\/div|\/td|\/tr|\/h[1-6]|\/li|\/a)\b[^>]*>/gi, '\n');
  return cheerio
    .load(withBreaks)
    .text()
    .split('\n')
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

const LOCATION_HINT =
  /\b(hyderabad|bengaluru|bangalore|pune|chennai|mumbai|delhi|noida|gurugram|gurgaon|kolkata|remote|work from home|wfh|hybrid|india)\b/i;

export function parseEmail(email: AlertEmail): Job[] {
  const src = detectSource(email.from);
  if (!src || !email.html) return [];

  const $ = cheerio.load(email.html);
  const groups = new Map<string, any[]>(); // canonical url -> anchors
  $('a[href]').each((_, el) => {
    const url = canonical(src, $(el).attr('href') ?? '');
    if (url) groups.set(url, [...(groups.get(url) ?? []), el]);
  });

  const jobs: Job[] = [];
  for (const [url, anchors] of groups) {
    // Title = first meaningful anchor text (skip "View job", logos, etc.)
    const title =
      anchors
        .map((a) => $(a).text().replace(/\s+/g, ' ').trim())
        .find((t) => t.length > 3 && !NOISE.test(t)) ?? '';
    if (!title) continue;

    // Climb to the largest ancestor that contains only THIS job's link.
    let best = $(anchors[0]);
    let node = best.parent();
    for (let i = 0; i < 8 && node.length; i++) {
      const urls = new Set(
        node
          .find('a[href]')
          .toArray()
          .map((a) => canonical(src, $(a).attr('href') ?? ''))
          .filter(Boolean),
      );
      if (urls.size > 1) break;
      best = node;
      node = node.parent();
    }

    const lines = textLines($.html(best)).filter((l) => l !== title && !NOISE.test(l));
    let company = lines[0] ?? '';
    let location = '';
    if (company.includes(' · ')) {
      [company, location] = company.split(' · ').map((s) => s.trim());
    }
    if (!location) {
      location = lines.slice(1).find((l) => LOCATION_HINT.test(l)) ?? lines[1] ?? '';
    }

    jobs.push({
      source: src,
      title,
      company,
      location,
      url,
      snippet: lines.join(' ').slice(0, 600),
      receivedAt: email.date,
    });
  }
  return jobs;
}
