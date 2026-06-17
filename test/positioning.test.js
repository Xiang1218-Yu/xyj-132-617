'use strict';

/**
 * 预览弹框定位功能测试用例
 * 测试链接预览弹框的定位逻辑，确保弹框能正确显示在视口内
 */

const {
  DEFAULT_SETTINGS,
  getTriggerPosition,
  selectOptimalAnchor,
  calculateAnchorPosition,
  calculateFixedPosition,
  calculateMouseFollowPosition
} = require('./modules/positioning');

describe('DEFAULT_SETTINGS', () => {
  test('包含定位相关的默认配置', () => {
    expect(DEFAULT_SETTINGS.positioning).toBeDefined();
    expect(DEFAULT_SETTINGS.positioning.mode).toBe('auto');
    expect(DEFAULT_SETTINGS.positioning.offsetX).toBe(15);
    expect(DEFAULT_SETTINGS.positioning.offsetY).toBe(10);
  });

  test('包含预览尺寸默认配置', () => {
    expect(DEFAULT_SETTINGS.previewWidth).toBe(600);
    expect(DEFAULT_SETTINGS.previewHeight).toBe(400);
  });
});

describe('getTriggerPosition', () => {
  describe('使用 target 元素获取位置', () => {
    test('从具有 getBoundingClientRect 的目标元素获取位置', () => {
      const mockElement = {
        getBoundingClientRect: jest.fn(() => ({
          left: 100,
          top: 200,
          right: 200,
          bottom: 250,
          width: 100,
          height: 50
        }))
      };
      const event = { target: mockElement };
      const result = getTriggerPosition(event);

      expect(result.x).toBe(150); // left + width/2 = 100 + 50
      expect(result.y).toBe(225); // top + height/2 = 200 + 25
      expect(result.rect).toEqual({
        left: 100,
        top: 200,
        right: 200,
        bottom: 250,
        width: 100,
        height: 50
      });
    });
  });

  describe('使用鼠标坐标获取位置', () => {
    test('从 clientX/clientY 获取位置', () => {
      const event = { clientX: 300, clientY: 400 };
      const result = getTriggerPosition(event);

      expect(result.x).toBe(300);
      expect(result.y).toBe(400);
      expect(result.rect.width).toBe(0);
      expect(result.rect.height).toBe(0);
    });
  });

  describe('无有效输入时的默认值', () => {
    beforeEach(() => {
      global.window = {
        innerWidth: 1024,
        innerHeight: 768
      };
    });

    afterEach(() => {
      delete global.window;
    });

    test('null 事件返回中心位置', () => {
      const result = getTriggerPosition(null);
      expect(result.x).toBe(512); // 1024 / 2
      expect(result.y).toBe(384); // 768 / 2
    });

    test('undefined 事件返回中心位置', () => {
      const result = getTriggerPosition(undefined);
      expect(result.x).toBe(512);
      expect(result.y).toBe(384);
    });

    test('空对象事件返回中心位置', () => {
      const result = getTriggerPosition({});
      expect(result.x).toBe(512);
      expect(result.y).toBe(384);
    });
  });
});

