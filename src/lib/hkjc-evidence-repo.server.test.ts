import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  EVIDENCE_METADATA_SELECT,
  HKJC_EVIDENCE_CONTENTS_BASE,
  HKJC_EVIDENCE_READ_FAILURE,
} from './hkjc-evidence-sync.functions';

type Call = {
  table: string;
  select: string;
  filters: Array<[string, string]>;
  order?: string;
  range?: [number, number];
  limit?: number;
};
type MetaRecord = {
  race_date: string;
  source_url: string;
  fetched_at: string;
  venue?: string;
  sha256?: string;
  source_sha256?: string;
};
type GithubCall = { method: string; path: string; body?: string; sha?: string };

const h = vi.hoisted(() => ({
  calls: [] as Call[],
  meta: {} as Record<string, MetaRecord[]>,
  raw: {} as Record<string, { html: string } | { error: { message: string; code: string } }>,
  metaError: null as null | { table: string; error: { message: string; code: string } },
}));

vi.mock('@/integrations/supabase/client.server', () => ({
  supabaseAdmin: {
    from(table: string) {
      const filters: Array<[string, string]> = [];
      let select = '';
      let order = '';
      const copyFilters = () => filters.map(([column, value]) => [column, value] as [string, string]);
      const api = {
        select(columns: string) { select = columns; return api; },
        order(column: string) { order = column; return api; },
        eq(column: string, value: string) { filters.push([column, value]); return api; },
        range(from: number, to: number) {
          const call: Call = { table, select, filters: copyFilters(), range: [from, to] };
          if (order) call.order = order;
          h.calls.push(call);
          if (h.metaError?.table === table) return Promise.resolve({ data: null, error: h.metaError.error });
          if (from > 0) return Promise.resolve({ data: [], error: null });
          return Promise.resolve({ data: h.meta[table] ?? [], error: null });
        },
        limit(count: number) {
          h.calls.push({ table, select, filters: copyFilters(), limit: count });
          const sha = filters.find(([column]) => column === 'sha256' || column === 'source_sha256')?.[1] ?? '';
          const found = h.raw[`${table}:${sha}`];
          if (!found) return Promise.resolve({ data: [], error: null });
          if ('error' in found) return Promise.resolve({ data: null, error: found.error });
          return Promise.resolve({ data: [{ raw_html: found.html }], error: null });
        },
      };
      return api;
    },
  },
}));

import { syncHkjcEvidenceToRepository } from './hkjc-evidence-repo.server';

const KNOWN_SHA = '11'.repeat(32);
const LATER_SHA = '22'.repeat(32);
const CHANGE_URL = 'https://racing.hkjc.com/zh-hk/local/information/changes';
const DIVIDEND_URL = 'https://racing.hkjc.com/zh-hk/local/information/resultsall?RaceDate=2026/11/18';

let files = new Map<string, { sha: string; text: string }>();
let githubCalls: GithubCall[] = [];

const encode = (text: string) => {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
};
const decode = (text: string) => new TextDecoder().decode(Uint8Array.from(atob(text.replace(/\s/g, '')), (c) => c.charCodeAt(0)));
const sha256Of = async (text: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
};
const puts = () => githubCalls.filter((call) => call.method === 'PUT');

function seedManifest(path: string, sha: string, snapshots: unknown) {
  files.set(path, { sha, text: JSON.stringify({ snapshots }, null, 2) });
}

function useDividends(html: string, sha: string) {
  h.meta['racing_dividend_snapshots'] = [
    {
      race_date: '2026-11-11',
      venue: 'ST',
      source_url: 'https://racing.hkjc.com/zh-hk/local/information/resultsall?RaceDate=2026/11/11',
      source_sha256: KNOWN_SHA,
      fetched_at: '2026-11-11T01:00:00Z',
    },
    {
      race_date: '2026-11-18',
      venue: 'HV',
      source_url: DIVIDEND_URL,
      source_sha256: sha,
      fetched_at: '2026-11-18T01:00:00Z',
    },
    {
      race_date: '2026-11-22',
      venue: 'ST',
      source_url: 'https://racing.hkjc.com/zh-hk/local/information/resultsall?RaceDate=2026/11/22',
      source_sha256: LATER_SHA,
      fetched_at: '2026-11-22T01:00:00Z',
    },
  ];
  h.raw[`racing_dividend_snapshots:${sha}`] = { html };
  seedManifest('data/racing-dividends/manifest.json', 'manifest-sha-1', [{
    path: `data/racing-dividends/2026-11-11/ST-${KNOWN_SHA}.html`,
    sha256: KNOWN_SHA,
    sourceUrl: 'https://racing.hkjc.com/zh-hk/local/information/resultsall?RaceDate=2026/11/11',
    date: '2026-11-11',
    kind: 'racing-dividends',
    venue: 'ST',
  }]);
}

