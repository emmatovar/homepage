import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.NIGHTSCOUT_URL;
const accessToken = process.env.NIGHTSCOUT_TOKEN;
if (!base || !accessToken) {
  console.warn('NIGHTSCOUT_URL and NIGHTSCOUT_TOKEN are not set; deploying without glucose data.');
  process.exit(0);
}

const authResponse = await fetch(`${base}/api/v2/authorization/request/${accessToken}`);
if (!authResponse.ok) throw new Error(`Authorization failed (${authResponse.status}).`);
const { token } = await authResponse.json();
if (!token) throw new Error('Authorization response did not include a token.');

const dataResponse = await fetch(`${base}/api/v3/entries?sort%24desc=date&limit=100&fields=date,sgv`, {
  headers: { Authorization: `Bearer ${token}` },
});
if (!dataResponse.ok) throw new Error(`Glucose request failed (${dataResponse.status}).`);
const payload = await dataResponse.json();

const readings = (payload.result ?? [])
  .filter(entry => Number.isFinite(entry.date) && Number.isFinite(entry.sgv))
  .map(({ date, sgv }) => ({ date, sgv }));
if (!readings.length) throw new Error('No glucose readings returned.');

const outDir = process.argv[2] ?? 'data';
await mkdir(outDir, { recursive: true });
await writeFile(`${outDir}/glucose.json`, JSON.stringify({ updatedAt: new Date().toISOString(), readings }));
console.log(`Saved ${readings.length} readings.`);