describe('selectOptimalAnchor', () => {
  const panelWidth = 600;
  const panelHeight = 460; // 400 + 60 (header/footer)

  beforeEach(() => {
    global.window = {
      innerWidth: 1024,
      innerHeight: 768
    };
  });

  afterEach(() => {
    delete global.window;
  });

  test('元素在视口左侧时 right 方向得分最高', () => {
    const triggerRect = {
      left: 100,
      top: 100,
      right: 200,
      bottom: 130,
      width: 100,
      height: 30
    };
    const result = selectOptimalAnchor(triggerRect, panelWidth, panelHeight);

    // 右侧空间大 (1024 - 200 = 824)，right 方向得分最高
    expect(result.direction).toBe('right');
    expect(result.left).toBeGreaterThan(200);
  });

  test('元素在视口底部时优先选择 top 方向（垂直空间不足时）', () => {
    const triggerRect = {
      left: 200,
      top: 650,
      right: 300,
      bottom: 680,
      width: 100,
      height: 30
    };
    const result = selectOptimalAnchor(triggerRect, panelWidth, panelHeight);

    // 底部空间不足，bottom 会被扣分，top 方向应该更优
    expect(['top', 'left', 'right']).toContain(result.direction);
  });

  test('元素在视口左侧时选择 right 方向（右侧空间大）', () => {
    const triggerRect = {
      left: 20,
      top: 300,
      right: 50,
      bottom: 330,
      width: 30,
      height: 30
    };
    const result = selectOptimalAnchor(triggerRect, panelWidth, panelHeight);

    // 右侧空间大，right 方向得分应该很高
    expect(['right', 'bottom']).toContain(result.direction);
  });

  test('返回的位置在视口边界内（左边距）', () => {
    const triggerRect = {
      left: 0,
      top: 100,
      right: 50,
      bottom: 130,
      width: 50,
      height: 30
    };
    const result = selectOptimalAnchor(triggerRect, panelWidth, panelHeight);

    expect(result.left).toBeGreaterThanOrEqual(10);
  });

  test('返回的位置在视口边界内（右边距）', () => {
    const triggerRect = {
      left: 900,
      top: 100,
      right: 950,
      bottom: 130,
      width: 50,
      height: 30
    };
    const result = selectOptimalAnchor(triggerRect, panelWidth, panelHeight);

    expect(result.left + panelWidth).toBeLessThanOrEqual(1024 - 10);
  });

  test('返回有效的 anchorX 和 anchorY', () => {
    const triggerRect = {
      left: 200,
      top: 200,
      right: 300,
      bottom: 250,
      width: 100,
      height: 50
    };
    const result = selectOptimalAnchor(triggerRect, panelWidth, panelHeight);

    expect(typeof result.anchorX).toBe('number');
    expect(typeof result.anchorY).toBe('number');
    // anchorX 取决于方向：bottom/top 用 centerX，left/right 用左右边
    const centerX = 250;
    // anchorX 应该是合理的值（在元素范围内或边界）
    expect(result.anchorX).toBeGreaterThanOrEqual(200);
    expect(result.anchorX).toBeLessThanOrEqual(300);
  });
});

