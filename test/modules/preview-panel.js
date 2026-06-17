'use strict';

function isValidUrl(url) {
  if (!url) return false;
  if (url.startsWith('javascript:')) return false;
  if (url.startsWith('mailto:')) return false;
  if (url.startsWith('tel:')) return false;
  if (url.startsWith('#')) return false;
  if (url.startsWith('about:')) return false;
  if (url.startsWith('data:')) return false;
  if (url.startsWith('chrome-extension:')) return false;
  try {
    const urlObj = new URL(url, 'https://example.com');
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

function getAbsoluteUrl(url, baseUrl) {
  try {
    return new URL(url, baseUrl || 'https://example.com').href;
  } catch (e) {
    return url;
  }
}

function isInBlacklist(url, blacklist) {
  if (!blacklist || blacklist.length === 0) return false;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return blacklist.some(domain => hostname.includes(domain.toLowerCase()));
  } catch (e) {
    return false;
  }
}

function getHostname(url) {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return url;
  }
}

function getFaviconFromUrl(url) {
  try {
    const urlObj = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(urlObj.hostname)}&sz=32`;
  } catch (e) {
    return '';
  }
}

function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  const str = String(text);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getTriggerPosition(event) {
  let triggerX, triggerY, triggerRect;

  if (event && event.target && event.target.getBoundingClientRect) {
    triggerRect = event.target.getBoundingClientRect();
    triggerX = triggerRect.left + triggerRect.width / 2;
    triggerY = triggerRect.top + triggerRect.height / 2;
  } else if (event && typeof event.clientX === 'number') {
    triggerX = event.clientX;
    triggerY = event.clientY;
    triggerRect = { left: event.clientX, top: event.clientY, right: event.clientX, bottom: event.clientY, width: 0, height: 0 };
  } else {
    triggerX = typeof window !== 'undefined' ? window.innerWidth / 2 : 500;
    triggerY = typeof window !== 'undefined' ? window.innerHeight / 2 : 400;
    triggerRect = { left: triggerX - 50, top: triggerY - 20, right: triggerX + 50, bottom: triggerY + 20, width: 100, height: 40 };
  }

  return { x: triggerX, y: triggerY, rect: triggerRect };
}

function selectOptimalAnchor(triggerRect, panelWidth, panelHeight, settings) {
  const viewportWidth = (typeof window !== 'undefined' && window.innerWidth) || 1024;
  const viewportHeight = (typeof window !== 'undefined' && window.innerHeight) || 768;
  const margin = 10;
  const offsetX = settings?.positioning?.offsetX ?? 15;
  const offsetY = settings?.positioning?.offsetY ?? 10;

  const directions = [
    { name: 'bottom', score: 0, left: 0, top: 0, anchorX: 0, anchorY: 0 },
    { name: 'top', score: 0, left: 0, top: 0, anchorX: 0, anchorY: 0 },
    { name: 'right', score: 0, left: 0, top: 0, anchorX: 0, anchorY: 0 },
    { name: 'left', score: 0, left: 0, top: 0, anchorX: 0, anchorY: 0 }
  ];

  const triggerCenterX = triggerRect.left + triggerRect.width / 2;
  const triggerCenterY = triggerRect.top + triggerRect.height / 2;

  directions.forEach(dir => {
    let left, top, anchorX, anchorY;

    switch (dir.name) {
      case 'bottom':
        left = triggerRect.left + offsetX;
        top = triggerRect.bottom + offsetY;
        anchorX = triggerCenterX;
        anchorY = triggerRect.bottom;
        if (left + panelWidth > viewportWidth - margin) left = viewportWidth - panelWidth - margin;
        if (left < margin) left = margin;
        if (top + panelHeight > viewportHeight - margin) dir.score -= 50;
        dir.score += Math.max(0, viewportHeight - triggerRect.bottom);
        break;
      case 'top':
        left = triggerRect.left + offsetX;
        top = triggerRect.top - panelHeight - offsetY;
        anchorX = triggerCenterX;
        anchorY = triggerRect.top;
        if (left + panelWidth > viewportWidth - margin) left = viewportWidth - panelWidth - margin;
        if (left < margin) left = margin;
        if (top < margin) dir.score -= 50;
        dir.score += Math.max(0, triggerRect.top);
        break;
      case 'right':
        left = triggerRect.right + offsetX;
        top = triggerRect.top;
        anchorX = triggerRect.right;
        anchorY = triggerCenterY;
        if (left + panelWidth > viewportWidth - margin) dir.score -= 50;
        if (top + panelHeight > viewportHeight - margin) top = viewportHeight - panelHeight - margin;
        if (top < margin) top = margin;
        dir.score += Math.max(0, viewportWidth - triggerRect.right);
        break;
      case 'left':
        left = triggerRect.left - panelWidth - offsetX;
        top = triggerRect.top;
        anchorX = triggerRect.left;
        anchorY = triggerCenterY;
        if (left < margin) dir.score -= 50;
        if (top + panelHeight > viewportHeight - margin) top = viewportHeight - panelHeight - margin;
        if (top < margin) top = margin;
        dir.score += Math.max(0, triggerRect.left);
        break;
    }

    dir.left = left;
    dir.top = top;
    dir.anchorX = anchorX;
    dir.anchorY = anchorY;

    if (dir.name === 'bottom' || dir.name === 'top') {
      dir.score += 20;
    }
  });

  directions.sort((a, b) => b.score - a.score);

  return {
    direction: directions[0].name,
    left: directions[0].left,
    top: directions[0].top,
    anchorX: directions[0].anchorX,
    anchorY: directions[0].anchorY
  };
}

function calculateAnchorPosition(anchorDirection, triggerRect, panelWidth, panelHeight, settings) {
  const viewportWidth = (typeof window !== 'undefined' && window.innerWidth) || 1024;
  const viewportHeight = (typeof window !== 'undefined' && window.innerHeight) || 768;
  const margin = 10;
  const offsetX = settings?.positioning?.offsetX ?? 15;
  const offsetY = settings?.positioning?.offsetY ?? 10;

  const triggerCenterX = triggerRect.left + triggerRect.width / 2;
  const triggerCenterY = triggerRect.top + triggerRect.height / 2;

  let left, top, anchorX, anchorY;

  switch (anchorDirection) {
    case 'top':
      left = triggerCenterX - panelWidth / 2;
      top = triggerRect.top - panelHeight - offsetY;
      anchorX = triggerCenterX;
      anchorY = triggerRect.top;
      if (left < margin) left = margin;
      if (left + panelWidth > viewportWidth - margin) left = viewportWidth - panelWidth - margin;
      if (top < margin) {
        top = triggerRect.bottom + offsetY;
        anchorDirection = 'bottom';
      }
      break;
    case 'bottom':
      left = triggerCenterX - panelWidth / 2;
      top = triggerRect.bottom + offsetY;
      anchorX = triggerCenterX;
      anchorY = triggerRect.bottom;
      if (left < margin) left = margin;
      if (left + panelWidth > viewportWidth - margin) left = viewportWidth - panelWidth - margin;
      if (top + panelHeight > viewportHeight - margin) {
        top = triggerRect.top - panelHeight - offsetY;
        anchorDirection = 'top';
      }
      break;
    case 'left':
      left = triggerRect.left - panelWidth - offsetX;
      top = triggerCenterY - panelHeight / 2;
      anchorX = triggerRect.left;
      anchorY = triggerCenterY;
      if (top < margin) top = margin;
      if (top + panelHeight > viewportHeight - margin) top = viewportHeight - panelHeight - margin;
      if (left < margin) {
        left = triggerRect.right + offsetX;
        anchorDirection = 'right';
      }
      break;
    case 'right':
      left = triggerRect.right + offsetX;
      top = triggerCenterY - panelHeight / 2;
      anchorX = triggerRect.right;
      anchorY = triggerCenterY;
      if (top < margin) top = margin;
      if (top + panelHeight > viewportHeight - margin) top = viewportHeight - panelHeight - margin;
      if (left + panelWidth > viewportWidth - margin) {
        left = triggerRect.left - panelWidth - offsetX;
        anchorDirection = 'left';
      }
      break;
    default:
      return selectOptimalAnchor(triggerRect, panelWidth, panelHeight, settings);
  }

  return { direction: anchorDirection, left, top, anchorX, anchorY };
}

function calculateFixedPosition(panelWidth, panelHeight, settings) {
  const viewportWidth = (typeof window !== 'undefined' && window.innerWidth) || 1024;
  const viewportHeight = (typeof window !== 'undefined' && window.innerHeight) || 768;
  const margin = 10;
  const fixed = settings?.positioning?.fixedPosition || {};

  let left;
  let top;

  if (fixed.left !== null && fixed.left !== undefined) {
    left = fixed.left;
  } else if (fixed.right !== null && fixed.right !== undefined) {
    left = viewportWidth - panelWidth - fixed.right;
  } else {
    left = (viewportWidth - panelWidth) / 2;
  }

  if (fixed.top !== null && fixed.top !== undefined) {
    top = fixed.top;
  } else if (fixed.bottom !== null && fixed.bottom !== undefined) {
    top = viewportHeight - panelHeight - fixed.bottom;
  } else {
    top = (viewportHeight - panelHeight) / 2;
  }

  if (left + panelWidth > viewportWidth - margin) left = viewportWidth - panelWidth - margin;
  if (left < margin) left = margin;
  if (top + panelHeight > viewportHeight - margin) top = viewportHeight - panelHeight - margin;
  if (top < margin) top = margin;

  return { left, top, direction: 'fixed' };
}

function calculateMouseFollowPosition(event, panelWidth, panelHeight, triggerRect, settings) {
  const viewportWidth = (typeof window !== 'undefined' && window.innerWidth) || 1024;
  const viewportHeight = (typeof window !== 'undefined' && window.innerHeight) || 768;
  const margin = 10;
  const offsetX = settings?.positioning?.offsetX ?? 15;
  const offsetY = settings?.positioning?.offsetY ?? 10;

  const mouseX = event ? event.clientX : 500;
  const mouseY = event ? event.clientY : 400;

  let left = mouseX + offsetX;
  let top = mouseY + offsetY;
  let anchorX = mouseX;
  let anchorY = mouseY;
  let direction = 'bottom-right';

  if (left + panelWidth > viewportWidth - margin) {
    left = mouseX - panelWidth - offsetX;
    direction = 'bottom-left';
  }
  if (top + panelHeight > viewportHeight - margin) {
    top = mouseY - panelHeight - offsetY;
    direction = direction.includes('left') ? 'top-left' : 'top-right';
  }
  if (left < margin) left = margin;
  if (top < margin) top = margin;

  return { left, top, anchorX, anchorY, direction };
}

function positionPreviewPanel(event, panel, width, height, settings) {
  const panelWidth = width || settings?.previewWidth || 600;
  const panelHeight = (height || settings?.previewHeight || 400) + 60;
  const posSettings = settings?.positioning || {};
  const trigger = getTriggerPosition(event);

  let result;
  const mode = posSettings.mode || 'auto';

  if (mode === 'fixed') {
    result = calculateFixedPosition(panelWidth, panelHeight, settings);
  } else if (mode === 'mouse') {
    result = calculateMouseFollowPosition(event, panelWidth, panelHeight, trigger.rect, settings);
  } else if (mode === 'anchor') {
    if (posSettings.anchorPosition !== 'auto') {
      result = calculateAnchorPosition(posSettings.anchorPosition, trigger.rect, panelWidth, panelHeight, settings);
    } else if (posSettings.smartAnchor) {
      result = selectOptimalAnchor(trigger.rect, panelWidth, panelHeight, settings);
    } else {
      result = calculateAnchorPosition('bottom', trigger.rect, panelWidth, panelHeight, settings);
    }
  } else {
    if (posSettings.smartAnchor) {
      result = selectOptimalAnchor(trigger.rect, panelWidth, panelHeight, settings);
    } else {
      result = calculateAnchorPosition('bottom', trigger.rect, panelWidth, panelHeight, settings);
    }
  }

  const currentAnchorPoint = {
    x: result.anchorX || trigger.x,
    y: result.anchorY || trigger.y,
    direction: result.direction
  };

  const targetPanelPos = {
    left: result.left,
    top: result.top
  };

  return {
    left: result.left,
    top: result.top,
    width: panelWidth,
    positionMode: mode,
    anchorDirection: result.direction,
    currentAnchorPoint,
    targetPanelPos
  };
}

function deepMerge(target, source) {
  const result = { ...target };
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

const DEFAULT_SETTINGS = {
  triggerMode: 'hover',
  hoverDelay: 500,
  hideDelay: 300,
  previewWidth: 600,
  previewHeight: 400,
  enableVideoPreview: true,
  enableAudioPreview: true,
  enableImagePreview: true,
  enableWebpagePreview: true,
  blacklist: [],
  enableSecurityCheck: true,
  positioning: {
    mode: 'auto',
    anchorPosition: 'auto',
    offsetX: 15,
    offsetY: 10,
    enableMouseFollow: false,
    mouseFollowSensitivity: 0.3,
    smartAnchor: true,
    fixedPosition: {
      top: 20,
      right: 20,
      bottom: null,
      left: null
    },
    showAnchorIndicator: true,
    smoothTransition: true
  },
  batchMode: {
    enabled: true,
    hotkey: 'Shift',
    enableFloatingMarker: true,
    autoShowCompare: true
  }
};

module.exports = {
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
};
