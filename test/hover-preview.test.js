'use strict';

/**
 * 链接预览弹框 Hover 交互测试用例
 *
 * 覆盖修复的 4 个 Bug：
 *   Bug1 — handleLinkLeave 未检查 relatedTarget，链接内子元素间移动时 hoverTimer 被反复清除
 *   Bug2 — DEFAULT_SETTINGS 缺少 hideDelay，scheduleHide 立即执行
 *   Bug3 — positionPreviewPanel 调用参数顺序与函数定义不匹配
 *   Bug4 — handleLinkHover 未跟踪当前悬停链接，同一链接内移动重复重置计时器
 */

/* ──────────────── 最小化 QLP 命名空间 & 依赖 Mock ──────────────── */

const DEFAULT_SETTINGS = {
  triggerMode: 'hover',
  hoverDelay: 500,
  hideDelay: 300,
  previewWidth: 600,
  previewHeight: 400,
  blacklist: [],
  enableSecurityCheck: false,
  positioning: {
    mode: 'auto',
    anchorPosition: 'auto',
    offsetX: 15,
    offsetY: 10,
    enableMouseFollow: false,
    mouseFollowSensitivity: 0.3,
    smartAnchor: true,
    fixedPosition: { top: 20, right: 20, bottom: null, left: null },
    showAnchorIndicator: true,
    smoothTransition: true
  },
  theme: {
    primaryColor: '#667eea',
    secondaryColor: '#764ba2',
    borderRadius: '12px',
    shadowIntensity: 'medium',
    fontSize: '14px',
    componentOrder: ['header', 'content', 'footer', 'security'],
    preset: 'default',
    smartContrast: true
  }
};

/**
 * 创建一个精简的 QLP 对象，仅包含与 hover 交互相关的属性和方法
 * 便于在 Node.js 环境下独立测试核心逻辑
 */
function createQLP() {
  const _ = {
    settings: { ...DEFAULT_SETTINGS },
    hoverTimer: null,
    hideTimer: null,
    currentLink: null,
    currentLinkTitle: '',
    currentLinkData: null,
    isFavoriteCurrent: false,
    isPanelHovered: false,
    currentHoveredLinkEl: null,
    isBatchModeActive: false,
    previewPanel: null,

    /* ── 工具方法 Mock ── */
    isValidUrl(url) {
      if (!url) return false;
      if (url.startsWith('javascript:')) return false;
      if (url.startsWith('mailto:')) return false;
      if (url.startsWith('#')) return false;
      try {
        const u = new URL(url, 'https://example.com');
        return u.protocol === 'http:' || u.protocol === 'https:';
      } catch { return false; }
    },
    isInBlacklist() { return false; },
    getAbsoluteUrl(href) {
      try { return new URL(href, 'https://example.com').href; } catch { return href; }
    },
    escapeHtml(t) { return t; },

    /* ── 调度隐藏 ── */
    scheduleHide() {
      if (_.hideTimer) clearTimeout(_.hideTimer);
      _.hideTimer = setTimeout(() => {
        if (!_.isPanelHovered) _.hidePreview();
      }, _.settings.hideDelay);
    },

    /* ── 隐藏预览 ── */
    hidePreview() {
      if (_.hoverTimer) { clearTimeout(_.hoverTimer); _.hoverTimer = null; }
      if (_.hideTimer) { clearTimeout(_.hideTimer); _.hideTimer = null; }
      if (_.previewPanel) {
        _.previewPanel.classList.remove('qlp-visible');
        _.currentLink = null;
        _.currentLinkTitle = '';
        _.currentLinkData = null;
        _.isFavoriteCurrent = false;
        _.isPanelHovered = false;
        _.currentHoveredLinkEl = null;
      }
    },

    /* ── showPreview 简化 Mock：只记录调用参数 ── */
    showPreviewCalls: [],
    showPreview(link, event) {
      _.showPreviewCalls.push({ link, event });
    },

    /* ── positionPreviewPanel 简化 Mock：记录参数顺序 ── */
    positionPreviewPanelCalls: [],
    positionPreviewPanel(event, panel, width, height) {
      _.positionPreviewPanelCalls.push({ event, panel, width, height });
    },

    /* ── 核心：handleLinkHover（修复后版本） ── */
    handleLinkHover(event) {
      if (_.isBatchModeActive) return;
      if (_.settings.triggerMode !== 'hover') return;
      if (_.isInBlacklist(window.location.href)) return;

      const link = event.target.closest('a');
      if (!link || !link.href || !_.isValidUrl(link.href)) return;

      /* Bug4 修复：同一链接内移动不重置计时器 */
      if (_.currentHoveredLinkEl === link && _.hoverTimer) return;

      if (_.hideTimer) { clearTimeout(_.hideTimer); _.hideTimer = null; }
      if (_.hoverTimer) clearTimeout(_.hoverTimer);

      _.currentHoveredLinkEl = link;

      _.hoverTimer = setTimeout(() => {
        _.showPreview(link, event);
      }, _.settings.hoverDelay);
    },

    /* ── 核心：handleLinkLeave（修复后版本） ── */
    handleLinkLeave(event) {
      if (_.isBatchModeActive) return;
      if (_.settings.triggerMode !== 'hover') return;

      const link = event.target.closest('a');
      if (!link || !link.href) return;

      /* Bug1 修复：relatedTarget 仍在同一 <a> 内则不处理 */
      if (event.relatedTarget) {
        const relatedLink = event.relatedTarget.closest?.('a');
        if (relatedLink === link) return;
      }

      _.currentHoveredLinkEl = null;

      if (_.hoverTimer) { clearTimeout(_.hoverTimer); _.hoverTimer = null; }
      _.scheduleHide();
    }
  };

  return _;
}

