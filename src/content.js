// eXpand — isolated-world content script (document_start).
// Responsibilities: apply settings as CSS variables / html attributes, un-clamp
// X's 600px column, and swap truncated long posts for their full text.
(() => {
  const DEFAULTS = {
    enabled: true,
    columnWidth: 1200,      // px (ignored when fillWidth is on)
    fillWidth: false,       // stretch the column across the whole window
    leftNav: 'icons',       // 'full' | 'icons'
    rightSidebar: 'hide',   // 'show' | 'search' | 'hide'
    autoExpand: true,
    expandMaxLines: 15,     // leave "Show more" alone if the full post renders taller than this
    mediaMaxHeight: 800,    // px; X caps timeline photos at 510px tall
    theme: 'x',             // 'x' (leave X's theme alone) | 'dim' (classic Dim, on top of Lights out)
    videoCrop: '3:4',       // portrait videos: 'none' | '3:4' | '4:5' | '1:1' (crop top/bottom to this shape)
    // Declutter toggles. Each maps to an html class `expand-<key>` used by content.css.
    hideAds: true,
    hideComposer: false,
    hideTabBar: false,
    hideViews: false,
    hideCounts: false,
    hideGrokButton: false,
    hideNavGrok: false,
    hideNavPremium: false,
    hideNavCreatorStudio: false,
    hideNavHistory: false,
    hideNavCommunities: false,
    hideNavJobs: false
  };
  const DECLUTTER_KEYS = Object.keys(DEFAULTS).filter((k) => k.startsWith('hide'));
  // Leaf label X puts on promoted posts, in the languages it ships.
  const AD_LABELS = new Set(['Ad', 'Promoted', 'Anzeige', 'Anuncio', 'Publicité', 'Sponsorizzato', 'Anúncio', 'Advertentie', 'Reklam', '広告', '광고', 'Реклама']);
  const CROP_RATIOS = { '3:4': 3 / 4, '4:5': 4 / 5, '1:1': 1 };
  // Pages whose primary column is not a timeline; leave X's layout alone there.
  const EXCLUDED_PATHS = [/^\/messages/, /^\/settings/, /^\/i\/grok/, /^\/i\/premium/, /^\/compose/];

  const CHANNEL = 'expand-x';
  const html = document.documentElement;
  const notes = new Map();
  let settings = { ...DEFAULTS };
  let lastPath = null;

  // ---------- settings ----------
  function applySettings() {
    const onThisPage = settings.enabled && !EXCLUDED_PATHS.some((re) => re.test(location.pathname));
    html.toggleAttribute('data-expand-on', onThisPage);
    html.setAttribute('data-expand-left', onThisPage ? settings.leftNav : 'full');
    html.setAttribute('data-expand-right', onThisPage ? settings.rightSidebar : 'show');
    html.toggleAttribute('data-expand-fill', onThisPage && settings.fillWidth);
    applyTheme();
    for (const k of DECLUTTER_KEYS) {
      html.classList.toggle('expand-' + k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()), settings.enabled && !!settings[k]);
    }
    html.style.setProperty('--expand-width', `${settings.columnWidth}px`);
    if (onThisPage && document.body) {
      tagClampedElements(document.body);
      scaleMedia(document.body);
    }
    if (document.body) markAds(document.body);
  }

  // Dim only makes sense over Lights out (its class map is the black palette).
  // X writes the theme as an inline style on <body>; read that, not the computed
  // color, which Dim itself overrides. This also tracks X's time-of-day switching.
  function applyTheme() {
    const lightsOut = !!document.body && document.body.style.backgroundColor === 'rgb(0, 0, 0)';
    html.toggleAttribute('data-expand-dim', settings.enabled && settings.theme === 'dim' && lightsOut);
  }

  // ---------- promoted posts ----------
  // Detected always (cheap) and hidden by CSS when hideAds is on, so the toggle
  // takes effect without a rescan. The label is a leaf span reading "Ad".
  function markAds(root) {
    if (!root || !root.querySelectorAll) return;
    const articles = root.querySelectorAll('article:not([data-expand-ad])');
    for (const a of articles) {
      let isAd = false;
      for (const sp of a.querySelectorAll('span')) {
        if (sp.children.length === 0 && AD_LABELS.has(sp.textContent.trim())) { isAd = true; break; }
      }
      a.setAttribute('data-expand-ad', isAd ? '1' : '0');
      if (isAd) (a.closest('[data-testid="cellInnerDiv"]') || a).classList.add('expand-ad');
    }
    if (root.closest) {
      const a = root.closest('article:not([data-expand-ad])');
      if (a) markAds(a.parentElement);
    }
  }

  chrome.storage.sync.get(DEFAULTS, (stored) => {
    settings = { ...DEFAULTS, ...stored };
    applySettings();
    if (settings.autoExpand) processShowMore(document.body);
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    for (const k of Object.keys(changes)) settings[k] = changes[k].newValue;
    applySettings();
  });

  // ---------- layout: remove the 600px clamp ----------
  // X's primary column and several inner wrappers carry max-width: 600px via
  // generated classes. Anything inside the column whose computed max-width is
  // 600px gets our class; ancestors of the column up to <main> are un-clamped.
  function tagClampedElements(root) {
    if (!root || !root.querySelectorAll) return;
    const col = document.querySelector('[data-testid="primaryColumn"]');
    if (!col) return;

    let el = col.parentElement;
    while (el && el.tagName !== 'MAIN') {
      el.classList.add('expand-unclamp');
      el = el.parentElement;
    }
    if (el && el.tagName === 'MAIN') el.classList.add('expand-unclamp-main');

    // Only scan inside the column: the added node if it's in there, or the whole
    // column when the added node contains it (SPA navigation swaps the entire
    // column subtree). Mutations elsewhere don't trigger a rescan.
    const scope = col.contains(root) ? root : (root.contains(col) ? col : null);
    if (!scope) return;
    const candidates = scope.querySelectorAll('div:not(.expand-w)');
    for (const d of candidates) {
      // Fast path on the class X uses today; computed-style fallback for when it changes.
      if (d.style.maxWidth) continue; // inline max-width is X's per-media sizing (or ours), not the column clamp
      if (d.classList.contains('r-1ye8kvj') || getComputedStyle(d).maxWidth === '600px') {
        d.classList.add('expand-w');
      }
    }
  }

  // ---------- media: lift X's 510px height cap on photos ----------
  // X sizes each single photo with inline width/height on a wrapper above
  // [data-testid="tweetPhoto"], capping height at 510px, and pins an ancestor with
  // an inline max-width to the same width. Very tall images are additionally
  // cropped to that box. We resize the wrapper from the image's natural aspect
  // ratio (no crop), up to the column width and the configured max height, and
  // release the pinned max-width so the rounded frame follows.
  function scaleMedia(root) {
    if (!root || !root.querySelectorAll) return;
    for (const p of root.querySelectorAll('article [data-testid="tweetPhoto"]')) scalePhoto(p);
    for (const v of root.querySelectorAll('article [data-testid="videoPlayer"]')) scaleVideo(v);
    // Players mount lazily inside existing wrappers; the added node may be inside one.
    if (root.closest) {
      const p = root.closest('article [data-testid="tweetPhoto"]');
      if (p) scalePhoto(p);
      const v = root.closest('article [data-testid="videoPlayer"]');
      if (v) scaleVideo(v);
    }
  }

  // Videos are sized differently: a spacer inside the player carries an inline
  // padding-bottom percentage (the aspect ratio) and, for portrait videos, an
  // ancestor carries an inline max-width that caps the box at 510px tall.
  // We raise that cap and, optionally, change the spacer's ratio to a wider
  // shape with the <video> set to object-fit: cover (crops top and bottom).
  function scaleVideo(v) {
    // Two spacers carry the ratio: one inside the player and one under the media
    // wrapper (the outer one sets the box). Both must change.
    const scope = v.closest('[data-testid="tweetPhoto"]') || v;
    const spacers = [...scope.querySelectorAll('div')].filter((d) => d.style.paddingBottom);
    if (!spacers.length) return;
    const spacer = spacers[0];
    let pin = v.parentElement, k = 0;
    while (pin && k < 12 && pin.tagName !== 'ARTICLE' && !pin.style.maxWidth) { pin = pin.parentElement; k++; }
    if (!pin || pin.tagName === 'ARTICLE' || !pin.style.maxWidth) return; // width-limited already

    if (!pin.dataset.expandOrigMw) pin.dataset.expandOrigMw = pin.style.maxWidth;
    if (!spacer.dataset.expandOrigPb) spacer.dataset.expandOrigPb = spacer.style.paddingBottom;
    const w = parseFloat(pin.dataset.expandOrigMw);
    const pb = parseFloat(spacer.dataset.expandOrigPb);
    if (!w || !pb) return;
    const natural = 100 / pb; // width / height
    let ratio = natural;

    const target = CROP_RATIOS[settings.videoCrop];
    const croppable = !!target && natural < target - 0.01;
    const crop = croppable && scope.dataset.expandNocrop !== '1'; // per-video override from the toggle button
    v.classList.toggle('expand-cropped', crop);
    if (crop) ratio = target;
    if (croppable) ensureCropToggle(scope, v, crop);

    let a = pin.parentElement, n = 0;
    while (a && n < 10 && a.clientWidth <= w + 8) { a = a.parentElement; n++; }
    const avail = a ? a.clientWidth : 0;
    if (!avail || avail < w * 1.1) return;

    let nh = Math.min(settings.mediaMaxHeight, avail / ratio);
    let nw = nh * ratio;
    if (nw > avail) { nw = avail; nh = nw / ratio; }
    nw = Math.round(nw);
    // Set through classes + custom properties: React re-applies the inline
    // max-width/padding-bottom it owns on re-render, but never touches these.
    pin.classList.add('expand-video-pin');
    pin.style.setProperty('--expand-vw', `${nw}px`);
    for (const sp of spacers) {
      sp.classList.add('expand-video-spacer');
      sp.style.setProperty('--expand-pb', `${(100 / ratio).toFixed(3)}%`);
      sp.style.setProperty('--expand-pb-orig', sp.dataset.expandOrigPb || spacer.dataset.expandOrigPb); // restored in fullscreen
    }
  }

  // Small hover button on cropped videos: "Full" shows the whole frame, "Crop" re-crops.
  function ensureCropToggle(scope, v, cropped) {
    let btn = scope.querySelector(':scope > .expand-crop-toggle');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'expand-crop-toggle';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        scope.dataset.expandNocrop = scope.dataset.expandNocrop === '1' ? '0' : '1';
        scaleVideo(v);
      });
      scope.appendChild(btn);
    }
    btn.textContent = cropped ? 'Full' : 'Crop';
    btn.title = cropped ? 'Show the whole video frame' : 'Crop to the wider shape';
  }

  function scalePhoto(p) {
    let el = p, depth = 0;
    while (el && depth < 6 && el.tagName !== 'ARTICLE' && !(el.style.width && el.style.height)) {
      el = el.parentElement; depth++;
    }
    if (!el || el.tagName === 'ARTICLE' || !el.style.width) return; // grids/carousels: X's own layout
    if (p.querySelector('[data-testid="videoPlayer"]')) return; // videos: see scaleVideo

    let w, h;
    if (el.dataset.expandOrig) {
      [w, h] = el.dataset.expandOrig.split('x').map(Number);
    } else {
      w = parseFloat(el.style.width); h = parseFloat(el.style.height);
      if (!w || !h) return;
      el.dataset.expandOrig = `${w}x${h}`;
    }

    let ratio = w / h;
    // The image's real shape. If it isn't loaded yet, come back when it is.
    const img = p.querySelector('img');
    if (img && !img.naturalWidth && !img.dataset.expandWait) {
      img.dataset.expandWait = '1';
      img.addEventListener('load', () => scalePhoto(p), { once: true });
    }
    if (img && img.naturalWidth && img.naturalHeight) {
      const natural = img.naturalWidth / img.naturalHeight;
      if (natural < ratio * 0.98) ratio = natural; // X cropped a tall image; show all of it
    }

    // Available width: the first ancestor clearly wider than X's own box.
    // If nothing is much wider, the photo already fills the column; leave it.
    let a = el.parentElement, n = 0;
    while (a && n < 10 && a.clientWidth <= w + 8) { a = a.parentElement; n++; }
    const avail = a ? a.clientWidth : 0;
    if (!avail || avail < w * 1.1) return;

    let nh = Math.min(settings.mediaMaxHeight, avail / ratio);
    let nw = nh * ratio;
    if (nw > avail) { nw = avail; nh = nw / ratio; }
    if (nh < h && ratio === w / h) return; // would only shrink; keep X's size
    nw = Math.round(nw); nh = Math.round(nh);

    if (el.style.width !== `${nw}px`) el.style.width = `${nw}px`;
    if (el.style.height !== `${nh}px`) el.style.height = `${nh}px`;

    // Release X's inline max-width pins between the wrapper and the column.
    for (let b = el.parentElement, i = 0; b && b !== a && i < 10; b = b.parentElement, i++) {
      if (b.style.maxWidth && b.style.maxWidth !== `${nw}px`) b.style.maxWidth = `${nw}px`;
    }
  }

  // ---------- long posts: press "Show more" for posts under the threshold ----------
  window.addEventListener('message', (ev) => {
    if (ev.source !== window || !ev.data || ev.data.source !== CHANNEL || ev.data.type !== 'notes') return;
    for (const n of ev.data.notes) notes.set(n.id, n);
    if (settings.autoExpand && document.body) processShowMore(document.body);
  });
  window.postMessage({ source: CHANNEL, type: 'replay' }, location.origin);

  const TWEET_ID_RE = /\/status\/(\d+)/;

  function tweetIdFor(link, article) {
    const href = link.getAttribute('href') || '';
    let m = href.match(TWEET_ID_RE);
    if (m) return m[1];
    const timeLink = article.querySelector('a[href*="/status/"]:has(time)');
    m = timeLink && (timeLink.getAttribute('href') || '').match(TWEET_ID_RE);
    if (m) return m[1];
    // Some units render without a timestamp; take the first plain permalink not inside a quoted post.
    for (const a of article.querySelectorAll('a[href*="/status/"]')) {
      if (a.closest('[role="link"]')) continue;
      m = (a.getAttribute('href') || '').match(/\/status\/(\d+)$/);
      if (m) return m[1];
    }
    return null;
  }

  // How tall would the full post be? Render it into a hidden clone of the post's
  // text element at the same width, so wrapping and blank lines both count.
  function measureLines(text, template) {
    const width = template ? template.clientWidth : 0;
    if (!width) { // not laid out; rough estimate
      return (text.match(/\n/g) || []).length + Math.ceil(Array.from(text).length / 110);
    }
    const probe = document.createElement('div');
    probe.className = template.className + ' ' + PROBE_CLASS;
    probe.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;left:-9999px;top:0;` +
      `white-space:pre-wrap;overflow-wrap:break-word;width:${width}px`;
    probe.textContent = text;
    document.body.appendChild(probe);
    const lineHeight = parseFloat(getComputedStyle(probe).lineHeight) || 24;
    const lines = Math.round(probe.offsetHeight / lineHeight);
    probe.remove();
    return lines;
  }

  // X's "Show more" is a <button> that expands the post in place (no navigation).
  // We only need the full text to decide whether to press it: posts that would
  // render taller than the threshold keep their button.
  function processShowMore(root) {
    if (!root || !root.querySelectorAll) return;
    const buttons = root.querySelectorAll('[data-testid="tweet-text-show-more-link"]:not([data-expand-seen])');
    for (const btn of buttons) {
      if (btn.closest('[role="link"]')) { btn.setAttribute('data-expand-seen', 'quote'); continue; } // inside a quoted post
      const article = btn.closest('article');
      if (!article) continue;
      const id = tweetIdFor(btn, article);
      if (!id) { btn.setAttribute('data-expand-seen', 'noid'); continue; }
      const note = notes.get(id);
      if (!note) continue; // full text may still be on its way; retry on the next pass
      const textEl = btn.parentElement.querySelector('[data-testid="tweetText"]')
        || article.querySelector('[data-testid="tweetText"]');
      const lines = measureLines(note.text, textEl);
      btn.setAttribute('data-expand-lines', String(lines));
      if (lines > settings.expandMaxLines) { btn.setAttribute('data-expand-seen', 'toolong'); continue; }
      btn.setAttribute('data-expand-seen', 'expanded');
      btn.click();
    }
  }

  // ---------- observe the SPA ----------
  const PROBE_CLASS = 'expand-probe'; // our own measurement nodes; never react to them
  const pending = new Set();
  function flush() {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      applySettings();
    }
    applyTheme();
    if (!html.hasAttribute('data-expand-on')) { pending.clear(); return; }
    for (const node of pending) {
      tagClampedElements(node);
      scaleMedia(node);
      markAds(node);
      if (settings.autoExpand) processShowMore(node);
    }
    pending.clear();
  }
  function startObserving() {
    // Process synchronously inside the mutation callback, i.e. before layout.
    // X measures post heights (for its virtual list and scroll restoration)
    // right after rendering; if our resizing landed later, X would first see
    // stock sizes and the scroll position would drift after going back.
    // (Not requestAnimationFrame either: it never fires in background tabs.)
    const mo = new MutationObserver((muts) => {
      let any = false;
      for (const m of muts) {
        for (const n of m.addedNodes) {
          if (n.nodeType !== 1 || n.classList.contains(PROBE_CLASS)) continue;
          // Queue the parent: querySelectorAll only matches descendants, and X
          // often inserts exactly the element we care about (e.g. the "Show more" button).
          pending.add(n.parentElement || n);
          any = true;
        }
      }
      if (any) flush();
    });
    mo.observe(document.body, { childList: true, subtree: true });
    pending.add(document.body);
    flush();
  }

  if (document.body) startObserving();
  else new MutationObserver((_, obs) => { if (document.body) { obs.disconnect(); startObserving(); } })
    .observe(html, { childList: true });
})();
