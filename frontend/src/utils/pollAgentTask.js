/**
 * Poll GET /agent/tasks/:id until worker finishes (handles POST /agent/chat returning 202).
 * First request runs immediately (no sleep-before-poll delay).
 */
const DEFAULT_POLL_MS = 400;
const DEFAULT_MAX_WAIT_MS = 120_000;

export async function pollAgentTask(api, taskId, options = {}) {
  const pollMs = options.pollMs ?? DEFAULT_POLL_MS;
  const maxWaitMs = options.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;
  const signal = options.signal;
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    if (signal?.aborted) {
      const err = new Error('canceled');
      err.code = 'ERR_CANCELED';
      throw err;
    }
    const { data } = await api.get(`/agent/tasks/${taskId}`, {
      signal,
      timeout: 60_000,
    });
    if (data.status === 'done') {
      return data.reply || 'Хариу боловсруулж чадсангүй. Дахин оролдоно уу.';
    }
    if (data.status === 'failed') {
      const err = new Error(data.error || 'AI туслагч алдаа гаргалаа');
      err.agentError = true;
      throw err;
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }

  const err = new Error('Хариу хэт удаан хүлээгдлөө. Дахин оролдоно уу.');
  err.agentTimeout = true;
  throw err;
}
