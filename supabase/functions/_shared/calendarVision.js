// Provider errors can contain private photo content. Only return coarse reasons.
export async function readCalendarVision({ providers, messages, fetchImpl = fetch, timeoutMs = 45000 }) {
  let failure = { status: 0, reason: 'unavailable' };
  for (const provider of providers) {
    let response;
    try {
      response = await fetchImpl(provider.url, {
        method: 'POST', headers: { Authorization: `Bearer ${provider.key}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify({ model: provider.model, temperature: 0, response_format: { type: 'json_object' }, messages }),
      });
    } catch {
      failure = { status: 0, reason: 'unavailable' };
      continue;
    }
    if (!response.ok) {
      let reason = 'other';
      try {
        const detail = (await response.text()).toLowerCase();
        if (/credit|billing|balance|payment|spend limit/.test(detail)) reason = 'billing';
        else if (/api.key|unauthorized|authentication/.test(detail)) reason = 'auth';
        else if (/model/.test(detail)) reason = 'model';
        else if (/image/.test(detail)) reason = 'image';
        else if (/json|response.format|structured/.test(detail)) reason = 'format';
      } catch { /* Do not expose the provider response. */ }
      failure = { status: response.status, reason };
      continue;
    }
    try {
      const body = await response.json();
      const content = body?.choices?.[0]?.message?.content;
      const result = JSON.parse(String(content || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
      if (!result || !Array.isArray(result.events)) throw Error('Invalid response');
      return { result, failure: null };
    } catch {
      failure = { status: response.status, reason: 'invalid_response' };
    }
  }
  return { result: null, failure };
}

export function calendarVisionError({ status, reason }) {
  if (reason === 'billing') return 'The image reader needs its provider account updated. Please contact support.';
  if (reason === 'auth' || status === 401 || status === 403) return 'The image reader needs a provider configuration update. Please contact support.';
  if (reason === 'model') return 'The image reader model is unavailable. Please contact support.';
  if (reason === 'format') return 'The image reader configuration needs attention. Please contact support.';
  if (reason === 'invalid_response') return 'The image could not be read reliably. Try a clearer photo.';
  if (status === 429) return 'The image reader is temporarily unavailable or its usage limit has been reached. Please try again later.';
  if (status === 400 || status === 422) return 'The image reader could not process these photos. Try a clearer JPEG or PNG image, or contact support if the problem continues.';
  return 'The image reader is unavailable right now. Your photos are still here; please retry.';
}
