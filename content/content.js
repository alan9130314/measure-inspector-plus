/* MeasureTool content script — full MeasureMate-feature replication */
(() => {
  'use strict';

  // ── Constants ────────────────────────────────────────────────────────────
  const SNAP_DIST = 8;
  const MODE_INSPECTOR = 'inspector';
  const MODE_GUIDES    = 'guides';
  const MODE_CURSOR    = 'cursor';

  const STORAGE_KEY      = 'inspectorBmPx';
  const REM_ROOT_KEY     = 'remRootPx';
  const THEME_KEY        = 'uiTheme';
  const PANEL_SNAP_KEY   = 'panelSnap';
  const SCREEN_UNITS     = ['px', 'rem', 'vw', 'vh'];
  const INS_GUTTER     = 5;
  const INS_BM_MIN     = 200;
  const INS_PROPS_MIN  = 160;

  // ── State ────────────────────────────────────────────────────────────────
  const S = {
    enabled:       false,
    mode:          MODE_INSPECTOR,
    snap:          true,
    unit:          'px',
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
    /** @type {{ startX:number, startBm:number }|null} */
    inspectorSplit: null,
    inspectorBmPx:  null,
    remRootPx:      16,
    theme:          'light',
    panelSnap:      true,
    settingsOpen:   false,
    shortcutsOpen:  false,
    panelCollapsed: false,
    domNavStack:    [],
  };

  // ── SVG Icon set ─────────────────────────────────────────────────────────
  const IC = {
    inspect:   `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="5.8" cy="5.8" r="3" stroke="currentColor" stroke-width="1.4"/><path d="M8 8L12 12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`,
    guides:    `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 5.5h10M5.5 2v10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="5.5" cy="5.5" r="1.3" fill="currentColor"/></svg>`,
    cursor:    `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 2L2.5 11L5.5 8.5L7 12L8.2 11.2L6.8 7.5L10.5 7.5Z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    snap:      `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1.5v11" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-dasharray="1.5 1.5"/><path d="M1.5 7H5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M5 5.5L6.5 7L5 8.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12.5 7H9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M9 5.5L7.5 7L9 8.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    clear:     `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 9.5L7.5 3L12 5.5L7.5 12L3 9.5Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M5.5 6.5L10 9" stroke="currentColor" stroke-width="1" stroke-linecap="round"/><path d="M3 12h5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
    shortcuts: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1.5" y="2.5" width="11" height="9" rx="1.6" stroke="currentColor" stroke-width="1.4"/><path d="M3.2 5h1.1M5.6 5h1.1M8 5h1.1M10.4 5h1.1M3.2 7h1.1M5.6 7h1.1M8 7h1.1M10.4 7h1.1M3.2 9h3.8M8.4 9h2.8" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>`,
    sun:       `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="2.3" stroke="currentColor" stroke-width="1.4"/><path d="M7 1.5v1.3M7 11.2v1.3M1.5 7h1.3M11.2 7h1.3M3.1 3.1l.9.9M10 10l.9.9M10.9 3.1l-.9.9M4 10l-.9.9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
    moon:      `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9.2 2.2a5 5 0 1 0 2.6 8.8 4.4 4.4 0 1 1-2.6-8.8z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    panelHide: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="2" width="10" height="6.5" rx="1.4" stroke="currentColor" stroke-width="1.4"/><path d="M4.5 11h5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M5 5L7 7L9 5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    settings:  `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M6.09 2.9L6.06 1.68L7.94 1.68L7.91 2.9L9.26 3.46L10.1 2.58L11.42 3.9L10.54 4.74L11.1 6.09L12.32 6.06L12.32 7.94L11.1 7.91L10.54 9.26L11.42 10.1L10.1 11.42L9.26 10.54L7.91 11.1L7.94 12.32L6.06 12.32L6.09 11.1L4.74 10.54L3.9 11.42L2.58 10.1L3.46 9.26L2.9 7.91L1.68 7.94L1.68 6.06L2.9 6.09L3.46 4.74L2.58 3.9L3.9 2.58L4.74 3.46Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><circle cx="7" cy="7" r="2" stroke="currentColor" stroke-width="1.2"/></svg>`,
  };

  // ── DOM refs ─────────────────────────────────────────────────────────────
  let ROOT, OVERLAY, CANVAS, CTX;
  // Collapsed-panel listeners — stored so they can be removed before re-adding
  let _collapseMousedown = null, _collapseClick = null;
  // Target position computed just before collapsing (while full panel is still measurable)
  let _collapseTarget = null;
  // Zone index (0-5) the panel was at when collapsed; -1 = freely positioned
  let _collapseZone = -1;
  // Current snap zone while panel is fully open; -1 = freely positioned
  let _currentSnapZone = -1;

  // roundRect polyfill for older Chrome
  function ctxRoundRect(ctx, x, y, w, h, r) {
    if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.arcTo(x+w, y, x+w, y+r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x+w, y+h, x+w-r, y+h, r);
    ctx.lineTo(x + r, y + h); ctx.arcTo(x, y+h, x, y+h-r, r);
    ctx.lineTo(x, y + r); ctx.arcTo(x, y, x+r, y, r);
  }

  const METRIC_CHIP_H = 16;
  const METRIC_CHIP_RX = 4;
  const METRIC_CHIP_PAD_X = 5;

  /**
   * Rounded metric pill on canvas (box-model + distance labels share this path
   * so text does not drift vs DOM rendering).
   */
  function drawMetricChip(cx, cy, text, bgColor, fgColor, chipH = METRIC_CHIP_H, padX = METRIC_CHIP_PAD_X, rx = METRIC_CHIP_RX) {
    if (!text) return;
    const family = getComputedStyle(ROOT).getPropertyValue('--mt-mono').trim();
    CTX.font = `500 10px ${family}`;
    CTX.textAlign = 'center';

    const tw = Math.ceil(CTX.measureText(text).width + padX * 2);
    const mid = Math.round(cx);
    const top = Math.round(cy - chipH / 2);
    const left = Math.round(mid - tw / 2);

    CTX.fillStyle = bgColor;
    CTX.beginPath();
    ctxRoundRect(CTX, left, top, tw, chipH, rx);
    CTX.fill();

    const m = CTX.measureText(text);
    let ascent = m.actualBoundingBoxAscent;
    let descent = m.actualBoundingBoxDescent;
    if (!(ascent > 0) || !Number.isFinite(ascent)) ascent = 7;
    if (!(descent > 0) || !Number.isFinite(descent)) descent = 3;
    const baselineY = top + (chipH + ascent - descent) / 2;

    CTX.textBaseline = 'alphabetic';
    CTX.fillStyle = fgColor;
    CTX.fillText(text, mid, baselineY);
  }

  function ensureMeasureToolFonts() {
    if (document.getElementById('mt-panel-font-faces')) return;
    let sansUrl;
    let monoUrl;
    try {
      sansUrl = chrome.runtime.getURL('fonts/inter-latin.woff2');
      monoUrl = chrome.runtime.getURL('fonts/jetbrains-mono-latin.woff2');
    } catch (_) {
      return;
    }
    const st = document.createElement('style');
    st.id = 'mt-panel-font-faces';
    const esc = u => String(u).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    st.textContent = [
      '@font-face{font-family:"MeasureTool Sans";font-style:normal;font-weight:400;font-display:swap;src:url("' + esc(sansUrl) + '") format("woff2");}',
      '@font-face{font-family:"MeasureTool Sans";font-style:normal;font-weight:600;font-display:swap;src:url("' + esc(sansUrl) + '") format("woff2");}',
      '@font-face{font-family:"MeasureTool Sans";font-style:normal;font-weight:700;font-display:swap;src:url("' + esc(sansUrl) + '") format("woff2");}',
      '@font-face{font-family:"MeasureTool Mono";font-style:normal;font-weight:400;font-display:swap;src:url("' + esc(monoUrl) + '") format("woff2");}',
      '@font-face{font-family:"MeasureTool Mono";font-style:normal;font-weight:600;font-display:swap;src:url("' + esc(monoUrl) + '") format("woff2");}',
      '@font-face{font-family:"MeasureTool Mono";font-style:normal;font-weight:700;font-display:swap;src:url("' + esc(monoUrl) + '") format("woff2");}',
    ].join('');
    (document.head || document.documentElement).appendChild(st);
  }

  let PANEL, MARQUEE;
  let distLabels = [];

  // ── Build UI ─────────────────────────────────────────────────────────────
  function applyTheme() {
    if (!ROOT) return;
    ROOT.classList.toggle('mt-theme-light', S.theme === 'light');
  }

  function buildUI() {
    ensureMeasureToolFonts();
    if (document.getElementById('mt-root')) {
      ROOT      = document.getElementById('mt-root');
      OVERLAY   = ROOT.querySelector('#mt-overlay');
      CANVAS    = ROOT.querySelector('#mt-canvas');
      PANEL     = ROOT.querySelector('#mt-panel');
      MARQUEE   = ROOT.querySelector('#mt-marquee');
      CTX = CANVAS.getContext('2d');
      applyTheme();
      return;
    }

    ROOT    = el('div', 'mt-root', null, 'id=mt-root');
    OVERLAY = el('div', null, ROOT, 'id=mt-overlay');
    CANVAS  = el('canvas', null, OVERLAY, 'id=mt-canvas');
    CTX     = CANVAS.getContext('2d');

    MARQUEE = el('div', null, ROOT, 'id=mt-marquee');
    PANEL   = el('div', null, ROOT, 'id=mt-panel');
    buildControlPanel();
    applyTheme();

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

    // ── Collapsed state: draggable floating icon ─────────────────────────────
    // Always clean up any previously attached collapsed listeners first
    if (_collapseMousedown) { PANEL.removeEventListener('mousedown', _collapseMousedown); _collapseMousedown = null; }
    if (_collapseClick)     { PANEL.removeEventListener('click',     _collapseClick);     _collapseClick     = null; }

    if (S.panelCollapsed) {
      PANEL.classList.add('is-collapsed');
      const img = document.createElement('img');
      img.src = chrome.runtime.getURL('icons/icon48.png');
      img.className = 'cp-expand-icon';
      img.draggable = false;
      img.title = 'Restore panel  [M]';
      PANEL.appendChild(img);

      let hasDragged = false;
      _collapseMousedown = e => {
        if (e.button !== 0) return;
        hasDragged = false;
        const ox = e.clientX, oy = e.clientY;
        const r = PANEL.getBoundingClientRect();
        let startL = r.left, startT = r.top;
        PANEL.style.left = `${startL}px`;
        PANEL.style.top = `${startT}px`;
        PANEL.style.transform = 'none';
        PANEL.style.right = 'auto';
        PANEL.style.bottom = 'auto';
        if (S.panelSnap) showSnapGhost(PANEL);
        const move = ev => {
          if (Math.abs(ev.clientX - ox) > 3 || Math.abs(ev.clientY - oy) > 3) hasDragged = true;
          PANEL.style.left = `${startL + ev.clientX - ox}px`;
          PANEL.style.top  = `${startT + ev.clientY - oy}px`;
          if (S.panelSnap) updateSnapGhost(PANEL);
        };
        const up = () => {
          document.removeEventListener('mousemove', move, true);
          document.removeEventListener('mouseup', up, true);
          removeSnapGhost();
          if (hasDragged && S.panelSnap) snapPanelToGrid(PANEL);
        };
        document.addEventListener('mousemove', move, true);
        document.addEventListener('mouseup', up, true);
        e.preventDefault();
      };
      _collapseClick = () => {
        if (hasDragged) return;
        S.panelCollapsed = false;
        const zone = _collapseZone;
        _collapseZone = -1;
        updatePanel();
        if (S.panelSnap) {
          if (zone >= 0) expandToZone(zone); else snapPanelToGrid(PANEL);
        } else {
          clampPanelToViewport();
        }
      };
      PANEL.addEventListener('mousedown', _collapseMousedown);
      PANEL.addEventListener('click', _collapseClick);

      // Apply pre-computed target position (must happen after content is built)
      if (_collapseTarget) {
        PANEL.style.transition = '';
        PANEL.style.transform  = 'none';
        PANEL.style.right      = 'auto';
        PANEL.style.bottom     = 'auto';
        PANEL.style.left = `${_collapseTarget.left}px`;
        PANEL.style.top  = `${_collapseTarget.top}px`;
        _collapseTarget = null;
      }
      return;
    }
    PANEL.classList.remove('is-collapsed');

    // ── Drag handle + toolbar ────────────────────────────────────────────────
    const handle = el('div', 'cp-handle', PANEL);
    const toolbar = el('div', 'cp-toolbar', handle);

    const leftBar = el('div', 'cp-toolbar-left', toolbar);

    const modeSwitch = el('div', 'cp-mode-switch', leftBar, 'id=cp-mode-switch');
    const segInsp = el('div', 'cp-mode-seg' + (S.mode === MODE_INSPECTOR ? ' is-active' : ''), modeSwitch);
    segInsp.setAttribute('data-mode', MODE_INSPECTOR);
    segInsp.innerHTML = IC.inspect;
    segInsp.title = 'Inspector  [1]';
    const segGuides = el('div', 'cp-mode-seg' + (S.mode === MODE_GUIDES ? ' is-active' : ''), modeSwitch);
    segGuides.setAttribute('data-mode', MODE_GUIDES);
    segGuides.innerHTML = IC.guides;
    segGuides.title = 'Guides  [2]';
    const segCursor = el('div', 'cp-mode-seg' + (S.mode === MODE_CURSOR ? ' is-active' : ''), modeSwitch);
    segCursor.setAttribute('data-mode', MODE_CURSOR);
    segCursor.innerHTML = IC.cursor;
    segCursor.title = 'Cursor  [3]';
    const onModeSegClick = (e, mode) => {
      e.stopPropagation();
      if (S.mode === mode) return;
      if (mode === MODE_CURSOR) {
        S.selected = [];
        S.hovered = null;
        S.marqueeing = false;
        S.marqueeStart = null;
        if (MARQUEE) MARQUEE.style.display = 'none';
        clearDomNavStack();
        clearHighlights();
      }
      S.mode = mode;
      updatePanel();
      updateStatusBar();
      redraw();
    };
    segInsp.addEventListener('click', e => onModeSegClick(e, MODE_INSPECTOR));
    segGuides.addEventListener('click', e => onModeSegClick(e, MODE_GUIDES));
    segCursor.addEventListener('click', e => onModeSegClick(e, MODE_CURSOR));

    const iconBtn = (icon, tip, isActive, parent) => {
      const b = el('div', 'cp-btn' + (isActive ? ' active' : ''), parent);
      b.innerHTML = icon;
      b.title = tip;
      return b;
    };

    const statusBar = el('div', 'cp-toolbar-status', toolbar, 'id=cp-toolbar-status');
    el('span', 'sb-left', statusBar, 'id=cp-status-left');
    el('span', 'sb-coords', statusBar, 'id=cp-status-coords');

    const rightBar = el('div', 'cp-toolbar-right', toolbar);
    const tailWrap = el('div', 'cp-toolbar-tail', rightBar);

    const scBtn = iconBtn(IC.shortcuts, 'Shortcuts', S.shortcutsOpen, tailWrap);
    scBtn.addEventListener('click', () => {
      S.shortcutsOpen = !S.shortcutsOpen;
      if (S.shortcutsOpen) S.settingsOpen = false;
      updatePanel();
    });

    const settingsBtn = iconBtn(IC.settings, 'Settings', S.settingsOpen, tailWrap);
    settingsBtn.addEventListener('click', e => {
      e.stopPropagation();
      S.settingsOpen = !S.settingsOpen;
      if (S.settingsOpen) S.shortcutsOpen = false;
      updatePanel();
    });

    const hidePanelBtn = iconBtn(IC.panelHide, 'Hide panel  [M]', false, tailWrap);
    hidePanelBtn.addEventListener('click', e => {
      e.stopPropagation();
      _collapseTarget = computeCollapseTarget();
      S.panelCollapsed = true;
      updatePanel();
    });

    // Drag handle behaviour (drag by toolbar area)
    makeDraggable(PANEL, handle);

    // ── Settings panel (replaces mode sections when open) ────────────────────
    if (S.settingsOpen) {
      const sp = el('div', 'cp-settings-panel', PANEL);
      // Units row
      const unitsSettingRow = el('div', 'cp-sp-row', sp);
      el('span', 'cp-sp-section-label', unitsSettingRow).textContent = 'UNITS';
      const unitsCtrl = el('div', 'cp-sp-units', unitsSettingRow);
      const mkUnitBtn = unit => {
        const b = el('button', 'cp-sp-unit-btn' + (S.unit === unit ? ' is-active' : ''), unitsCtrl);
        b.textContent = unit.toUpperCase();
        b.addEventListener('click', e => {
          e.stopPropagation();
          if (S.unit !== unit) {
            S.unit = unit;
            updatePanel();
            updateStatusBar();
            const inspected = S.selected.length === 1 ? S.selected[0] : S.hovered;
            if (inspected) showInspector(inspected);
            redraw();
          }
        });
      };
      ['px', 'rem', 'vw', 'vh', 'pt', 'in', 'cm', 'mm'].forEach(mkUnitBtn);

      if (S.unit === 'rem') {
        const remWrap = el('div', 'cp-sp-rem cp-sp-rem-block', unitsCtrl);
        el('span', 'cp-rem-root-label', remWrap).textContent = '1rem=';
        const remInp = el('input', 'cp-rem-root-inp', remWrap, 'id=cp-rem-root-inp');
        remInp.type = 'number'; remInp.min = '1'; remInp.max = '512'; remInp.step = 'any';
        remInp.value = String(S.remRootPx);
        remInp.title = 'Custom rem base (px per 1rem)';
        const stopKeyBubble = e => e.stopPropagation();
        remInp.addEventListener('keydown', stopKeyBubble);
        remInp.addEventListener('keyup', stopKeyBubble);
        remInp.addEventListener('change', () => {
          const n = parseRemRootFromStorage(remInp.value);
          remInp.value = String(n);
          S.remRootPx = n;
          try { chrome.storage.local.set({ [REM_ROOT_KEY]: n }); } catch (_) { /* ignore */ }
          redraw();
          const inspected = S.selected.length === 1 ? S.selected[0] : S.hovered;
          if (inspected) showInspector(inspected);
        });
      }

      // Theme row
      const themeSettingRow = el('div', 'cp-sp-row', sp);
      el('span', 'cp-sp-section-label', themeSettingRow).textContent = 'THEME';
      const themeCtrl = el('div', 'cp-sp-themes', themeSettingRow);
      const mkThemeBtn = (themeVal, label) => {
        const btn = el('button', 'cp-sp-theme-btn' + (S.theme === themeVal ? ' is-active' : ''), themeCtrl);
        el('span', `cp-sp-theme-dot cp-sp-theme-dot--${themeVal}`, btn);
        el('span', 'cp-sp-theme-name', btn).textContent = label;
        btn.addEventListener('click', e => {
          e.stopPropagation();
          if (S.theme !== themeVal) {
            S.theme = themeVal;
            try { chrome.storage.local.set({ [THEME_KEY]: S.theme }); } catch (_) { /* ignore */ }
            applyTheme();
            updatePanel();
            updateStatusBar();
          }
        });
      };
      mkThemeBtn('light', 'Light');
      mkThemeBtn('dark', 'Dark');

      // Panel snap row
      const snapSettingRow = el('div', 'cp-sp-row', sp);
      el('span', 'cp-sp-section-label', snapSettingRow).textContent = 'AUTO POSITION';
      const snapToggle = el('label', 'cp-sp-toggle', snapSettingRow);
      const snapChk = el('input', '', snapToggle);
      snapChk.type = 'checkbox';
      snapChk.checked = S.panelSnap;
      el('span', 'cp-sp-toggle-slider', snapToggle);
      snapChk.addEventListener('change', e => {
        e.stopPropagation();
        S.panelSnap = snapChk.checked;
        if (!S.panelSnap) _currentSnapZone = -1;
        try { chrome.storage.local.set({ [PANEL_SNAP_KEY]: S.panelSnap }); } catch (_) { /* ignore */ }
      });
    }

    // ── Cursor mode hint (below toolbar) ─────────────────────────────────────
    if (!S.settingsOpen && !S.shortcutsOpen && S.mode === MODE_CURSOR) {
      const cursorBar = el('div', 'cp-cursor-bar', PANEL);
      const inner = el('div', 'cp-cursor-bar-inner', cursorBar);
      el('span', 'cp-cursor-label', inner).textContent = 'CURSOR';
      el('span', 'cp-cursor-hint', inner).textContent =
        'Interact with the page — no picking, guides, or measure overlay.';
    }

    // ── Guides tools section (below toolbar, same level as inspector) ───────
    if (!S.settingsOpen && !S.shortcutsOpen && S.mode === MODE_GUIDES) {
      const guidesSection = el('div', 'cp-guides-tools', PANEL);
      const guidesHead = el('div', 'cp-guides-tools-head', guidesSection);
      el('span', 'cp-guides-label', guidesHead).textContent = 'GUIDES';
      const guidesBtns = el('div', 'cp-guides-tools-actions', guidesHead);

      const snapBtn = iconBtn(IC.snap, 'Snap  [S]', S.snap, guidesBtns);
      snapBtn.addEventListener('click', () => {
        S.snap = !S.snap;
        updatePanel();
        updateStatusBar();
      });

      const clrBtn = iconBtn(IC.clear, 'Clear Guides  [Q]', false, guidesBtns);
      clrBtn.addEventListener('click', () => {
        S.guides = [];
        S.activeGuide = null;
        redraw();
      });
    }

    // ── Inspector section (only in inspector mode) ───────────────────────────
    if (!S.settingsOpen && !S.shortcutsOpen && S.mode === MODE_INSPECTOR) {
      const insSection = el('div', 'cp-inspector', PANEL, 'id=mt-panel-inspector');

      // Collapsible header
      const hdr = el('div', 'cp-ins-hdr', insSection);
      el('span', 'cp-ins-label', hdr).textContent = 'INSPECTOR';

      // Quick-info displayed in header even when body is collapsed
      const quick = el('div', 'cp-ins-quick cp-ins-quick--idle', hdr, 'id=cp-ins-quick');
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

      const body = el('div', 'cp-ins-body', detail);
      const bmPx = readInspectorBmPx();
      body.style.setProperty('--ins-bm-px', `${bmPx}px`);
      S.inspectorBmPx = bmPx;
      el('div', 'cp-bm', body, 'id=mt-panel-bm');
      const insGutter = el('div', 'cp-ins-gutter', body, 'id=cp-ins-gutter');
      insGutter.title = 'Drag to resize box model / properties columns';
      const propsCol = el('div', 'cp-props', body, 'id=mt-panel-props');
      const posRow = el('div', 'cp-ins-pos', propsCol);
      el('span', 'cp-ins-pos-label', posRow).textContent = 'Viewport';
      const phPosEl = el('span', 'cp-ins-pos-val', posRow, 'id=ph-pos');
      phPosEl.title = 'Border box top-left relative to the viewport (getBoundingClientRect.left / .top)';
      wireInspectorSplit(body, insGutter);

      // Toggle collapse
      hdr.addEventListener('click', () => {
        S.inspectorOpen = !S.inspectorOpen;
        wrap.style.display = S.inspectorOpen ? '' : 'none';
        applyCurrentSnapZone();
      });
    }

    // ── Shortcuts panel (replaces mode sections when open) ───────────────────
    if (S.shortcutsOpen) {
      const shp = el('div', 'cp-shortcuts-panel', PANEL);

      const scCommon = {
        title: 'Common',
        rows: [
          ['Toggle tool',       'Ctrl+Shift+M'],
          ['Show/hide panel',   'M'],
          ['Inspector mode',    '1'],
          ['Guides mode',       '2'],
          ['Cursor mode',       '3'],
          ['Cycle screen units', 'U'],
          ['Deselect',          'Esc'],
        ],
      };
      const scInspector = {
        title: 'Inspector',
        rows: [
          ['Multi-select',      'Shift+Click'],
          ['DOM parent / child', '↑ / ↓'],
        ],
      };
      const scGuides = {
        title: 'Guides',
        rows: [
          ['Add H guide',       'H'],
          ['Add V guide',       'V'],
          ['Toggle snap',       'S'],
          ['Add guide (click)', 'Click'],
          ['Clear guides',      'Q'],
          ['Nudge guide 1px',   '← → ↑ ↓'],
          ['Nudge guide 10px',  'Shift+arrows'],
        ],
      };
      const scGroups = [scCommon, scInspector, scGuides];
      scGroups.forEach(({ title, rows }) => {
        const grp = el('div', 'cp-sc-group', shp);
        el('div', 'cp-sc-group-title', grp).textContent = title;
        const grid = el('div', 'cp-sc-group-rows', grp);
        rows.forEach(([label, key]) => {
          const r = el('div', 'cp-sc-row', grid);
          el('span', 'cp-sc-label', r).textContent = label;
          el('span', 'cp-kbd', r).textContent = key;
        });
      });
    }

    if (S.enabled) syncPageInteractionLock();
  }

  function updatePanel() {
    buildControlPanel();
    if (S.panelCollapsed) return;
    const inspected = S.selected.length === 1 ? S.selected[0] : S.hovered;
    if (inspected && inspected.isConnected && S.mode === MODE_INSPECTOR) {
      showInspector(inspected);
      showBoxModel(inspected);
    }
    applyCurrentSnapZone();
  }

  function toggleUnit() {
    const idx = SCREEN_UNITS.indexOf(S.unit);
    S.unit = SCREEN_UNITS[(idx < 0 ? 0 : idx + 1) % SCREEN_UNITS.length];
    updatePanel();
    updateStatusBar();
    const inspected = S.selected.length === 1 ? S.selected[0] : S.hovered;
    if (inspected) showInspector(inspected);
    redraw();
  }

  // ── Enable / Disable ──────────────────────────────────────────────────────
  function enable(onReady) {
    chrome.storage.local.get([STORAGE_KEY, REM_ROOT_KEY, THEME_KEY, PANEL_SNAP_KEY], result => {
      const v = result[STORAGE_KEY];
      S.inspectorBmPx = (Number.isFinite(v) && v >= INS_BM_MIN) ? v : 340;
      S.remRootPx = parseRemRootFromStorage(result[REM_ROOT_KEY]);
      S.theme = result[THEME_KEY] === 'dark' ? 'dark' : 'light';
      S.panelSnap = result[PANEL_SNAP_KEY] !== false;
      _enable();
      if (typeof onReady === 'function') onReady();
    });
  }
  function syncPageInteractionLock() {
    if (!S.enabled) return;
    if (S.mode === MODE_CURSOR) {
      document.documentElement.style.userSelect = '';
      document.documentElement.style.webkitUserSelect = '';
    } else {
      document.documentElement.style.userSelect = 'none';
      document.documentElement.style.webkitUserSelect = 'none';
    }
  }

  function _enable() {
    buildUI();
    S.enabled = true;
    S.panelCollapsed = false;
    syncPageInteractionLock();
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
    clearDomNavStack();
    detachEvents();
    clearHighlights();
    clearDistLabels();
    clearGuideEls();
    if (PANEL)   PANEL.style.display   = 'none';
    if (MARQUEE) MARQUEE.style.display = 'none';
    if (CTX) CTX.clearRect(0, 0, CANVAS.width / (window.devicePixelRatio || 1), CANVAS.height / (window.devicePixelRatio || 1));
  }

  function toggle() { S.enabled ? disable() : enable(); }

  function clearDomNavStack() {
    S.domNavStack.length = 0;
  }

  // ── Event Wiring ──────────────────────────────────────────────────────────
  function onResize() {
    if (!S.enabled || !PANEL) return;
    if (S.panelCollapsed) {
      const r  = PANEL.getBoundingClientRect();
      const cw = document.documentElement.clientWidth;
      const vh = window.innerHeight;
      const cl = Math.min(Math.max(r.left, SNAP_MARGIN), cw - r.width  - SNAP_MARGIN);
      const ct = Math.min(Math.max(r.top,  SNAP_MARGIN), vh - r.height - SNAP_MARGIN);
      PANEL.style.transition = '';
      PANEL.style.transform  = 'none';
      PANEL.style.right = 'auto'; PANEL.style.bottom = 'auto';
      PANEL.style.left = `${cl}px`; PANEL.style.top = `${ct}px`;
      return;
    }
    applyCurrentSnapZone();
    if (!S.panelSnap || _currentSnapZone < 0) clampPanelToViewport();
  }

  function attachEvents() {
    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('mouseup',   onMouseUp,   true);
    document.addEventListener('click',     onClick,     true);
    document.addEventListener('keydown',   onKeyDown,   true);
    window.addEventListener('resize', onResize);
  }

  function detachEvents() {
    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('mousedown', onMouseDown, true);
    document.removeEventListener('mouseup',   onMouseUp,   true);
    document.removeEventListener('click',     onClick,     true);
    document.removeEventListener('keydown',   onKeyDown,   true);
    window.removeEventListener('resize', onResize);
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

    if (S.mode === MODE_CURSOR) {
      if (S.hovered !== null) {
        S.hovered = null;
        updateHighlights();
        redraw();
      }
      return;
    }

    if (S.mode === MODE_INSPECTOR) {
      if (e.target.closest && e.target.closest('#mt-root')) {
        if (S.hovered !== null) {
          S.hovered = null;
          updateHighlights();
        }
        if (S.selected.length === 1 && S.selected[0] && S.selected[0].isConnected) {
          showInspector(S.selected[0]);
          showBoxModel(S.selected[0]);
        }
        redraw();
        return;
      }
      const vw = document.documentElement.clientWidth;
      const vh = document.documentElement.clientHeight;
      if (e.clientX < 0 || e.clientY < 0 || e.clientX >= vw || e.clientY >= vh) {
        if (S.hovered !== null) {
          S.hovered = null;
          updateHighlights();
          redraw();
        }
        return;
      }
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
    } else if (S.mode === MODE_GUIDES) {
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
    if (S.mode === MODE_CURSOR) return;

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
          clearDomNavStack();
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
          clearDomNavStack();
          updateHighlights();
          redraw();
        }
        S.marqueeStart = null;
      }
    }
  }

  function onClick(e) {
    if (e.target.closest('#mt-root')) return;
    if (S.mode === MODE_CURSOR) return;

    if (S.mode === MODE_GUIDES) {
      e.preventDefault();
      e.stopPropagation();
      const type = S.moveDeltaY >= S.moveDeltaX ? 'h' : 'v';
      const viewportPos = type === 'h'
        ? (S.snap ? snapPoint('h', e.clientY) : e.clientY)
        : (S.snap ? snapPoint('v', e.clientX) : e.clientX);
      const scrollOff = type === 'h' ? window.scrollY : window.scrollX;
      addGuide(type, viewportPos + scrollOff);
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
      clearDomNavStack();
    }
  }

  // ── Keyboard ──────────────────────────────────────────────────────────────
  function onKeyDown(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

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
      case '3':
        S.mode = MODE_CURSOR;
        S.selected = [];
        S.hovered = null;
        S.marqueeing = false;
        S.marqueeStart = null;
        if (MARQUEE) MARQUEE.style.display = 'none';
        clearDomNavStack();
        clearHighlights();
        updatePanel(); updateStatusBar();
        redraw();
        e.preventDefault();
        break;
      case 'm': case 'M':
        if (!e.ctrlKey && !e.metaKey) {
          if (S.panelCollapsed) {
            S.panelCollapsed = false;
            const zone = _collapseZone;
            _collapseZone = -1;
            updatePanel();
            if (S.panelSnap) {
              if (zone >= 0) expandToZone(zone); else snapPanelToGrid(PANEL);
            } else {
              clampPanelToViewport();
            }
          } else {
            _collapseTarget = computeCollapseTarget();
            S.panelCollapsed = true;
            updatePanel();
          }
          e.preventDefault();
        }
        break;
      case 'h': case 'H':
        if (S.mode === MODE_GUIDES && !e.ctrlKey && !e.metaKey) {
          addGuide('h', (S.snap ? snapPoint('h', S.mouseY) : S.mouseY) + window.scrollY);
          e.preventDefault();
        }
        break;
      case 'v': case 'V':
        if (S.mode === MODE_GUIDES && !e.ctrlKey && !e.metaKey) {
          addGuide('v', (S.snap ? snapPoint('v', S.mouseX) : S.mouseX) + window.scrollX);
          e.preventDefault();
        }
        break;
      case 's': case 'S':
        if (S.mode === MODE_GUIDES && !e.ctrlKey && !e.metaKey) {
          S.snap = !S.snap;
          updatePanel();
          updateStatusBar();
          e.preventDefault();
        }
        break;
      case 'u': case 'U':
        if (!e.ctrlKey && !e.metaKey) {
          toggleUnit();
          e.preventDefault();
        }
        break;
      case 'q': case 'Q':
        if (S.mode === MODE_GUIDES) {
          S.guides = [];
          S.activeGuide = null;
          redraw();
          e.preventDefault();
        }
        break;
      case 'Escape':
        S.selected = [];
        S.activeGuide = null;
        S.guides.forEach(g => { g.selected = false; });
        clearDomNavStack();
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

    // In guides mode only: nudge the active guide
    if (S.mode === MODE_GUIDES && S.activeGuide !== null) {
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
          S.domNavStack.push(cur);
          S.selected = [cur.parentElement];
          updateHighlights();
          showInspector(cur.parentElement);
          showBoxModel(cur.parentElement);
          redraw();
          e.preventDefault();
        }
      } else if (e.key === 'ArrowDown') {
        while (S.domNavStack.length) {
          const top = S.domNavStack[S.domNavStack.length - 1];
          if (top && top.isConnected && top.parentElement === cur && !top.closest('#mt-root')) break;
          S.domNavStack.pop();
        }
        if (S.domNavStack.length) {
          const child = S.domNavStack.pop();
          S.selected = [child];
          updateHighlights();
          showInspector(child);
          showBoxModel(child);
          redraw();
          e.preventDefault();
        } else if (cur.firstElementChild && !cur.firstElementChild.closest('#mt-root')) {
          clearDomNavStack();
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
    badge.textContent = `${fmtU(r.width)} × ${fmtU(r.height)}`;
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

    const phTag = ROOT.querySelector('#ph-tag');
    const phSel = ROOT.querySelector('#ph-sel');
    const phSize = ROOT.querySelector('#ph-size');
    if (!phTag || !phSel || !phSize) return;
    phTag.textContent = `<${tag}>`;
    phSel.textContent = `${id}${cls}`;
    phSize.textContent = `${fmtU(r.width)} × ${fmtU(r.height)}`;

    // Show quick-info in header (visible even when body is collapsed)
    const quick = ROOT.querySelector('#cp-ins-quick');
    if (quick) quick.classList.remove('cp-ins-quick--idle');

    // Reveal detail section, hide placeholder (first hover only)
    const placeholder = ROOT.querySelector('#cp-ins-placeholder');
    const detail = ROOT.querySelector('#cp-ins-detail');
    if (placeholder) placeholder.style.display = 'none';
    if (detail) detail.style.display = '';

    // ── CSS Properties column ──────────────────────────────────────────────
    const propsEl = ROOT.querySelector('#mt-panel-props');
    if (!propsEl) return;
    propsEl.innerHTML = '';
    const posRow = el('div', 'cp-ins-pos', propsEl);
    el('span', 'cp-ins-pos-label', posRow).textContent = 'Viewport';
    const phPosEl = el('span', 'cp-ins-pos-coords', posRow, 'id=ph-pos');
    phPosEl.title = 'Border box position relative to the viewport (getBoundingClientRect)';
    const mkCoord = (axis, val) => {
      const wrap = document.createElement('span');
      wrap.className = 'cp-ins-pos-coord';
      const axisEl = document.createElement('span');
      axisEl.className = 'cp-ins-pos-axis';
      axisEl.textContent = axis;
      const valEl = document.createElement('span');
      valEl.textContent = fmtU(val);
      wrap.appendChild(axisEl);
      wrap.appendChild(valEl);
      return wrap;
    };
    phPosEl.appendChild(mkCoord('top', r.top));
    phPosEl.appendChild(mkCoord('left', r.left));

    const fontFamily = cs.fontFamily.split(',')[0].replace(/["']/g,'').trim();
    const display    = cs.display;
    let   layout     = display;
    if (display === 'flex') layout = `flex / ${cs.flexDirection}`;
    if (display === 'grid') layout = `grid`;
    const isFlexGrid = display === 'flex' || display === 'grid';

    const bgRaw = (cs.backgroundColor || '').replace(/\s/g, '');
    const bgTransparent =
      !bgRaw ||
      bgRaw === 'transparent' ||
      bgRaw === 'rgba(0,0,0,0)';
    const bgOpaque = !bgTransparent;

    const lsRaw = cs.letterSpacing;
    const letterSpacing = !lsRaw || lsRaw === 'normal' ? 'normal' : fmtCssLen(lsRaw);
    const borderRadius  = cs.borderRadius;
    const hasRadius     = borderRadius && borderRadius !== '0px';
    const gapVal        = cs.gap;
    const hasGap        = gapVal && gapVal !== 'normal';

    const propGroups = [
      { title: 'Typography', rows: [
        ['font-family',    fontFamily],
        ['font-size',      fmtCssLen(cs.fontSize)],
        ['font-weight',    cs.fontWeight],
        ['line-height',    fmtCssLen(cs.lineHeight)],
        ['color',          cs.color,  true],
        ['text-align',     cs.textAlign],
        ['letter-spacing', letterSpacing],
      ]},
      { title: 'Layout', rows: [
        ['display',   layout],
        ['position',  cs.position],
        ['z-index',   cs.zIndex === 'auto' ? 'auto' : cs.zIndex],
        ['overflow',  cs.overflow],
        ...(isFlexGrid ? [
          ['align-items',     cs.alignItems],
          ['justify-content', cs.justifyContent],
          ...(hasGap ? [['gap', gapVal]] : []),
        ] : []),
      ]},
      { title: 'Visual', rows: [
        ['background', bgOpaque ? cs.backgroundColor : 'transparent', bgOpaque],
        ['opacity',    cs.opacity],
        ...(hasRadius ? [['border-radius', borderRadius]] : []),
        ['cursor',     cs.cursor],
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
    applyCurrentSnapZone();
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
    const cw = r.width  - (parseFloat(cs.paddingLeft)||0)  - (parseFloat(cs.paddingRight)||0)  - (parseFloat(cs.borderLeftWidth)||0)  - (parseFloat(cs.borderRightWidth)||0);
    const ch = r.height - (parseFloat(cs.paddingTop)||0)   - (parseFloat(cs.paddingBottom)||0) - (parseFloat(cs.borderTopWidth)||0)   - (parseFloat(cs.borderBottomWidth)||0);

    bmEl.innerHTML = `
      <div class="bm-header">Box Model</div>
      <div class="bm-layer bm-margin">
        <div class="bm-row"><span class="bm-zone-label">margin</span><span class="bm-val bm-val-m">${fmtPx(m.top)}</span></div>
        <div class="bm-mid">
          <span class="bm-val bm-val-m">${fmtPx(m.left)}</span>
          <div class="bm-layer bm-border">
            <div class="bm-row"><span class="bm-zone-label">border</span><span class="bm-val bm-val-b">${fmtPx(b.top)}</span></div>
            <div class="bm-mid">
              <span class="bm-val bm-val-b">${fmtPx(b.left)}</span>
              <div class="bm-layer bm-padding">
                <div class="bm-row"><span class="bm-zone-label">padding</span><span class="bm-val bm-val-p">${fmtPx(p.top)}</span></div>
                <div class="bm-mid">
                  <span class="bm-val bm-val-p">${fmtPx(p.left)}</span>
                  <div class="bm-layer bm-content"><span class="bm-val bm-val-c">${cw} × ${ch}</span></div>
                  <span class="bm-val bm-val-p">${fmtPx(p.right)}</span>
                </div>
                <div class="bm-row"><span></span><span class="bm-val bm-val-p">${fmtPx(p.bottom)}</span></div>
              </div>
              <span class="bm-val bm-val-b">${fmtPx(b.right)}</span>
            </div>
            <div class="bm-row"><span></span><span class="bm-val bm-val-b">${fmtPx(b.bottom)}</span></div>
          </div>
          <span class="bm-val bm-val-m">${fmtPx(m.right)}</span>
        </div>
        <div class="bm-row"><span></span><span class="bm-val bm-val-m">${fmtPx(m.bottom)}</span></div>
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

    const _p = n => getComputedStyle(ROOT).getPropertyValue(n).trim();
    const C_MARGIN  = _p('--mt-ov-bm-margin-fill');
    const C_BORDER  = _p('--mt-ov-bm-border-fill');
    const C_PADDING = _p('--mt-ov-bm-padding-fill');
    const C_CONTENT = _p('--mt-ov-bm-content-fill');
    const L_M_BG    = _p('--mt-ov-bm-margin-label-bg');
    const L_M_FG    = _p('--mt-ov-bm-margin-label-fg');
    const L_P_BG    = _p('--mt-ov-bm-padding-label-bg');
    const L_P_FG    = _p('--mt-ov-bm-padding-label-fg');
    const L_C_BG    = _p('--mt-ov-bm-content-label-bg');
    const L_C_FG    = _p('--mt-ov-bm-content-label-fg');

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

    // ── Labels (canvas only — same drawMetricChip as distance labels) ─────
    const drawLabel = (val, x, y, bgColor, textColor) => {
      if (Math.abs(val) < 0.5) return;
      drawMetricChip(x, y, fmtU(val), bgColor, textColor);
    };

    const midX = (borderBox.l + borderBox.r) / 2;
    const midY = (borderBox.t + borderBox.b) / 2;

    // Margin labels
    if (mt > 0) drawLabel(mt, midX, marginBox.t + mt/2,  L_M_BG, L_M_FG);
    if (mb > 0) drawLabel(mb, midX, borderBox.b + mb/2,  L_M_BG, L_M_FG);
    if (ml > 0) drawLabel(ml, marginBox.l + ml/2, midY,  L_M_BG, L_M_FG);
    if (mr > 0) drawLabel(mr, borderBox.r + mr/2, midY,  L_M_BG, L_M_FG);

    // Padding labels
    const pmx = (paddingBox.l + paddingBox.r) / 2;
    const pmy = (paddingBox.t + paddingBox.b) / 2;
    if (pt > 0) drawLabel(pt, pmx, paddingBox.t + pt/2,  L_P_BG, L_P_FG);
    if (pb > 0) drawLabel(pb, pmx, contentBox.b + pb/2,  L_P_BG, L_P_FG);
    if (pl > 0) drawLabel(pl, paddingBox.l + pl/2, pmy,  L_P_BG, L_P_FG);
    if (pr > 0) drawLabel(pr, contentBox.r + pr/2, pmy,  L_P_BG, L_P_FG);

    // Content size label (slightly taller chip, horizontal padding 4+4 ≈ old +8)
    if (cw > 30 && ch > 16) {
      const label = `${fmtU(cw)} × ${fmtU(ch)}`;
      drawMetricChip(contentBox.l + cw / 2, contentBox.t + ch / 2, label, L_C_BG, L_C_FG, 18, 4, 4);
    }

    CTX.restore();
  }

  function pointerInViewport(px = S.mouseX, py = S.mouseY) {
    const w = document.documentElement.clientWidth;
    const h = document.documentElement.clientHeight;
    return px >= 0 && py >= 0 && px < w && py < h;
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
      S.selected.forEach(el => drawGridLines(el));
      drawInterSelectedDistances();
      drawDistances();
      if (S.hovered && S.selected.length === 0 && pointerInViewport()) {
        drawLayoutGaps(S.hovered);
        drawBoxModelOverlay(S.hovered);
        drawGridLines(S.hovered);
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
    if (!pointerInViewport()) return;
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

  function drawInterSelectedDistances() {
    if (S.selected.length < 2) return;
    const list = S.selected.filter(el => el && el.isConnected);
    if (list.length < 2) return;

    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const elA = list[i];
        const elB = list[j];
        if (elA === elB) continue;
        const rA = elA.getBoundingClientRect();
        const rB = elB.getBoundingClientRect();
        if (rA.width <= 0 || rA.height <= 0 || rB.width <= 0 || rB.height <= 0) continue;

        if (elA.contains(elB)) {
          renderContainmentLines(rA, rB);
        } else if (elB.contains(elA)) {
          renderContainmentLines(rB, rA);
        } else {
          renderDistanceLines(rA, rB);
        }
      }
    }
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
  /** @param {'distance'|'guide'} [chipKind] distance = inspector orange chips; guide = guide-spacing tokens */
  function addDistLabel(dist, x, y, axis, chipKind = 'distance') {
    const vw  = document.documentElement.clientWidth;
    const vh  = document.documentElement.clientHeight;
    const PAD = 28; // keep label clear of viewport edges (accounts for ~half label size)
    const lx = Math.round(Math.max(PAD, Math.min(vw - PAD, x)));
    const ly = Math.round(Math.max(PAD, Math.min(vh - 30, y))); // 30 = status bar + margin
    const _p = n => getComputedStyle(ROOT).getPropertyValue(n).trim();
    const bg = chipKind === 'guide'
      ? (_p('--mt-label-guide-metric-bg') || _p('--mt-label-orange-bg') || '#6a1a12')
      : (_p('--mt-label-orange-bg') || '#6a3f00');
    const fg = chipKind === 'guide'
      ? (_p('--mt-label-guide-metric-fg') || _p('--mt-label-orange-fg') || '#fff8f6')
      : (_p('--mt-label-orange-fg') || '#ffe3b3');
    drawMetricChip(lx, ly, fmtU(dist), bg, fg);
  }

  // ── Guide rendering ───────────────────────────────────────────────────────
  function drawGuides() {
    S.guides.forEach(g => {
      // Guide DOM element for interaction
      const gEl = document.createElement('div');
      gEl.className = `mt-guide ${g.type}` + (g.id === S.activeGuide ? ' selected' : '');
      const vPos = g.type === 'h' ? g.pos - window.scrollY : g.pos - window.scrollX;
      if (g.type === 'h') gEl.style.top  = `${vPos}px`;
      else                gEl.style.left = `${vPos}px`;
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
          const vpPos = g.type === 'h' ? ev.clientY : ev.clientX;
          const scrollOff = g.type === 'h' ? window.scrollY : window.scrollX;
          g.pos = (S.snap ? snapPoint(g.type, vpPos) : vpPos) + scrollOff;
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
      label.textContent = fmtU(g.pos);
      if (g.type === 'h') label.style.cssText = `left:4px;top:${vPos - 16}px;`;
      else                label.style.cssText = `left:${vPos + 4}px;top:4px;`;
      ROOT.appendChild(label);
    });

    // Draw guide-to-guide distance lines on canvas
    drawGuideCrossDistances();
  }

  function drawGuideCrossDistances() {
    if (S.guides.length < 2) return;
    const hGuides = S.guides.filter(g => g.type === 'h').map(g => g.pos).sort((a,b)=>a-b);
    const vGuides = S.guides.filter(g => g.type === 'v').map(g => g.pos).sort((a,b)=>a-b);

    for (let i = 0; i < hGuides.length - 1; i++) {
      const midX = document.documentElement.clientWidth / 2;
      const mid  = (hGuides[i] + hGuides[i+1]) / 2 - window.scrollY;
      addDistLabel(Math.abs(hGuides[i+1] - hGuides[i]), midX, mid, 'v', 'guide');
    }
    for (let i = 0; i < vGuides.length - 1; i++) {
      const midY = document.documentElement.clientHeight / 2;
      const mid  = (vGuides[i] + vGuides[i+1]) / 2 - window.scrollX;
      addDistLabel(Math.abs(vGuides[i+1] - vGuides[i]), mid, midY, 'h', 'guide');
    }
  }

  // ── Element edge extension lines ──────────────────────────────────────────
  function drawElementExtensions(elem) {
    const r  = elem.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    CTX.save();
    CTX.strokeStyle = 'rgba(248,81,73,.75)';
    CTX.lineWidth = 1;
    CTX.setLineDash([5, 4]);
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
    const sz = 5;
    const off = document.createElement('canvas');
    off.width = sz;
    off.height = sz;
    const c = off.getContext('2d');
    c.strokeStyle = lineColor;
    c.lineWidth = 1.35;
    c.lineCap = 'square';
    c.beginPath();
    c.moveTo(-0.5, sz + 0.5);
    c.lineTo(sz + 0.5, -0.5);
    c.moveTo(-0.5, -0.5);
    c.lineTo(sz + 0.5, sz + 0.5);
    c.stroke();
    return CTX.createPattern(off, 'repeat');
  }

  // ── CSS Grid track lines (inspector) ─────────────────────────────────────
  /** @param {DOMRectReadOnly|DOMRect} r */
  function gridContentBoxFromRect(r, cs) {
    const bl = parseFloat(cs.borderLeftWidth) || 0;
    const br = parseFloat(cs.borderRightWidth) || 0;
    const bt = parseFloat(cs.borderTopWidth) || 0;
    const bb = parseFloat(cs.borderBottomWidth) || 0;
    const pl = parseFloat(cs.paddingLeft) || 0;
    const pr = parseFloat(cs.paddingRight) || 0;
    const pt = parseFloat(cs.paddingTop) || 0;
    const pb = parseFloat(cs.paddingBottom) || 0;
    return {
      left: r.left + bl + pl,
      top: r.top + bt + pt,
      right: r.right - br - pr,
      bottom: r.bottom - bb - pb,
    };
  }

  /** Grid item border boxes (skips #mt-root; unwraps `display: contents`) */
  function collectGridItemRects(container) {
    const out = [];
    for (const ch of container.children) {
      if (ch.closest && ch.closest('#mt-root')) continue;
      let csCh;
      try { csCh = window.getComputedStyle(ch); } catch (_) { continue; }
      if (csCh.display === 'contents') {
        for (const sub of ch.children) {
          if (sub.closest && sub.closest('#mt-root')) continue;
          const sr = sub.getBoundingClientRect();
          if (sr.width > 0 && sr.height > 0) out.push(sr);
        }
      } else {
        const cr = ch.getBoundingClientRect();
        if (cr.width > 0 && cr.height > 0) out.push(cr);
      }
    }
    return out;
  }

  /** Merge coordinates that differ only by subpixel noise */
  function mergeAxisLines(sorted, eps = 0.55) {
    const out = [];
    for (const v of sorted) {
      if (!out.length || Math.abs(v - out[out.length - 1]) > eps) out.push(v);
    }
    return out;
  }

  /** Draw column/row boundaries inferred from grid-item geometry */
  function drawGridLines(container) {
    if (!container || !container.isConnected || !ROOT) return;
    let cs;
    try { cs = window.getComputedStyle(container); } catch (_) { return; }
    const disp = cs.display;
    if (disp !== 'grid' && disp !== 'inline-grid') return;

    const rects = collectGridItemRects(container);
    if (!rects.length) return;

    const r0 = container.getBoundingClientRect();
    const box = gridContentBoxFromRect(r0, cs);
    const bw = box.right - box.left;
    const bh = box.bottom - box.top;
    if (bw < 2 || bh < 2) return;

    const xs = rects.flatMap(rr => [rr.left, rr.right]);
    const ys = rects.flatMap(rr => [rr.top, rr.bottom]);
    xs.push(box.left, box.right);
    ys.push(box.top, box.bottom);

    const vertXs = mergeAxisLines(xs.slice().sort((a, b) => a - b));
    const horizYs = mergeAxisLines(ys.slice().sort((a, b) => a - b));

    const _p = n => getComputedStyle(ROOT).getPropertyValue(n).trim();
    const stroke = _p('--mt-violet') || '#7c5cff';

    CTX.save();
    CTX.lineWidth = 1;
    CTX.setLineDash([3, 3]);
    CTX.globalAlpha = 0.92;
    CTX.strokeStyle = stroke;
    CTX.beginPath();
    for (const x of vertXs) {
      if (x < box.left - 1 || x > box.right + 1) continue;
      const xi = Math.round(x) + 0.5;
      CTX.moveTo(xi, box.top);
      CTX.lineTo(xi, box.bottom);
    }
    for (const y of horizYs) {
      if (y < box.top - 1 || y > box.bottom + 1) continue;
      const yi = Math.round(y) + 0.5;
      CTX.moveTo(box.left, yi);
      CTX.lineTo(box.right, yi);
    }
    CTX.stroke();
    CTX.restore();
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

    const cR        = container.getBoundingClientRect();
    const rects     = children.map(ch => ch.getBoundingClientRect());
    const rectToEl  = new Map(children.map((ch, i) => [rects[i], ch]));
    const isColFlex = isFlex && cs.flexDirection.startsWith('column');
    const colGap    = parseFloat(cs.columnGap) || 0;
    const rowGap    = parseFloat(cs.rowGap)    || 0;

    // segs: individual colored regions { x1,y1,x2,y2, kind:'gap'|'margin' }
    // labels: one per logical gap { x1,y1,x2,y2, size, axis, kind }
    const segs   = [];
    const labels  = [];

    // Helper: push h-gap segments between two adjacent items
    const pushHSegs = (a, b) => {
      const totalSpace = b.left - a.right;
      if (totalSpace < 0.5) return;
      const key = `${Math.round(a.right)},${Math.round(b.left)}`;
      const aEl = rectToEl.get(a), bEl = rectToEl.get(b);
      const mr  = aEl ? (parseFloat(window.getComputedStyle(aEl).marginRight) || 0) : 0;
      const ml  = bEl ? (parseFloat(window.getComputedStyle(bEl).marginLeft)  || 0) : 0;
      const hasMargin = mr > 0.5 || ml > 0.5;
      const hasGap    = colGap > 0.5;

      if (!hasMargin || !hasGap) {
        const kind = hasGap ? 'gap' : 'margin';
        segs.push({ x1: a.right, y1: cR.top, x2: b.left, y2: cR.bottom, kind });
      } else {
        const xA = Math.min(a.right + mr, b.left);
        const xB = Math.max(b.left  - ml, a.right);
        if (mr > 0.5)          segs.push({ x1: a.right, y1: cR.top, x2: xA,     y2: cR.bottom, kind: 'margin' });
        if (xB > xA + 0.5)    segs.push({ x1: xA,      y1: cR.top, x2: xB,     y2: cR.bottom, kind: 'gap'    });
        if (ml > 0.5)          segs.push({ x1: xB,      y1: cR.top, x2: b.left, y2: cR.bottom, kind: 'margin' });
      }
      const labelKind = hasMargin ? 'margin' : 'gap';
      labels.push({ x1: a.right, y1: cR.top, x2: b.left, y2: cR.bottom, size: totalSpace, axis: 'h', kind: labelKind });
      return key;
    };

    // Helper: push v-gap segments between two rows
    const pushVSegs = (rowTop, rowBot, y1, y2) => {
      const totalSpace = y2 - y1;
      if (totalSpace < 0.5) return;
      const topElems = rowTop.map(r => rectToEl.get(r)).filter(Boolean);
      const botElems = rowBot.map(r => rectToEl.get(r)).filter(Boolean);
      const maxMb = topElems.length ? Math.max(...topElems.map(el => parseFloat(window.getComputedStyle(el).marginBottom) || 0)) : 0;
      const maxMt = botElems.length ? Math.max(...botElems.map(el => parseFloat(window.getComputedStyle(el).marginTop)    || 0)) : 0;
      const hasMargin = maxMb > 0.5 || maxMt > 0.5;
      const hasGap    = rowGap > 0.5;

      if (!hasMargin || !hasGap) {
        const kind = hasGap ? 'gap' : 'margin';
        segs.push({ x1: cR.left, y1, x2: cR.right, y2, kind });
      } else {
        const yA = Math.min(y1 + maxMb, y2);
        const yB = Math.max(y2 - maxMt, y1);
        if (maxMb > 0.5)    segs.push({ x1: cR.left, y1, x2: cR.right, y2: yA, kind: 'margin' });
        if (yB > yA + 0.5)  segs.push({ x1: cR.left, y1: yA, x2: cR.right, y2: yB, kind: 'gap'    });
        if (maxMt > 0.5)    segs.push({ x1: cR.left, y1: yB, x2: cR.right, y2, kind: 'margin' });
      }
      const labelKind = hasMargin ? 'margin' : 'gap';
      labels.push({ x1: cR.left, y1, x2: cR.right, y2, size: totalSpace, axis: 'v', kind: labelKind });
    };

    if (!isColFlex) {
      const rows = groupByRow(rects);

      const seenH = new Set();
      rows.forEach(row => {
        row.slice().sort((a, b) => a.left - b.left).forEach((a, i, arr) => {
          if (i === arr.length - 1) return;
          const b   = arr[i + 1];
          const key = pushHSegs(a, b);
          if (key) seenH.add(key);
        });
      });

      if (isGrid || (isFlex && cs.flexWrap !== 'nowrap')) {
        for (let i = 0; i < rows.length - 1; i++) {
          const maxBottom = Math.max(...rows[i].map(r => r.bottom));
          const minTop    = Math.min(...rows[i + 1].map(r => r.top));
          pushVSegs(rows[i], rows[i + 1], maxBottom, minTop);
        }
      }
    } else {
      const seenV = new Set();
      groupByCol(rects).forEach(col => {
        col.slice().sort((a, b) => a.top - b.top).forEach((a, i, arr) => {
          if (i === arr.length - 1) return;
          const b   = arr[i + 1];
          const gap = b.top - a.bottom;
          if (gap < 0.5) return;
          const key = `${Math.round(a.bottom)},${Math.round(b.top)}`;
          if (seenV.has(key)) return;
          seenV.add(key);
          const aEl = rectToEl.get(a), bEl = rectToEl.get(b);
          const mb  = aEl ? (parseFloat(window.getComputedStyle(aEl).marginBottom) || 0) : 0;
          const mt  = bEl ? (parseFloat(window.getComputedStyle(bEl).marginTop)    || 0) : 0;
          const hasMargin = mb > 0.5 || mt > 0.5;
          const hasGap    = rowGap > 0.5;

          if (!hasMargin || !hasGap) {
            const kind = hasGap ? 'gap' : 'margin';
            segs.push({ x1: cR.left, y1: a.bottom, x2: cR.right, y2: b.top, kind });
          } else {
            const yA = Math.min(a.bottom + mb, b.top);
            const yB = Math.max(b.top - mt, a.bottom);
            if (mb > 0.5)       segs.push({ x1: cR.left, y1: a.bottom, x2: cR.right, y2: yA,    kind: 'margin' });
            if (yB > yA + 0.5)  segs.push({ x1: cR.left, y1: yA,      x2: cR.right, y2: yB,    kind: 'gap'    });
            if (mt > 0.5)       segs.push({ x1: cR.left, y1: yB,       x2: cR.right, y2: b.top, kind: 'margin' });
          }
          const labelKind = hasMargin ? 'margin' : 'gap';
          labels.push({ x1: cR.left, y1: a.bottom, x2: cR.right, y2: b.top, size: gap, axis: 'v', kind: labelKind });
        });
      });
    }

    if (!segs.length) return;

    const hatchGap    = makeHatchPattern('rgba(37, 99, 235, 0.72)');
    const hatchMargin = makeHatchPattern('rgba(202, 138, 4, 0.80)');

    CTX.save();
    CTX.lineWidth = 1;
    CTX.setLineDash([]);
    segs.forEach(({ x1, y1, x2, y2, kind }) => {
      const w = x2 - x1, h = y2 - y1;
      if (w < 0.5 || h < 0.5) return;
      CTX.fillStyle   = kind === 'gap' ? hatchGap    : hatchMargin;
      CTX.strokeStyle = kind === 'gap' ? 'rgba(37, 99, 235, 0.90)' : 'rgba(202, 138, 4, 0.90)';
      CTX.fillRect(x1, y1, w, h);
      CTX.strokeRect(x1, y1, w, h);
    });
    CTX.restore();

    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    labels.forEach(({ x1, y1, x2, y2, size, axis, kind }) => {
      addGapLabel(size, x1, y1, x2, y2, axis, vw, vh, kind);
    });
  }

  function addGapLabel(size, x1, y1, x2, y2, axis, vw, vh, kind = 'gap') {
    const div = document.createElement('div');
    const kindCls = kind === 'margin' ? ' mt-gap-label-margin' : '';
    div.className = (axis === 'h' ? 'mt-gap-label mt-gap-label-h' : 'mt-gap-label mt-gap-label-v') + kindCls;
    div.textContent = fmtU(size);

    if (axis === 'h') {
      // Column gap strip: full container height, gap width
      const lx     = Math.max(28, Math.min(vw - 28, (x1 + x2) / 2));
      const stripH = y2 - y1;
      if (stripH < 40) {
        // container too short — float label above it
        div.style.left      = `${lx}px`;
        div.style.top       = `${Math.max(4, y1 - 4)}px`;
        div.style.transform = 'translate(-50%, -100%)';
      } else {
        const ly = Math.max(4, Math.min(vh - 24, y1));
        div.style.left      = `${lx}px`;
        div.style.top       = `${ly}px`;
        div.style.transform = 'translate(-50%, 4px)';
      }
    } else {
      // Row gap strip: gap height, full container width
      const ly     = Math.max(4, Math.min(vh - 20, (y1 + y2) / 2));
      const stripH = y2 - y1;
      if (stripH < 20) {
        // gap too narrow — float label to the left of the container
        div.style.left      = `${Math.max(4, x1 - 4)}px`;
        div.style.top       = `${ly}px`;
        div.style.transform = 'translate(-100%, -50%)';
      } else {
        const lx = Math.max(4, Math.min(vw - 60, x1));
        div.style.left      = `${lx}px`;
        div.style.top       = `${ly}px`;
        div.style.transform = 'translate(4px, -50%)';
      }
    }

    ROOT.appendChild(div);
    distLabels.push(div); // cleaned up by clearDistLabels() on each redraw
  }

  function drawSnapCrosshair() {
    const isHorizontal = S.moveDeltaY >= S.moveDeltaX;
    const x = S.snap ? (S.snapX ?? S.mouseX) : S.mouseX;
    const y = S.snap ? (S.snapY ?? S.mouseY) : S.mouseY;
    const _p = n => getComputedStyle(ROOT).getPropertyValue(n).trim();
    const lineStrong = _p('--mt-guide-snap-line') || 'rgba(32,170,255,0.92)';
    const lineDim    = _p('--mt-guide-snap-line-dim') || 'rgba(32,170,255,0.52)';
    CTX.save();
    CTX.lineWidth = 1;

    CTX.strokeStyle = lineStrong;
    CTX.setLineDash([]);
    CTX.beginPath();
    if (isHorizontal) {
      CTX.moveTo(0, y); CTX.lineTo(CANVAS.width, y);
    } else {
      CTX.moveTo(x, 0); CTX.lineTo(x, CANVAS.height);
    }
    CTX.stroke();

    CTX.setLineDash([4, 4]);
    CTX.strokeStyle = lineDim;
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
    const left = ROOT && ROOT.querySelector('#cp-status-left');
    const coords = ROOT && ROOT.querySelector('#cp-status-coords');
    if (!left || !coords) return;
    const parts = [];
    if (S.selected.length) parts.push(`<span class="sb-sel">${S.selected.length} selected</span>`);
    left.innerHTML = parts.join('');
    coords.textContent = `x: ${Math.round(S.mouseX)} y: ${Math.round(S.mouseY)}`;
  }

  function readInspectorBmPx() {
    const v = S.inspectorBmPx;
    return (Number.isFinite(v) && v >= INS_BM_MIN) ? v : 340;
  }
  function writeInspectorBmPx(px) {
    try { chrome.storage.local.set({ [STORAGE_KEY]: px }); } catch (_) { /* ignore */ }
  }
  function parseBmPxFromBody(body) {
    const s = body.style.getPropertyValue('--ins-bm-px').trim();
    const m = /^([\d.]+)px$/.exec(s);
    return m ? Math.round(parseFloat(m[1])) : readInspectorBmPx();
  }
  function wireInspectorSplit(body, gutter) {
    const onMove = e => {
      if (!S.inspectorSplit) return;
      const bw = body.getBoundingClientRect().width;
      const maxBm = bw - INS_GUTTER - INS_PROPS_MIN;
      const next = Math.round(
        Math.min(Math.max(INS_BM_MIN, S.inspectorSplit.startBm + e.clientX - S.inspectorSplit.startX), maxBm)
      );
      body.style.setProperty('--ins-bm-px', `${next}px`);
      S.inspectorBmPx = next;
    };
    const onUp = () => {
      if (S.inspectorSplit) writeInspectorBmPx(S.inspectorBmPx ?? parseBmPxFromBody(body));
      S.inspectorSplit = null;
      document.body.style.removeProperty('cursor');
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('mouseup', onUp, true);
    };
    gutter.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const startBm = parseBmPxFromBody(body);
      S.inspectorBmPx = startBm;
      S.inspectorSplit = { startX: e.clientX, startBm };
      document.body.style.cursor = 'col-resize';
      document.addEventListener('mousemove', onMove, true);
      document.addEventListener('mouseup', onUp, true);
    });
  }

  // ── Panel snap-to-grid ────────────────────────────────────────────────────
  const SNAP_MARGIN = 16;

  function calcSnapPositions(panel) {
    const r  = panel.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const cw = document.documentElement.clientWidth; // excludes scrollbar
    const pw = r.width, ph = r.height;
    const rx = cw - pw - SNAP_MARGIN, by = vh - ph - SNAP_MARGIN;
    if (vw >= 1280) {
      const cx = (cw - pw) / 2;
      return [
        [SNAP_MARGIN, SNAP_MARGIN], [cx, SNAP_MARGIN], [rx, SNAP_MARGIN],
        [SNAP_MARGIN, by],          [cx, by],           [rx, by],
      ];
    }
    if (vw >= 768) {
      return [
        [SNAP_MARGIN, SNAP_MARGIN], [rx, SNAP_MARGIN],
        [SNAP_MARGIN, by],          [rx, by],
      ];
    }
    const cx = (cw - pw) / 2;
    return [
      [cx, SNAP_MARGIN],
      [cx, by],
    ];
  }

  function nearestSnapZone(panel) {
    const r = panel.getBoundingClientRect();
    const snaps = calcSnapPositions(panel);
    let bestIdx = 0, bestD = Infinity;
    for (let i = 0; i < snaps.length; i++) {
      const d = Math.hypot(snaps[i][0] - r.left, snaps[i][1] - r.top);
      if (d < bestD) { bestD = d; bestIdx = i; }
    }
    return bestIdx;
  }

  function nearestSnap(panel) {
    return calcSnapPositions(panel)[nearestSnapZone(panel)];
  }

  function snapPanelToGrid(panel) {
    const r = panel.getBoundingClientRect();
    // Anchor current rendered position as inline styles so transition has a start point
    panel.style.transition = '';
    panel.style.transform  = 'none';
    panel.style.right      = 'auto';
    panel.style.bottom     = 'auto';
    panel.style.left = `${r.left}px`;
    panel.style.top  = `${r.top}px`;
    panel.offsetLeft; // force reflow to commit anchor before applying transition
    _currentSnapZone = nearestSnapZone(panel);
    const [sl, st] = calcSnapPositions(panel)[_currentSnapZone];
    panel.style.transition = 'left .18s cubic-bezier(0.25,0.46,0.45,0.94), top .18s cubic-bezier(0.25,0.46,0.45,0.94)';
    panel.style.left = `${sl}px`;
    panel.style.top  = `${st}px`;
    setTimeout(() => { panel.style.transition = ''; }, 200);
  }

  // Returns the index (0-5) of the snap zone the panel is currently at, or -1 if free
  function findSnapZone(panel) {
    const snaps = calcSnapPositions(panel);
    const r = panel.getBoundingClientRect();
    const TOLERANCE = 6;
    for (let i = 0; i < snaps.length; i++) {
      if (Math.abs(r.left - snaps[i][0]) < TOLERANCE && Math.abs(r.top - snaps[i][1]) < TOLERANCE) return i;
    }
    return -1;
  }

  // Computes collapsed-button target position. Must be called BEFORE innerHTML is cleared.
  function computeCollapseTarget() {
    const CS = 44; // collapsed button size
    const M  = SNAP_MARGIN;
    const vw = window.innerWidth, vh = window.innerHeight;
    const cw = document.documentElement.clientWidth; // excludes scrollbar
    const rx = cw - CS - M, by = vh - CS - M;
    let collapsedSnaps;
    if (vw >= 1280) {
      const cx = (cw - CS) / 2;
      collapsedSnaps = [
        [M, M], [cx, M], [rx, M],
        [M, by], [cx, by], [rx, by],
      ];
    } else if (vw >= 768) {
      collapsedSnaps = [
        [M, M], [rx, M],
        [M, by], [rx, by],
      ];
    } else {
      const cx = (cw - CS) / 2;
      collapsedSnaps = [
        [cx, M],
        [cx, by],
      ];
    }
    const zone = findSnapZone(PANEL);
    _collapseZone = zone; // remember for expand
    if (zone >= 0) {
      return { left: collapsedSnaps[zone][0], top: collapsedSnaps[zone][1] };
    }
    const r = PANEL.getBoundingClientRect();
    return { left: r.left + r.width / 2 - CS / 2, top: r.top + r.height / 2 - CS / 2 };
  }

  // Expand panel to a specific zone (bypasses geometric nearest-snap to fix TC/BC misdetection)
  function expandToZone(zone) {
    _currentSnapZone = zone;
    const snaps = calcSnapPositions(PANEL);
    const [sl, st] = snaps[zone];
    const r = PANEL.getBoundingClientRect();
    PANEL.style.transition = '';
    PANEL.style.transform  = 'none';
    PANEL.style.right      = 'auto';
    PANEL.style.bottom     = 'auto';
    PANEL.style.left = `${r.left}px`;
    PANEL.style.top  = `${r.top}px`;
    PANEL.offsetLeft;
    PANEL.style.transition = 'left .18s cubic-bezier(0.25,0.46,0.45,0.94), top .18s cubic-bezier(0.25,0.46,0.45,0.94)';
    PANEL.style.left = `${sl}px`;
    PANEL.style.top  = `${st}px`;
    setTimeout(() => { PANEL.style.transition = ''; }, 200);
  }

  // Re-apply current snap zone without animation — called after content changes panel height
  function applyCurrentSnapZone() {
    if (S.panelCollapsed) return;
    if (S.panelSnap && _currentSnapZone >= 0) {
      const snaps = calcSnapPositions(PANEL);
      const [sl, st] = snaps[_currentSnapZone];
      PANEL.style.transition = '';
      PANEL.style.transform  = 'none';
      PANEL.style.right      = 'auto';
      PANEL.style.bottom     = 'auto';
      PANEL.style.left = `${sl}px`;
      PANEL.style.top  = `${st}px`;
    } else if (!S.panelSnap) {
      clampPanelToViewport();
    }
  }

  function clampPanelToViewport() {
    const r  = PANEL.getBoundingClientRect();
    const cw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const cl = Math.min(Math.max(r.left, SNAP_MARGIN), cw - r.width  - SNAP_MARGIN);
    const ct = Math.min(Math.max(r.top,  SNAP_MARGIN), vh - r.height - SNAP_MARGIN);
    if (Math.round(cl) === Math.round(r.left) && Math.round(ct) === Math.round(r.top)) return;
    PANEL.style.transition = '';
    PANEL.style.transform  = 'none';
    PANEL.style.right      = 'auto';
    PANEL.style.bottom     = 'auto';
    PANEL.style.left = `${cl}px`;
    PANEL.style.top  = `${ct}px`;
  }

  function showSnapGhost(panel) {
    let ghost = document.getElementById('mt-snap-ghost');
    if (!ghost) {
      ghost = document.createElement('div');
      ghost.id = 'mt-snap-ghost';
      ROOT.appendChild(ghost);
    }
    const r = panel.getBoundingClientRect();
    ghost.style.width  = `${r.width}px`;
    ghost.style.height = `${r.height}px`;
    return ghost;
  }

  function updateSnapGhost(panel) {
    const ghost = document.getElementById('mt-snap-ghost');
    if (!ghost) return;
    const [sl, st] = nearestSnap(panel);
    ghost.style.left = `${sl}px`;
    ghost.style.top  = `${st}px`;
  }

  function removeSnapGhost() {
    const ghost = document.getElementById('mt-snap-ghost');
    if (ghost) ghost.remove();
  }

  // ── Draggable panels ──────────────────────────────────────────────────────
  function makeDraggable(panel, handle) {
    let ox, oy, startL, startT;
    handle.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      if (e.target.closest('input, textarea, select, .cp-btn, .cp-unit-btn, .cp-kbd, .cp-mode-switch, a, button')) return;
      _currentSnapZone = -1;
      ox = e.clientX; oy = e.clientY;
      const r = panel.getBoundingClientRect();
      startL = r.left; startT = r.top;
      panel.style.left = `${startL}px`;
      panel.style.top = `${startT}px`;
      panel.style.transform = 'none';
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
      if (S.panelSnap) showSnapGhost(panel);
      const move = ev => {
        panel.style.left = `${startL + ev.clientX - ox}px`;
        panel.style.top  = `${startT + ev.clientY - oy}px`;
        if (S.panelSnap) updateSnapGhost(panel);
      };
      const up = () => {
        document.removeEventListener('mousemove', move, true);
        document.removeEventListener('mouseup',   up,   true);
        removeSnapGhost();
        if (S.panelSnap) snapPanelToGrid(panel);
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

  function roundPx(val) { return parseFloat(val) || 0; }
  function parseRemRootFromStorage(raw) {
    const n = typeof raw === 'number' ? raw : parseFloat(raw);
    if (!Number.isFinite(n)) return 16;
    return Math.min(512, Math.max(1, n));
  }
  function rootFontSize() {
    return S.remRootPx > 0 ? S.remRootPx : (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16);
  }
  function fmtU(n) {
    if (n === 0) return '0';
    switch (S.unit) {
      case 'rem': { const v = n / rootFontSize();            return parseFloat(v.toFixed(3)) + 'rem'; }
      case 'vw':  { const v = n * 100 / window.innerWidth;  return parseFloat(v.toFixed(2)) + 'vw';  }
      case 'vh':  { const v = n * 100 / window.innerHeight; return parseFloat(v.toFixed(2)) + 'vh';  }
      case 'pt':  { const v = n * 0.75;                     return parseFloat(v.toFixed(2)) + 'pt';  }
      case 'in':  { const v = n / 96;                       return parseFloat(v.toFixed(3)) + 'in';  }
      case 'cm':  { const v = n * 2.54 / 96;                return parseFloat(v.toFixed(2)) + 'cm';  }
      case 'mm':  { const v = n * 25.4 / 96;                return parseFloat(v.toFixed(1)) + 'mm';  }
      default: { const v = parseFloat(n.toFixed(2)); return (v === 0 ? '0' : v + 'px'); }
    }
  }
  function fmtCssLen(val) {
    if (!val || val === 'normal') return val;
    const n = parseFloat(val);
    if (isNaN(n) || !String(val).trimEnd().endsWith('px')) return val;
    return fmtU(n);
  }
  function fmtPx(n) { return fmtU(n); }

  function overlapH(a, b) { return a.left < b.right && a.right > b.left; }
  function overlapV(a, b) { return a.top  < b.bottom && a.bottom > b.top; }

  function colorToHex(color) {
    if (!color || color === 'rgba(0, 0, 0, 0)') return 'transparent';
    const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return color;
    return '#' + [m[1],m[2],m[3]].map(n => (+n).toString(16).padStart(2,'0')).join('').toUpperCase();
  }

  function onGlobalKeyToggle(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'M' || e.key === 'm')) {
      toggle();
      e.preventDefault();
    }
  }

  // ── Message Handler ───────────────────────────────────────────────────────
  document.addEventListener('keydown', onGlobalKeyToggle, true);

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'PING') {
      sendResponse({ ok: true });
      return;
    }
    if (msg.type === 'TOGGLE') {
      if (S.enabled) {
        disable();
        sendResponse({ enabled: false });
        return;
      }
      enable(() => sendResponse({ enabled: true }));
      return true;
    }
    if (msg.type === 'GET_ENABLED') {
      sendResponse({ enabled: S.enabled });
    }
  });

})();