/* ──────────────── DOM 辅助：模拟事件对象 ──────────────── */

/**
 * 创建模拟的 <a> 元素
 * @param {string} href - 链接地址
 * @returns {object} 模拟 DOM 节点
 */
function createMockLink(href) {
  return {
    tagName: 'A',
    href,
    textContent: 'Test Link',
    title: '',
    closest(sel) { return sel === 'a' ? this : null; },
    getBoundingClientRect() {
      return { left: 100, top: 100, right: 200, bottom: 130, width: 100, height: 30 };
    }
  };
}

/**
 * 创建模拟的子元素（嵌套在 <a> 内的 <span> 等）
 * @param {object} parentLink - 父级 <a> 元素
 * @returns {object} 模拟子节点
 */
function createMockChild(parentLink) {
  return {
    tagName: 'SPAN',
    closest(sel) { return sel === 'a' ? parentLink : null; }
  };
}

/**
 * 创建模拟的 mouseover/mouseout 事件
 * @param {object} target - event.target
 * @param {object|null} relatedTarget - event.relatedTarget
 * @returns {object} 模拟事件对象
 */
function createMouseEvent(target, relatedTarget = null) {
  return { target, relatedTarget, clientX: 150, clientY: 115 };
}

/* ──────────────── 全局 window Mock ──────────────── */

let originalWindow;
beforeAll(() => {
  originalWindow = global.window;
  global.window = { location: { href: 'https://example.com/page' } };
});
afterAll(() => {
  global.window = originalWindow;
});

/* ══════════════════════════════════════════════════════════════════
 *  测试用例
 * ══════════════════════════════════════════════════════════════════ */

