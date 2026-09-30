// eXpand — runs in the page's MAIN world at document_start.
//
// X truncates long posts in the timeline and renders a "Show more" link that
// navigates away. The full text is already in the GraphQL responses, though,
// under `note_tweet`. We tap fetch/XHR, pull every note_tweet we see, and hand
// it to the isolated content script via postMessage.
(() => {
  if (window.__expandHooked) return;
  window.__expandHooked = true;

  const notes = new Map(); // tweet id -> { id, text, entities }
  window.__expandNotes = notes; // debugging aid: inspect from DevTools
  const CHANNEL = 'expand-x';

  function isApiUrl(url) {
    return typeof url === 'string' && (url.includes('/graphql/') || url.includes('/i/api/'));
  }

  function post(list) {
    if (!list.length) return;
    window.postMessage({ source: CHANNEL, type: 'notes', notes: list }, location.origin);
  }

  function collect(obj, out, depth) {
    if (!obj || typeof obj !== 'object' || depth > 60) return;
    if (Array.isArray(obj)) {
      for (const v of obj) collect(v, out, depth + 1);
      return;
    }
    const nt = obj.note_tweet && obj.note_tweet.note_tweet_results && obj.note_tweet.note_tweet_results.result;
    if (nt && typeof nt.text === 'string' && obj.rest_id) {
      const id = String(obj.rest_id);
      if (!notes.has(id)) {
        const note = { id, text: nt.text, entities: nt.entity_set || {} };
        notes.set(id, note);
        out.push(note);
      }
    }
    for (const k in obj) {
      const v = obj[k];
      if (v && typeof v === 'object') collect(v, out, depth + 1);
    }
  }

  function scan(json) {
    try {
      const out = [];
      collect(json, out, 0);
      post(out);
    } catch (_) { /* ignore */ }
  }

  function scanText(text) {
    if (!text || text[0] !== '{' && text[0] !== '[') return;
    try { scan(JSON.parse(text)); } catch (_) { /* not JSON */ }
  }

  // --- XMLHttpRequest ---
  const xhrOpen = XMLHttpRequest.prototype.open;
  const xhrSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__expandUrl = typeof url === 'string' ? url : String(url);
    return xhrOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function () {
    if (isApiUrl(this.__expandUrl)) {
      this.addEventListener('loadend', () => {
        try {
          if (this.responseType === '' || this.responseType === 'text') scanText(this.responseText);
          else if (this.responseType === 'json' && this.response) scan(this.response);
        } catch (_) { /* ignore */ }
      });
    }
    return xhrSend.apply(this, arguments);
  };

  // --- fetch ---
  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const p = origFetch.apply(this, arguments);
    if (isApiUrl(url)) {
      p.then((res) => {
        try {
          const ct = res.headers.get('content-type') || '';
          if (ct.includes('json')) res.clone().json().then(scan).catch(() => {});
        } catch (_) { /* ignore */ }
      }).catch(() => {});
    }
    return p;
  };

  // The isolated-world script may start after early responses landed; let it ask for a replay.
  window.addEventListener('message', (ev) => {
    if (ev.source !== window || !ev.data || ev.data.source !== CHANNEL) return;
    if (ev.data.type === 'replay') post([...notes.values()]);
  });
})();
