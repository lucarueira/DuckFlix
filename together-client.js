(function () {
  'use strict';
  async function readEvents(response, receive, heartbeat = () => {}) {
    const reader = response.body.getReader(), decoder = new TextDecoder();
    let buffer = '';
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) return;
        heartbeat(); buffer += decoder.decode(chunk.value, { stream: true }).replace(/\r\n/g, '\n');
        if (buffer.length > 131072) throw new Error('Resposta da sala inválida.');
        let end;
        while ((end = buffer.indexOf('\n\n')) >= 0) {
          const packet = buffer.slice(0, end); buffer = buffer.slice(end + 2);
          const data = packet.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
          if (data) receive(JSON.parse(data));
        }
      }
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  }
  function create({ baseUrl = '', fetch = globalThis.fetch, clock, onSnapshot = () => {}, onConnection = () => {}, onExpired = () => {} }) {
    let session, controller, stopped = true, retryTimer;
    const base = baseUrl.replace(/\/$/, '') + '/api/together';
    async function request(path, { method = 'GET', data, credential = session?.credential, signal } = {}) {
      const timeout = new AbortController(), timer = setTimeout(() => timeout.abort(), 12000);
      const abort = () => timeout.abort();
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) timeout.abort();
      try {
        const response = await fetch(base + path, { method, signal: timeout.signal, credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store',
          headers: { ...(credential ? { Authorization: `Bearer ${credential}` } : {}), ...(data ? { 'Content-Type': 'application/json' } : {}) }, body: data ? JSON.stringify(data) : undefined });
        let value;
        try { value = await response.json(); } catch { throw new Error('O serviço de salas ainda não está disponível neste endereço.'); }
        if (!response.ok) throw Object.assign(new Error(value.error || 'Não foi possível acessar a sala.'), { status: response.status });
        return value;
      } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
    }
    async function calibrate() {
      clock.reset();
      for (let i = 0; i < 3; i++) {
        const sent = Date.now(), data = await request('/clock', { credential: null });
        if (data.service !== 'duck-together') throw new Error('O serviço de salas ainda não está disponível.');
        clock.sample(sent, Date.now(), data.serverTime);
      }
    }
    async function connect(value) {
      disconnect(); session = value; stopped = false;
      const current = session;
      let failures = 0;
      while (!stopped && current === session) {
        const attempt = new AbortController(); controller = attempt;
        let watchdog;
        const heartbeat = () => { clearTimeout(watchdog); watchdog = setTimeout(() => attempt.abort(), 16000); };
        try {
          onConnection(false); heartbeat();
          const response = await fetch(`${base}/rooms/${current.roomId}/events`, { signal: attempt.signal, credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', headers: { Authorization: `Bearer ${current.credential}` } });
          if ([403, 404].includes(response.status)) { stopped = true; onExpired(); return; }
          if (!response.ok) throw new Error('Conexão interrompida.');
          await readEvents(response, packet => { if (stopped || session !== current) return; failures = 0; onSnapshot(packet); onConnection(true); }, heartbeat);
        } catch { /* Reconnect with the same role and obtain a fresh authoritative snapshot. */ }
        finally { clearTimeout(watchdog); if (current === session) onConnection(false); }
        if (stopped || current !== session) return;
        await new Promise(resolve => { retryTimer = { id: setTimeout(resolve, Math.min(8000, 500 * 2 ** failures++)), resolve }; });
      }
    }
    function disconnect() { stopped = true; controller?.abort(); if (retryTimer) { clearTimeout(retryTimer.id); retryTimer.resolve(); retryTimer = null; } onConnection(false); }
    return {
      request, calibrate, connect, disconnect,
      createRoom: name => request('/rooms', { method: 'POST', data: { name }, credential: null }),
      joinRoom: (roomId, invite, name) => request(`/rooms/${roomId}/join`, { method: 'POST', data: { invite, name }, credential: null }),
      state: value => request(`/rooms/${value.roomId}/state`, { credential: value.credential }),
      command: data => request(`/rooms/${session.roomId}/command`, { method: 'POST', data }),
      presence: status => session && request(`/rooms/${session.roomId}/presence`, { method: 'POST', data: { status } }).catch(() => {}),
      async leave() { const previous = session; disconnect(); session = null; if (previous) await request(`/rooms/${previous.roomId}/leave`, { method: 'POST', data: {}, credential: previous.credential }).catch(() => {}); }
    };
  }
  const api = { create, readEvents };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.DuckTogetherClient = api;
})();
