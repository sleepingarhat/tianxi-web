/**
 * 官方停賽公告證據存檔：當停賽偵測命中官方關鍵字時，保存原文及 SHA-256。
 * Append-only：同一日期＋來源＋指紋只存一次；指紋或來源不符即拒絕，唔會覆寫。
 */

export type CancellationEvidenceInput = {
  date: string;
  sourceUrl: string;
  keyword: string;
  sentence: string;
  rawHtml: string;
};

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 保存一筆官方停賽公告原文；失敗時回傳錯誤而唔會靜默略過。 */
export async function archiveCancellationEvidence(input: CancellationEvidenceInput) {
  if (!/^https:\/\/racing\.hkjc\.com\//.test(input.sourceUrl)) {
    return { ok: false as const, error: '停賽證據來源唔係馬會官方網站，拒絕存檔' };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    return { ok: false as const, error: '停賽證據日期格式不符' };
  }
  if (!input.rawHtml || !input.keyword) {
    return { ok: false as const, error: '停賽證據缺少原文或關鍵字' };
  }
  const sha256 = await sha256Hex(input.rawHtml);
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { error } = await supabaseAdmin.from('hkjc_cancellation_snapshots').upsert(
    {
      race_date: input.date,
      source_url: input.sourceUrl,
      sha256,
      keyword: input.keyword,
      sentence: input.sentence,
      raw_html: input.rawHtml,
    },
    { onConflict: 'race_date,source_url,sha256', ignoreDuplicates: true },
  );
  if (error) return { ok: false as const, error: '停賽公告原文存檔失敗' };
  return { ok: true as const, date: input.date, sha256 };
}

/** 讀取某賽日最新一筆停賽證據（唯讀，publishable client）。 */
export async function readLatestCancellationEvidence(date: string) {
  const { createClient } = await import('@supabase/supabase-js');
  const key = process.env['SUPABASE_PUBLISHABLE_KEY']!;
  const sb = createClient(process.env['SUPABASE_URL']!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith('sb_') && h.get('Authorization') === `Bearer ${key}`) h.delete('Authorization');
        h.set('apikey', key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { data, error } = await sb
    .from('hkjc_cancellation_snapshots')
    .select('race_date,source_url,sha256,keyword,sentence,fetched_at')
    .eq('race_date', date)
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error('停賽公告證據暫時未能讀取');
  return data;
}