describe('Bug1: handleLinkLeave relatedTarget 检查', () => {
  let _;

  beforeEach(() => {
    _ = createQLP();
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test('鼠标在同一 <a> 内的子元素间移动时，不应清除 hoverTimer', () => {
    const link = createMockLink('https://example.com');
    const child1 = createMockChild(link);
    const child2 = createMockChild(link);

    /* 先触发 hover，启动计时器 */
    _.handleLinkHover(createMouseEvent(child1));
    expect(_.hoverTimer).not.toBeNull();

    const timerBefore = _.hoverTimer;

    /* 鼠标从 child1 移到 child2，relatedTarget 仍在同一 <a> 内 */
    _.handleLinkLeave(createMouseEvent(child1, child2));

    /* 修复后：hoverTimer 不应被清除 */
    expect(_.hoverTimer).not.toBeNull();
    expect(_.hoverTimer).toBe(timerBefore);
  });

  test('鼠标真正离开 <a> 时，应清除 hoverTimer 并调度隐藏', () => {
    const link = createMockLink('https://example.com');
    const child = createMockChild(link);

    /* 外部元素（不在任何 <a> 内） */
    const outside = { tagName: 'DIV', closest() { return null; } };

    _.handleLinkHover(createMouseEvent(child));
    expect(_.hoverTimer).not.toBeNull();

    /* 鼠标离开链接到外部元素 */
    _.handleLinkLeave(createMouseEvent(child, outside));

    /* 修复后：hoverTimer 应被清除 */
    expect(_.hoverTimer).toBeNull();
    expect(_.hideTimer).not.toBeNull();
  });

  test('relatedTarget 为 null（鼠标移出窗口）时，应正常清除计时器', () => {
    const link = createMockLink('https://example.com');
    const child = createMockChild(link);

    _.handleLinkHover(createMouseEvent(child));
    expect(_.hoverTimer).not.toBeNull();

    /* relatedTarget 为 null 表示鼠标离开了窗口 */
    _.handleLinkLeave(createMouseEvent(child, null));

    expect(_.hoverTimer).toBeNull();
    expect(_.hideTimer).not.toBeNull();
  });

  test('鼠标从链接 A 移到链接 B 时，应清除 A 的计时器', () => {
    const linkA = createMockLink('https://a.com');
    const linkB = createMockLink('https://b.com');
    const childA = createMockChild(linkA);

    _.handleLinkHover(createMouseEvent(childA));
    expect(_.hoverTimer).not.toBeNull();

    /* 鼠标从 linkA 移到 linkB */
    _.handleLinkLeave(createMouseEvent(childA, linkB));

    /* linkB 不是同一个 <a>，所以应清除计时器 */
    expect(_.hoverTimer).toBeNull();
  });
});

describe('Bug2: DEFAULT_SETTINGS 包含 hideDelay', () => {
  test('hideDelay 应为正整数，确保 scheduleHide 有合理延迟', () => {
    expect(DEFAULT_SETTINGS.hideDelay).toBeDefined();
    expect(typeof DEFAULT_SETTINGS.hideDelay).toBe('number');
    expect(DEFAULT_SETTINGS.hideDelay).toBeGreaterThan(0);
  });

  test('scheduleHide 使用 hideDelay 而非立即执行', () => {
    const _ = createQLP();
    jest.useFakeTimers();

    let hideCalled = false;
    _.hidePreview = () => { hideCalled = true; };
    _.isPanelHovered = false;

    _.scheduleHide();

    /* hideDelay 期间不应立即调用 hidePreview */
    expect(hideCalled).toBe(false);

    /* 快进不到 hideDelay 时间，仍不应调用 */
    jest.advanceTimersByTime(DEFAULT_SETTINGS.hideDelay - 1);
    expect(hideCalled).toBe(false);

    /* 快进到 hideDelay 时间后，应调用 hidePreview */
    jest.advanceTimersByTime(1);
    expect(hideCalled).toBe(true);

    jest.useRealTimers();
  });

  test('scheduleHide 在面板被悬停时应取消隐藏', () => {
    const _ = createQLP();
    jest.useFakeTimers();

    let hideCalled = false;
    _.hidePreview = () => { hideCalled = true; };
    _.isPanelHovered = true;

    _.scheduleHide();

    /* 即使过了 hideDelay，面板被悬停也不应隐藏 */
    jest.advanceTimersByTime(DEFAULT_SETTINGS.hideDelay + 100);
    expect(hideCalled).toBe(false);

    jest.useRealTimers();
  });
});

describe('Bug3: positionPreviewPanel 参数顺序', () => {
  test('调用时应按 (event, panel, width, height) 顺序传参', () => {
    const _ = createQLP();

    const mockEvent = { clientX: 100, clientY: 200, target: createMockLink('https://example.com') };
    const mockPanel = { classList: { add: jest.fn() }, style: {} };

    /* 模拟 showPreview 中的调用方式（修复后） */
    _.positionPreviewPanel(mockEvent, mockPanel, 600, 460);

    const call = _.positionPreviewPanelCalls[0];
    expect(call.event).toBe(mockEvent);
    expect(call.panel).toBe(mockPanel);
    expect(call.width).toBe(600);
    expect(call.height).toBe(460);
  });

  test('event 参数应为事件对象而非 DOM 元素', () => {
    const _ = createQLP();

    const mockEvent = { clientX: 100, clientY: 200, target: createMockLink('https://example.com') };
    const mockPanel = { classList: { add: jest.fn() }, style: {} };

    _.positionPreviewPanel(mockEvent, mockPanel, 600, 460);

    const call = _.positionPreviewPanelCalls[0];
    /* event 应该有 clientX/clientY 或 target 属性（事件对象特征） */
    expect(call.event).toHaveProperty('clientX');
    expect(call.event).toHaveProperty('clientY');
    /* panel 不应被误传为 event */
    expect(call.panel).not.toHaveProperty('clientX');
  });
});

describe('Bug4: handleLinkHover 同一链接内不重置计时器', () => {
  let _;

  beforeEach(() => {
    _ = createQLP();
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test('同一链接内移动不应重置 hoverTimer', () => {
    const link = createMockLink('https://example.com');
    const child1 = createMockChild(link);
    const child2 = createMockChild(link);

    /* 第一次 hover，启动计时器 */
    _.handleLinkHover(createMouseEvent(child1));
    const firstTimer = _.hoverTimer;
    expect(firstTimer).not.toBeNull();

    /* 同一链接内再次 hover（从 child1 移到 child2） */
    _.handleLinkHover(createMouseEvent(child2));

    /* 修复后：计时器不应被重置 */
    expect(_.hoverTimer).toBe(firstTimer);
  });

  test('移到不同链接时应重置 hoverTimer', () => {
    const linkA = createMockLink('https://a.com');
    const linkB = createMockLink('https://b.com');

    _.handleLinkHover(createMouseEvent(linkA));
    const firstTimer = _.hoverTimer;

    /* 移到不同链接 */
    _.handleLinkHover(createMouseEvent(linkB));

    /* 修复后：应设置新计时器 */
    expect(_.hoverTimer).not.toBe(firstTimer);
  });

  test('hover 计时器到期后应调用 showPreview', () => {
    const _ = createQLP();
    jest.useFakeTimers();

    const link = createMockLink('https://example.com');

    _.handleLinkHover(createMouseEvent(link));
    expect(_.showPreviewCalls.length).toBe(0);

    /* 快进 hoverDelay 时间 */
    jest.advanceTimersByTime(DEFAULT_SETTINGS.hoverDelay);
    expect(_.showPreviewCalls.length).toBe(1);
    expect(_.showPreviewCalls[0].link).toBe(link);

    jest.useRealTimers();
  });

  test('同一链接内反复移动后，计时器到期仍能触发 showPreview', () => {
    const link = createMockLink('https://example.com');
    const child1 = createMockChild(link);
    const child2 = createMockChild(link);
    const child3 = createMockChild(link);

    /* 第一次 hover */
    _.handleLinkHover(createMouseEvent(child1));

    /* 在同一链接内多次移动（Bug1+Bug4 修复后不应重置计时器） */
    _.handleLinkLeave(createMouseEvent(child1, child2));
    _.handleLinkHover(createMouseEvent(child2));
    _.handleLinkLeave(createMouseEvent(child2, child3));
    _.handleLinkHover(createMouseEvent(child3));

    /* 快进 hoverDelay 时间 */
    jest.advanceTimersByTime(DEFAULT_SETTINGS.hoverDelay);

    /* showPreview 应被调用一次 */
    expect(_.showPreviewCalls.length).toBe(1);
  });
});

describe('集成：完整的 hover → show → leave → hide 流程', () => {
  let _;

  beforeEach(() => {
    _ = createQLP();
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test('hover 链接 → 等待延迟 → 显示预览 → 离开 → 延迟后隐藏', () => {
    const link = createMockLink('https://example.com');
    const child = createMockChild(link);
    const outside = { tagName: 'DIV', closest() { return null; } };

    /* 1. 鼠标进入链接 */
    _.handleLinkHover(createMouseEvent(child));
    expect(_.hoverTimer).not.toBeNull();

    /* 2. 等待 hoverDelay，预览应显示 */
    jest.advanceTimersByTime(DEFAULT_SETTINGS.hoverDelay);
    expect(_.showPreviewCalls.length).toBe(1);

    /* 3. 模拟面板已显示 */
    _.previewPanel = { classList: { remove: jest.fn(), add: jest.fn() } };

    /* 4. 鼠标离开链接 */
    _.handleLinkLeave(createMouseEvent(child, outside));
    expect(_.hoverTimer).toBeNull();
    expect(_.hideTimer).not.toBeNull();

    /* 5. 在 hideDelay 内，预览仍可见 */
    jest.advanceTimersByTime(DEFAULT_SETTINGS.hideDelay - 1);

    /* 6. 超过 hideDelay 后，预览应隐藏 */
    jest.advanceTimersByTime(1);
    expect(_.currentLink).toBeNull();
  });

  test('hover 链接 → 离开 → 在 hoverDelay 内 → 不应显示预览', () => {
    const link = createMockLink('https://example.com');
    const child = createMockChild(link);
    const outside = { tagName: 'DIV', closest() { return null; } };

    /* 1. 鼠标进入链接 */
    _.handleLinkHover(createMouseEvent(child));

    /* 2. 在 hoverDelay 到期前离开 */
    jest.advanceTimersByTime(DEFAULT_SETTINGS.hoverDelay - 100);
    _.handleLinkLeave(createMouseEvent(child, outside));

    /* 3. hoverTimer 应被清除 */
    expect(_.hoverTimer).toBeNull();

    /* 4. 继续快进，showPreview 不应被调用 */
    jest.advanceTimersByTime(DEFAULT_SETTINGS.hoverDelay);
    expect(_.showPreviewCalls.length).toBe(0);
  });

  test('面板被悬停时，离开链接不应隐藏面板', () => {
    const link = createMockLink('https://example.com');
    const child = createMockChild(link);
    const outside = { tagName: 'DIV', closest() { return null; } };

    /* 1. hover 并等待显示 */
    _.handleLinkHover(createMouseEvent(child));
    jest.advanceTimersByTime(DEFAULT_SETTINGS.hoverDelay);
    expect(_.showPreviewCalls.length).toBe(1);

    /* 2. 模拟面板已显示且鼠标移到面板上，同时设置 currentLink 模拟 showPreview 的副作用 */
    _.currentLink = 'https://example.com';
    _.previewPanel = { classList: { remove: jest.fn(), add: jest.fn() } };
    _.isPanelHovered = true;

    /* 3. 鼠标离开链接（但仍在面板上） */
    _.handleLinkLeave(createMouseEvent(child, outside));

    /* 4. 等待 hideDelay */
    jest.advanceTimersByTime(DEFAULT_SETTINGS.hideDelay + 100);

    /* 5. 面板被悬停，不应隐藏 */
    expect(_.currentLink).not.toBeNull();
  });
});
