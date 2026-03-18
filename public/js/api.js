(function () {
  'use strict';

  const DEFAULT_TIMEOUT_MS = 20000;

  function withTimeout(promise, timeoutMs) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Request timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }

  function emit(name, detail) {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }

  async function request(url, timeoutMs) {
    return withTimeout(window.Utils.fetchJSON(url), timeoutMs || DEFAULT_TIMEOUT_MS);
  }

  const api = {
    async search(disease, region, options) {
      const params = new URLSearchParams();
      params.set('disease', disease);
      if (region) params.set('region', region);

      emit('search:start', { disease, region });

      try {
        const data = await request(`/api/search?${params.toString()}`, options && options.timeoutMs);
        emit('search:complete', { disease, region, data });
        return data;
      } catch (error) {
        emit('search:error', { disease, region, error });
        throw error;
      }
    },

    async getSources(options) {
      return request('/api/sources', options && options.timeoutMs);
    },

    async healthCheck(options) {
      return request('/api/health', options && options.timeoutMs);
    },
  };

  window.api = api;
})();
