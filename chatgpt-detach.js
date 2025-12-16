// ==UserScript==
// @name         ChatGPT Detach-for-Long-Chats v0.9 (improved)
// @namespace    chatgpt-detach
// @version      0.9
// @description  Detach old chat turns (store placeholders) to avoid huge DOM and UI freezes; conservative, non-invasive, chunked removals and safe restores.
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // ---------- CONFIG ----------
  const VISIBLE_KEEP = 8;            // keep these latest turns in DOM (including current streaming turn)
  const REVEAL_BATCH = 8;            // how many to re-insert per reveal
  const NEAR_BOTTOM_PX = 140;        // px from bottom considered "at bottom"
  const OBS_DEBOUNCE_MS = 160;       // debounce for observer reactions
  const BUTTON_ID = 'detach-toggle-btn';
  const CHUNK_SIZE = 20;             // detach / restore this many nodes per tick
  const MAX_HIDDEN = 2000;           // maximum stored detached turns to avoid unbounded memory
  const USE_REQUEST_IDLE = typeof window.requestIdleCallback === 'function';

  // ---------- SELECTOR ----------
  const TURN_SELECTOR = [
    '[data-testid^="conversation-turn"]',
    'article[data-turn-id]',
    'article[data-turn]',
    'div[data-testid^="conversation-turn"]',
    'li[data-testid^="conversation-turn"]'
  ].join(',');

  // ---------- STATE ----------
  const hiddenStore = []; // [{ placeholder: Comment, node: Element }]
  let observer = null;
  let debounceTimer = null;
  let enabled = true;
  let lastStream = false;
  let scheduledDetach = false;
  let restoring = false;

  // ---------- HELPERS ----------
  function pickFeedRoot() {
    return document.querySelector('[role="feed"]') ||
           document.querySelector('main [role="feed"]') ||
           document.querySelector('main') ||
           document.body;
  }

  function getTurns() {
    try { return Array.from((pickFeedRoot() || document).querySelectorAll(TURN_SELECTOR)); }
    catch (e) { return []; }
  }

  function findScrollableAncestor(node) {
    let el = node && node.parentElement;
    while (el && el !== document.documentElement) {
      try {
        const cs = getComputedStyle(el);
        const oy = cs.overflowY;
        if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 1) return el;
      } catch (e) {}
      el = el.parentElement;
    }
    return null;
  }

  function isNearBottom() {
    const feed = pickFeedRoot();
    if (!feed) return true;
    const sAncestor = findScrollableAncestor(feed);
    try {
      if (sAncestor && sAncestor !== window) {
        const bottomDist = sAncestor.scrollHeight - (sAncestor.scrollTop + sAncestor.clientHeight);
        return bottomDist <= NEAR_BOTTOM_PX;
      } else {
        const el = document.documentElement || document.body;
        const bottomDist = el.scrollHeight - (window.scrollY + window.innerHeight);
        return bottomDist <= NEAR_BOTTOM_PX;
      }
    } catch (e) { return true; }
  }

  // Heuristic: is this turn currently streaming / active? don't detach streaming nodes
  function isStreamingTurn(el) {
    if (!el) return false;
    try {
      // look for common stop/button or streaming marker inside the turn
      if (el.querySelector('[data-testid="stop-button"], button[aria-label*="stop streaming" i], .streaming, [data-streaming]')) return true;
      // also check descendant for a "spinner" or progress-like element
      if (el.querySelector('svg[role="img"], .spinner')) return true;
    } catch (e) {}
    return false;
  }

  // chunked detach - non blocking
  function detachOldTurnsIfNeeded() {
    if (!enabled || scheduledDetach) return;
    scheduledDetach = true;

    const doDetach = () => {
      scheduledDetach = false;
      try {
        const turns = getTurns();
        const keep = VISIBLE_KEEP;
        if (turns.length <= keep) return;

        let needDetach = turns.length - keep;
        let idx = 0;

        function workChunk() {
          let did = 0;
          while (needDetach > 0 && idx < turns.length) {
            const el = turns[idx];
            idx++;
            // skip if streaming or otherwise protected
            if (!el || !el.parentNode || isStreamingTurn(el)) continue;
            // create placeholder
            const ph = document.createComment('detached-turn');
            el.parentNode.insertBefore(ph, el);
            el.remove();
            hiddenStore.push({ placeholder: ph, node: el });
            did++;
            needDetach--;
            // cap hiddenStore
            if (hiddenStore.length > MAX_HIDDEN) {
              // prune oldest (FIFO)
              hiddenStore.shift();
            }
            if (did >= CHUNK_SIZE) break;
          }
          if (needDetach > 0 && idx < turns.length) {
            // schedule next chunk
            if (USE_REQUEST_IDLE) requestIdleCallback(workChunk, {timeout: 200});
            else setTimeout(workChunk, 16);
          }
        }

        // start first chunk
        if (USE_REQUEST_IDLE) requestIdleCallback(workChunk, {timeout: 200});
        else setTimeout(workChunk, 0);
      } catch (e) {
        console.error('detach error', e);
        try { restoreAll(); } catch (e2) {}
      }
    };

    // small safety: only detach if user is near bottom (not reading old messages)
    if (!isNearBottom()) {
      scheduledDetach = false;
      return;
    }

    doDetach();
  }

  // restore up to `count` oldest from hiddenStore (reinsert before corresponding placeholder) in chunks
  function restoreSome(count) {
    if (!count || hiddenStore.length === 0 || restoring) return;
    restoring = true;
    let toRestore = Math.min(count, hiddenStore.length);

    function workChunk() {
      let did = 0;
      for (let i = 0; i < CHUNK_SIZE && toRestore > 0 && hiddenStore.length; i++, did++, toRestore--) {
        const item = hiddenStore.splice(hiddenStore.length - 1, 1)[0]; // FIFO restore: oldest first
        try {
          const { placeholder, node } = item;
          if (placeholder && placeholder.parentNode) {
            placeholder.parentNode.insertBefore(node, placeholder);
            placeholder.remove();
          } else {
            const feed = pickFeedRoot();
            if (feed) feed.appendChild(node);
          }
        } catch (e) {
          console.warn('restore error', e);
        }
      }
      if (toRestore > 0 && hiddenStore.length) {
        if (USE_REQUEST_IDLE) requestIdleCallback(workChunk, {timeout: 200});
        else setTimeout(workChunk, 16);
      } else {
        restoring = false;
      }
    }

    if (USE_REQUEST_IDLE) requestIdleCallback(workChunk, {timeout: 200});
    else setTimeout(workChunk, 0);
  }

  function restoreAll() {
    if (restoring) return;
    restoreSome(hiddenStore.length);
  }

  // reveal more when user scrolls away from bottom
  function revealMoreOnScroll() {
    if (!enabled) return;
    if (isNearBottom()) return;
    if (!hiddenStore.length) return;
    // reveal a batch
    restoreSome(REVEAL_BATCH);
  }

  function flushAllIfAtBottom() {
    try {
      if (isNearBottom()) restoreAll();
    } catch (e) {}
  }

  // debounce observer reaction
  function scheduleDetachDebounced() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      detachOldTurnsIfNeeded();
    }, OBS_DEBOUNCE_MS);
  }

  // observer: watch for new turns appearing
  function attachObserver() {
    try {
      const root = pickFeedRoot();
      if (!root) return;
      if (observer) observer.disconnect();
      observer = new MutationObserver(muts => {
        let added = false;
        for (const m of muts) {
          if (m.addedNodes && m.addedNodes.length) {
            added = true;
            break;
          }
        }
        if (added) scheduleDetachDebounced();
      });
      observer.observe(root, { childList: true, subtree: true });
    } catch (e) {
      console.error('attachObserver error', e);
    }
  }

  // STREAM detection: if stream ends, flush small delay
  function hasStopButton() {
    return !!document.querySelector('#composer-submit-button[data-testid="stop-button"], [data-testid="stop-button"], button[aria-label*="stop streaming" i]');
  }

  function pollStream() {
    try {
      const s = hasStopButton();
      if (lastStream && !s) {
        // stream ended -> small delay then flush recent items if at bottom
        setTimeout(() => {
          flushAllIfAtBottom();
        }, 80);
      }
      lastStream = s;
    } catch (e) {}
  }

  // UI toggle + quick info
  function ensureButton() {
    if (document.getElementById(BUTTON_ID)) return;
    const btn = document.createElement('button');
    btn.id = BUTTON_ID;
    btn.title = 'Toggle detach (Ctrl+Alt+D)';
    btn.textContent = enabled ? 'Detach: ON' : 'Detach: OFF';
    Object.assign(btn.style, {
      position: 'fixed', right: '10px', bottom: '10px', zIndex: 2147483647,
      padding: '6px 10px', borderRadius: '8px', background: '#0b0b0bcc', color: '#fff', border: '1px solid #333', cursor: 'pointer',
      fontSize: '13px'
    });
    btn.addEventListener('click', () => {
      enabled = !enabled;
      btn.textContent = enabled ? 'Detach: ON' : 'Detach: OFF';
      if (!enabled) {
        // when disabling, restore immediately all to avoid losing UI
        restoreAll();
      } else {
        scheduleDetachDebounced();
      }
    });
    document.body.appendChild(btn);
  }

  // keyboard shortcut to toggle
  function attachKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.altKey && e.code === 'KeyD') {
        const btn = document.getElementById(BUTTON_ID);
        if (btn) btn.click();
      }
    });
  }

  // scroll listeners: when user scrolls, reveal more / flush as appropriate
  function attachScrollHandlers() {
    window.addEventListener('scroll', () => {
      revealMoreOnScroll();
    }, { passive: true });

    const feed = pickFeedRoot();
    const ancestor = findScrollableAncestor(feed);
    if (ancestor && ancestor !== window) {
      ancestor.addEventListener('scroll', () => {
        revealMoreOnScroll();
      }, { passive: true });
    }
  }

  // ---------- BOOT ----------
  function boot() {
    try {
      ensureButton();
      attachObserver();
      attachScrollHandlers();
      attachKeyboard();
      // poll stream status
      setInterval(pollStream, 300);
      // initial detach attempt on load (if long history)
      setTimeout(scheduleDetachDebounced, 700);
    } catch (e) {
      console.error('detach boot error', e);
    }
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') boot();
  else window.addEventListener('DOMContentLoaded', boot, { once: true });

})();
