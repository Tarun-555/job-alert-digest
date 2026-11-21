import { google, type gmail_v1 } from 'googleapis';
import fs from 'node:fs';

export const REDIRECT_URI = 'http://localhost:3000/oauth2callback';
export const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

export interface AlertEmail {
  id: string;
  from: string;
  subject: string;
  date: string;
  html: string;
}

export function newOAuthClient() {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env');
  }
  return new google.auth.OAuth2(id, secret, REDIRECT_URI);
}

export const tokenPath = () => process.env.TOKEN_PATH ?? './tokens.json';

function authorizedClient() {
  const client = newOAuthClient();
  const raw =
    process.env.GOOGLE_TOKENS_JSON ??
    (fs.existsSync(tokenPath()) ? fs.readFileSync(tokenPath(), 'utf8') : '');
  if (!raw) throw new Error('No Google tokens found. Run: npm run auth');
  client.setCredentials(JSON.parse(raw));
  return client;
}

const decode = (data?: string | null) =>
  data ? Buffer.from(data, 'base64url').toString('utf8') : '';

function findHtml(part?: gmail_v1.Schema$MessagePart): string {
  if (!part) return '';
  if (part.mimeType === 'text/html' && part.body?.data) return decode(part.body.data);
  for (const p of part.parts ?? []) {
    const html = findHtml(p);
    if (html) return html;
  }
  return '';
}

export async function fetchAlertEmails(query: string): Promise<AlertEmail[]> {
  const gmail = google.gmail({ version: 'v1', auth: authorizedClient() });

  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const res = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 100,
      pageToken,
    });
    ids.push(...(res.data.messages ?? []).map((m) => m.id!).filter(Boolean));
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  const emails: AlertEmail[] = [];
  for (const id of ids) {
    const { data } = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
    const header = (name: string) =>
      data.payload?.headers?.find((h) => h.name?.toLowerCase() === name)?.value ?? '';
    const html = findHtml(data.payload) || decode(data.payload?.body?.data);
    emails.push({
      id,
      from: header('from'),
      subject: header('subject'),
      date: header('date'),
      html,
    });
  }
  return emails;
}
