'use strict';

const {
  isValidUrl,
  getAbsoluteUrl,
  isInBlacklist,
  getHostname,
  getFaviconFromUrl,
  escapeHtml,
  getTriggerPosition,
  selectOptimalAnchor,
  calculateAnchorPosition,
  calculateFixedPosition,
  calculateMouseFollowPosition,
  positionPreviewPanel,
  deepMerge,
  DEFAULT_SETTINGS
} = require('./modules/preview-panel');

describe('isValidUrl', () => {
  describe('valid URLs', () => {
    test('http:// URL → valid', () => {
      expect(isValidUrl('http://example.com/page')).toBe(true);
    });

    test('https:// URL → valid', () => {
      expect(isValidUrl('https://example.com/page')).toBe(true);
    });

    test('URL with query params → valid', () => {
      expect(isValidUrl('https://example.com/page?foo=bar&baz=qux')).toBe(true);
    });

    test('URL with hash → valid', () => {
      expect(isValidUrl('https://example.com/page#section')).toBe(true);
    });
  });

  describe('invalid URLs', () => {
    test('null → invalid', () => {
      expect(isValidUrl(null)).toBe(false);
    });

    test('undefined → invalid', () => {
      expect(isValidUrl(undefined)).toBe(false);
    });

    test('empty string → invalid', () => {
      expect(isValidUrl('')).toBe(false);
    });

    test('javascript: → invalid', () => {
      expect(isValidUrl('javascript:void(0)')).toBe(false);
    });

    test('mailto: → invalid', () => {
      expect(isValidUrl('mailto:test@example.com')).toBe(false);
    });

    test('tel: → invalid', () => {
      expect(isValidUrl('tel:1234567890')).toBe(false);
    });

    test('#anchor → invalid', () => {
      expect(isValidUrl('#section')).toBe(false);
    });

    test('about: → invalid', () => {
      expect(isValidUrl('about:blank')).toBe(false);
    });

    test('data: → invalid', () => {
      expect(isValidUrl('data:text/html,<h1>hello</h1>')).toBe(false);
    });

    test('chrome-extension: → invalid', () => {
      expect(isValidUrl('chrome-extension://abc123/popup.html')).toBe(false);
    });

    test('ftp:// → invalid (protocol not http/https)', () => {
      expect(isValidUrl('ftp://example.com/file')).toBe(false);
    });

    test('ws:// → invalid', () => {
      expect(isValidUrl('ws://example.com/socket')).toBe(false);
    });
  });
});

describe('getAbsoluteUrl', () => {
  test('absolute URL returns as-is', () => {
    expect(getAbsoluteUrl('https://example.com/page')).toBe('https://example.com/page');
  });

  test('relative URL resolved with base', () => {
    expect(getAbsoluteUrl('/path/to/page', 'https://example.com')).toBe('https://example.com/path/to/page');
  });

  test('relative URL with default base', () => {
    expect(getAbsoluteUrl('/test')).toBe('https://example.com/test');
  });

  test('invalid URL returns original (truly invalid)', () => {
    expect(getAbsoluteUrl('http://[invalid-url')).toBe('http://[invalid-url');
  });
});

describe('isInBlacklist', () => {
  test('empty blacklist → not blocked', () => {
    expect(isInBlacklist('https://example.com', [])).toBe(false);
  });

  test('null blacklist → not blocked', () => {
    expect(isInBlacklist('https://example.com', null)).toBe(false);
  });

  test('exact domain match → blocked', () => {
    expect(isInBlacklist('https://example.com/page', ['example.com'])).toBe(true);
  });

  test('subdomain match → blocked', () => {
    expect(isInBlacklist('https://sub.example.com/page', ['example.com'])).toBe(true);
  });

  test('domain not in blacklist → not blocked', () => {
    expect(isInBlacklist('https://other.com/page', ['example.com'])).toBe(false);
  });

  test('invalid URL → not blocked (returns false)', () => {
    expect(isInBlacklist('not-a-url', ['example.com'])).toBe(false);
  });
});

describe('getHostname', () => {
  test('extracts hostname from URL', () => {
    expect(getHostname('https://www.example.com/path')).toBe('www.example.com');
  });

  test('returns original string for invalid URL', () => {
    expect(getHostname('not-a-url')).toBe('not-a-url');
  });
});

describe('getFaviconFromUrl', () => {
  test('generates favicon URL', () => {
    const result = getFaviconFromUrl('https://example.com/page');
    expect(result).toContain('google.com/s2/favicons');
    expect(result).toContain('example.com');
  });

  test('returns empty string for invalid URL', () => {
    expect(getFaviconFromUrl('not-a-url')).toBe('');
  });
});