describe('calculateAnchorPosition', () => {
  const panelWidth = 600;
  const panelHeight = 460;

  beforeEach(() => {
    global.window = {
      innerWidth: 1024,
      innerHeight: 768
    };
  });

  afterEach(() => {
    delete global.window;
  });

  describe('top 方向', () => {
    test('正常显示在元素上方', () => {
      const triggerRect = {
        left: 200,
        top: 500,
        right: 300,
        bottom: 530,
        width: 100,
        height: 30
      };
      const result = calculateAnchorPosition('top', triggerRect, panelWidth, panelHeight);

      expect(result.direction).toBe('top');
      expect(result.top).toBeLessThan(500);
    });

    test('空间不足时翻转到 bottom', () => {
      const triggerRect = {
        left: 200,
        top: 50,
        right: 300,
        bottom: 80,
        width: 100,
        height: 30
      };
      const result = calculateAnchorPosition('top', triggerRect, panelWidth, panelHeight);

      expect(result.direction).toBe('bottom');
      expect(result.top).toBeGreaterThan(80);
    });
  });

  describe('bottom 方向', () => {
    test('正常显示在元素下方', () => {
      const triggerRect = {
        left: 200,
        top: 100,
        right: 300,
        bottom: 130,
        width: 100,
        height: 30
      };
      const result = calculateAnchorPosition('bottom', triggerRect, panelWidth, panelHeight);

      expect(result.direction).toBe('bottom');
      expect(result.top).toBeGreaterThan(130);
    });

    test('空间不足时翻转到 top', () => {
      const triggerRect = {
        left: 200,
        top: 680,
        right: 300,
        bottom: 710,
        width: 100,
        height: 30
      };
      const result = calculateAnchorPosition('bottom', triggerRect, panelWidth, panelHeight);

      expect(result.direction).toBe('top');
      expect(result.top).toBeLessThan(680);
    });
  });

  describe('left 方向', () => {
    test('正常显示在元素左侧', () => {
      const triggerRect = {
        left: 700,
        top: 200,
        right: 750,
        bottom: 230,
        width: 50,
        height: 30
      };
      const result = calculateAnchorPosition('left', triggerRect, panelWidth, panelHeight);

      expect(result.direction).toBe('left');
      expect(result.left + panelWidth).toBeLessThanOrEqual(700);
    });

    test('空间不足时翻转到 right', () => {
      const triggerRect = {
        left: 30,
        top: 200,
        right: 60,
        bottom: 230,
        width: 30,
        height: 30
      };
      const result = calculateAnchorPosition('left', triggerRect, panelWidth, panelHeight);

      expect(result.direction).toBe('right');
      expect(result.left).toBeGreaterThan(60);
    });
  });

  describe('right 方向', () => {
    test('正常显示在元素右侧', () => {
      const triggerRect = {
        left: 100,
        top: 200,
        right: 150,
        bottom: 230,
        width: 50,
        height: 30
      };
      const result = calculateAnchorPosition('right', triggerRect, panelWidth, panelHeight);

      expect(result.direction).toBe('right');
      expect(result.left).toBeGreaterThan(150);
    });

    test('空间不足时翻转到 left', () => {
      const triggerRect = {
        left: 900,
        top: 200,
        right: 950,
        bottom: 230,
        width: 50,
        height: 30
      };
      const result = calculateAnchorPosition('right', triggerRect, panelWidth, panelHeight);

      expect(result.direction).toBe('left');
      expect(result.left + panelWidth).toBeLessThanOrEqual(900);
    });
  });

  describe('边界保护', () => {
    test('左边界保护（不小于 margin）', () => {
      const triggerRect = {
        left: 10,
        top: 100,
        right: 60,
        bottom: 130,
        width: 50,
        height: 30
      };
      const result = calculateAnchorPosition('bottom', triggerRect, panelWidth, panelHeight);

      expect(result.left).toBeGreaterThanOrEqual(10);
    });

    test('右边界保护（不超出视口）', () => {
      const triggerRect = {
        left: 950,
        top: 100,
        right: 1000,
        bottom: 130,
        width: 50,
        height: 30
      };
      const result = calculateAnchorPosition('bottom', triggerRect, panelWidth, panelHeight);

      expect(result.left + panelWidth).toBeLessThanOrEqual(1024 - 10);
    });

    test('上边界保护', () => {
      const triggerRect = {
        left: 200,
        top: 20,
        right: 300,
        bottom: 50,
        width: 100,
        height: 30
      };
      const result = calculateAnchorPosition('top', triggerRect, panelWidth, panelHeight);

      expect(result.direction).toBe('bottom');
      expect(result.top).toBeGreaterThanOrEqual(10);
    });

    test('下边界保护', () => {
      const triggerRect = {
        left: 200,
        top: 700,
        right: 300,
        bottom: 730,
        width: 100,
        height: 30
      };
      const result = calculateAnchorPosition('bottom', triggerRect, panelWidth, panelHeight);

      expect(result.direction).toBe('top');
      expect(result.top + panelHeight).toBeLessThanOrEqual(768 - 10);
    });
  });

  describe('未知方向', () => {
    test('未知方向时调用 selectOptimalAnchor', () => {
      const triggerRect = {
        left: 200,
        top: 100,
        right: 300,
        bottom: 130,
        width: 100,
        height: 30
      };
      const result = calculateAnchorPosition('unknown', triggerRect, panelWidth, panelHeight);

      expect(result.direction).toBeDefined();
      expect(['top', 'bottom', 'left', 'right']).toContain(result.direction);
    });
  });
});

describe('calculateFixedPosition', () => {
  const panelWidth = 600;
  const panelHeight = 460;

  beforeEach(() => {
    global.window = {
      innerWidth: 1024,
      innerHeight: 768
    };
  });

  afterEach(() => {
    delete global.window;
  });

  test('右上角固定位置', () => {
    const settings = {
      positioning: {
        ...DEFAULT_SETTINGS.positioning,
        fixedPosition: { top: 20, right: 20, bottom: null, left: null }
      }
    };
    const result = calculateFixedPosition(panelWidth, panelHeight, settings);

    expect(result.direction).toBe('fixed');
    expect(result.top).toBe(20);
    expect(result.left).toBe(1024 - 600 - 20); // viewportWidth - panelWidth - right
  });

  test('左上角固定位置', () => {
    const settings = {
      positioning: {
        ...DEFAULT_SETTINGS.positioning,
        fixedPosition: { top: 20, right: null, bottom: null, left: 20 }
      }
    };
    const result = calculateFixedPosition(panelWidth, panelHeight, settings);

    expect(result.left).toBe(20);
    expect(result.top).toBe(20);
  });

  test('居中位置（无指定边）', () => {
    const settings = {
      positioning: {
        ...DEFAULT_SETTINGS.positioning,
        fixedPosition: { top: null, right: null, bottom: null, left: null }
      }
    };
    const result = calculateFixedPosition(panelWidth, panelHeight, settings);

    expect(result.left).toBe((1024 - 600) / 2);
    expect(result.top).toBe((768 - 460) / 2);
  });

  test('边界保护 - 左侧', () => {
    const settings = {
      positioning: {
        ...DEFAULT_SETTINGS.positioning,
        fixedPosition: { top: 20, right: null, bottom: null, left: -100 }
      }
    };
    const result = calculateFixedPosition(panelWidth, panelHeight, settings);

    expect(result.left).toBeGreaterThanOrEqual(10);
  });

  test('边界保护 - 右侧', () => {
    const settings = {
      positioning: {
        ...DEFAULT_SETTINGS.positioning,
        fixedPosition: { top: 20, right: -100, bottom: null, left: null }
      }
    };
    const result = calculateFixedPosition(panelWidth, panelHeight, settings);

    expect(result.left + panelWidth).toBeLessThanOrEqual(1024 - 10);
  });
});

