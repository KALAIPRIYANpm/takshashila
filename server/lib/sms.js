// Login codes by SMS through MSG91's Flow API (needs a DLT-approved template that contains the OTP variable).
import { config } from '../config.js';
import { HttpError } from './http.js';

export async function sendOtpSms(phone, code) {
  const { authKey, templateId, otpVar } = config.msg91;
  let res;
  try {
    res = await fetch('https://control.msg91.com/api/v5/flow', {
      method: 'POST',
      headers: { authkey: authKey, 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ template_id: templateId, short_url: '0', recipients: [{ mobiles: `91${phone}`, [otpVar]: code }] }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    console.error('[sms] MSG91 unreachable:', err.message);
    throw new HttpError(502, "We couldn't send the SMS just now. Try again in a minute.");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.type === 'error') {
    console.error(`[sms] MSG91 rejected the request (${res.status}):`, body.message || body);
    throw new HttpError(502, "We couldn't send the SMS just now. Try again in a minute.");
  }
}
