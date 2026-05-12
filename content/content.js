/* MeasureTool content script — full MeasureMate-feature replication */
(() => {
  'use strict';

  // ── Constants ────────────────────────────────────────────────────────────
  const SNAP_DIST = 8;
  const MODE_INSPECTOR = 'inspector';
  const MODE_GUIDES    = 'guides';

  // ── State ────────────────────────────────────────────────────────────────
  const S = {
    enabled:       false,
    mode:          MODE_INSPECTOR,
    snap:          true,
    inspectorOpen: false,
    selected:  [],       // pinned elements
    hovered:   null,
    guides:    [],       // { id, type:'h'|'v', pos, selected:false }
    guideSeq:  0,
    activeGuide: null,   // id of guide being dragged/nudged
    mouseX:    0,
    mouseY:    0,
    // marquee
    marqueeing:  false,
    marqueeStart: null,
    // mouse movement direction tracking
    prevMouseX: 0,
    prevMouseY: 0,
    moveDeltaX: 0,
    moveDeltaY: 0,
    // inspector panel drag
    panelDrag: null,
  };

  // ── SVG Icon set ─────────────────────────────────────────────────────────
  const IC = {
    // Magnifying glass — universal "inspect" metaphor
    inspect: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="5.5" cy="5.5" r="3.5" stroke="currentColor" stroke-width="1.5"/><line x1="8.2" y1="8.2" x2="12.5" y2="12.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
    // Crosshair — "guides / reference lines" mode
    guides:  `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="2.5" stroke="currentColor" stroke-width="1.5"/><line x1="7" y1="1" x2="7" y2="4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="7" y1="10" x2="7" y2="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="1" y1="7" x2="4" y2="7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="10" y1="7" x2="13" y2="7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
    // Horseshoe magnet — snap-to-edge
    snap:    `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 2v3.5a4.5 4.5 0 009 0V2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="2.5" y1="10.5" x2="2.5" y2="12.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="11.5" y1="10.5" x2="11.5" y2="12.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    // Horizontal measurement line with end caps
    hguide:  `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><line x1="2" y1="7" x2="12" y2="7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="2" y1="4" x2="2" y2="10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="12" y1="4" x2="12" y2="10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
    // Vertical measurement line with end caps
    vguide:  `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><line x1="7" y1="2" x2="7" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="4" y1="2" x2="10" y2="2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="4" y1="12" x2="10" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
    // Trash can with detail lines
    clear:   `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><line x1="2" y1="4" x2="12" y2="4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M4.5 4V2.5a.5.5 0 01.5-.5h4a.5.5 0 01.5.5V4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.5 4l.75 8h6.5L11.5 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><line x1="7" y1="6.5" x2="7" y2="10.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><line x1="5.5" y1="6.5" x2="5.5" y2="10.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><line x1="8.5" y1="6.5" x2="8.5" y2="10.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>`,
    chevD:   `<svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M1.5 3l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    chevR:   `<svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M3 1.5l3 3-3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  };

  // ── DOM refs ─────────────────────────────────────────────────────────────
  let ROOT, OVERLAY, CANVAS, CTX;

  // roundRect polyfill for older Chrome
  function ctxRoundRect(ctx, x, y, w, h, r) {
    if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.arcTo(x+w, y, x+w, y+r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x+w, y+h, x+w-r, y+h, r);
    ctx.lineTo(x + r, y + h); ctx.arcTo(x, y+h, x, y+h-r, r);
    ctx.lineTo(x, y + r); ctx.arcTo(x, y, x+r, y, r);
  }
  let PANEL, MARQUEE, STATUSBAR;
  let distLabels = [];

  // ── Build UI ─────────────────────────────────────────────────────────────
  function buildUI() {
    if (document.getElementById('mt-root')) {
      ROOT      = document.getElementById('mt-root');
      OVERLAY   = ROOT.querySelector('#mt-overlay');
      CANVAS    = ROOT.querySelector('#mt-canvas');
      PANEL     = ROOT.querySelector('#mt-panel');
      MARQUEE   = ROOT.querySelector('#mt-marquee');
      STATUSBAR = ROOT.querySelector('#mt-statusbar');
      CTX = CANVAS.getContext('2d');
      return;
    }

    ROOT    = el('div', 'mt-root', null, 'id=mt-root');
    OVERLAY = el('div', null, ROOT, 'id=mt-overlay');
    CANVAS  = el('canvas', null, OVERLAY, 'id=mt-canvas');
    CTX     = CANVAS.getContext('2d');

    MARQUEE   = el('div', null, ROOT, 'id=mt-marquee');
    STATUSBAR = el('div', null, ROOT, 'id=mt-statusbar');

    PANEL = el('div', null, ROOT, 'id=mt-panel');
    buildControlPanel();

    document.documentElement.appendChild(ROOT);

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('scroll', () => { updateHighlights(); redraw(); }, { passive: true });
  }

  function el(tag, cls, parent, attrs) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (attrs) attrs.split(' ').forEach(a => {
      const [k, v] = a.split('=');
      e.setAttribute(k, v || '');
    });
    if (parent) parent.appendChild(e);
    return e;
  }

  function resizeCanvas() {
    const w   = document.documentElement.clientWidth;
    const h   = document.documentElement.clientHeight;
    const dpr = window.devicePixelRatio || 1;

    // CSS size = viewport (no scrollbar)
    CANVAS.style.width  = w + 'px';
    CANVAS.style.height = h + 'px';
    OVERLAY.style.width  = w + 'px';
    OVERLAY.style.height = h + 'px';

    // Physical pixels = CSS × DPR → crisp on Retina
    CANVAS.width  = Math.round(w * dpr);
    CANVAS.height = Math.round(h * dpr);

    // Scale context so all drawing uses CSS-pixel coordinates
    CTX.setTransform(dpr, 0, 0, dpr, 0, 0);
    redraw();
  }

  // ── Control Panel ─────────────────────────────────────────────────────────
  function buildControlPanel() {
    PANEL.innerHTML = '';

    // ── Drag handle + toolbar ────────────────────────────────────────────────
    const handle = el('div', 'cp-handle', PANEL);
    const toolbar = el('div', 'cp-toolbar', handle);

    const iconBtn = (icon, tip, isActive) => {
      const b = el('div', 'cp-btn' + (isActive ? ' active' : ''), toolbar);
      b.innerHTML = icon;
      b.title = tip;
      return b;
    };

    const inspBtn = iconBtn(IC.inspect, 'Inspector  [1]', S.mode === MODE_INSPECTOR);
    inspBtn.addEventListener('click', () => { S.mode = MODE_INSPECTOR; updatePanel(); updateStatusBar(); });

    const guidBtn = iconBtn(IC.guides, 'Guides  [2]', S.mode === MODE_GUIDES);
    guidBtn.addEventListener('click', () => { S.mode = MODE_GUIDES; updatePanel(); updateStatusBar(); });

    el('div', 'cp-sep', toolbar);

    const snapBtn = iconBtn(IC.snap, 'Snap  [S]', S.snap);
    snapBtn.addEventListener('click', () => { S.snap = !S.snap; updatePanel(); });

    if (S.mode === MODE_GUIDES) {
      el('div', 'cp-sep', toolbar);
      const addH = iconBtn(IC.hguide, 'Add H-Guide  [H]', false);
      addH.addEventListener('click', () => addGuide('h', S.mouseY));
      const addV = iconBtn(IC.vguide, 'Add V-Guide  [V]', false);
      addV.addEventListener('click', () => addGuide('v', S.mouseX));
      const clr = iconBtn(IC.clear, 'Clear Guides  [Q]', false);
      clr.addEventListener('click', () => { S.guides = []; redraw(); });
    }

    // Mode pill (right-aligned)
    const pill = el('div', 'cp-mode-pill', toolbar);
    pill.innerHTML = `<b>${S.mode === MODE_INSPECTOR ? 'Inspector' : 'Guides'}</b>${S.snap ? ' · Snap' : ''}`;

    // Drag handle behaviour (drag by toolbar area)
    makeDraggable(PANEL, handle);

    // ── Inspector section (only in inspector mode) ───────────────────────────
    if (S.mode === MODE_INSPECTOR) {
      const insSection = el('div', 'cp-inspector', PANEL, 'id=mt-panel-inspector');

      // Collapsible header
      const hdr = el('div', 'cp-ins-hdr', insSection);
      const chevron = el('span', 'cp-ins-chevron', hdr);
      chevron.innerHTML = S.inspectorOpen ? IC.chevD : IC.chevR;
      el('span', 'cp-ins-label', hdr).textContent = 'Inspector';

      // Quick-info displayed in header even when body is collapsed
      const quick = el('div', 'cp-ins-quick', hdr, 'id=cp-ins-quick');
      quick.style.display = 'none';
      el('span', 'cp-ins-qtag', quick, 'id=ph-tag');
      el('span', 'cp-ins-qsel', quick, 'id=ph-sel');
      el('span', 'cp-ins-qsize', quick, 'id=ph-size');

      // Collapsible content wrapper
      const wrap = el('div', '', insSection, 'id=cp-ins-wrap');
      if (!S.inspectorOpen) wrap.style.display = 'none';

      // Placeholder shown until first element is inspected
      const placeholder = el('div', 'cp-ins-placeholder', wrap, 'id=cp-ins-placeholder');
      placeholder.textContent = 'Hover over an element to inspect';

      // Detail section (hidden until first showInspector call)
      const detail = el('div', '', wrap, 'id=cp-ins-detail');
      detail.style.display = 'none';

      el('div', 'cp-ins-pos', detail, 'id=ph-pos');

      const body = el('div', 'cp-ins-body', detail);
      el('div', 'cp-bm', body, 'id=mt-panel-bm');
      el('div', 'cp-props', body, 'id=mt-panel-props');

      // Toggle collapse
      hdr.addEventListener('click', () => {
        S.inspectorOpen = !S.inspectorOpen;
        chevron.innerHTML = S.inspectorOpen ? IC.chevD : IC.chevR;
        wrap.style.display = S.inspectorOpen ? '' : 'none';
      });
    }

    // ── Shortcuts toggle ─────────────────────────────────────────────────────
    const scToggle = el('div', 'cp-sc-toggle', PANEL);
    const scChevron = el('span', 'cp-ins-chevron', null);
    scChevron.innerHTML = IC.chevR;
    scToggle.append(scChevron, document.createTextNode(' Shortcuts'));
    const scBody = el('div', 'cp-sc-body', PANEL);
    scBody.style.display = 'none';
    scToggle.addEventListener('click', () => {
      const open = scBody.style.display !== 'none';
      scBody.style.display = open ? 'none' : 'grid';
      scChevron.innerHTML = open ? IC.chevR : IC.chevD;
    });

    const shortcuts = [
      ['Toggle tool',     'Ctrl+Shift+M'], ['Inspector',       '1'],
      ['Guides mode',     '2'],            ['Show/hide panel', 'M'],
      ['Add H guide',     'H'],            ['Add V guide',     'V'],
      ['Toggle snap',     'S'],            ['Clear guides',    'Q'],
      ['Deselect',        'Esc'],          ['Multi-select',    'Shift+Click'],
      ['DOM parent',      '↑'],            ['DOM child',       '↓'],
      ['Nudge 1px',       '← →'],          ['Nudge 10px',      'Shift+←→'],
    ];
    shortcuts.forEach(([label, key]) => {
      const r = el('div', 'cp-sc-row', scBody);
      el('span', 'cp-sc-label', r).textContent = label;
      el('span', 'cp-kbd', r).textContent = key;
    });
  }

  function updatePanel() {
    const insSection = ROOT && ROOT.querySelector('#mt-panel-inspector');
    // Keep inspector section visibility, just rebuild toolbar/shortcuts
    buildControlPanel();
  }

  // ── Enable / Disable ──────────────────────────────────────────────────────
  function enable() {
    buildUI();
    S.enabled = true;
    document.documentElement.style.userSelect = 'none';
    document.documentElement.style.webkitUserSelect = 'none';
    STATUSBAR.style.display = 'flex';
    PANEL.style.display = 'flex';
    updateStatusBar();
    attachEvents();
    redraw();
  }

  function disable() {
    S.enabled = false;
    document.documentElement.style.userSelect = '';
    document.documentElement.style.webkitUserSelect = '';
    S.selected = [];
    S.hovered  = null;
    detachEvents();
    clearHighlights();
    clearDistLabels();
    clearGuideEls();
    if (PANEL) PANEL.style.display = 'none';
    if (STATUSBAR) STATUSBAR.style.display = 'none';
    if (MARQUEE)   MARQUEE.style.display   = 'none';
    if (CTX) CTX.clearRect(0, 0, CANVAS.width / (window.devicePixelRatio || 1), CANVAS.height / (window.devicePixelRatio || 1));
  }

  function toggle() { S.enabled ? disable() : enable(); }

  // ── Event Wiring ──────────────────────────────────────────────────────────
  function attachEvents() {
    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('mouseup',   onMouseUp,   true);
    document.addEventListener('click',     onClick,     true);
    document.addEventListener('keydown',   onKeyDown,   true);
  }

  function detachEvents() {
    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('mousedown', onMouseDown, true);
    document.removeEventListener('mouseup',   onMouseUp,   true);
    document.removeEventListener('click',     onClick,     true);
    document.removeEventListener('keydown',   onKeyDown,   true);
  }

  // ── Mouse Events ──────────────────────────────────────────────────────────
  function onMouseMove(e) {
    S.moveDeltaX = Math.abs(e.clientX - S.prevMouseX);
    S.moveDeltaY = Math.abs(e.clientY - S.prevMouseY);
    S.prevMouseX = S.mouseX;
    S.prevMouseY = S.mouseY;
    S.mouseX = e.clientX;
    S.mouseY = e.clientY;
    updateStatusBar();

    // Marquee drag
    if (S.marqueeing && S.marqueeStart) {
      const x1 = Math.min(S.marqueeStart.x, e.clientX);
      const y1 = Math.min(S.marqueeStart.y, e.clientY);
      const x2 = Math.max(S.marqueeStart.x, e.clientX);
      const y2 = Math.max(S.marqueeStart.y, e.clientY);
      MARQUEE.style.cssText = `display:block;left:${x1}px;top:${y1}px;width:${x2-x1}px;height:${y2-y1}px;`;
      return;
    }

    if (S.mode === MODE_INSPECTOR) {
      const el = pickEl(e.clientX, e.clientY);
      if (el !== S.hovered) {
        S.hovered = el;
        updateHighlights();
        if (el) {
          showInspector(el);
          showBoxModel(el);
        }
        redraw();
      } else {
        redraw(); // redraw distances with new mouse pos
      }
    } else {
      // Guides mode — cursor snapping highlight
      if (S.snap) {
        const sx = snapPoint('v', e.clientX);
        const sy = snapPoint('h', e.clientY);
        S.snapX = sx;
        S.snapY = sy;
      }
      redraw();
    }
  }

  function onMouseDown(e) {
    if (e.target.closest('#mt-root')) return;

    if (S.mode === MODE_INSPECTOR) {
      // Prevent text selection on shift+click and normal clicks
      e.preventDefault();

      if (!e.shiftKey) {
        // Start potential marquee on empty area
        const el = pickEl(e.clientX, e.clientY);
        if (!el) {
          S.marqueeing = true;
          S.marqueeStart = { x: e.clientX, y: e.clientY };
          S.selected = [];
          updateHighlights();
          redraw();
          e.stopPropagation();
        }
      }
    }
  }

  function onMouseUp(e) {
    if (S.marqueeing) {
      S.marqueeing = false;
      if (MARQUEE) MARQUEE.style.display = 'none';

      if (S.marqueeStart) {
        const x1 = Math.min(S.marqueeStart.x, e.clientX);
        const y1 = Math.min(S.marqueeStart.y, e.clientY);
        const x2 = Math.max(S.marqueeStart.x, e.clientX);
        const y2 = Math.max(S.marqueeStart.y, e.clientY);

        if (x2 - x1 > 4 || y2 - y1 > 4) {
          S.selected = elementsInRect(x1, y1, x2, y2);
          updateHighlights();
          redraw();
        }
        S.marqueeStart = null;
      }
    }
  }

  function onClick(e) {
    if (e.target.closest('#mt-root')) return;

    if (S.mode === MODE_GUIDES) {
      e.preventDefault();
      e.stopPropagation();
      // 垂直移動 → 水平線；水平移動 → 垂直線
      const type = S.moveDeltaY >= S.moveDeltaX ? 'h' : 'v';
      const pos  = type === 'h'
        ? (S.snap ? snapPoint('h', e.clientY) : e.clientY)
        : (S.snap ? snapPoint('v', e.clientX) : e.clientX);
      addGuide(type, pos);
      return;
    }

    if (S.mode === MODE_INSPECTOR) {
      const target = pickEl(e.clientX, e.clientY);
      if (!target) return;
      e.preventDefault();
      e.stopPropagation();

      if (e.shiftKey) {
        const idx = S.selected.indexOf(target);
        idx === -1 ? S.selected.push(target) : S.selected.splice(idx, 1);
      } else {
        S.selected = S.selected.length === 1 && S.selected[0] === target ? [] : [target];
      }
      updateHighlights();
      redraw();
    }
  }

  // ── Keyboard ──────────────────────────────────────────────────────────────
  function onKeyDown(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

    // Cmd/Ctrl+Shift+M → toggle
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'M') {
      toggle();
      e.preventDefault();
      return;
    }
    if (!S.enabled) return;

    switch (e.key) {
      case '1':
        S.mode = MODE_INSPECTOR;
        updatePanel(); updateStatusBar();
        e.preventDefault();
        break;
      case '2':
        S.mode = MODE_GUIDES;
        updatePanel(); updateStatusBar();
        e.preventDefault();
        break;
      case 'm': case 'M':
        if (!e.ctrlKey && !e.metaKey) {
          PANEL.style.display = PANEL.style.display === 'none' ? 'flex' : 'none';
          e.preventDefault();
        }
        break;
      case 'h': case 'H':
        if (S.mode === MODE_GUIDES && !e.ctrlKey && !e.metaKey) {
          addGuide('h', S.snap ? snapPoint('h', S.mouseY) : S.mouseY);
          e.preventDefault();
        }
        break;
      case 'v': case 'V':
        if (S.mode === MODE_GUIDES && !e.ctrlKey && !e.metaKey) {
          addGuide('v', S.snap ? snapPoint('v', S.mouseX) : S.mouseX);
          e.preventDefault();
        }
        break;
      case 's': case 'S':
        if (!e.ctrlKey && !e.metaKey) {
          S.snap = !S.snap;
          updatePanel();
          e.preventDefault();
        }
        break;
      case 'q': case 'Q':
        S.guides = [];
        S.activeGuide = null;
        redraw();
        e.preventDefault();
        break;
      case 'Escape':
        S.selected = [];
        S.activeGuide = null;
        S.guides.forEach(g => g.selected = false);
        updateHighlights();
        redraw();
        break;
      case 'ArrowUp': case 'ArrowDown': case 'ArrowLeft': case 'ArrowRight':
        handleArrowKey(e);
        break;
    }
  }

  function handleArrowKey(e) {
    const step = e.shiftKey ? 10 : 1;

    // If a guide is active, nudge it
    if (S.activeGuide !== null) {
      const g = S.guides.find(g => g.id === S.activeGuide);
      if (g) {
        if (g.type === 'h' && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
          g.pos += e.key === 'ArrowDown' ? step : -step;
        } else if (g.type === 'v' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
          g.pos += e.key === 'ArrowRight' ? step : -step;
        }
        redraw();
        e.preventDefault();
        return;
      }
    }

    // DOM navigation on selected element
    if (S.selected.length === 1 && S.mode === MODE_INSPECTOR) {
      const cur = S.selected[0];
      if (e.key === 'ArrowUp' && cur.parentElement && cur.parentElement !== document.body) {
        if (!cur.parentElement.closest('#mt-root')) {
          S.selected = [cur.parentElement];
          updateHighlights();
          showInspector(cur.parentElement);
          showBoxModel(cur.parentElement);
          redraw();
          e.preventDefault();
        }
      } else if (e.key === 'ArrowDown' && cur.firstElementChild) {
        if (!cur.firstElementChild.closest('#mt-root')) {
          S.selected = [cur.firstElementChild];
          updateHighlights();
          showInspector(cur.firstElementChild);
          showBoxModel(cur.firstElementChild);
          redraw();
          e.preventDefault();
        }
      }
    }
  }

  // ── Element Picking ───────────────────────────────────────────────────────
  // elementsFromPoint includes pointer-events:none elements (unlike elementFromPoint),
  // which lets us reach deeply nested elements even when ancestor <a> tags or wrappers
  // have absorbed pointer events via CSS (e.g. `a * { pointer-events:none }`).
  // We skip MT overlay elements, html/body, zero-size elements, and truly invisible
  // elements (visibility:hidden / opacity:0) to reach the deepest visible page element.
  function pickEl(x, y) {
    const hits = document.elementsFromPoint(x, y);
    for (const el of hits) {
      if (el === document.documentElement || el === document.body) continue;
      if (el.closest('#mt-root')) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      const cs = window.getComputedStyle(el);
      if (cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) continue;
      return el;
    }
    return null;
  }

  function elementsInRect(x1, y1, x2, y2) {
    const results = [];
    document.querySelectorAll('*').forEach(el => {
      if (el.closest('#mt-root')) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      if (r.left >= x1 && r.top >= y1 && r.right <= x2 && r.bottom <= y2) {
        results.push(el);
      }
    });
    return results;
  }

  // ── Highlights ────────────────────────────────────────────────────────────
  function clearHighlights() {
    ROOT && ROOT.querySelectorAll('.mt-hl, .mt-size-badge').forEach(e => e.remove());
  }

  function updateHighlights() {
    clearHighlights();
    S.selected.forEach(el => createHighlight(el, 'select'));
    if (S.hovered && !S.selected.includes(S.hovered)) {
      createHighlight(S.hovered, 'hover');
    }
  }

  function createHighlight(el, type) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;

    const box = document.createElement('div');
    box.className = `mt-hl mt-hl-${type}`;
    box.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;`;

    const badge = document.createElement('div');
    badge.className = `mt-size-badge mt-size-badge-${type}`;
    badge.textContent = `${Math.round(r.width)} × ${Math.round(r.height)}`;
    const bt = r.top < 22 ? r.bottom + 2 : r.top - 20;
    badge.style.cssText = `left:${r.left}px;top:${bt}px;`;

    ROOT.appendChild(box);
    ROOT.appendChild(badge);
  }

  // ── Inspector Panel ───────────────────────────────────────────────────────
  function showInspector(elem) {
    const insSection = ROOT.querySelector('#mt-panel-inspector');
    if (!insSection) return;
    const cs  = window.getComputedStyle(elem);
    const r   = elem.getBoundingClientRect();
    const tag = elem.tagName.toLowerCase();
    const id  = elem.id ? `#${elem.id}` : '';
    const cls = typeof elem.className === 'string' && elem.className
      ? '.' + elem.className.trim().split(/\s+/).slice(0,2).join('.') : '';

    ROOT.querySelector('#ph-tag').textContent  = `<${tag}>`;
    ROOT.querySelector('#ph-sel').textContent  = `${id}${cls}`;
    ROOT.querySelector('#ph-size').textContent = `${Math.round(r.width)} × ${Math.round(r.height)}`;
    ROOT.querySelector('#ph-pos').textContent  = `${Math.round(r.left)}px, ${Math.round(r.top)}px`;

    // Show quick-info in header (visible even when body is collapsed)
    const quick = ROOT.querySelector('#cp-ins-quick');
    if (quick) quick.style.display = '';

    // Reveal detail section, hide placeholder (first hover only)
    const placeholder = ROOT.querySelector('#cp-ins-placeholder');
    const detail = ROOT.querySelector('#cp-ins-detail');
    if (placeholder) placeholder.style.display = 'none';
    if (detail) detail.style.display = '';

    // ── CSS Properties column ──────────────────────────────────────────────
    const propsEl = ROOT.querySelector('#mt-panel-props');
    propsEl.innerHTML = '';

    const fontFamily = cs.fontFamily.split(',')[0].replace(/["']/g,'').trim();
    const display    = cs.display;
    let   layout     = display;
    if (display === 'flex') layout = `flex / ${cs.flexDirection}`;
    if (display === 'grid') layout = `grid`;

    const propGroups = [
      { title: 'Typography', rows: [
        ['Font',     fontFamily],
        ['Size',     cs.fontSize],
        ['Weight',   cs.fontWeight],
        ['Color',    cs.color,            true],
        ['Line-h',   cs.lineHeight],
      ]},
      { title: 'Layout', rows: [
        ['Display',  layout],
        ['Position', cs.position],
        ['Z-index',  cs.zIndex === 'auto' ? 'auto' : cs.zIndex],
        ...(cs.backgroundColor !== 'rgba(0, 0, 0, 0)' ? [['BG', cs.backgroundColor, true]] : []),
      ]},
    ];

    propGroups.forEach(({ title, rows }) => {
      const grp = el('div', 'cp-prop-group', propsEl);
      el('div', 'cp-prop-title', grp).textContent = title;
      rows.forEach(([key, val, isColor]) => {
        const row = el('div', 'cp-prop-row', grp);
        el('span', 'cp-prop-key', row).textContent = key;
        const v = el('span', 'cp-prop-val', row);
        if (isColor) {
          const chip = el('span', 'mt-color-chip', v);
          chip.style.background = val;
          v.appendChild(document.createTextNode(colorToHex(val)));
        } else {
          v.textContent = val;
        }
      });
    });

    // ── Box model column ───────────────────────────────────────────────────
    showBoxModel(elem);
  }

  // ── Box Model ─────────────────────────────────────────────────────────────
  function showBoxModel(elem) {
    const bmEl = ROOT.querySelector('#mt-panel-bm');
    if (!bmEl) return;
    const cs = window.getComputedStyle(elem);
    const r  = elem.getBoundingClientRect();
    const m  = fourSides(cs, 'margin');
    const p  = fourSides(cs, 'padding');
    const b  = {
      top:    roundPx(cs.borderTopWidth),   right:  roundPx(cs.borderRightWidth),
      bottom: roundPx(cs.borderBottomWidth),left:   roundPx(cs.borderLeftWidth),
    };
    const cw = Math.round(r.width  - (parseFloat(cs.paddingLeft)||0)  - (parseFloat(cs.paddingRight)||0)  - (parseFloat(cs.borderLeftWidth)||0)  - (parseFloat(cs.borderRightWidth)||0));
    const ch = Math.round(r.height - (parseFloat(cs.paddingTop)||0)   - (parseFloat(cs.paddingBottom)||0) - (parseFloat(cs.borderTopWidth)||0)   - (parseFloat(cs.borderBottomWidth)||0));

    bmEl.innerHTML = `
      <div class="bm-header">Box Model</div>
      <div class="bm-layer bm-margin">
        <div class="bm-row"><span class="bm-zone-label">margin</span><span>${fmtPx(m.top)}</span></div>
        <div class="bm-mid">
          <span>${fmtPx(m.left)}</span>
          <div class="bm-layer bm-border">
            <div class="bm-row"><span class="bm-zone-label">border</span><span>${fmtPx(b.top)}</span></div>
            <div class="bm-mid">
              <span>${fmtPx(b.left)}</span>
              <div class="bm-layer bm-padding">
                <div class="bm-row"><span class="bm-zone-label">padding</span><span>${fmtPx(p.top)}</span></div>
                <div class="bm-mid">
                  <span>${fmtPx(p.left)}</span>
                  <div class="bm-layer bm-content">${cw} × ${ch}</div>
                  <span>${fmtPx(p.right)}</span>
                </div>
                <div class="bm-row"><span></span><span>${fmtPx(p.bottom)}</span></div>
              </div>
              <span>${fmtPx(b.right)}</span>
            </div>
            <div class="bm-row"><span></span><span>${fmtPx(b.bottom)}</span></div>
          </div>
          <span>${fmtPx(m.right)}</span>
        </div>
        <div class="bm-row"><span></span><span>${fmtPx(m.bottom)}</span></div>
      </div>
    `;
  }

  // ── Guides ────────────────────────────────────────────────────────────────
  function addGuide(type, pos) {
    const id = ++S.guideSeq;
    S.guides.push({ id, type, pos, selected: false });
    S.activeGuide = id;
    redraw();
  }

  function snapPoint(axis, pos) {
    let best = pos, bestDist = SNAP_DIST + 1;
    const check = (v) => {
      const d = Math.abs(v - pos);
      if (d < bestDist) { bestDist = d; best = v; }
    };
    document.querySelectorAll('*').forEach(el => {
      if (el.closest('#mt-root')) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      if (axis === 'h') {
        check(r.top); check(r.bottom); check((r.top + r.bottom) / 2);
      } else {
        check(r.left); check(r.right); check((r.left + r.right) / 2);
      }
    });
    return best;
  }

  function clearGuideEls() {
    ROOT && ROOT.querySelectorAll('.mt-guide, .mt-guide-label').forEach(e => e.remove());
  }

  // ── Canvas Drawing ────────────────────────────────────────────────────────
  function clearDistLabels() {
    distLabels.forEach(l => l.remove());
    distLabels = [];
  }

  // ── Box Model Canvas Overlay (DevTools style) ─────────────────────────────
  function drawBoxModelOverlay(el) {
    if (!el) return;
    const cs = window.getComputedStyle(el);
    const r  = el.getBoundingClientRect();

    const mt = parseFloat(cs.marginTop)        || 0;
    const mr = parseFloat(cs.marginRight)      || 0;
    const mb = parseFloat(cs.marginBottom)     || 0;
    const ml = parseFloat(cs.marginLeft)       || 0;
    const bt = parseFloat(cs.borderTopWidth)   || 0;
    const br = parseFloat(cs.borderRightWidth) || 0;
    const bb = parseFloat(cs.borderBottomWidth)|| 0;
    const bl = parseFloat(cs.borderLeftWidth)  || 0;
    const pt = parseFloat(cs.paddingTop)       || 0;
    const pr = parseFloat(cs.paddingRight)     || 0;
    const pb = parseFloat(cs.paddingBottom)    || 0;
    const pl = parseFloat(cs.paddingLeft)      || 0;

    // Named boxes in viewport coords
    const marginBox  = { l: r.left-ml,    t: r.top-mt,    r: r.right+mr,    b: r.bottom+mb  };
    const borderBox  = { l: r.left,       t: r.top,       r: r.right,       b: r.bottom     };
    const paddingBox = { l: r.left+bl,    t: r.top+bt,    r: r.right-br,    b: r.bottom-bb  };
    const contentBox = { l: r.left+bl+pl, t: r.top+bt+pt, r: r.right-br-pr, b: r.bottom-bb-pb };

    // DevTools palette
    const C_MARGIN  = 'rgba(255,159,26,0.3)';
    const C_BORDER  = 'rgba(47,124,255,0.18)';
    const C_PADDING = 'rgba(32,199,217,0.22)';
    const C_CONTENT = 'rgba(124,92,255,0.28)';

    CTX.save();

    // Draw rings using evenodd fill rule
    const fillRing = (outer, inner, color) => {
      const ow = outer.r - outer.l, oh = outer.b - outer.t;
      const iw = inner.r - inner.l, ih = inner.b - inner.t;
      if (ow <= 0 || oh <= 0) return;
      CTX.fillStyle = color;
      CTX.beginPath();
      CTX.rect(outer.l, outer.t, ow, oh);
      if (iw > 0 && ih > 0) CTX.rect(inner.r, inner.t, -iw, ih); // reverse = hole
      CTX.fill('evenodd');
    };

    fillRing(marginBox,  borderBox,  C_MARGIN);
    fillRing(borderBox,  paddingBox, C_BORDER);
    fillRing(paddingBox, contentBox, C_PADDING);

    // Content fill
    const cw = contentBox.r - contentBox.l, ch = contentBox.b - contentBox.t;
    if (cw > 0 && ch > 0) {
      CTX.fillStyle = C_CONTENT;
      CTX.fillRect(contentBox.l, contentBox.t, cw, ch);
    }

    // ── Labels ─────────────────────────────────────────────────
    CTX.font = 'bold 10px "SF Mono",Consolas,monospace';
    CTX.textAlign = 'center';
    CTX.textBaseline = 'middle';

    const drawLabel = (val, x, y, bgColor, textColor) => {
      if (Math.abs(val) < 0.5) return;
      const text = String(Math.round(val)) + 'px';
      const tw = CTX.measureText(text).width + 6;
      CTX.fillStyle = bgColor;
      CTX.beginPath();
      ctxRoundRect(CTX, x - tw/2, y - 8, tw, 16, 3);
      CTX.fill();
      CTX.fillStyle = textColor;
      CTX.fillText(text, x, y);
    };

    const midX = (borderBox.l + borderBox.r) / 2;
    const midY = (borderBox.t + borderBox.b) / 2;

    // Margin labels
    if (mt > 0) drawLabel(mt, midX, marginBox.t + mt/2,  'rgba(130,78,0,.92)', '#ffe9c3');
    if (mb > 0) drawLabel(mb, midX, borderBox.b + mb/2,  'rgba(130,78,0,.92)', '#ffe9c3');
    if (ml > 0) drawLabel(ml, marginBox.l + ml/2, midY,  'rgba(130,78,0,.92)', '#ffe9c3');
    if (mr > 0) drawLabel(mr, borderBox.r + mr/2, midY,  'rgba(130,78,0,.92)', '#ffe9c3');

    // Padding labels
    const pmx = (paddingBox.l + paddingBox.r) / 2;
    const pmy = (paddingBox.t + paddingBox.b) / 2;
    if (pt > 0) drawLabel(pt, pmx, paddingBox.t + pt/2,  'rgba(0,95,106,.92)',  '#d8faff');
    if (pb > 0) drawLabel(pb, pmx, contentBox.b + pb/2,  'rgba(0,95,106,.92)',  '#d8faff');
    if (pl > 0) drawLabel(pl, paddingBox.l + pl/2, pmy,  'rgba(0,95,106,.92)',  '#d8faff');
    if (pr > 0) drawLabel(pr, contentBox.r + pr/2, pmy,  'rgba(0,95,106,.92)',  '#d8faff');

    // Content size label
    if (cw > 30 && ch > 16) {
      const label = `${Math.round(cw)} × ${Math.round(ch)}`;
      const tw = CTX.measureText(label).width + 8;
      CTX.fillStyle = 'rgba(30,70,120,.85)';
      CTX.beginPath();
      ctxRoundRect(CTX, contentBox.l + cw/2 - tw/2, contentBox.t + ch/2 - 9, tw, 18, 4);
      CTX.fill();
      CTX.fillStyle = '#cae8ff';
      CTX.fillText(label, contentBox.l + cw/2, contentBox.t + ch/2);
    }

    CTX.restore();
  }

  function redraw() {
    if (!CTX) return;
    CTX.clearRect(0, 0, CANVAS.width / (window.devicePixelRatio || 1), CANVAS.height / (window.devicePixelRatio || 1));
    clearGuideEls();
    clearDistLabels();

    drawGuides();

    if (S.mode === MODE_INSPECTOR) {
      if (S.selected.length > 0) {
        S.selected.forEach(el => drawElementExtensions(el));
        drawGuideElementDots(S.selected);
        S.selected.forEach(el => drawLayoutGaps(el));
      }
      S.selected.forEach(el => drawBoxModelOverlay(el));
      drawDistances();
      if (S.hovered && S.selected.length === 0) {
        drawLayoutGaps(S.hovered);
        drawBoxModelOverlay(S.hovered);
        drawNeighborDistances(S.hovered);
      }
    }

    if (S.mode === MODE_GUIDES) {
      drawSnapCrosshair();
    }
  }

  function drawSelectedOutlines() {
    if (!S.selected.length) return;
    CTX.save();
    CTX.strokeStyle = '#ff6b6b';
    CTX.lineWidth = 2;
    CTX.setLineDash([]);
    S.selected.forEach(el => {
      const r = el.getBoundingClientRect();
      CTX.strokeRect(r.left + 1, r.top + 1, r.width - 2, r.height - 2);
    });
    CTX.restore();
  }

  // Distance between selected and hovered
  function drawDistances() {
    if (!S.selected.length || !S.hovered) return;
    if (S.selected.includes(S.hovered)) return;

    const hovR     = S.hovered.getBoundingClientRect();
    const selRects = S.selected.map(e => e.getBoundingClientRect());
    const selR     = unionRect(selRects);
    if (!selR) return;

    // Containment check still uses union rect
    if (S.selected.some(sel => S.hovered.contains(sel))) {
      renderContainmentLines(hovR, selR);
      return;
    }
    if (S.selected.some(sel => sel.contains(S.hovered))) {
      renderContainmentLines(selR, hovR);
      return;
    }

    // Use individual rects for distance lines so that each selected element's
    // gap to the hovered element is computed independently.  This prevents the
    // union-rect from swallowing C when it sits between A and B, which was the
    // cause of non-parallel reference lines.
    selRects.forEach(sr => renderDistanceLines(sr, hovR));
  }

  // Distances from hovered element to its nearest non-ancestor neighbors
  function drawNeighborDistances(el) {
    const r = el.getBoundingClientRect();
    const ancestors = new Set();
    let cur = el.parentElement;
    while (cur) { ancestors.add(cur); cur = cur.parentElement; }

    const neighbors = { top: null, bottom: null, left: null, right: null };
    const dists     = { top: Infinity, bottom: Infinity, left: Infinity, right: Infinity };

    document.querySelectorAll('*').forEach(other => {
      if (other === el || other.closest('#mt-root')) return;
      if (ancestors.has(other)) return; // skip ancestors
      if (other.contains(el)) return;   // skip containers
      const or = other.getBoundingClientRect();
      if (or.width === 0 || or.height === 0) return;
      // Skip elements that are effectively the full viewport
      const vw = document.documentElement.clientWidth;
      const vh = document.documentElement.clientHeight;
      if (or.width >= vw - 4 && or.height >= vh - 4) return;

      if (or.bottom <= r.top && overlapH(r, or)) {
        const d = r.top - or.bottom;
        if (d < dists.top) { dists.top = d; neighbors.top = or; }
      }
      if (or.top >= r.bottom && overlapH(r, or)) {
        const d = or.top - r.bottom;
        if (d < dists.bottom) { dists.bottom = d; neighbors.bottom = or; }
      }
      if (or.right <= r.left && overlapV(r, or)) {
        const d = r.left - or.right;
        if (d < dists.left) { dists.left = d; neighbors.left = or; }
      }
      if (or.left >= r.right && overlapV(r, or)) {
        const d = or.left - r.right;
        if (d < dists.right) { dists.right = d; neighbors.right = or; }
      }
    });

    CTX.save();
    CTX.strokeStyle = '#e74c3c';
    CTX.lineWidth = 1;
    CTX.setLineDash([3, 3]);

    // Use shared-region midpoint for centering lines, not just element center
    if (neighbors.top && dists.top > 0) {
      const nb = neighbors.top;
      const sharedMidX = (Math.max(r.left, nb.left) + Math.min(r.right, nb.right)) / 2;
      const y1 = nb.bottom, y2 = r.top;
      drawArrowLine(sharedMidX, y1, sharedMidX, y2, true);
      addDistLabel(dists.top, sharedMidX, (y1 + y2) / 2, 'v');
    }
    if (neighbors.bottom && dists.bottom > 0) {
      const nb = neighbors.bottom;
      const sharedMidX = (Math.max(r.left, nb.left) + Math.min(r.right, nb.right)) / 2;
      const y1 = r.bottom, y2 = nb.top;
      drawArrowLine(sharedMidX, y1, sharedMidX, y2, true);
      addDistLabel(dists.bottom, sharedMidX, (y1 + y2) / 2, 'v');
    }
    if (neighbors.left && dists.left > 0) {
      const nb = neighbors.left;
      const sharedMidY = (Math.max(r.top, nb.top) + Math.min(r.bottom, nb.bottom)) / 2;
      const x1 = nb.right, x2 = r.left;
      drawArrowLine(x1, sharedMidY, x2, sharedMidY, false);
      addDistLabel(dists.left, (x1 + x2) / 2, sharedMidY, 'h');
    }
    if (neighbors.right && dists.right > 0) {
      const nb = neighbors.right;
      const sharedMidY = (Math.max(r.top, nb.top) + Math.min(r.bottom, nb.bottom)) / 2;
      const x1 = r.right, x2 = nb.left;
      drawArrowLine(x1, sharedMidY, x2, sharedMidY, false);
      addDistLabel(dists.right, (x1 + x2) / 2, sharedMidY, 'h');
    }

    CTX.restore();
  }

  // Show inset distances: how far 'inner' sits inside 'outer'
  function renderContainmentLines(outer, inner) {
    CTX.save();
    CTX.strokeStyle = '#e74c3c';
    CTX.lineWidth = 1.5;
    CTX.setLineDash([4, 3]);

    const midX = (inner.left + inner.right) / 2;
    const midY = (inner.top + inner.bottom) / 2;

    // top inset
    const dTop = inner.top - outer.top;
    if (dTop > 0) {
      drawArrowLine(midX, outer.top, midX, inner.top, true);
      addDistLabel(dTop, midX, outer.top + dTop / 2, 'v');
    }
    // bottom inset
    const dBot = outer.bottom - inner.bottom;
    if (dBot > 0) {
      drawArrowLine(midX, inner.bottom, midX, outer.bottom, true);
      addDistLabel(dBot, midX, inner.bottom + dBot / 2, 'v');
    }
    // left inset
    const dLeft = inner.left - outer.left;
    if (dLeft > 0) {
      drawArrowLine(outer.left, midY, inner.left, midY, false);
      addDistLabel(dLeft, outer.left + dLeft / 2, midY, 'h');
    }
    // right inset
    const dRight = outer.right - inner.right;
    if (dRight > 0) {
      drawArrowLine(inner.right, midY, outer.right, midY, false);
      addDistLabel(dRight, inner.right + dRight / 2, midY, 'h');
    }

    CTX.restore();
  }

  // Gap lines between two non-overlapping (or partially overlapping) rects
  function renderDistanceLines(a, b) {
    CTX.save();
    CTX.strokeStyle = '#e74c3c';
    CTX.lineWidth = 1.5;
    CTX.setLineDash([4, 3]);

    const overH = a.left < b.right && a.right > b.left;
    const overV = a.top  < b.bottom && a.bottom > b.top;

    // Vertical gap (elements stacked above/below)
    if (!overV) {
      const isAbove = a.bottom <= b.top;
      const gap = isAbove ? b.top - a.bottom : a.top - b.bottom;
      const sharedLeft  = Math.max(a.left, b.left);
      const sharedRight = Math.min(a.right, b.right);
      const midX = overH ? (sharedLeft + sharedRight) / 2 : (a.left + a.right) / 2;
      const y1 = isAbove ? a.bottom : b.bottom;
      const y2 = isAbove ? b.top    : a.top;
      if (gap > 0) {
        drawArrowLine(midX, y1, midX, y2, true);
        addDistLabel(gap, midX, (y1 + y2) / 2, 'v');
      }
    }

    // Horizontal gap (elements side by side)
    if (!overH) {
      const isLeft = a.right <= b.left;
      const gap = isLeft ? b.left - a.right : a.left - b.right;
      const sharedTop    = Math.max(a.top, b.top);
      const sharedBottom = Math.min(a.bottom, b.bottom);
      const midY = overV ? (sharedTop + sharedBottom) / 2 : (a.top + a.bottom) / 2;
      const x1 = isLeft ? a.right : b.right;
      const x2 = isLeft ? b.left  : a.left;
      if (gap > 0) {
        drawArrowLine(x1, midY, x2, midY, false);
        addDistLabel(gap, (x1 + x2) / 2, midY, 'h');
      }
    }

    // Partial overlap: show closest edge distances
    if (overH && overV) {
      const dLeft   = Math.abs(b.left   - a.left);
      const dRight  = Math.abs(b.right  - a.right);
      const dTop    = Math.abs(b.top    - a.top);
      const dBottom = Math.abs(b.bottom - a.bottom);
      const midX = (Math.max(a.left,b.left) + Math.min(a.right,b.right)) / 2;
      const midY = (Math.max(a.top,b.top)   + Math.min(a.bottom,b.bottom)) / 2;
      if (dLeft > 1) {
        drawArrowLine(Math.min(a.left,b.left), midY, Math.max(a.left,b.left), midY, false);
        addDistLabel(dLeft, Math.min(a.left,b.left) + dLeft/2, midY, 'h');
      }
      if (dRight > 1) {
        drawArrowLine(Math.min(a.right,b.right), midY + 20, Math.max(a.right,b.right), midY + 20, false);
        addDistLabel(dRight, Math.min(a.right,b.right) + dRight/2, midY + 20, 'h');
      }
      if (dTop > 1) {
        drawArrowLine(midX, Math.min(a.top,b.top), midX, Math.max(a.top,b.top), true);
        addDistLabel(dTop, midX, Math.min(a.top,b.top) + dTop/2, 'v');
      }
      if (dBottom > 1) {
        drawArrowLine(midX, Math.min(a.bottom,b.bottom), midX, Math.max(a.bottom,b.bottom), true);
        addDistLabel(dBottom, midX, Math.min(a.bottom,b.bottom) + dBottom/2, 'v');
      }
    }

    CTX.restore();
  }

  function drawArrowLine(x1, y1, x2, y2, vertical) {
    const TICK = 5;
    CTX.beginPath();
    CTX.moveTo(x1, y1);
    CTX.lineTo(x2, y2);
    CTX.stroke();
    // Tick marks at each end
    CTX.setLineDash([]);
    CTX.beginPath();
    if (vertical) {
      CTX.moveTo(x1-TICK, y1); CTX.lineTo(x1+TICK, y1);
      CTX.moveTo(x2-TICK, y2); CTX.lineTo(x2+TICK, y2);
    } else {
      CTX.moveTo(x1, y1-TICK); CTX.lineTo(x1, y1+TICK);
      CTX.moveTo(x2, y2-TICK); CTX.lineTo(x2, y2+TICK);
    }
    CTX.stroke();
    CTX.setLineDash([4, 3]);
  }

  // axis: 'v' = vertical line (label centered horizontally on line)
  //       'h' = horizontal line (label centered vertically on line)
  function addDistLabel(dist, x, y, axis) {
    const vw  = document.documentElement.clientWidth;
    const vh  = document.documentElement.clientHeight;
    const PAD = 28; // keep label clear of viewport edges (accounts for ~half label size)
    x = Math.max(PAD, Math.min(vw - PAD, x));
    y = Math.max(PAD, Math.min(vh - 30, y)); // 30 = status bar + margin

    const div = document.createElement('div');
    div.className = 'mt-dist-label';
    div.textContent = `${Math.round(dist)}px`;
    div.style.left = `${x}px`;
    div.style.top  = `${y}px`;
    div.style.transform = 'translate(-50%, -50%)';
    ROOT.appendChild(div);
    distLabels.push(div);
  }

  // ── Guide rendering ───────────────────────────────────────────────────────
  function drawGuides() {
    S.guides.forEach(g => {
      // Guide DOM element for interaction
      const gEl = document.createElement('div');
      gEl.className = `mt-guide ${g.type}` + (g.id === S.activeGuide ? ' selected' : '');
      if (g.type === 'h') gEl.style.top  = `${g.pos}px`;
      else                gEl.style.left = `${g.pos}px`;
      ROOT.appendChild(gEl);

      gEl.addEventListener('click', (e) => {
        e.stopPropagation();
        S.activeGuide = g.id;
        redraw();
      });

      // drag guide
      let dragging = false;
      gEl.addEventListener('mousedown', (e) => {
        e.stopPropagation(); e.preventDefault();
        dragging = true;
        S.activeGuide = g.id;
        const onMove = (ev) => {
          if (!dragging) return;
          let pos = g.type === 'h' ? ev.clientY : ev.clientX;
          if (S.snap) pos = snapPoint(g.type, pos);
          g.pos = pos;
          redraw();
        };
        const onUp = () => {
          dragging = false;
          document.removeEventListener('mousemove', onMove, true);
          document.removeEventListener('mouseup',   onUp,   true);
        };
        document.addEventListener('mousemove', onMove, true);
        document.addEventListener('mouseup',   onUp,   true);
      }, true);

      // Label
      const label = document.createElement('div');
      label.className = 'mt-guide-label';
      label.textContent = `${Math.round(g.pos)}px`;
      if (g.type === 'h') label.style.cssText = `left:4px;top:${g.pos - 16}px;`;
      else                label.style.cssText = `left:${g.pos + 4}px;top:4px;`;
      ROOT.appendChild(label);
    });

    // Draw guide-to-guide distance lines on canvas
    drawGuideCrossDistances();
  }

  function drawGuideCrossDistances() {
    if (S.guides.length < 2) return;
    const hGuides = S.guides.filter(g => g.type === 'h').map(g => g.pos).sort((a,b)=>a-b);
    const vGuides = S.guides.filter(g => g.type === 'v').map(g => g.pos).sort((a,b)=>a-b);

    CTX.save();
    CTX.strokeStyle = 'rgba(231,76,60,.6)';
    CTX.lineWidth = 1;
    CTX.setLineDash([]);
    CTX.fillStyle = 'rgba(231,76,60,.9)';

    for (let i = 0; i < hGuides.length - 1; i++) {
      const midX = document.documentElement.clientWidth / 2;
      const mid  = (hGuides[i] + hGuides[i+1]) / 2;
      addDistLabel(Math.abs(hGuides[i+1] - hGuides[i]), midX, mid, 'v');
    }
    for (let i = 0; i < vGuides.length - 1; i++) {
      const midY = document.documentElement.clientHeight / 2;
      const mid  = (vGuides[i] + vGuides[i+1]) / 2;
      addDistLabel(Math.abs(vGuides[i+1] - vGuides[i]), mid, midY, 'h');
    }

    CTX.restore();
  }

  // ── Element edge extension lines ──────────────────────────────────────────
  function drawElementExtensions(elem) {
    const r  = elem.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    CTX.save();
    CTX.strokeStyle = 'rgba(248,81,73,.4)';
    CTX.lineWidth = 0.75;
    CTX.setLineDash([5, 5]);
    CTX.beginPath();
    CTX.moveTo(0, r.top);    CTX.lineTo(vw, r.top);
    CTX.moveTo(0, r.bottom); CTX.lineTo(vw, r.bottom);
    CTX.moveTo(r.left, 0);   CTX.lineTo(r.left, vh);
    CTX.moveTo(r.right, 0);  CTX.lineTo(r.right, vh);
    CTX.stroke();
    CTX.restore();
  }

  // ── Dots at guide × element-edge intersections ────────────────────────────
  function drawGuideElementDots(elems) {
    if (!S.guides.length) return;
    CTX.save();
    CTX.fillStyle = '#f85149';
    CTX.setLineDash([]);
    elems.forEach(elem => {
      const r = elem.getBoundingClientRect();
      S.guides.forEach(g => {
        if (g.type === 'v') {
          dot(g.pos, r.top);
          dot(g.pos, r.bottom);
        } else {
          dot(r.left, g.pos);
          dot(r.right, g.pos);
        }
      });
    });
    CTX.restore();

    function dot(x, y) {
      CTX.beginPath();
      CTX.arc(x, y, 3, 0, Math.PI * 2);
      CTX.fill();
    }
  }

  // ── Hatch pattern for gap fills ──────────────────────────────────────────
  function makeHatchPattern(lineColor) {
    const sz  = 7;
    const off = document.createElement('canvas');
    off.width = sz; off.height = sz;
    const c   = off.getContext('2d');
    c.strokeStyle = lineColor;
    c.lineWidth   = 1;
    c.beginPath();
    c.moveTo(-1, sz);    c.lineTo(sz,    -1);     // main diagonal tile
    c.moveTo(0,  sz * 2); c.lineTo(sz * 2, 0);   // seamless right/bottom wrap
    c.stroke();
    return CTX.createPattern(off, 'repeat');
  }

  // ── Flex / Grid gap visualisation ────────────────────────────────────────
  function groupByRow(rects) {
    const sorted = rects.slice().sort((a, b) => a.top - b.top);
    const rows = [];
    let row = [sorted[0]], rowBottom = sorted[0].bottom;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].top >= rowBottom - 1) {
        rows.push(row);
        row = [sorted[i]];
        rowBottom = sorted[i].bottom;
      } else {
        row.push(sorted[i]);
        rowBottom = Math.max(rowBottom, sorted[i].bottom);
      }
    }
    rows.push(row);
    return rows;
  }

  function groupByCol(rects) {
    const sorted = rects.slice().sort((a, b) => a.left - b.left);
    const cols = [];
    let col = [sorted[0]], colRight = sorted[0].right;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].left >= colRight - 1) {
        cols.push(col);
        col = [sorted[i]];
        colRight = sorted[i].right;
      } else {
        col.push(sorted[i]);
        colRight = Math.max(colRight, sorted[i].right);
      }
    }
    cols.push(col);
    return cols;
  }

  function drawLayoutGaps(container) {
    const cs      = window.getComputedStyle(container);
    const display = cs.display;
    const isFlex  = display === 'flex' || display === 'inline-flex';
    const isGrid  = display === 'grid' || display === 'inline-grid';
    if (!isFlex && !isGrid) return;

    const children = Array.from(container.children).filter(ch => {
      if (ch.closest('#mt-root')) return false;
      const r = ch.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    if (children.length < 2) return;

    const cR    = container.getBoundingClientRect();
    const rects = children.map(ch => ch.getBoundingClientRect());
    const isColFlex = isFlex && cs.flexDirection.startsWith('column');
    const gaps  = []; // { x1, y1, x2, y2, size, axis }

    if (!isColFlex) {
      // row-flex or grid: group into rows, detect column gaps
      const rows = groupByRow(rects);

      // Column gaps (deduplicated by x-range)
      const seenH = new Set();
      rows.forEach(row => {
        row.slice().sort((a, b) => a.left - b.left).forEach((a, i, arr) => {
          if (i === arr.length - 1) return;
          const b = arr[i + 1];
          const gap = b.left - a.right;
          if (gap < 0.5) return;
          const key = `${Math.round(a.right)},${Math.round(b.left)}`;
          if (seenH.has(key)) return;
          seenH.add(key);
          gaps.push({ x1: a.right, y1: cR.top, x2: b.left, y2: cR.bottom, size: gap, axis: 'h' });
        });
      });

      // Row gaps (grid or wrapping flex)
      if (isGrid || (isFlex && cs.flexWrap !== 'nowrap')) {
        for (let i = 0; i < rows.length - 1; i++) {
          const maxBottom = Math.max(...rows[i].map(r => r.bottom));
          const minTop    = Math.min(...rows[i + 1].map(r => r.top));
          const gap = minTop - maxBottom;
          if (gap > 0.5)
            gaps.push({ x1: cR.left, y1: maxBottom, x2: cR.right, y2: minTop, size: gap, axis: 'v' });
        }
      }
    } else {
      // column-flex: group into columns, detect vertical gaps
      const seenV = new Set();
      groupByCol(rects).forEach(col => {
        col.slice().sort((a, b) => a.top - b.top).forEach((a, i, arr) => {
          if (i === arr.length - 1) return;
          const b = arr[i + 1];
          const gap = b.top - a.bottom;
          if (gap < 0.5) return;
          const key = `${Math.round(a.bottom)},${Math.round(b.top)}`;
          if (seenV.has(key)) return;
          seenV.add(key);
          gaps.push({ x1: cR.left, y1: a.bottom, x2: cR.right, y2: b.top, size: gap, axis: 'v' });
        });
      });
    }

    if (!gaps.length) return;

    const hatchH = makeHatchPattern('rgba(255,159,26,.65)');
    const hatchV = makeHatchPattern('rgba(32,199,217,.60)');

    CTX.save();
    CTX.lineWidth = 0.5;
    CTX.setLineDash([]);
    gaps.forEach(({ x1, y1, x2, y2, axis }) => {
      const w = x2 - x1, h = y2 - y1;
      if (axis === 'h') {
        CTX.fillStyle   = hatchH;
        CTX.strokeStyle = 'rgba(255,159,26,.55)';
      } else {
        CTX.fillStyle   = hatchV;
        CTX.strokeStyle = 'rgba(32,199,217,.5)';
      }
      CTX.fillRect(x1, y1, w, h);
      CTX.strokeRect(x1, y1, w, h);
    });
    CTX.restore();

    // Labels placed at edge of each gap strip, not the midpoint of the container
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    gaps.forEach(({ x1, y1, x2, y2, size, axis }) => {
      addGapLabel(Math.round(size), x1, y1, x2, y2, axis, vw, vh);
    });
  }

  function addGapLabel(size, x1, y1, x2, y2, axis, vw, vh) {
    const div = document.createElement('div');
    div.className = axis === 'h' ? 'mt-gap-label mt-gap-label-h' : 'mt-gap-label mt-gap-label-v';
    div.textContent = `${size}px`;

    if (axis === 'h') {
      // Column gap: centred horizontally in the strip, anchored to the top edge
      const lx = Math.max(28, Math.min(vw - 28, (x1 + x2) / 2));
      const ly = Math.max(4, Math.min(vh - 24, y1));
      div.style.left      = `${lx}px`;
      div.style.top       = `${ly}px`;
      div.style.transform = 'translate(-50%, 4px)';
    } else {
      // Row gap: anchored to the left edge, centred vertically in the strip
      const lx = Math.max(4, Math.min(vw - 60, x1));
      const ly = Math.max(4, Math.min(vh - 20, (y1 + y2) / 2));
      div.style.left      = `${lx}px`;
      div.style.top       = `${ly}px`;
      div.style.transform = 'translate(4px, -50%)';
    }

    ROOT.appendChild(div);
    distLabels.push(div); // cleaned up by clearDistLabels() on each redraw
  }

  function drawSnapCrosshair() {
    const isHorizontal = S.moveDeltaY >= S.moveDeltaX;
    const x = S.snap ? (S.snapX ?? S.mouseX) : S.mouseX;
    const y = S.snap ? (S.snapY ?? S.mouseY) : S.mouseY;
    CTX.save();
    CTX.strokeStyle = 'rgba(24,160,251,.6)';
    CTX.lineWidth = 1;

    // 即將新增的方向 → 實線
    CTX.setLineDash([]);
    CTX.beginPath();
    if (isHorizontal) {
      CTX.moveTo(0, y); CTX.lineTo(CANVAS.width, y);
    } else {
      CTX.moveTo(x, 0); CTX.lineTo(x, CANVAS.height);
    }
    CTX.stroke();

    // 另一方向 → 虛線
    CTX.setLineDash([4, 4]);
    CTX.strokeStyle = 'rgba(24,160,251,.3)';
    CTX.beginPath();
    if (isHorizontal) {
      CTX.moveTo(x, 0); CTX.lineTo(x, CANVAS.height);
    } else {
      CTX.moveTo(0, y); CTX.lineTo(CANVAS.width, y);
    }
    CTX.stroke();

    CTX.restore();
  }

  // ── Status Bar ────────────────────────────────────────────────────────────
  function updateStatusBar() {
    if (!STATUSBAR) return;
    const mode = S.mode === MODE_INSPECTOR ? 'Inspector' : 'Guides';
    const snap = S.snap ? ' · Snap ON' : '';
    const sel  = S.selected.length ? ` · ${S.selected.length} selected` : '';
    STATUSBAR.innerHTML = `
      <span class="sb-mode">${mode}${snap}</span>
      ${sel ? `<span>${sel}</span>` : ''}
      <span class="sb-coords">${Math.round(S.mouseX)}, ${Math.round(S.mouseY)}</span>
      <span class="sb-hint">1/2=mode · M=panel · H/V=guide · S=snap · Q=clear · Esc=deselect · ↑↓=DOM</span>
    `;
  }

  // ── Draggable panels ──────────────────────────────────────────────────────
  function makeDraggable(panel, handle) {
    let ox, oy, startL, startT;
    handle.addEventListener('mousedown', e => {
      ox = e.clientX; oy = e.clientY;
      const r = panel.getBoundingClientRect();
      startL = r.left; startT = r.top;
      panel.style.left = `${startL}px`;
      panel.style.top = `${startT}px`;
      panel.style.transform = 'none';
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
      const move = ev => {
        panel.style.left = `${startL + ev.clientX - ox}px`;
        panel.style.top  = `${startT + ev.clientY - oy}px`;
      };
      const up = () => {
        document.removeEventListener('mousemove', move, true);
        document.removeEventListener('mouseup',   up,   true);
      };
      document.addEventListener('mousemove', move, true);
      document.addEventListener('mouseup',   up,   true);
      e.preventDefault();
    });
  }

  // ── Utilities ─────────────────────────────────────────────────────────────
  function unionRect(rects) {
    if (!rects.length) return null;
    return rects.reduce((a, r) => ({
      left:   Math.min(a.left,   r.left),
      top:    Math.min(a.top,    r.top),
      right:  Math.max(a.right,  r.right),
      bottom: Math.max(a.bottom, r.bottom),
    }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
  }

  function fourSides(cs, prop) {
    return {
      top:    roundPx(cs[`${prop}Top`]),
      right:  roundPx(cs[`${prop}Right`]),
      bottom: roundPx(cs[`${prop}Bottom`]),
      left:   roundPx(cs[`${prop}Left`]),
    };
  }

  function roundPx(val) { return Math.round(parseFloat(val) || 0); }
  function fmtPx(n)     { return n === 0 ? '0' : `${n}px`; }

  function overlapH(a, b) { return a.left < b.right && a.right > b.left; }
  function overlapV(a, b) { return a.top  < b.bottom && a.bottom > b.top; }

  function colorToHex(color) {
    if (!color || color === 'rgba(0, 0, 0, 0)') return 'transparent';
    const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return color;
    return '#' + [m[1],m[2],m[3]].map(n => (+n).toString(16).padStart(2,'0')).join('').toUpperCase();
  }

  // ── Message Handler ───────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'PING') {
      sendResponse({ ok: true });
    } else if (msg.type === 'TOGGLE') {
      toggle();
      sendResponse({ enabled: S.enabled });
    } else if (msg.type === 'GET_ENABLED') {
      sendResponse({ enabled: S.enabled });
    }
    return true;
  });

})();
