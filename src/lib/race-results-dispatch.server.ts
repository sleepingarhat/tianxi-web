/** Fixed legacy dispatch contract shared by both authenticated entrypoints. */
export async function dispatchRaceResults(): Promise<Response> {
  const token = process.env['GITHUB_TOKEN'];
  if (!token) return Response.json({ ok: false, error: '未設定 GitHub token' }, { status: 500 });
  const workflow = 'capy_race_daily.yml';
  const res = await fetch(`https://api.github.com/repos/sleepingarhat/tianxi-racing/actions/workflows/${workflow}/dispatches`, {
    method: 'POST',
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'User-Agent': 'tianxi-web', 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: 'main', inputs: { date: '', force: 'n' } }),
    signal: AbortSignal.timeout(30_000),
  }).catch(() => null);
  if (!res) return Response.json({ ok: false, error: '賽果收料派送暫時未能確認' }, { status: 502 });
  if (!res.ok) return Response.json({ ok: false, status: res.status, error: '賽果收料派送未獲接納' }, { status: 502 });
  return Response.json({ ok: true, workflow, dispatched_at: new Date().toISOString(), deliveryVerified: false });
}