beforeEach(() => {
  h.calls.length = 0;
  h.meta = {};
  h.raw = {};
  h.metaError = null;
  files = new Map();
  githubCalls = [];
  vi.stubEnv('GITHUB_TOKEN', 'test-token');
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (!url.startsWith(HKJC_EVIDENCE_CONTENTS_BASE)) throw new Error(`unexpected url ${url}`);
    const path = url.slice(HKJC_EVIDENCE_CONTENTS_BASE.length);
    const method = init?.method ?? 'GET';
    if (method === 'GET') {
      githubCalls.push({ method, path });
      const file = files.get(path);
      if (!file) return new Response('missing', { status: 404 });
      return Response.json({ sha: file.sha, content: encode(file.text) });
    }
    const payload = JSON.parse(String(init?.body)) as { content: string; sha?: string; message?: string };
    const text = decode(payload.content);
    const recorded: GithubCall = { method, path, body: text };
    if (payload.sha) recorded.sha = payload.sha;
    githubCalls.push(recorded);
    if (payload.message !== 'archive: official HKJC evidence (append-only)') throw new Error('unexpected commit message');
    const sha = `written-${githubCalls.length}`;
    files.set(path, { sha, text });
    return Response.json({ content: { sha } }, { status: 201 });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it('loads metadata for every table, then raw_html only for the one pending original each table archives', async () => {
  const changeHtml = '<html>changes HV</html>';
  const cancelHtml = '<html>cancellation</html>';
  const dividendHtml = '<html>dividend HV 2026-11-18</html>';
  const changeSha = await sha256Of(changeHtml);
  const cancelSha = await sha256Of(cancelHtml);
  const dividendSha = await sha256Of(dividendHtml);
  h.meta['hkjc_changes_snapshots'] = [{
    race_date: '2026-11-25', venue: 'HV', source_url: CHANGE_URL, sha256: changeSha, fetched_at: '2026-11-25T01:00:00Z',
  }];
  h.meta['hkjc_cancellation_snapshots'] = [{
    race_date: '2026-11-25', source_url: CHANGE_URL, sha256: cancelSha, fetched_at: '2026-11-25T01:00:00Z',
  }];
  h.raw[`hkjc_changes_snapshots:${changeSha}`] = { html: changeHtml };
  h.raw[`hkjc_cancellation_snapshots:${cancelSha}`] = { html: cancelHtml };
  useDividends(dividendHtml, dividendSha);

  const result = await syncHkjcEvidenceToRepository();

  expect(result).toEqual({
    ok: true,
    added: 3,
    changes: { added: 1, remaining: 0 },
    cancellations: { added: 1, remaining: 0 },
    dividends: { added: 1, remaining: 1 },
  });
  const pages = h.calls.filter((call) => call.range);
  expect(pages.map((call) => call.select)).toEqual([
    EVIDENCE_METADATA_SELECT.hkjc_changes_snapshots,
    EVIDENCE_METADATA_SELECT.hkjc_cancellation_snapshots,
    EVIDENCE_METADATA_SELECT.racing_dividend_snapshots,
  ]);
  expect(pages.every((call) => call.order === 'fetched_at' && call.range?.[0] === 0 && call.range?.[1] === 999)).toBe(true);
  expect(pages.every((call) => !call.select.includes('raw_html'))).toBe(true);
  const rawCalls = h.calls.filter((call) => call.limit !== undefined);
  expect(rawCalls.map((call) => ({ table: call.table, select: call.select, filters: call.filters, limit: call.limit }))).toEqual([
    {
      table: 'hkjc_changes_snapshots',
      select: 'raw_html',
      limit: 2,
      filters: [['race_date', '2026-11-25'], ['venue', 'HV'], ['sha256', changeSha]],
    },
    {
      table: 'hkjc_cancellation_snapshots',
      select: 'raw_html',
      limit: 2,
      filters: [['race_date', '2026-11-25'], ['source_url', CHANGE_URL], ['sha256', cancelSha]],
    },
    {
      table: 'racing_dividend_snapshots',
      select: 'raw_html',
      limit: 2,
      filters: [['race_date', '2026-11-18'], ['venue', 'HV'], ['source_sha256', dividendSha]],
    },
  ]);
  expect(rawCalls.some((call) => call.filters.some(([, value]) => value === KNOWN_SHA || value === LATER_SHA))).toBe(false);
  expect(h.calls.findIndex((call) => call.table === 'racing_dividend_snapshots' && call.limit === 2))
    .toBeGreaterThan(h.calls.findIndex((call) => call.table === 'racing_dividend_snapshots' && call.range?.[0] === 0));

  expect(files.get(`data/racing-changes/2026-11-25/HV-${changeSha}.html`)?.text).toBe(changeHtml);
  expect(files.get(`data/racing-cancellations/2026-11-25/cancellation-${cancelSha}.html`)?.text).toBe(cancelHtml);
  expect(files.get(`data/racing-dividends/2026-11-18/HV-${dividendSha}.html`)?.text).toBe(dividendHtml);
  const dividendManifest = puts().find((call) => call.path === 'data/racing-dividends/manifest.json');
  expect(dividendManifest?.sha).toBe('manifest-sha-1');
  const snapshots = JSON.parse(dividendManifest?.body ?? '{}') as { snapshots: { sha256: string; path: string; venue?: string }[] };
  expect(snapshots.snapshots.map((entry) => entry.sha256)).toEqual([KNOWN_SHA, dividendSha]);
  expect(snapshots.snapshots[1]).toMatchObject({
    path: `data/racing-dividends/2026-11-18/HV-${dividendSha}.html`,
    venue: 'HV',
    date: '2026-11-18',
    kind: 'racing-dividends',
    sourceUrl: DIVIDEND_URL,
  });
  expect(puts().some((call) => call.path.includes(LATER_SHA) || call.path.includes(KNOWN_SHA))).toBe(false);
});

it('keeps paging metadata when a table fills a page, without selecting raw_html for rows already in the manifest', async () => {
  const known = '33'.repeat(32);
  h.meta['hkjc_changes_snapshots'] = Array.from({ length: 1000 }, () => ({
    race_date: '2026-11-01',
    venue: 'ST',
    source_url: CHANGE_URL,
    sha256: known,
    fetched_at: '2026-11-01T00:00:00Z',
  }));
  seedManifest('data/racing-changes/manifest.json', 'changes-manifest', [{
    path: `data/racing-changes/2026-11-01/ST-${known}.html`,
    sha256: known,
    sourceUrl: CHANGE_URL,
    date: '2026-11-01',
    kind: 'racing-changes',
    venue: 'ST',
  }]);

  const result = await syncHkjcEvidenceToRepository();

  expect(result.added).toBe(0);
  expect(h.calls.filter((call) => call.table === 'hkjc_changes_snapshots').map((call) => call.range)).toEqual([[0, 999], [1000, 1999]]);
  expect(h.calls.every((call) => !call.select.includes('raw_html'))).toBe(true);
  expect(puts()).toEqual([]);
});

it('names the sanitized supabase error when the metadata read fails, before any GitHub write', async () => {
  const token = 'ghp_' + 'c'.repeat(36);
  h.metaError = {
    table: 'hkjc_changes_snapshots',
    error: { code: '57014', message: `canceling statement due to statement timeout Bearer ${token}` },
  };

  await expect(syncHkjcEvidenceToRepository()).rejects.toThrow(
    `${HKJC_EVIDENCE_READ_FAILURE}（code=57014 message=canceling statement due to statement timeout [redacted]）`,
  );
  expect(githubCalls).toEqual([]);
  expect(h.calls.every((call) => !call.select.includes('raw_html'))).toBe(true);
});

it('names the sanitized supabase error when the pending raw_html read fails and does not write', async () => {
  const html = '<html>dividend HV 2026-11-18</html>';
  const sha = await sha256Of(html);
  const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaaa.bbbb';
  useDividends(html, sha);
  h.raw[`racing_dividend_snapshots:${sha}`] = { error: { code: '54000', message: `response too large ${jwt}` } };

  await expect(syncHkjcEvidenceToRepository()).rejects.toThrow(
    `${HKJC_EVIDENCE_READ_FAILURE}（code=54000 message=response too large [redacted]）`,
  );
  expect(puts()).toEqual([]);
  expect(files.get(`data/racing-dividends/2026-11-18/HV-${sha}.html`)).toBeUndefined();
});

it('still refuses a pending body whose fingerprint does not match, and does not write it', async () => {
  const html = '<html>dividend HV 2026-11-18</html>';
  const sha = await sha256Of(html);
  useDividends('<html>substituted</html>', sha);

  await expect(syncHkjcEvidenceToRepository()).rejects.toThrow('官方原文指紋或來源不符');
  expect(puts()).toEqual([]);
});

it('still refuses to overwrite a different archived original', async () => {
  const html = '<html>dividend HV 2026-11-18</html>';
  const sha = await sha256Of(html);
  useDividends(html, sha);
  const path = `data/racing-dividends/2026-11-18/HV-${sha}.html`;
  files.set(path, { sha: 'existing-sha', text: '<html>different</html>' });

  await expect(syncHkjcEvidenceToRepository()).rejects.toThrow('資料倉已有原文不符，禁止覆寫');
  expect(puts()).toEqual([]);
  expect(files.get(path)).toEqual({ sha: 'existing-sha', text: '<html>different</html>' });
});

it('does not rewrite an original that is already the same body, and still appends the manifest', async () => {
  const html = '<html>dividend HV 2026-11-18</html>';
  const sha = await sha256Of(html);
  useDividends(html, sha);
  const path = `data/racing-dividends/2026-11-18/HV-${sha}.html`;
  files.set(path, { sha: 'existing-sha', text: html });

  const result = await syncHkjcEvidenceToRepository();

  expect(result.dividends).toEqual({ added: 1, remaining: 1 });
  expect(puts().map((call) => call.path)).toEqual(['data/racing-dividends/manifest.json']);
  expect(files.get(path)).toEqual({ sha: 'existing-sha', text: html });
  const manifest = JSON.parse(files.get('data/racing-dividends/manifest.json')?.text ?? '{}') as { snapshots: { sha256: string }[] };
  expect(manifest.snapshots.map((entry) => entry.sha256)).toEqual([KNOWN_SHA, sha]);
});
