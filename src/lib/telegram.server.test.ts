import {afterEach,expect,it,vi} from 'vitest';
import {tg,validTelegramSecret} from './telegram.server';
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
it('wrong webhook secret is denied',()=>{vi.stubEnv('TELEGRAM_WEBHOOK_SECRET','a'.repeat(32));expect(validTelegramSecret('wrong')).toBe(false);});
it('matching webhook secret is accepted',()=>{vi.stubEnv('TELEGRAM_WEBHOOK_SECRET','a'.repeat(32));expect(validTelegramSecret('a'.repeat(32))).toBe(true);});
it('missing member bot never uses engine connector',async()=>{vi.stubEnv('TIANXI_RACING_BOT_TOKEN','');const fetch=vi.fn();vi.stubGlobal('fetch',fetch);expect((await tg('sendMessage',{})).ok).toBe(false);expect(fetch).not.toHaveBeenCalled();});
it('member bot credential never escapes returned provider errors',async()=>{vi.stubEnv('TIANXI_RACING_BOT_TOKEN','test-token');vi.stubGlobal('fetch',vi.fn(async()=>Response.json({ok:false,description:'test-token invalid'})));expect((await tg('getMe',{})).description).toBe('[redacted] invalid');});