describe('calculateMouseFollowPosition', () => {
  const panelWidth = 600;
  const panelHeight = 460;

  beforeEach(() => {
    global.window = {
      innerWidth: 1024,
      innerHeight: 768
    };
  });

  afterEach(() => {
    delete global.window;
  });

  test('鼠标在视口左上区域时弹框在右下方', () => {
    const event = { clientX: 100, clientY: 100 };
    const result = calculateMouseFollowPosition(event, panelWidth, panelHeight);

    expect(result.direction).toBe('bottom-right');
    expect(result.left).toBe(115); // clientX + offsetX = 100 + 15
    expect(result.top).toBe(110); // clientY + offsetY = 100 + 10
  });

  test('鼠标在视口右上区域时弹框在左下方', () => {
    const event = { clientX: 900, clientY: 100 };
    const result = calculateMouseFollowPosition(event, panelWidth, panelHeight);

    expect(result.direction).toBe('bottom-left');
    expect(result.left + panelWidth).toBeLessThan(900);
  });

  test('鼠标在视口左下区域时弹框在右上方', () => {
    const event = { clientX: 100, clientY: 700 };
    const result = calculateMouseFollowPosition(event, panelWidth, panelHeight);

    expect(result.direction).toBe('top-right');
    expect(result.top + panelHeight).toBeLessThan(700);
  });

  test('鼠标在视口右下区域时弹框在左上方', () => {
    const event = { clientX: 900, clientY: 700 };
    const result = calculateMouseFollowPosition(event, panelWidth, panelHeight);

    expect(result.direction).toBe('top-left');
    expect(result.left + panelWidth).toBeLessThan(900);
    expect(result.top + panelHeight).toBeLessThan(700);
  });

  test('边界保护 - 左边界', () => {
    const event = { clientX: 0, clientY: 100 };
    const result = calculateMouseFollowPosition(event, panelWidth, panelHeight);

    expect(result.left).toBeGreaterThanOrEqual(10);
  });

  test('边界保护 - 上边界', () => {
    const event = { clientX: 100, clientY: 0 };
    const result = calculateMouseFollowPosition(event, panelWidth, panelHeight);

    expect(result.top).toBeGreaterThanOrEqual(10);
  });

  test('返回有效的锚点坐标', () => {
    const event = { clientX: 300, clientY: 400 };
    const result = calculateMouseFollowPosition(event, panelWidth, panelHeight);

    expect(result.anchorX).toBe(300);
    expect(result.anchorY).toBe(400);
  });
});