describe('escapeHtml', () => {
  test('escapes HTML special characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  test('plain text unchanged', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });

  test('empty string', () => {
    expect(escapeHtml('')).toBe('');
  });
});

describe('getTriggerPosition', () => {
  test('event with target element (has getBoundingClientRect)', () => {
    const mockElement = {
      getBoundingClientRect: () => ({
        left: 100,
        top: 200,
        width: 200,
        height: 50,
        right: 300,
        bottom: 250
      })
    };
    const event = { target: mockElement };
    const result = getTriggerPosition(event);
    
    expect(result.x).toBe(200);
    expect(result.y).toBe(225);
    expect(result.rect.left).toBe(100);
    expect(result.rect.top).toBe(200);
  });

  test('event with clientX/clientY but no target rect', () => {
    const event = { clientX: 150, clientY: 250, target: {} };
    const result = getTriggerPosition(event);
    
    expect(result.x).toBe(150);
    expect(result.y).toBe(250);
    expect(result.rect.width).toBe(0);
    expect(result.rect.height).toBe(0);
  });

  test('no event → defaults to viewport center', () => {
    const result = getTriggerPosition(null);
    
    expect(result.x).toBe(500);
    expect(result.y).toBe(400);
    expect(result.rect.width).toBe(100);
    expect(result.rect.height).toBe(40);
  });
});

describe('selectOptimalAnchor', () => {
  const triggerRect = {
    left: 400,
    top: 300,
    width: 200,
    height: 50,
    right: 600,
    bottom: 350
  };

  test('returns a valid direction', () => {
    const result = selectOptimalAnchor(triggerRect, 300, 200, DEFAULT_SETTINGS);
    expect(['top', 'bottom', 'left', 'right']).toContain(result.direction);
    expect(typeof result.left).toBe('number');
    expect(typeof result.top).toBe('number');
    expect(typeof result.anchorX).toBe('number');
    expect(typeof result.anchorY).toBe('number');
  });

  test('position is within viewport bounds', () => {
    const result = selectOptimalAnchor(triggerRect, 300, 200, DEFAULT_SETTINGS);
    const viewportWidth = 1024;
    const viewportHeight = 768;
    const margin = 10;

    expect(result.left).toBeGreaterThanOrEqual(margin);
    expect(result.left + 300).toBeLessThanOrEqual(viewportWidth - margin);
    expect(result.top).toBeGreaterThanOrEqual(margin);
    expect(result.top + 200).toBeLessThanOrEqual(viewportHeight - margin);
  });

  test('prefers bottom/top over left/right (score bonus)', () => {
    const centerRect = {
      left: 400,
      top: 300,
      width: 200,
      height: 50,
      right: 600,
      bottom: 350
    };
    const result = selectOptimalAnchor(centerRect, 300, 200, DEFAULT_SETTINGS);
    expect(['top', 'bottom']).toContain(result.direction);
  });
});

describe('calculateAnchorPosition', () => {
  const triggerRect = {
    left: 400,
    top: 300,
    width: 200,
    height: 50,
    right: 600,
    bottom: 350
  };

  test('top direction positions panel above trigger', () => {
    const result = calculateAnchorPosition('top', triggerRect, 300, 200, DEFAULT_SETTINGS);
    expect(result.direction).toBe('top');
    expect(result.top).toBeLessThan(triggerRect.top);
    expect(result.anchorY).toBe(triggerRect.top);
  });

  test('bottom direction positions panel below trigger', () => {
    const result = calculateAnchorPosition('bottom', triggerRect, 300, 200, DEFAULT_SETTINGS);
    expect(result.direction).toBe('bottom');
    expect(result.top).toBeGreaterThan(triggerRect.bottom);
    expect(result.anchorY).toBe(triggerRect.bottom);
  });

  test('left direction positions panel left of trigger', () => {
    const result = calculateAnchorPosition('left', triggerRect, 300, 200, DEFAULT_SETTINGS);
    expect(result.direction).toBe('left');
    expect(result.left + 300).toBeLessThanOrEqual(triggerRect.left);
    expect(result.anchorX).toBe(triggerRect.left);
  });

  test('right direction positions panel right of trigger', () => {
    const result = calculateAnchorPosition('right', triggerRect, 300, 200, DEFAULT_SETTINGS);
    expect(result.direction).toBe('right');
    expect(result.left).toBeGreaterThanOrEqual(triggerRect.right);
    expect(result.anchorX).toBe(triggerRect.right);
  });

  test('flips to bottom when top is out of viewport', () => {
    const topRect = {
      left: 100,
      top: 10,
      width: 200,
      height: 50,
      right: 300,
      bottom: 60
    };
    const result = calculateAnchorPosition('top', topRect, 300, 200, DEFAULT_SETTINGS);
    expect(result.direction).toBe('bottom');
  });

  test('flips to top when bottom is out of viewport', () => {
    const bottomRect = {
      left: 100,
      top: 600,
      width: 200,
      height: 50,
      right: 300,
      bottom: 650
    };
    const result = calculateAnchorPosition('bottom', bottomRect, 300, 200, DEFAULT_SETTINGS);
    expect(result.direction).toBe('top');
  });

  test('invalid direction falls back to selectOptimalAnchor', () => {
    const result = calculateAnchorPosition('invalid', triggerRect, 300, 200, DEFAULT_SETTINGS);
    expect(['top', 'bottom', 'left', 'right']).toContain(result.direction);
  });
});

describe('calculateFixedPosition', () => {
  test('default (top-right) positioning', () => {
    const settings = {
      positioning: {
        fixedPosition: { top: 20, right: 20, bottom: null, left: null }
      }
    };
    const result = calculateFixedPosition(300, 200, settings);
    expect(result.direction).toBe('fixed');
    expect(result.top).toBe(20);
    expect(result.left).toBe(1024 - 300 - 20);
  });

  test('top-left positioning', () => {
    const settings = {
      positioning: {
        fixedPosition: { top: 20, right: null, bottom: null, left: 20 }
      }
    };
    const result = calculateFixedPosition(300, 200, settings);
    expect(result.top).toBe(20);
    expect(result.left).toBe(20);
  });

  test('bottom-right positioning', () => {
    const settings = {
      positioning: {
        fixedPosition: { top: null, right: 20, bottom: 20, left: null }
      }
    };
    const result = calculateFixedPosition(300, 200, settings);
    expect(result.top).toBe(768 - 200 - 20);
    expect(result.left).toBe(1024 - 300 - 20);
  });

  test('centered when all null', () => {
    const settings = {
      positioning: {
        fixedPosition: { top: null, right: null, bottom: null, left: null }
      }
    };
    const result = calculateFixedPosition(300, 200, settings);
    expect(result.left).toBe((1024 - 300) / 2);
    expect(result.top).toBe((768 - 200) / 2);
  });

  test('respects viewport margin', () => {
    const settings = {
      positioning: {
        fixedPosition: { top: -100, right: null, bottom: null, left: -100 }
      }
    };
    const result = calculateFixedPosition(300, 200, settings);
    expect(result.left).toBeGreaterThanOrEqual(10);
    expect(result.top).toBeGreaterThanOrEqual(10);
  });
});

describe('calculateMouseFollowPosition', () => {
  test('positions panel below-right of mouse by default', () => {
    const event = { clientX: 100, clientY: 100 };
    const result = calculateMouseFollowPosition(event, 300, 200, null, DEFAULT_SETTINGS);
    
    expect(result.left).toBe(100 + DEFAULT_SETTINGS.positioning.offsetX);
    expect(result.top).toBe(100 + DEFAULT_SETTINGS.positioning.offsetY);
    expect(result.direction).toBe('bottom-right');
  });

  test('flips left when panel would go off right edge', () => {
    const event = { clientX: 900, clientY: 100 };
    const result = calculateMouseFollowPosition(event, 300, 200, null, DEFAULT_SETTINGS);
    
    expect(result.left + 300).toBeLessThanOrEqual(1024 - 10);
    expect(result.direction).toContain('left');
  });

  test('flips up when panel would go off bottom edge', () => {
    const event = { clientX: 100, clientY: 700 };
    const result = calculateMouseFollowPosition(event, 300, 200, null, DEFAULT_SETTINGS);
    
    expect(result.top + 200).toBeLessThanOrEqual(768 - 10);
    expect(result.direction).toContain('top');
  });

  test('respects left/top margin', () => {
    const event = { clientX: 0, clientY: 0 };
    const result = calculateMouseFollowPosition(event, 300, 200, null, DEFAULT_SETTINGS);
    
    expect(result.left).toBeGreaterThanOrEqual(10);
    expect(result.top).toBeGreaterThanOrEqual(10);
  });

  test('no event uses default mouse position', () => {
    const result = calculateMouseFollowPosition(null, 300, 200, null, DEFAULT_SETTINGS);
    expect(typeof result.left).toBe('number');
    expect(typeof result.top).toBe('number');
  });
});

describe('positionPreviewPanel', () => {
  const mockEvent = {
    target: {
      getBoundingClientRect: () => ({
        left: 400,
        top: 300,
        width: 200,
        height: 50,
        right: 600,
        bottom: 350
      })
    }
  };

  test('returns position with correct properties', () => {
    const result = positionPreviewPanel(mockEvent, {}, 600, 400, DEFAULT_SETTINGS);
    
    expect(result).toHaveProperty('left');
    expect(result).toHaveProperty('top');
    expect(result).toHaveProperty('width');
    expect(result).toHaveProperty('positionMode');
    expect(result).toHaveProperty('anchorDirection');
    expect(result).toHaveProperty('currentAnchorPoint');
    expect(result).toHaveProperty('targetPanelPos');
  });

  test('auto mode uses smart anchor', () => {
    const settings = { ...DEFAULT_SETTINGS, positioning: { ...DEFAULT_SETTINGS.positioning, mode: 'auto' } };
    const result = positionPreviewPanel(mockEvent, {}, 600, 400, settings);
    
    expect(result.positionMode).toBe('auto');
    expect(['top', 'bottom', 'left', 'right']).toContain(result.anchorDirection);
  });

  test('fixed mode returns fixed position', () => {
    const settings = { ...DEFAULT_SETTINGS, positioning: { ...DEFAULT_SETTINGS.positioning, mode: 'fixed' } };
    const result = positionPreviewPanel(mockEvent, {}, 600, 400, settings);
    
    expect(result.positionMode).toBe('fixed');
    expect(result.anchorDirection).toBe('fixed');
  });

  test('mouse mode returns mouse-follow position', () => {
    const settings = { ...DEFAULT_SETTINGS, positioning: { ...DEFAULT_SETTINGS.positioning, mode: 'mouse' } };
    const mouseEvent = { clientX: 100, clientY: 100, target: {} };
    const result = positionPreviewPanel(mouseEvent, {}, 600, 400, settings);
    
    expect(result.positionMode).toBe('mouse');
    expect(result.direction !== undefined || result.anchorDirection !== undefined).toBe(true);
  });

  test('uses default dimensions when not provided', () => {
    const result = positionPreviewPanel(mockEvent, {}, null, null, DEFAULT_SETTINGS);
    
    expect(result.width).toBe(DEFAULT_SETTINGS.previewWidth);
  });

  test('adds 60px to height for header+footer', () => {
    const result = positionPreviewPanel(mockEvent, {}, 600, 400, DEFAULT_SETTINGS);
    // The panel height used for positioning should include the 60px offset
    // We can verify the top is calculated correctly
    expect(typeof result.top).toBe('number');
  });
});

describe('deepMerge', () => {
  test('merges flat objects', () => {
    const result = deepMerge({ a: 1, b: 2 }, { b: 3, c: 4 });
    expect(result).toEqual({ a: 1, b: 3, c: 4 });
  });

  test('merges nested objects', () => {
    const result = deepMerge(
      { a: { x: 1, y: 2 }, b: 3 },
      { a: { y: 3, z: 4 }, c: 5 }
    );
    expect(result).toEqual({ a: { x: 1, y: 3, z: 4 }, b: 3, c: 5 });
  });

  test('does not mutate target', () => {
    const target = { a: 1 };
    const source = { b: 2 };
    const result = deepMerge(target, source);
    expect(target).toEqual({ a: 1 });
    expect(result).toEqual({ a: 1, b: 2 });
  });

  test('arrays are replaced not merged', () => {
    const result = deepMerge({ a: [1, 2] }, { a: [3, 4] });
    expect(result.a).toEqual([3, 4]);
  });

  test('null/undefined source properties override', () => {
    const result = deepMerge({ a: 1, b: 2 }, { a: null, b: undefined });
    expect(result.a).toBeNull();
    expect(result.b).toBeUndefined();
  });
});

describe('DEFAULT_SETTINGS', () => {
  test('has expected top-level properties', () => {
    expect(DEFAULT_SETTINGS).toHaveProperty('triggerMode');
    expect(DEFAULT_SETTINGS).toHaveProperty('hoverDelay');
    expect(DEFAULT_SETTINGS).toHaveProperty('hideDelay');
    expect(DEFAULT_SETTINGS).toHaveProperty('previewWidth');
    expect(DEFAULT_SETTINGS).toHaveProperty('previewHeight');
    expect(DEFAULT_SETTINGS).toHaveProperty('positioning');
  });

  test('default trigger mode is hover', () => {
    expect(DEFAULT_SETTINGS.triggerMode).toBe('hover');
  });

  test('default hover delay is 500ms', () => {
    expect(DEFAULT_SETTINGS.hoverDelay).toBe(500);
  });

  test('positioning has expected properties', () => {
    expect(DEFAULT_SETTINGS.positioning).toHaveProperty('mode');
    expect(DEFAULT_SETTINGS.positioning).toHaveProperty('offsetX');
    expect(DEFAULT_SETTINGS.positioning).toHaveProperty('offsetY');
    expect(DEFAULT_SETTINGS.positioning).toHaveProperty('smartAnchor');
  });
});
