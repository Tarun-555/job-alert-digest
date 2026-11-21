// One-time Google sign-in. Run: npm run auth
import 'dotenv/config';
import http from 'node:http';
import fs from 'node:fs';
import { newOAuthClient, SCOPES, tokenPath } from './gmail.js';

const client = newOAuthClient();
const url = client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: SCOPES,
});
console.log('\nOpen this URL in your browser and approve read-only Gmail access:\n\n' + url + '\n');

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url ?? '/', 'http://localhost:3000');
    if (u.pathname !== '/oauth2callback') {
      res.statusCode = 404;
      res.end();
      return;
    }
    const code = u.searchParams.get('code');
    if (!code) {
      res.end('Missing code');
      return;
    }
    const { tokens } = await client.getToken(code);
    fs.writeFileSync(tokenPath(), JSON.stringify(tokens, null, 2), { mode: 0o600 });
    res.end('Done. You can close this tab.');
    console.log('Saved tokens to', tokenPath());
  } catch (err) {
    res.statusCode = 500;
    res.end('Auth failed, see terminal.');
    console.error(err);
  } finally {
    server.close();
  }
});
server.listen(3000);