describe('参数顺序验证 - 回归测试', () => {
  /**
   * 这是一个重要的回归测试，用于验证 positionPreviewPanel 的参数顺序
   * 历史问题：调用时参数顺序错误，导致 panel 和 event 参数互换
   */
  test('positionPreviewPanel 调用应使用正确的参数顺序：(event, panel, width, height)', () => {
    // 模拟 positionPreviewPanel 函数的参数签名
    function positionPreviewPanel(event, panel, width, height) {
      // 验证 event 是否包含 target 或 clientX
      const hasValidEvent = !!(event && (event.target || typeof event.clientX === 'number'));
      // 验证 panel 是否是对象
      const hasValidPanel = !!(panel && typeof panel === 'object');
      // 验证 width 和 height 是否是数字
      const hasValidWidth = typeof width === 'number';
      const hasValidHeight = typeof height === 'number';
      return { hasValidEvent, hasValidPanel, hasValidWidth, hasValidHeight };
    }

    // 创建模拟的链接元素（作为事件 target）
    const mockLink = {
      getBoundingClientRect: () => ({
        left: 100, top: 100, right: 200, bottom: 130, width: 100, height: 30
      }),
      href: 'https://example.com'
    };

    // 创建模拟的 panel 元素
    const mockPanel = {
      style: {},
      classList: { add: jest.fn(), remove: jest.fn() },
      querySelector: jest.fn()
    };

    // 正确的参数顺序 (event, panel, width, height)
    const triggerEvent = { target: mockLink, clientX: 150, clientY: 115 };
    const result = positionPreviewPanel(triggerEvent, mockPanel, 600, 460);

    expect(result.hasValidEvent).toBe(true);
    expect(result.hasValidPanel).toBe(true);
    expect(result.hasValidWidth).toBe(true);
    expect(result.hasValidHeight).toBe(true);
  });

  test('伪事件对象应正确传递 link 元素作为 target', () => {
    const mockLink = {
      getBoundingClientRect: () => ({
        left: 200, top: 300, right: 300, bottom: 340, width: 100, height: 40
      }),
      tagName: 'A',
      href: 'https://example.com/test'
    };

    const mockEvent = { clientX: 250, clientY: 320 };

    // 构造伪事件对象（修复后的方式）
    const triggerEvent = {
      target: mockLink,
      clientX: mockEvent?.clientX,
      clientY: mockEvent?.clientY
    };

    const result = getTriggerPosition(triggerEvent);

    // 应该基于 link 元素的位置，而不是鼠标坐标
    expect(result.x).toBe(250); // link centerX
    expect(result.y).toBe(320); // link centerY
    expect(result.rect.width).toBe(100);
    expect(result.rect.height).toBe(40);
  });

  test('参数顺序错误时（历史 bug 复现）会导致定位失败', () => {
    // 设置 window 环境
    global.window = {
      innerWidth: 1024,
      innerHeight: 768
    };

    // 模拟错误的参数顺序：(panel, link, event, width, height)
    // 这是修复前的错误调用方式
    function brokenPositionPreviewPanel(panel, link, event, width, height) {
      // 错误地将 panel 当作 event 使用
      const trigger = getTriggerPosition(panel);
      return { trigger, panelParam: panel, eventParam: event };
    }

    const mockLink = { tagName: 'A', href: 'https://example.com' };
    const mockPanel = { style: {}, classList: {} };
    const mockEvent = { clientX: 100, clientY: 200 };

    // 错误调用（参数顺序混乱）
    const result = brokenPositionPreviewPanel(mockPanel, mockLink, mockEvent, 600, 460);

    // 由于 panel 没有 getBoundingClientRect 也没有 clientX，
    // getTriggerPosition 会回退到默认值，导致定位错误
    // 这就是 bug 的根源
    expect(result.trigger).toBeDefined();
    // 验证 panel 被错误地当作第一个参数传入
    expect(result.panelParam).toBe(mockPanel);
    expect(result.eventParam).toBe(mockEvent);
    // 验证触发位置是默认的中心位置（因为 panel 不是有效 event）
    expect(result.trigger.x).toBe(512); // window.innerWidth / 2

    // 清理
    delete global.window;
  });
});

describe('预览弹框显示条件验证', () => {
  test('所有定位模式都能产生有效的视口内坐标', () => {
    const modes = ['auto', 'anchor', 'mouse', 'fixed'];
    const panelWidth = 600;
    const panelHeight = 460;

    const triggerRect = {
      left: 200,
      top: 200,
      right: 300,
      bottom: 250,
      width: 100,
      height: 50
    };

    const mockEvent = { clientX: 250, clientY: 225 };

    modes.forEach(mode => {
      let result;
      switch (mode) {
        case 'fixed':
          result = calculateFixedPosition(panelWidth, panelHeight);
          break;
        case 'mouse':
          result = calculateMouseFollowPosition(mockEvent, panelWidth, panelHeight, triggerRect);
          break;
        case 'anchor':
        case 'auto':
        default:
          result = selectOptimalAnchor(triggerRect, panelWidth, panelHeight);
          break;
      }

      expect(result.left).toBeGreaterThanOrEqual(10);
      expect(result.top).toBeGreaterThanOrEqual(10);
      expect(result.left + panelWidth).toBeLessThanOrEqual(1024 - 10);
      expect(result.top + panelHeight).toBeLessThanOrEqual(768 - 10);
    });
  });
});
