import {racedayIsLive} from './notification-availability';
import {vapidConfig} from './webpush.server';
export async function racedayAvailability() {
  const {supabaseAdmin: db} = await import('@/integrations/supabase/client.server');
  const setting = await db.from('app_settings').select('value').eq('key', 'raceday_alerts_enabled').maybeSingle();
  return !setting.error && racedayIsLive(setting.data?.value, !!vapidConfig(), !!process.env['TIANXI_RACING_BOT_TOKEN']);
}