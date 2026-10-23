import {expect,it} from 'vitest';import {pushDisposition,validPushEndpoint} from './push-rules';
it('revoked 410 subscription is removed',()=>expect(pushDisposition(410,0)).toBe('delete'));
it('fifth failure removes subscription',()=>expect(pushDisposition(503,4)).toBe('delete'));
it('fourth failure can retry',()=>expect(pushDisposition(503,3)).toBe('retry'));
it('successful 201 is recorded',()=>expect(pushDisposition(201,0)).toBe('success'));
it('private endpoint cannot receive requests',()=>expect(validPushEndpoint('https://127.0.0.1/push')).toBe(false));
it('fake provider suffix cannot receive requests',()=>expect(validPushEndpoint('https://fcm.googleapis.com.evil.test/push')).toBe(false));
it('Apple push endpoint is supported',()=>expect(validPushEndpoint('https://web.push.apple.com/123')).toBe(true));