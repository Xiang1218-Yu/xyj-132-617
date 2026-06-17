'use strict';

/**
 * 定位功能测试模块
 * 从 content/06-positioning.js 中提取的可独立测试的定位逻辑
 */

// 默认设置
const DEFAULT_SETTINGS = {
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
  previewWidth: 600,
  previewHeight: 400
};

/**
 * 获取触发位置
 * 从事件对象或目标元素中提取位置信息
 * @param {Object} event - 事件对象或伪事件对象
 * @returns {Object} 包含 x, y, rect 的位置信息
 */
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
    triggerX = window.innerWidth / 2;
    triggerY = window.innerHeight / 2;
    triggerRect = { left: triggerX - 50, top: triggerY - 20, right: triggerX + 50, bottom: triggerY + 20, width: 100, height: 40 };
  }

  return { x: triggerX, y: triggerY, rect: triggerRect };
}

/**
 * 选择最佳锚点方向
 * 根据可用空间智能选择最优的弹框显示方向
 * @param {DOMRect} triggerRect - 触发元素的位置矩形
 * @param {number} panelWidth - 弹框宽度
 * @param {number} panelHeight - 弹框高度
 * @param {Object} settings - 设置对象
 * @returns {Object} 包含 direction, left, top, anchorX, anchorY 的位置信息
 */
function selectOptimalAnchor(triggerRect, panelWidth, panelHeight, settings = DEFAULT_SETTINGS) {
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 768;
  const margin = 10;
  const offsetX = settings.positioning.offsetX;
  const offsetY = settings.positioning.offsetY;

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

/**
 * 计算锚点位置
 * 根据指定方向计算弹框的显示位置
 * @param {string} anchorDirection - 锚点方向 (top/bottom/left/right)
 * @param {DOMRect} triggerRect - 触发元素的位置矩形
 * @param {number} panelWidth - 弹框宽度
 * @param {number} panelHeight - 弹框高度
 * @param {Object} settings - 设置对象
 * @returns {Object} 包含 direction, left, top, anchorX, anchorY 的位置信息
 */
function calculateAnchorPosition(anchorDirection, triggerRect, panelWidth, panelHeight, settings = DEFAULT_SETTINGS) {
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 768;
  const margin = 10;
  const offsetX = settings.positioning.offsetX;
  const offsetY = settings.positioning.offsetY;

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

/**
 * 计算固定位置
 * 根据设置计算弹框的固定显示位置
 * @param {number} panelWidth - 弹框宽度
 * @param {number} panelHeight - 弹框高度
 * @param {Object} settings - 设置对象
 * @returns {Object} 包含 left, top, direction 的位置信息
 */
function calculateFixedPosition(panelWidth, panelHeight, settings = DEFAULT_SETTINGS) {
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 768;
  const margin = 10;
  const fixed = settings.positioning.fixedPosition || {};

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

/**
 * 计算鼠标跟随位置
 * 根据鼠标位置计算弹框显示位置
 * @param {Object} event - 鼠标事件对象
 * @param {number} panelWidth - 弹框宽度
 * @param {number} panelHeight - 弹框高度
 * @param {DOMRect} triggerRect - 触发元素的位置矩形
 * @param {Object} settings - 设置对象
 * @returns {Object} 包含 left, top, anchorX, anchorY, direction 的位置信息
 */
function calculateMouseFollowPosition(event, panelWidth, panelHeight, triggerRect, settings = DEFAULT_SETTINGS) {
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 768;
  const margin = 10;
  const offsetX = settings.positioning.offsetX;
  const offsetY = settings.positioning.offsetY;

  const mouseX = event ? event.clientX : 0;
  const mouseY = event ? event.clientY : 0;

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

module.exports = {
  DEFAULT_SETTINGS,
  getTriggerPosition,
  selectOptimalAnchor,
  calculateAnchorPosition,
  calculateFixedPosition,
  calculateMouseFollowPosition
};
