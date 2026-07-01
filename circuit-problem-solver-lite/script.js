// components 数组用于保存画布中的所有元件数据
let components = [];

// connections 数组用于保存元件端点之间的连接关系
let connections = [];

// counters 用于给不同类型的元件自动生成编号
const counters = {
  source: 0,
  resistor: 0,
  capacitor: 0,
  inductor: 0,
  node: 0
};

// 网格大小：元件坐标会自动吸附到 24px 网格
const GRID_SIZE = 24;
const DEFAULT_COMPONENT_WIDTH = 116;
const DEFAULT_COMPONENT_HEIGHT = 58;
const CANVAS_WORLD_WIDTH = 2200;
const CANVAS_WORLD_HEIGHT = 1400;

// 不同元件的默认显示信息
const componentConfig = {
  source: { prefix: "V", label: "直流电源", value: "12V", symbol: "V", terminals: { left: "-", right: "+" } },
  resistor: { prefix: "R", label: "电阻", value: "10Ω", symbol: "R", terminals: { left: "1", right: "2" } },
  capacitor: { prefix: "C", label: "电容", value: "100uF", symbol: "C", terminals: { left: "1", right: "2" } },
  inductor: { prefix: "L", label: "电感", value: "10mH", symbol: "L", terminals: { left: "1", right: "2" } },
  node: { prefix: "N", label: "等电位点", value: "node", symbol: "●", width: 44, height: 44 }
};

const canvas = document.getElementById("canvas");
const canvasViewport = document.getElementById("canvasViewport");
const wireLayer = document.getElementById("wireLayer");
const componentLayer = document.getElementById("componentLayer");
const jsonOutput = document.getElementById("jsonOutput");
const countText = document.getElementById("countText");
const clearBtn = document.getElementById("clearBtn");
const undoBtn = document.getElementById("undoBtn");
const redoBtn = document.getElementById("redoBtn");
const restoreSavedBtn = document.getElementById("restoreSavedBtn");
const exampleBtn = document.getElementById("exampleBtn");
const parallelExampleBtn = document.getElementById("parallelExampleBtn");
const mixedExampleBtn = document.getElementById("mixedExampleBtn");
const arrangeBtn = document.getElementById("arrangeBtn");
const zoomOutBtn = document.getElementById("zoomOutBtn");
const zoomResetBtn = document.getElementById("zoomResetBtn");
const zoomInBtn = document.getElementById("zoomInBtn");
const fitViewBtn = document.getElementById("fitViewBtn");
const panModeBtn = document.getElementById("panModeBtn");
const downloadSvgBtn = document.getElementById("downloadSvgBtn");
const downloadPngBtn = document.getElementById("downloadPngBtn");
const selectedName = document.getElementById("selectedName");
const valueInput = document.getElementById("valueInput");
const applyValueBtn = document.getElementById("applyValueBtn");
const rotateBtn = document.getElementById("rotateBtn");
const duplicateBtn = document.getElementById("duplicateBtn");
const deleteBtn = document.getElementById("deleteBtn");
const componentConnectionList = document.getElementById("componentConnectionList");
const connectionHint = document.getElementById("connectionHint");
const selectedConnectionText = document.getElementById("selectedConnectionText");
const deleteConnectionBtn = document.getElementById("deleteConnectionBtn");
const cancelConnectionBtn = document.getElementById("cancelConnectionBtn");
const copyJsonBtn = document.getElementById("copyJsonBtn");
const downloadJsonBtn = document.getElementById("downloadJsonBtn");
const copyCalculationBtn = document.getElementById("copyCalculationBtn");
const downloadCalculationBtn = document.getElementById("downloadCalculationBtn");
const copyReportBtn = document.getElementById("copyReportBtn");
const downloadReportBtn = document.getElementById("downloadReportBtn");
const importInput = document.getElementById("importInput");
const importJsonBtn = document.getElementById("importJsonBtn");
const statusText = document.getElementById("statusText");
const circuitSummary = document.getElementById("circuitSummary");
const circuitAnalysis = document.getElementById("circuitAnalysis");
const calculationResult = document.getElementById("calculationResult");
const meterModeButtons = document.querySelectorAll("[data-meter-mode]");
const meterModeLabel = document.getElementById("meterModeLabel");
const meterReading = document.getElementById("meterReading");
const meterTarget = document.getElementById("meterTarget");
const meterExplanation = document.getElementById("meterExplanation");
const redProbeBtn = document.getElementById("redProbeBtn");
const blackProbeBtn = document.getElementById("blackProbeBtn");
const clearProbeBtn = document.getElementById("clearProbeBtn");
const probeStatusText = document.getElementById("probeStatusText");
const toolItems = document.querySelectorAll(".tool-item");

let selectedComponentId = null;
let selectedConnectionIndex = null;
let pendingTerminal = null;
let draggedComponentId = null;
let draggedWireIndex = null;
let draggedToolType = null;
let dragOffsetX = 0;
let dragOffsetY = 0;
let toolPreview = null;
let currentToolPointerId = null;
let toolDragCreated = false;
let componentDragChanged = false;
let wireDragChanged = false;
let isApplyingHistory = false;
let canvasScale = 1;
let canvasOffsetX = 0;
let canvasOffsetY = 0;
let isPanMode = false;
let isPanningCanvas = false;
let suppressNextCanvasClick = false;
let meterMode = "voltage";
let activeProbe = null;
const meterProbes = {
  red: null,
  black: null
};
let panStartX = 0;
let panStartY = 0;
let panStartOffsetX = 0;
let panStartOffsetY = 0;
const STORAGE_KEY = "circuit-problem-solver-lite-project";
const MAX_HISTORY_LENGTH = 60;
const undoStack = [];
const redoStack = [];

// 将普通坐标吸附到最近的网格点
function snapToGrid(value) {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

// 把坐标限制在画布范围内，避免元件被拖出画布
function getComponentSize(type) {
  const config = componentConfig[type] || {};

  return {
    width: config.width || DEFAULT_COMPONENT_WIDTH,
    height: config.height || DEFAULT_COMPONENT_HEIGHT
  };
}

function clampPosition(x, y, type = "resistor") {
  const size = getComponentSize(type);
  const maxX = Math.max(0, CANVAS_WORLD_WIDTH - size.width - 20);
  const maxY = Math.max(0, CANVAS_WORLD_HEIGHT - size.height - 20);

  return {
    x: Math.min(Math.max(0, snapToGrid(x)), snapToGrid(maxX)),
    y: Math.min(Math.max(0, snapToGrid(y)), snapToGrid(maxY))
  };
}

function getWorldPoint(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();

  return {
    x: (clientX - rect.left - canvasOffsetX) / canvasScale,
    y: (clientY - rect.top - canvasOffsetY) / canvasScale
  };
}

function updateCanvasView() {
  canvasViewport.style.transform = `translate(${canvasOffsetX}px, ${canvasOffsetY}px) scale(${canvasScale})`;
  canvas.style.backgroundSize = `${GRID_SIZE * canvasScale}px ${GRID_SIZE * canvasScale}px`;
  canvas.style.backgroundPosition = `${canvasOffsetX}px ${canvasOffsetY}px`;
  panModeBtn.classList.toggle("active", isPanMode);
  zoomResetBtn.textContent = `${Math.round(canvasScale * 100)}%`;
}

function setCanvasScale(nextScale) {
  const clampedScale = Math.min(Math.max(nextScale, 0.5), 1.8);
  const rect = canvas.getBoundingClientRect();
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  const worldCenterX = (centerX - canvasOffsetX) / canvasScale;
  const worldCenterY = (centerY - canvasOffsetY) / canvasScale;

  canvasScale = clampedScale;
  canvasOffsetX = centerX - worldCenterX * canvasScale;
  canvasOffsetY = centerY - worldCenterY * canvasScale;
  updateCanvasView();
}

function resetCanvasView() {
  canvasScale = 1;
  canvasOffsetX = 0;
  canvasOffsetY = 0;
  updateCanvasView();
  setStatus("画布视图已恢复到 100%。", "success");
}

function fitCanvasView(showStatus = true) {
  if (components.length === 0) {
    resetCanvasView();
    return;
  }

  const bounds = getCircuitBounds();
  const padding = 64;
  const availableWidth = Math.max(1, canvas.clientWidth - padding * 2);
  const availableHeight = Math.max(1, canvas.clientHeight - padding * 2);
  const nextScale = Math.min(1.4, Math.max(0.5, Math.min(availableWidth / bounds.width, availableHeight / bounds.height)));

  canvasScale = nextScale;
  canvasOffsetX = padding - bounds.minX * canvasScale + Math.max(0, (availableWidth - bounds.width * canvasScale) / 2);
  canvasOffsetY = padding - bounds.minY * canvasScale + Math.max(0, (availableHeight - bounds.height * canvasScale) / 2);
  updateCanvasView();

  if (showStatus) {
    setStatus("已将当前电路适配到画布中。", "success");
  }
}

function getCircuitBounds() {
  if (components.length === 0) {
    return { minX: 0, minY: 0, maxX: canvas.clientWidth, maxY: canvas.clientHeight, width: canvas.clientWidth, height: canvas.clientHeight };
  }

  const bounds = components.reduce((result, component) => {
    const size = getComponentSize(component.type);

    return {
      minX: Math.min(result.minX, component.x),
      minY: Math.min(result.minY, component.y),
      maxX: Math.max(result.maxX, component.x + size.width),
      maxY: Math.max(result.maxY, component.y + size.height)
    };
  }, { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });

  connections.forEach((connection) => {
    const points = getWirePolylinePoints(connection)
      .split(" ")
      .map((point) => {
        const [x, y] = point.split(",").map(Number);
        return { x, y };
      })
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));

    points.forEach((point) => {
      bounds.minX = Math.min(bounds.minX, point.x);
      bounds.minY = Math.min(bounds.minY, point.y);
      bounds.maxX = Math.max(bounds.maxX, point.x);
      bounds.maxY = Math.max(bounds.maxY, point.y);
    });
  });

  bounds.width = Math.max(1, bounds.maxX - bounds.minX);
  bounds.height = Math.max(1, bounds.maxY - bounds.minY);
  return bounds;
}

function getComponentRotation(component) {
  return Number(component.rotation) || 0;
}

function rotatePointAroundCenter(x, y, width, height, rotation) {
  const centerX = width / 2;
  const centerY = height / 2;
  const dx = x - centerX;
  const dy = y - centerY;

  if (rotation === 90) {
    return { x: centerX - dy, y: centerY + dx };
  }

  if (rotation === 180) {
    return { x: centerX - dx, y: centerY - dy };
  }

  if (rotation === 270) {
    return { x: centerX + dy, y: centerY - dx };
  }

  return { x, y };
}

function escapeSvgText(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getComponentSvg(component, offsetX, offsetY) {
  const size = getComponentSize(component.type);
  const x = component.x - offsetX;
  const y = component.y - offsetY;
  const rotation = getComponentRotation(component);
  const centerX = x + size.width / 2;
  const centerY = y + size.height / 2;

  if (component.type === "node") {
    return [
      `<circle cx="${x + size.width / 2}" cy="${y + size.height / 2}" r="7" fill="#66717f" />`,
      `<text x="${x + size.width / 2}" y="${y + size.height + 14}" text-anchor="middle" font-size="12" fill="#5f6b7a">${escapeSvgText(component.id)}</text>`
    ].join("\n");
  }

  return [
    `<g transform="rotate(${rotation} ${centerX} ${centerY})">`,
    `  <rect x="${x}" y="${y}" width="${size.width}" height="${size.height}" rx="8" fill="#f8fafc" stroke="#334155" stroke-width="2" />`,
    `  <circle cx="${x}" cy="${y + size.height / 2}" r="7" fill="#eef2f6" stroke="#27313f" stroke-width="2" />`,
    `  <circle cx="${x + size.width}" cy="${y + size.height / 2}" r="7" fill="#eef2f6" stroke="#27313f" stroke-width="2" />`,
    getSchematicSvgMarkup(component.type, x, y),
    `  <text x="${x + 12}" y="${y + 50}" font-size="15" font-weight="700" fill="#27313f">${escapeSvgText(component.id)}</text>`,
    `  <text x="${x + size.width - 12}" y="${y + 50}" text-anchor="end" font-size="14" fill="#5f6b7a">${escapeSvgText(component.value)}</text>`,
    `</g>`
  ].join("\n");
}

function getSchematicSvgMarkup(type, x, y) {
  const leadY = y + 26;

  if (type === "source") {
    return [
      `  <line x1="${x + 16}" y1="${leadY}" x2="${x + 48}" y2="${leadY}" stroke="#27313f" stroke-width="2" />`,
      `  <line x1="${x + 68}" y1="${leadY}" x2="${x + 100}" y2="${leadY}" stroke="#27313f" stroke-width="2" />`,
      `  <circle cx="${x + 58}" cy="${leadY}" r="14" fill="#f8fafc" stroke="#27313f" stroke-width="2" />`
    ].join("\n");
  }

  if (type === "resistor") {
    return [
      `  <polyline points="${x + 16},${leadY} ${x + 34},${leadY} ${x + 40},${y + 16} ${x + 48},${y + 36} ${x + 56},${y + 16} ${x + 64},${y + 36} ${x + 72},${y + 16} ${x + 80},${y + 36} ${x + 86},${leadY} ${x + 100},${leadY}" fill="none" stroke="#27313f" stroke-width="2" stroke-linejoin="miter" />`
    ].join("\n");
  }

  if (type === "capacitor") {
    return [
      `  <line x1="${x + 16}" y1="${leadY}" x2="${x + 50}" y2="${leadY}" stroke="#27313f" stroke-width="2" />`,
      `  <line x1="${x + 66}" y1="${leadY}" x2="${x + 100}" y2="${leadY}" stroke="#27313f" stroke-width="2" />`,
      `  <line x1="${x + 52}" y1="${y + 16}" x2="${x + 52}" y2="${y + 36}" stroke="#27313f" stroke-width="3" />`,
      `  <line x1="${x + 64}" y1="${y + 16}" x2="${x + 64}" y2="${y + 36}" stroke="#27313f" stroke-width="3" />`
    ].join("\n");
  }

  if (type === "inductor") {
    return [
      `  <line x1="${x + 16}" y1="${leadY}" x2="${x + 36}" y2="${leadY}" stroke="#27313f" stroke-width="2" />`,
      `  <path d="M ${x + 36} ${leadY} a 8 8 0 0 1 16 0 a 8 8 0 0 1 16 0 a 8 8 0 0 1 16 0" fill="none" stroke="#27313f" stroke-width="2" />`,
      `  <line x1="${x + 84}" y1="${leadY}" x2="${x + 100}" y2="${leadY}" stroke="#27313f" stroke-width="2" />`
    ].join("\n");
  }

  return "";
}

function buildCircuitSvg() {
  const bounds = getCircuitBounds();
  const padding = 48;
  const minX = Math.max(0, bounds.minX - padding);
  const minY = Math.max(0, bounds.minY - padding);
  const width = Math.max(360, bounds.width + padding * 2);
  const height = Math.max(240, bounds.height + padding * 2);
  const wireMarkup = connections.map((connection) => {
    const from = getWireAnchorPosition(connection.from);
    const to = getWireAnchorPosition(connection.to);

    if (!from || !to) {
      return "";
    }

    const shiftedPoints = getWirePolylinePoints(connection)
      .split(" ")
      .map((point) => {
        const [x, y] = point.split(",").map(Number);
        return `${x - minX},${y - minY}`;
      })
      .join(" ");

    return `<polyline points="${shiftedPoints}" fill="none" stroke="#4b5563" stroke-width="4" stroke-linecap="square" stroke-linejoin="miter" />`;
  }).join("\n");
  const componentMarkup = components.map((component) => getComponentSvg(component, minX, minY)).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#eef2f6" />
  <defs>
    <pattern id="grid" width="${GRID_SIZE}" height="${GRID_SIZE}" patternUnits="userSpaceOnUse">
      <path d="M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}" fill="none" stroke="#d4dbe5" stroke-width="1" />
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#grid)" />
  ${wireMarkup}
  ${componentMarkup}
</svg>`;
}

function downloadSvg() {
  if (components.length === 0) {
    setStatus("画布中还没有元件，暂时没有可导出的电路图。", "");
    return;
  }

  const blob = new Blob([buildCircuitSvg()], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "circuit-diagram.svg";
  link.click();
  URL.revokeObjectURL(url);
  setStatus("SVG 电路图已开始下载。", "success");
}

function downloadPng() {
  if (components.length === 0) {
    setStatus("画布中还没有元件，暂时没有可导出的电路图。", "");
    return;
  }

  const svgText = buildCircuitSvg();
  const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  const image = new Image();

  image.onload = () => {
    const exportCanvas = document.createElement("canvas");
    const scale = 2;

    exportCanvas.width = image.width * scale;
    exportCanvas.height = image.height * scale;

    const context = exportCanvas.getContext("2d");
    context.fillStyle = "#eef2f6";
    context.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    context.drawImage(image, 0, 0, exportCanvas.width, exportCanvas.height);

    exportCanvas.toBlob((blob) => {
      if (!blob) {
        URL.revokeObjectURL(url);
        setStatus("PNG 生成失败，请先导出 SVG。", "error");
        return;
      }

      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = downloadUrl;
      link.download = "circuit-diagram.png";
      link.click();
      URL.revokeObjectURL(downloadUrl);
      URL.revokeObjectURL(url);
      setStatus("PNG 电路图已开始下载。", "success");
    }, "image/png");
  };

  image.onerror = () => {
    URL.revokeObjectURL(url);
    setStatus("PNG 生成失败，请先导出 SVG。", "error");
  };

  image.src = url;
}

// 根据元件类型生成唯一 id，例如 R1、R2、C1
function createComponentId(type) {
  const config = componentConfig[type];
  counters[type] += 1;
  return `${config.prefix}${counters[type]}`;
}

// 导入 JSON 后，重新计算各类元件的计数器，避免新建元件编号重复
function rebuildCounters() {
  Object.keys(counters).forEach((key) => {
    counters[key] = 0;
  });

  components.forEach((component) => {
    const config = componentConfig[component.type];
    const numberPart = Number(component.id.replace(config.prefix, ""));

    if (!Number.isNaN(numberPart)) {
      counters[component.type] = Math.max(counters[component.type], numberPart);
    }
  });
}

// 输出当前项目数据
function getProjectData() {
  return {
    components,
    connections
  };
}

function cloneProjectData(data = getProjectData()) {
  return JSON.parse(JSON.stringify(data));
}

function getProjectSnapshot(data = getProjectData()) {
  return JSON.stringify(data);
}

function resetProbeState() {
  activeProbe = null;
  meterProbes.red = null;
  meterProbes.black = null;
}

function isTerminalKeyValid(key) {
  if (!key) {
    return false;
  }

  const { componentId, side } = parseTerminalKey(key);
  const component = components.find((item) => item.id === componentId);
  return Boolean(component && getTerminalKeys(component).includes(makeTerminalKey(componentId, side)));
}

function pruneInvalidProbes() {
  if (!isTerminalKeyValid(meterProbes.red)) {
    meterProbes.red = null;
  }

  if (!isTerminalKeyValid(meterProbes.black)) {
    meterProbes.black = null;
  }
}

function applyProjectData(data) {
  components = cloneProjectData(data.components || []);
  connections = cloneProjectData(data.connections || []);
  clearSelection();
  pendingTerminal = null;
  resetProbeState();
  rebuildCounters();
}

function updateHistoryButtons() {
  undoBtn.disabled = undoStack.length <= 1;
  redoBtn.disabled = redoStack.length === 0;
}

function recordHistory() {
  if (isApplyingHistory) {
    return;
  }

  const snapshot = getProjectSnapshot();
  const latestSnapshot = undoStack[undoStack.length - 1];

  if (snapshot === latestSnapshot) {
    updateHistoryButtons();
    return;
  }

  undoStack.push(snapshot);

  if (undoStack.length > MAX_HISTORY_LENGTH) {
    undoStack.shift();
  }

  redoStack.length = 0;
  updateHistoryButtons();
}

function undoProjectChange() {
  if (undoStack.length <= 1) {
    return;
  }

  const currentSnapshot = undoStack.pop();
  redoStack.push(currentSnapshot);
  isApplyingHistory = true;
  applyProjectData(JSON.parse(undoStack[undoStack.length - 1]));
  isApplyingHistory = false;
  setStatus("已撤销上一步操作。", "success");
  render();
  updateHistoryButtons();
}

function redoProjectChange() {
  if (redoStack.length === 0) {
    return;
  }

  const nextSnapshot = redoStack.pop();
  undoStack.push(nextSnapshot);
  isApplyingHistory = true;
  applyProjectData(JSON.parse(nextSnapshot));
  isApplyingHistory = false;
  setStatus("已重做刚才撤销的操作。", "success");
  render();
  updateHistoryButtons();
}

function saveProjectToLocalStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(getProjectData()));
  } catch (error) {
    setStatus("浏览器本地保存失败，可先下载 JSON 备份。", "error");
  }
}

function restoreSavedProject(showStatus = true) {
  const savedText = localStorage.getItem(STORAGE_KEY);

  if (!savedText) {
    if (showStatus) {
      setStatus("还没有可恢复的本地画布。", "");
    }
    return false;
  }

  try {
    const savedProject = JSON.parse(savedText);
    const nextComponents = normalizeImportedComponents(savedProject.components || []);
    const nextConnections = normalizeImportedConnections(savedProject.connections || [], nextComponents);

    applyProjectData({ components: nextComponents, connections: nextConnections });
    recordHistory();
    render();

    if (showStatus) {
      setStatus("已恢复浏览器本地保存的画布。", "success");
    }

    return true;
  } catch (error) {
    if (showStatus) {
      setStatus(`恢复失败：${error.message}`, "error");
    }
    return false;
  }
}

// 端点字符串格式：R1.left / R1.right / N1.center
function makeTerminalKey(componentId, side) {
  return `${componentId}.${side}`;
}

function parseTerminalKey(key) {
  const [componentId, side] = key.split(".");
  return { componentId, side };
}

function getComponentLabel(componentId) {
  const component = components.find((item) => item.id === componentId);

  if (!component) {
    return componentId;
  }

  const config = componentConfig[component.type];
  if (component.type === "node") {
    return `${component.id}（${config.label}）`;
  }

  return `${component.id}（${config.label}，${component.value}）`;
}

function getTerminalLabel(key) {
  const { componentId, side } = parseTerminalKey(key);
  const component = components.find((item) => item.id === componentId);

  if (!component) {
    return key;
  }

  const terminalText = getTerminalText(component, side);
  return `${getComponentLabel(componentId)}的${terminalText}`;
}

function getTerminalText(component, side) {
  if (component.type === "source") {
    return side === "right" ? "正极" : "负极";
  }

  if (side === "center") {
    return "中心节点";
  }

  return side === "right" ? "右端" : "左端";
}

function getProbeName(probe) {
  return probe === "red" ? "红表笔" : "黑表笔";
}

function setActiveProbe(probe) {
  activeProbe = activeProbe === probe ? null : probe;
  pendingTerminal = null;
  selectedConnectionIndex = null;
  setStatus(activeProbe ? `请选择${getProbeName(activeProbe)}要接触的端点。` : "已退出表笔放置模式。", activeProbe ? "success" : "");
  render();
}

function clearProbes() {
  resetProbeState();
  setStatus("已清除红黑表笔。", "success");
  render();
}

function handleProbeTerminalClick(probe, key) {
  meterProbes[probe] = key;
  activeProbe = probe === "red" && !meterProbes.black ? "black" : null;
  selectedComponentId = null;
  selectedConnectionIndex = null;
  pendingTerminal = null;
  setStatus(`${getProbeName(probe)}已接到 ${key}。`, "success");
  render();
}

function getProbeStatusText() {
  const redText = meterProbes.red ? `红笔：${meterProbes.red}` : "红笔：未放置";
  const blackText = meterProbes.black ? `黑笔：${meterProbes.black}` : "黑笔：未放置";
  return `${redText}；${blackText}`;
}

// 获取端点在画布中的坐标，用于绘制连线
function getTerminalPosition(key) {
  const { componentId, side } = parseTerminalKey(key);
  const component = components.find((item) => item.id === componentId);

  if (!component) {
    return null;
  }

  const size = getComponentSize(component.type);

  if (side === "center") {
    return {
      x: component.x + size.width / 2,
      y: component.y + size.height / 2
    };
  }

  const localPoint = side === "left"
    ? { x: 0, y: size.height / 2 }
    : { x: size.width, y: size.height / 2 };
  const rotatedPoint = rotatePointAroundCenter(localPoint.x, localPoint.y, size.width, size.height, getComponentRotation(component));

  return {
    x: component.x + rotatedPoint.x,
    y: component.y + rotatedPoint.y
  };
}

function getWireAnchorPosition(key) {
  const terminalPosition = getTerminalPosition(key);
  const { componentId, side } = parseTerminalKey(key);
  const component = components.find((item) => item.id === componentId);

  if (!terminalPosition || !component) {
    return terminalPosition;
  }

  if (side === "center") {
    return terminalPosition;
  }

  const rotation = getComponentRotation(component);
  const direction = side === "left" ? -1 : 1;
  const offset = 14;

  if (rotation === 90) {
    return { x: terminalPosition.x, y: terminalPosition.y + direction * offset };
  }

  if (rotation === 180) {
    return { x: terminalPosition.x - direction * offset, y: terminalPosition.y };
  }

  if (rotation === 270) {
    return { x: terminalPosition.x, y: terminalPosition.y - direction * offset };
  }

  return { x: terminalPosition.x + direction * offset, y: terminalPosition.y };
}

function getWirePolylinePoints(connection) {
  const fromTerminal = getTerminalPosition(connection.from);
  const toTerminal = getTerminalPosition(connection.to);
  const fromAnchor = getWireAnchorPosition(connection.from);
  const toAnchor = getWireAnchorPosition(connection.to);

  if (!fromTerminal || !toTerminal || !fromAnchor || !toAnchor) {
    return "";
  }

  const middlePoints = getOrthogonalWirePoints(fromAnchor, toAnchor, connection)
    .split(" ")
    .map((point) => {
      const [x, y] = point.split(",").map(Number);
      return { x, y };
    });
  const allPoints = [fromTerminal, ...middlePoints, toTerminal];
  const compactPoints = allPoints.filter((point, index, list) => {
    const previous = list[index - 1];
    return !previous || previous.x !== point.x || previous.y !== point.y;
  });

  return compactPoints.map((point) => `${point.x},${point.y}`).join(" ");
}

function rotateSelectedComponent() {
  const component = components.find((item) => item.id === selectedComponentId);

  if (!component || component.type === "node") {
    return;
  }

  component.rotation = (getComponentRotation(component) + 90) % 360;
  setStatus(`已将 ${component.id} 旋转到 ${component.rotation}°。`, "success");
  render();
  recordHistory();
}

function duplicateSelectedComponent() {
  const component = components.find((item) => item.id === selectedComponentId);

  if (!component) {
    return;
  }

  const position = clampPosition(component.x + GRID_SIZE * 2, component.y + GRID_SIZE * 2, component.type);
  const nextComponent = {
    id: createComponentId(component.type),
    type: component.type,
    value: component.value,
    rotation: getComponentRotation(component),
    x: position.x,
    y: position.y
  };

  components.push(nextComponent);
  selectedComponentId = nextComponent.id;
  selectedConnectionIndex = null;
  pendingTerminal = null;
  setStatus(`已复制 ${component.id} 为 ${nextComponent.id}。`, "success");
  render();
  recordHistory();
}

function getSchematicMarkup(type) {
  if (type === "source") {
    return `
      <span class="schematic-body schematic-source">
        <span class="schematic-lead left"></span>
        <span class="source-circle"></span>
        <span class="schematic-lead right"></span>
      </span>
    `;
  }

  if (type === "resistor") {
    return `
      <span class="schematic-body schematic-resistor">
        <span class="schematic-lead left"></span>
        <span class="zigzag"></span>
        <span class="schematic-lead right"></span>
      </span>
    `;
  }

  if (type === "capacitor") {
    return `
      <span class="schematic-body schematic-capacitor">
        <span class="schematic-lead left"></span>
        <span class="plate left"></span>
        <span class="plate right"></span>
        <span class="schematic-lead right"></span>
      </span>
    `;
  }

  if (type === "inductor") {
    return `
      <span class="schematic-body schematic-inductor">
        <span class="schematic-lead left"></span>
        <span class="coil one"></span>
        <span class="coil two"></span>
        <span class="coil three"></span>
        <span class="schematic-lead right"></span>
      </span>
    `;
  }

  return "";
}

// 生成直角折线坐标，让导线更接近电路图中的横平竖直画法。
// 如果导线记录了 bendX / bendY，就使用用户手动拖出的拐点位置。
function getOrthogonalWirePoints(from, to, connection = {}) {
  const hasBendX = Number.isFinite(connection.bendX);
  const hasBendY = Number.isFinite(connection.bendY);
  const midX = hasBendX ? connection.bendX : from.x + (to.x - from.x) / 2;
  const midY = hasBendY ? connection.bendY : from.y + (to.y - from.y) / 2;

  if (hasBendY) {
    return `${from.x},${from.y} ${from.x},${midY} ${to.x},${midY} ${to.x},${to.y}`;
  }

  if (hasBendX) {
    return `${from.x},${from.y} ${midX},${from.y} ${midX},${to.y} ${to.x},${to.y}`;
  }

  if (from.x === to.x || from.y === to.y) {
    return `${from.x},${from.y} ${to.x},${to.y}`;
  }

  return `${from.x},${from.y} ${midX},${from.y} ${midX},${to.y} ${to.x},${to.y}`;
}

// 手动整理导线时显示的小方块位置，用户拖它即可调整折线路径。
function getWireHandlePosition(from, to, connection) {
  const bendX = Number.isFinite(connection.bendX) ? connection.bendX : from.x + (to.x - from.x) / 2;
  const bendY = Number.isFinite(connection.bendY) ? connection.bendY : from.y + (to.y - from.y) / 2;

  return {
    x: bendX,
    y: bendY
  };
}

// 根据拖拽落点创建一个新元件
function addComponent(type, x, y) {
  const config = componentConfig[type];
  const position = clampPosition(x, y, type);

  components.push({
    id: createComponentId(type),
    type,
    value: config.value,
    rotation: 0,
    x: position.x,
    y: position.y
  });

  render();
  recordHistory();
}

function loadExampleCircuit() {
  components = [
    { id: "V1", type: "source", value: "12V", rotation: 90, x: 96, y: 216 },
    { id: "R1", type: "resistor", value: "10Ω", rotation: 0, x: 312, y: 120 },
    { id: "R2", type: "resistor", value: "20Ω", rotation: 0, x: 552, y: 120 }
  ];

  connections = [
    { from: "V1.right", to: "R1.left" },
    { from: "R1.right", to: "R2.left" },
    { from: "R2.right", to: "V1.left", bendY: 360 }
  ];

  clearSelection();
  pendingTerminal = null;
  resetProbeState();
  rebuildCounters();
  render();
  recordHistory();
  fitCanvasView(false);
  setStatus("已生成示例电路，并自动适配到画布中。", "success");
}

function loadParallelExampleCircuit() {
  components = [
    { id: "V1", type: "source", value: "12V", rotation: 0, x: 96, y: 216 },
    { id: "N1", type: "node", value: "node", rotation: 0, x: 312, y: 120 },
    { id: "N2", type: "node", value: "node", rotation: 0, x: 312, y: 336 },
    { id: "R1", type: "resistor", value: "6Ω", rotation: 0, x: 552, y: 96 },
    { id: "R2", type: "resistor", value: "12Ω", rotation: 0, x: 552, y: 288 }
  ];

  connections = [
    { from: "V1.right", to: "N1.center" },
    { from: "V1.left", to: "N2.center" },
    { from: "N1.center", to: "R1.left" },
    { from: "R1.right", to: "N2.center" },
    { from: "N1.center", to: "R2.left" },
    { from: "R2.right", to: "N2.center" }
  ];

  clearSelection();
  pendingTerminal = null;
  resetProbeState();
  rebuildCounters();
  render();
  recordHistory();
  fitCanvasView(false);
  setStatus("已生成并联示例电路，并自动适配到画布中。", "success");
}

function loadMixedExampleCircuit() {
  components = [
    { id: "V1", type: "source", value: "12V", rotation: 0, x: 96, y: 264 },
    { id: "R1", type: "resistor", value: "4Ω", rotation: 0, x: 312, y: 264 },
    { id: "N1", type: "node", value: "node", rotation: 0, x: 552, y: 288 },
    { id: "R2", type: "resistor", value: "6Ω", rotation: 0, x: 720, y: 192 },
    { id: "R3", type: "resistor", value: "12Ω", rotation: 0, x: 720, y: 360 },
    { id: "N2", type: "node", value: "node", rotation: 0, x: 936, y: 288 }
  ];

  connections = [
    { from: "V1.right", to: "R1.left" },
    { from: "R1.right", to: "N1.center" },
    { from: "V1.left", to: "N2.center", bendY: 504 },
    { from: "N1.center", to: "R2.left" },
    { from: "R2.right", to: "N2.center" },
    { from: "N1.center", to: "R3.left" },
    { from: "R3.right", to: "N2.center" }
  ];

  clearSelection();
  pendingTerminal = null;
  resetProbeState();
  rebuildCounters();
  render();
  recordHistory();
  fitCanvasView(false);
  setStatus("已生成混联示例电路，并自动适配到画布中。", "success");
}

function arrangeCanvas() {
  if (components.length === 0) {
    setStatus("画布中还没有元件可整理。", "");
    return;
  }

  components.forEach((component, index) => {
    const row = Math.floor(index / 3);
    const column = index % 3;
    const x = 72 + column * 216;
    const y = 96 + row * 144;
    const position = clampPosition(x, y, component.type);

    component.x = position.x;
    component.y = position.y;
  });

  connections.forEach((connection) => {
    delete connection.bendX;
    delete connection.bendY;
  });
  selectedConnectionIndex = null;
  pendingTerminal = null;
  setStatus("已按网格整理画布，并恢复导线为自动折线。", "success");
  render();
  recordHistory();
}

function clearSelection() {
  selectedComponentId = null;
  selectedConnectionIndex = null;
}

// 删除当前选中的元件，同时删除与它相关的连线
function deleteSelectedComponent() {
  if (!selectedComponentId) {
    return;
  }

  components = components.filter((component) => component.id !== selectedComponentId);
  connections = connections.filter((connection) => {
    return !connection.from.startsWith(`${selectedComponentId}.`) &&
      !connection.to.startsWith(`${selectedComponentId}.`);
  });
  clearSelection();
  pendingTerminal = null;
  setStatus("已删除选中的元件和相关连线。", "success");
  render();
  recordHistory();
}

function deleteSelectedConnection() {
  if (selectedConnectionIndex === null || !connections[selectedConnectionIndex]) {
    return;
  }

  const removed = connections[selectedConnectionIndex];
  connections.splice(selectedConnectionIndex, 1);
  selectedConnectionIndex = null;
  setStatus(`已删除导线 ${removed.from} 到 ${removed.to}。`, "success");
  render();
  recordHistory();
}

function selectConnection(index) {
  const connection = connections[index];

  if (!connection) {
    return;
  }

  selectedConnectionIndex = index;
  selectedComponentId = null;
  pendingTerminal = null;
  setStatus(`已选择导线 ${connection.from} 到 ${connection.to}。`, "success");
  render();
}

// 渲染画布中的所有元件
function renderComponents() {
  componentLayer.innerHTML = "";
  const diagnostic = getCircuitDiagnostics();

  components.forEach((component) => {
    const config = componentConfig[component.type];
    const element = document.createElement("div");

    element.className = `component type-${component.type}`;
    element.dataset.id = component.id;
    element.style.left = `${component.x}px`;
    element.style.top = `${component.y}px`;
    element.style.width = `${getComponentSize(component.type).width}px`;
    element.style.height = `${getComponentSize(component.type).height}px`;
    element.style.transform = component.type === "node" ? "" : `rotate(${getComponentRotation(component)}deg)`;

    if (component.id === selectedComponentId) {
      element.classList.add("selected");
    }

    if (component.type === "node") {
      element.innerHTML = `
        <span class="terminal center" data-side="center" title="${component.id}.center"></span>
        <span class="component-name">${component.id}</span>
      `;
    } else {
      element.innerHTML = `
        <span class="terminal left" data-side="left" title="${component.id}.left">${config.terminals.left}</span>
        <span class="terminal right" data-side="right" title="${component.id}.right">${config.terminals.right}</span>
        ${getSchematicMarkup(component.type)}
        <span class="component-name">${component.id}</span>
        <span class="component-value">${component.value}</span>
      `;
    }

    element.querySelectorAll(".terminal").forEach((terminal) => {
      const side = terminal.dataset.side;
      const key = makeTerminalKey(component.id, side);

      if (pendingTerminal === key) {
        terminal.classList.add("active");
      }

      if (meterProbes.red === key) {
        terminal.classList.add("probe-red");
      }

      if (meterProbes.black === key) {
        terminal.classList.add("probe-black");
      }

      if (diagnostic.terminalIssues.has(key)) {
        terminal.classList.add("warning");
        terminal.title = `${key}：尚未正确接入回路`;
      }

      // 点击端点：第一次选择起点，第二次选择终点并生成连接。
      // 这里使用 pointerdown，避免端点点击被元件拖拽或画布点击逻辑干扰。
      terminal.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        handleTerminalClick(component.id, side);
      });
    });

    // 单击元件：选中元件，并在左侧编辑栏中修改数值
    element.addEventListener("click", (event) => {
      event.stopPropagation();
      selectedComponentId = component.id;
      selectedConnectionIndex = null;
      render();
    });

    // 鼠标按下后进入画布内拖动模式
    element.addEventListener("pointerdown", (event) => {
      if (event.target.classList.contains("terminal")) {
        return;
      }

      event.stopPropagation();
      draggedComponentId = component.id;
      componentDragChanged = false;
      selectedComponentId = component.id;
      selectedConnectionIndex = null;
      const worldPoint = getWorldPoint(event.clientX, event.clientY);
      dragOffsetX = worldPoint.x - component.x;
      dragOffsetY = worldPoint.y - component.y;
      element.setPointerCapture(event.pointerId);
      render();
    });

    componentLayer.appendChild(element);
  });
}

// 渲染所有连接线
function renderConnections() {
  wireLayer.innerHTML = "";

  connections.forEach((connection, index) => {
    const from = getWireAnchorPosition(connection.from);
    const to = getWireAnchorPosition(connection.to);

    if (!from || !to) {
      return;
    }

    const lineGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const hitArea = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    const line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    const points = getWirePolylinePoints(connection);

    hitArea.setAttribute("points", points);
    line.setAttribute("points", points);

    hitArea.setAttribute("class", "connection-hit-area");
    line.setAttribute("class", index === selectedConnectionIndex ? "connection-line selected" : "connection-line");
    hitArea.dataset.connectionIndex = String(index);
    line.dataset.connectionIndex = String(index);
    lineGroup.appendChild(hitArea);
    lineGroup.appendChild(line);

    if (index === selectedConnectionIndex) {
      const handlePosition = getWireHandlePosition(from, to, connection);

      if (handlePosition) {
        const handle = document.createElementNS("http://www.w3.org/2000/svg", "rect");

        handle.setAttribute("class", "wire-handle");
        handle.classList.add(from.y === to.y ? "vertical-drag" : "horizontal-drag");
        handle.setAttribute("x", String(handlePosition.x - 7));
        handle.setAttribute("y", String(handlePosition.y - 7));
        handle.setAttribute("width", "14");
        handle.setAttribute("height", "14");
        handle.setAttribute("rx", "3");
        handle.dataset.connectionIndex = String(index);
        lineGroup.appendChild(handle);

        handle.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          event.stopPropagation();
          draggedWireIndex = index;
          wireDragChanged = false;
          selectedConnectionIndex = index;
          handle.setPointerCapture(event.pointerId);
          setStatus("正在整理导线路径。", "success");
        });
      }
    }

    const selectCurrentLine = (event) => {
      event.preventDefault();
      event.stopPropagation();
      selectConnection(index);
    };

    hitArea.addEventListener("pointerdown", selectCurrentLine);
    line.addEventListener("pointerdown", selectCurrentLine);
    hitArea.addEventListener("click", selectCurrentLine);
    line.addEventListener("click", selectCurrentLine);
    wireLayer.appendChild(lineGroup);
  });
}

// 处理端点点击，建立 connections 数据
function handleTerminalClick(componentId, side) {
  const key = makeTerminalKey(componentId, side);

  if (activeProbe) {
    handleProbeTerminalClick(activeProbe, key);
    return;
  }

  if (!pendingTerminal) {
    pendingTerminal = key;
    selectedConnectionIndex = null;
    setStatus(`已选择起点 ${key}，请点击另一个端点完成连线。`, "success");
    render();
    return;
  }

  if (pendingTerminal === key) {
    pendingTerminal = null;
    setStatus("已取消当前端点选择。", "");
    render();
    return;
  }

  const exists = connections.some((connection) => {
    return (connection.from === pendingTerminal && connection.to === key) ||
      (connection.from === key && connection.to === pendingTerminal);
  });

  if (!exists) {
    connections.push({
      from: pendingTerminal,
      to: key
    });
    selectedConnectionIndex = connections.length - 1;
    setStatus(`已连接 ${pendingTerminal} 到 ${key}。`, "success");
  } else {
    setStatus("这两个端点已经连接过了。", "");
  }

  pendingTerminal = null;
  render();
  if (!exists) {
    recordHistory();
  }
}

// 渲染底部 JSON 数据
function renderJson() {
  jsonOutput.textContent = JSON.stringify(getProjectData(), null, 2);
  countText.textContent = `${components.length} 个元件，${connections.length} 条连接`;
}

function renderSummary() {
  if (connections.length === 0) {
    circuitSummary.textContent = "当前还没有连接。";
    return;
  }

  const sentences = connections.map((connection, index) => {
    return `${index + 1}. 将${getTerminalLabel(connection.from)}连接到${getTerminalLabel(connection.to)}。`;
  });

  circuitSummary.textContent = sentences.join(" ");
}

function buildComponentGraph() {
  const graph = new Map();

  components.forEach((component) => {
    graph.set(component.id, {
      component,
      degree: 0,
      neighbors: new Set()
    });
  });

  connections.forEach((connection) => {
    const from = parseTerminalKey(connection.from).componentId;
    const to = parseTerminalKey(connection.to).componentId;

    if (!graph.has(from) || !graph.has(to) || from === to) {
      return;
    }

    graph.get(from).degree += 1;
    graph.get(to).degree += 1;
    graph.get(from).neighbors.add(to);
    graph.get(to).neighbors.add(from);
  });

  return graph;
}

function getConnectedComponentIds(graph) {
  return Array.from(graph.values())
    .filter((entry) => entry.degree > 0)
    .map((entry) => entry.component.id);
}

function findSimplePath(graph) {
  const connectedIds = getConnectedComponentIds(graph);

  if (connectedIds.length < 2) {
    return [];
  }

  const endpoints = connectedIds.filter((id) => graph.get(id).degree === 1);
  const hasOnlyPathDegrees = connectedIds.every((id) => graph.get(id).degree <= 2);

  if (endpoints.length !== 2 || !hasOnlyPathDegrees) {
    return [];
  }

  const path = [];
  const visited = new Set();
  let currentId = endpoints[0];
  let previousId = null;

  while (currentId) {
    path.push(currentId);
    visited.add(currentId);

    const nextId = Array.from(graph.get(currentId).neighbors)
      .find((neighborId) => neighborId !== previousId && !visited.has(neighborId));

    previousId = currentId;
    currentId = nextId || null;
  }

  return path.length === connectedIds.length ? path : [];
}

function describeComponentConnection(entry) {
  const label = getComponentLabel(entry.component.id);
  return `${label}：已连接 ${entry.degree} 条导线`;
}

function getSimplePathComponents(graph) {
  return findSimplePath(graph)
    .map((id) => components.find((component) => component.id === id))
    .filter(Boolean);
}

// 从类似 12V、10Ω、2.2kΩ 的文本中提取数值，方便做基础计算。
function parseElectricalValue(value, type) {
  const text = String(value || "").trim().toLowerCase();
  const numberMatch = text.match(/-?\d+(\.\d+)?/);

  if (!numberMatch) {
    return null;
  }

  const number = Number(numberMatch[0]);

  if (!Number.isFinite(number)) {
    return null;
  }

  if (type === "resistor") {
    if (text.includes("k")) {
      return number * 1000;
    }

    if (text.includes("m") && !text.includes("mω")) {
      return number * 1000000;
    }
  }

  return number;
}

function formatNumber(value, unit) {
  if (!Number.isFinite(value)) {
    return `0 ${unit}`;
  }

  const formatted = Number.isInteger(value)
    ? String(value)
    : value.toFixed(3).replace(/\.?0+$/, "");

  return `${formatted} ${unit}`;
}

function getConnectedComponentIdsByTerminal(terminalKey) {
  return connections.reduce((ids, connection) => {
    if (connection.from === terminalKey) {
      ids.push(parseTerminalKey(connection.to).componentId);
    } else if (connection.to === terminalKey) {
      ids.push(parseTerminalKey(connection.from).componentId);
    }

    return ids;
  }, []);
}

function getConnectedTerminals(terminalKey) {
  return connections.reduce((terminals, connection) => {
    if (connection.from === terminalKey) {
      terminals.push(connection.to);
    } else if (connection.to === terminalKey) {
      terminals.push(connection.from);
    }

    return terminals;
  }, []);
}

function getTerminalKeys(component) {
  return component.type === "node"
    ? [`${component.id}.center`]
    : [`${component.id}.left`, `${component.id}.right`];
}

// 建立端点级电气图。导线连接端点，非电源元件内部连接左右端。
function buildTerminalGraph() {
  const graph = new Map();

  components.forEach((component) => {
    getTerminalKeys(component).forEach((key) => graph.set(key, []));
  });

  function addEdge(from, to, viaComponent = null) {
    if (!graph.has(from) || !graph.has(to)) {
      return;
    }

    graph.get(from).push({ key: to, viaComponent });
    graph.get(to).push({ key: from, viaComponent });
  }

  connections.forEach((connection) => addEdge(connection.from, connection.to));

  components.forEach((component) => {
    if (component.type !== "node" && component.type !== "source") {
      addEdge(`${component.id}.left`, `${component.id}.right`, component.id);
    }
  });

  return graph;
}

function findTerminalPath(startKey, endKey) {
  const graph = buildTerminalGraph();

  if (!graph.has(startKey) || !graph.has(endKey)) {
    return [];
  }

  const queue = [startKey];
  const visited = new Set([startKey]);
  const previous = new Map();

  while (queue.length > 0) {
    const current = queue.shift();

    if (current === endKey) {
      break;
    }

    graph.get(current).forEach((edge) => {
      if (!visited.has(edge.key)) {
        visited.add(edge.key);
        previous.set(edge.key, { key: current, viaComponent: edge.viaComponent });
        queue.push(edge.key);
      }
    });
  }

  if (!visited.has(endKey)) {
    return [];
  }

  const path = [];
  let current = endKey;

  while (current !== startKey) {
    const step = previous.get(current);
    path.unshift({ from: step.key, to: current, viaComponent: step.viaComponent });
    current = step.key;
  }

  return path;
}

function isWireOnlyTerminalPath(path) {
  return path.length > 0 && path.every((step) => !step.viaComponent);
}

function getCircuitDiagnostics() {
  const terminalIssues = new Set();
  const items = [];
  const sources = components.filter((component) => component.type === "source");

  components.forEach((component) => {
    const terminalKeys = getTerminalKeys(component);
    const minimumConnections = component.type === "node" ? 2 : 1;

    terminalKeys.forEach((key) => {
      if (getConnectedTerminals(key).length < minimumConnections) {
        terminalIssues.add(key);
      }
    });
  });

  if (components.length === 0) {
    return {
      terminalIssues,
      closedSources: new Set(),
      shortSources: new Set(),
      items: [{ type: "info", message: "当前还没有元件，可以先拖入一个直流电源和电阻。" }]
    };
  }

  if (sources.length === 0) {
    items.push({ type: "warning", message: "没有检测到直流电源，当前电路无法进行直流计算。" });
  } else if (sources.length > 1) {
    items.push({ type: "warning", message: `检测到 ${sources.length} 个直流电源，当前版本暂不计算多电源电路。` });
  }

  const closedSources = new Set();
  const shortSources = new Set();

  sources.forEach((source) => {
    const path = findTerminalPath(`${source.id}.right`, `${source.id}.left`);

    if (isWireOnlyTerminalPath(path)) {
      shortSources.add(source.id);
      terminalIssues.add(`${source.id}.left`);
      terminalIssues.add(`${source.id}.right`);
      items.push({ type: "warning", message: `短路风险：${source.id} 的正极和负极被导线或等电位点直接连在一起，中间没有负载电阻。` });
    } else if (path.length > 0) {
      closedSources.add(source.id);
      items.push({ type: "success", message: `${source.id} 的正极和负极已经通过外部元件形成闭合回路。` });
    } else {
      terminalIssues.add(`${source.id}.left`);
      terminalIssues.add(`${source.id}.right`);
      items.push({ type: "warning", message: `${source.id} 尚未形成闭合回路，请检查红色端点和回路线。` });
    }
  });

  const danglingLabels = Array.from(terminalIssues).map(getTerminalLabel);

  if (danglingLabels.length > 0) {
    items.push({
      type: "warning",
      message: `发现 ${danglingLabels.length} 个待处理端点：${danglingLabels.join("、")}。`
    });
  } else if (sources.length > 0) {
    items.push({ type: "success", message: "所有必需端点都已接入，未发现悬空端点。" });
  }

  const componentGraph = buildComponentGraph();
  const activeIds = getConnectedComponentIds(componentGraph);

  if (activeIds.length > 0 && activeIds.length < components.length) {
    const disconnected = components
      .filter((component) => !activeIds.includes(component.id))
      .map((component) => component.id);
    items.push({ type: "warning", message: `存在未接入主电路的元件：${disconnected.join("、")}。` });
  }

  return { terminalIssues, closedSources, shortSources, items };
}

function getNodeIdsConnectedToComponent(componentId) {
  const nodeIds = new Set();

  connections.forEach((connection) => {
    const from = parseTerminalKey(connection.from);
    const to = parseTerminalKey(connection.to);

    if (from.componentId === componentId) {
      const target = components.find((component) => component.id === to.componentId);

      if (target && target.type === "node") {
        nodeIds.add(target.id);
      }
    }

    if (to.componentId === componentId) {
      const target = components.find((component) => component.id === from.componentId);

      if (target && target.type === "node") {
        nodeIds.add(target.id);
      }
    }
  });

  return Array.from(nodeIds);
}

function getResistorNodePair(resistorId) {
  const nodePair = getNodeIdsConnectedToComponent(resistorId).sort();
  return nodePair.length === 2 ? nodePair : [];
}

function getMixedCircuitInfo() {
  const sources = components.filter((component) => component.type === "source");
  const resistors = components.filter((component) => component.type === "resistor");
  const unsupported = components.filter((component) => {
    return !["source", "resistor", "node"].includes(component.type);
  });

  if (sources.length !== 1 || resistors.length < 3 || unsupported.length > 0) {
    return null;
  }

  const source = sources[0];
  const returnNodes = getConnectedComponentIdsByTerminal(`${source.id}.left`)
    .filter((id) => components.some((component) => component.id === id && component.type === "node"));
  const positiveNeighbors = getConnectedTerminals(`${source.id}.right`)
    .map(parseTerminalKey)
    .filter(({ componentId }) => components.some((component) => component.id === componentId && component.type === "resistor"));

  if (returnNodes.length !== 1 || positiveNeighbors.length !== 1) {
    return null;
  }

  const returnNodeId = returnNodes[0];
  const seriesResistor = components.find((component) => component.id === positiveNeighbors[0].componentId);
  const seriesResistorNodeIds = getNodeIdsConnectedToComponent(seriesResistor.id);

  if (seriesResistorNodeIds.length !== 1 || seriesResistorNodeIds[0] === returnNodeId) {
    return null;
  }

  const branchNodeId = seriesResistorNodeIds[0];
  const nodePair = [branchNodeId, returnNodeId].sort();
  const parallelResistors = resistors.filter((resistor) => {
    if (resistor.id === seriesResistor.id) {
      return false;
    }

    const resistorNodePair = getResistorNodePair(resistor.id);
    return resistorNodePair.length === 2 &&
      resistorNodePair[0] === nodePair[0] &&
      resistorNodePair[1] === nodePair[1];
  });

  if (parallelResistors.length !== resistors.length - 1 || parallelResistors.length < 2) {
    return null;
  }

  return {
    source,
    seriesResistor,
    parallelResistors,
    branchNodeId,
    returnNodeId
  };
}

function calculateMixedCircuit() {
  const mixedInfo = getMixedCircuitInfo();

  if (!mixedInfo) {
    return null;
  }

  const voltage = parseElectricalValue(mixedInfo.source.value, "source");
  const seriesResistance = parseElectricalValue(mixedInfo.seriesResistor.value, "resistor");
  const parallelValues = mixedInfo.parallelResistors.map((component) => ({
    component,
    resistance: parseElectricalValue(component.value, "resistor")
  }));
  const invalidParallelResistor = parallelValues.find((item) => item.resistance === null || item.resistance <= 0);

  if (voltage === null) {
    return [`无法识别 ${mixedInfo.source.id} 的电压值，请输入类似 12V 的格式。`];
  }

  if (seriesResistance === null || seriesResistance <= 0) {
    return [`无法识别 ${mixedInfo.seriesResistor.id} 的电阻值，请输入类似 10Ω 或 2.2kΩ 的格式。`];
  }

  if (invalidParallelResistor) {
    return [`无法识别 ${invalidParallelResistor.component.id} 的电阻值，请输入类似 10Ω 或 2.2kΩ 的格式。`];
  }

  const reciprocalSum = parallelValues.reduce((sum, item) => sum + 1 / item.resistance, 0);
  const parallelResistance = 1 / reciprocalSum;
  const totalResistance = seriesResistance + parallelResistance;
  const totalCurrent = voltage / totalResistance;
  const seriesVoltage = totalCurrent * seriesResistance;
  const parallelVoltage = voltage - seriesVoltage;
  const lines = [
    `识别到简单混联电路：${mixedInfo.seriesResistor.id} 串联 ${parallelValues.map((item) => item.component.id).join("、")} 的并联支路。`,
    `先算并联部分：1 / R并 = ${parallelValues.map((item) => `1 / ${item.component.id}`).join(" + ")}。`,
    `R并 = ${formatNumber(parallelResistance, "Ω")}。`,
    `总电阻公式：R总 = ${mixedInfo.seriesResistor.id} + R并 = ${formatNumber(seriesResistance, "Ω")} + ${formatNumber(parallelResistance, "Ω")}。`,
    `R总 = ${formatNumber(totalResistance, "Ω")}。`,
    `总电流 I总 = U / R总 = ${formatNumber(voltage, "V")} / ${formatNumber(totalResistance, "Ω")} = ${formatNumber(totalCurrent, "A")}。`,
    `${mixedInfo.seriesResistor.id} 分压：U = I总 × R = ${formatNumber(totalCurrent, "A")} × ${formatNumber(seriesResistance, "Ω")} = ${formatNumber(seriesVoltage, "V")}。`,
    `并联支路电压：U并 = ${formatNumber(voltage, "V")} - ${formatNumber(seriesVoltage, "V")} = ${formatNumber(parallelVoltage, "V")}。`
  ];

  parallelValues.forEach((item) => {
    const branchCurrent = parallelVoltage / item.resistance;
    lines.push(`${item.component.id} 支路电流：I = U并 / R = ${formatNumber(parallelVoltage, "V")} / ${formatNumber(item.resistance, "Ω")} = ${formatNumber(branchCurrent, "A")}。`);
  });

  lines.push("说明：这是基础串并联混合计算，只处理一个串联电阻加一组并联电阻的清晰结构。");
  return lines;
}

function getParallelCircuitInfo() {
  const sources = components.filter((component) => component.type === "source");
  const resistors = components.filter((component) => component.type === "resistor");
  const unsupported = components.filter((component) => {
    return !["source", "resistor", "node"].includes(component.type);
  });

  if (sources.length !== 1 || resistors.length < 2 || unsupported.length > 0) {
    return null;
  }

  const source = sources[0];
  const leftNodeIds = getConnectedComponentIdsByTerminal(`${source.id}.left`)
    .filter((id) => components.some((component) => component.id === id && component.type === "node"));
  const rightNodeIds = getConnectedComponentIdsByTerminal(`${source.id}.right`)
    .filter((id) => components.some((component) => component.id === id && component.type === "node"));

  if (leftNodeIds.length !== 1 || rightNodeIds.length !== 1 || leftNodeIds[0] === rightNodeIds[0]) {
    return null;
  }

  const nodePair = [leftNodeIds[0], rightNodeIds[0]].sort();
  const validResistors = resistors.every((resistor) => {
    const resistorNodePair = getNodeIdsConnectedToComponent(resistor.id).sort();
    return resistorNodePair.length === 2 &&
      resistorNodePair[0] === nodePair[0] &&
      resistorNodePair[1] === nodePair[1];
  });

  if (!validResistors) {
    return null;
  }

  return {
    source,
    resistors,
    nodePair
  };
}

function calculateParallelCircuit() {
  const parallelInfo = getParallelCircuitInfo();

  if (!parallelInfo) {
    return null;
  }

  const voltage = parseElectricalValue(parallelInfo.source.value, "source");
  const resistorValues = parallelInfo.resistors.map((component) => ({
    component,
    resistance: parseElectricalValue(component.value, "resistor")
  }));
  const invalidResistor = resistorValues.find((item) => item.resistance === null || item.resistance <= 0);

  if (voltage === null) {
    return [`无法识别 ${parallelInfo.source.id} 的电压值，请输入类似 12V 的格式。`];
  }

  if (invalidResistor) {
    return [`无法识别 ${invalidResistor.component.id} 的电阻值，请输入类似 10Ω 或 2.2kΩ 的格式。`];
  }

  const reciprocalSum = resistorValues.reduce((sum, item) => sum + 1 / item.resistance, 0);
  const totalResistance = 1 / reciprocalSum;
  const totalCurrent = voltage / totalResistance;
  const lines = [
    `识别到简单并联电路：${resistorValues.map((item) => item.component.id).join("、")} 跨接在 ${parallelInfo.nodePair.join(" 与 ")} 之间。`,
    `并联总电阻公式：1 / R总 = ${resistorValues.map((item) => `1 / ${item.component.id}`).join(" + ")}。`,
    `R总 = ${formatNumber(totalResistance, "Ω")}。`,
    `并联支路电压相同：每个电阻两端电压均为 ${formatNumber(voltage, "V")}。`,
    `总电流 I总 = U / R总 = ${formatNumber(voltage, "V")} / ${formatNumber(totalResistance, "Ω")} = ${formatNumber(totalCurrent, "A")}。`
  ];

  resistorValues.forEach((item) => {
    const branchCurrent = voltage / item.resistance;
    lines.push(`${item.component.id} 支路电流：I = U / R = ${formatNumber(voltage, "V")} / ${formatNumber(item.resistance, "Ω")} = ${formatNumber(branchCurrent, "A")}。`);
  });

  lines.push("说明：这是基础直流并联计算，暂不处理混联、复杂回路或电容电感动态过程。");
  return lines;
}

function calculateSeriesCircuit() {
  if (components.length === 0) {
    return ["当前还没有元件，无法计算。"];
  }

  const sources = components.filter((component) => component.type === "source");
  const diagnostics = getCircuitDiagnostics();

  if (sources.length !== 1 || !diagnostics.closedSources.has(sources[0].id)) {
    return ["当前电路尚未闭合，无法产生持续电流。请先把电源正极经过负载接回负极。"];
  }

  const source = sources[0];
  const path = findTerminalPath(`${source.id}.right`, `${source.id}.left`);
  const pathComponentIds = path
    .map((step) => step.viaComponent)
    .filter(Boolean);
  const simplePathComponents = [
    source,
    ...pathComponentIds.map((id) => components.find((component) => component.id === id)).filter(Boolean)
  ];
  const unsupported = simplePathComponents.filter((component) => {
    return !["source", "resistor", "node"].includes(component.type);
  });

  if (unsupported.length > 0) {
    return [`当前路径包含 ${unsupported.map((component) => component.id).join("、")}，暂不计算电容、电感或交流相量。`];
  }

  const resistors = simplePathComponents.filter((component) => component.type === "resistor");

  if (resistors.length === 0) {
    return ["串联计算至少需要 1 个电阻。"];
  }

  const hasBranch = components.some((component) => {
    if (component.type === "node") {
      return getConnectedTerminals(`${component.id}.center`).length > 2;
    }

    return getConnectedTerminals(`${component.id}.left`).length > 1 ||
      getConnectedTerminals(`${component.id}.right`).length > 1;
  });

  if (hasBranch || new Set(pathComponentIds).size !== components.filter((component) => component.type !== "node" && component.type !== "source").length) {
    return ["当前闭合电路包含分支或多个独立部分，暂不按纯串联电路计算。"];
  }

  const voltage = parseElectricalValue(source.value, "source");
  const resistorValues = resistors.map((component) => ({
    component,
    resistance: parseElectricalValue(component.value, "resistor")
  }));
  const invalidResistor = resistorValues.find((item) => item.resistance === null || item.resistance <= 0);

  if (voltage === null) {
    return [`无法识别 ${source.id} 的电压值，请输入类似 12V 的格式。`];
  }

  if (invalidResistor) {
    return [`无法识别 ${invalidResistor.component.id} 的电阻值，请输入类似 10Ω 或 2.2kΩ 的格式。`];
  }

  const totalResistance = resistorValues.reduce((sum, item) => sum + item.resistance, 0);
  const current = voltage / totalResistance;
  const lines = [
    `识别到闭合串联回路：${source.id} → ${resistors.map((component) => component.id).join(" → ")} → ${source.id}。`,
    `串联总电阻公式：R总 = ${resistorValues.map((item) => item.component.id).join(" + ")}。`,
    `R总 = ${formatNumber(totalResistance, "Ω")}。`,
    `总电流公式：I = U / R总 = ${formatNumber(voltage, "V")} / ${formatNumber(totalResistance, "Ω")}。`,
    `总电流 I = ${formatNumber(current, "A")}。`
  ];

  resistorValues.forEach((item) => {
    const voltageDrop = current * item.resistance;
    lines.push(`${item.component.id} 分压：U = I × R = ${formatNumber(current, "A")} × ${formatNumber(item.resistance, "Ω")} = ${formatNumber(voltageDrop, "V")}。`);
  });

  lines.push("说明：只有电源正负极通过负载形成闭合回路后，程序才会给出直流电流。");
  return lines;
}

function createWirePotentialMap() {
  const parent = new Map();

  components.forEach((component) => {
    getTerminalKeys(component).forEach((key) => parent.set(key, key));
  });

  function find(key) {
    if (!parent.has(key)) {
      return null;
    }

    const currentParent = parent.get(key);

    if (currentParent !== key) {
      parent.set(key, find(currentParent));
    }

    return parent.get(key);
  }

  function union(first, second) {
    const firstRoot = find(first);
    const secondRoot = find(second);

    if (firstRoot && secondRoot && firstRoot !== secondRoot) {
      parent.set(secondRoot, firstRoot);
    }
  }

  connections.forEach((connection) => union(connection.from, connection.to));

  const potentials = new Map();

  return {
    set(key, value) {
      const root = find(key);

      if (root) {
        potentials.set(root, value);
      }
    },
    get(key) {
      const root = find(key);
      return root && potentials.has(root) ? potentials.get(root) : null;
    }
  };
}

function buildDcMeasurementModel() {
  const sources = components.filter((component) => component.type === "source");
  const unsupported = components.filter((component) => !["source", "resistor", "node"].includes(component.type));
  const diagnostics = getCircuitDiagnostics();

  if (sources.length !== 1) {
    return { error: "万用表计算暂时需要恰好一个直流电源。" };
  }

  const source = sources[0];
  const sourceVoltage = parseElectricalValue(source.value, "source");

  if (sourceVoltage === null) {
    return { error: `无法识别 ${source.id} 的电压值。` };
  }

  if (unsupported.length > 0) {
    return { error: "当前回路含有电容或电感，V10 暂不计算动态测量值。" };
  }

  if (diagnostics.shortSources.has(source.id)) {
    return {
      error: "检测到电源正负极疑似短路，已停止万用表计算。请先加入负载电阻或删除短接导线。",
      shortCircuit: true,
      source,
      sourceVoltage
    };
  }

  if (!diagnostics.closedSources.has(source.id)) {
    const potentials = createWirePotentialMap();
    potentials.set(`${source.id}.right`, sourceVoltage);
    potentials.set(`${source.id}.left`, 0);

    return {
      error: "当前电路未闭合，电流为 0 A；负载电压需要补全回路后计算。",
      openCircuit: true,
      source,
      sourceVoltage,
      potentials
    };
  }

  const potentials = createWirePotentialMap();
  const componentMeasurements = new Map();
  let totalCurrent = null;
  let circuitType = "";
  const mixedInfo = getMixedCircuitInfo();
  const parallelInfo = getParallelCircuitInfo();

  if (mixedInfo) {
    const seriesResistance = parseElectricalValue(mixedInfo.seriesResistor.value, "resistor");
    const parallelValues = mixedInfo.parallelResistors.map((component) => ({
      component,
      resistance: parseElectricalValue(component.value, "resistor")
    }));

    if (seriesResistance === null || parallelValues.some((item) => item.resistance === null || item.resistance <= 0)) {
      return { error: "回路中存在无法识别的电阻值。" };
    }

    const parallelResistance = 1 / parallelValues.reduce((sum, item) => sum + 1 / item.resistance, 0);
    totalCurrent = sourceVoltage / (seriesResistance + parallelResistance);
    const branchVoltage = sourceVoltage - totalCurrent * seriesResistance;

    potentials.set(`${source.id}.right`, sourceVoltage);
    potentials.set(`${source.id}.left`, 0);
    potentials.set(`${mixedInfo.branchNodeId}.center`, branchVoltage);
    potentials.set(`${mixedInfo.returnNodeId}.center`, 0);
    circuitType = "混联";
  } else if (parallelInfo) {
    const resistorValues = parallelInfo.resistors.map((component) => parseElectricalValue(component.value, "resistor"));

    if (resistorValues.some((value) => value === null || value <= 0)) {
      return { error: "并联回路中存在无法识别的电阻值。" };
    }

    const totalResistance = 1 / resistorValues.reduce((sum, value) => sum + 1 / value, 0);
    totalCurrent = sourceVoltage / totalResistance;
    potentials.set(`${source.id}.right`, sourceVoltage);
    potentials.set(`${source.id}.left`, 0);
    circuitType = "并联";
  } else {
    const path = findTerminalPath(`${source.id}.right`, `${source.id}.left`);
    const resistorIds = path.map((step) => step.viaComponent).filter(Boolean);
    const resistorValues = resistorIds.map((id) => {
      const component = components.find((item) => item.id === id);
      return {
        component,
        resistance: component ? parseElectricalValue(component.value, "resistor") : null
      };
    });

    if (path.length === 0 || resistorValues.length === 0 ||
        resistorValues.some((item) => !item.component || item.component.type !== "resistor" || item.resistance === null || item.resistance <= 0)) {
      return { error: "当前闭合回路不是 V10 支持的纯电阻串联、并联或简单混联结构。" };
    }

    const totalResistance = resistorValues.reduce((sum, item) => sum + item.resistance, 0);
    totalCurrent = sourceVoltage / totalResistance;
    let currentPotential = sourceVoltage;

    path.forEach((step) => {
      potentials.set(step.from, currentPotential);

      if (step.viaComponent) {
        const item = resistorValues.find((entry) => entry.component.id === step.viaComponent);
        currentPotential -= totalCurrent * item.resistance;
      }

      potentials.set(step.to, currentPotential);
    });

    circuitType = "串联";
  }

  components.forEach((component) => {
    if (component.type === "source") {
      componentMeasurements.set(component.id, {
        voltage: sourceVoltage,
        current: totalCurrent,
        power: sourceVoltage * totalCurrent
      });
      return;
    }

    if (component.type === "node") {
      componentMeasurements.set(component.id, {
        voltage: potentials.get(`${component.id}.center`)
      });
      return;
    }

    if (component.type === "resistor") {
      const leftPotential = potentials.get(`${component.id}.left`);
      const rightPotential = potentials.get(`${component.id}.right`);
      const resistance = parseElectricalValue(component.value, "resistor");

      if (leftPotential !== null && rightPotential !== null && resistance !== null && resistance > 0) {
        const voltage = Math.abs(leftPotential - rightPotential);
        const current = voltage / resistance;
        componentMeasurements.set(component.id, {
          resistance,
          voltage,
          current,
          power: voltage * current
        });
      }
    }
  });

  return {
    circuitType,
    source,
    sourceVoltage,
    totalCurrent,
    potentials,
    componentMeasurements
  };
}

function formatMeterValue(value, unit) {
  if (!Number.isFinite(value)) {
    return "--";
  }

  if (Math.abs(value) >= 1000 && unit === "Ω") {
    return `${(value / 1000).toFixed(3).replace(/\.?0+$/, "")} kΩ`;
  }

  const digits = Math.abs(value) < 0.01 && value !== 0 ? 5 : 3;
  return `${value.toFixed(digits).replace(/\.?0+$/, "")} ${unit}`;
}

function getSelectedWireMeasurement(model) {
  const connection = selectedConnectionIndex === null ? null : connections[selectedConnectionIndex];

  if (!connection) {
    return null;
  }

  const fromPotential = model.potentials ? model.potentials.get(connection.from) : null;
  const toPotential = model.potentials ? model.potentials.get(connection.to) : null;
  const connectedIds = [connection.from, connection.to]
    .map((key) => parseTerminalKey(key).componentId);
  const currents = connectedIds
    .map((id) => model.componentMeasurements && model.componentMeasurements.get(id))
    .filter(Boolean)
    .map((measurement) => measurement.current)
    .filter(Number.isFinite);
  const uniqueCurrents = currents.filter((value, index) => {
    return currents.findIndex((other) => Math.abs(other - value) < 1e-9) === index;
  });

  return {
    voltage: fromPotential !== null && toPotential !== null ? Math.abs(fromPotential - toPotential) : null,
    current: uniqueCurrents.length === 1 ? uniqueCurrents[0] : null,
    resistance: 0
  };
}

function getProbePotential(model, terminalKey) {
  if (!terminalKey) {
    return null;
  }

  if (model.potentials) {
    const potential = model.potentials.get(terminalKey);

    if (potential !== null) {
      return potential;
    }
  }

  if (model.source) {
    if (terminalKey === `${model.source.id}.right`) {
      return model.sourceVoltage;
    }

    if (terminalKey === `${model.source.id}.left`) {
      return 0;
    }
  }

  return null;
}

function getProbeResistance() {
  if (!meterProbes.red || !meterProbes.black) {
    return null;
  }

  const red = parseTerminalKey(meterProbes.red);
  const black = parseTerminalKey(meterProbes.black);

  if (red.componentId === black.componentId) {
    const component = components.find((item) => item.id === red.componentId);

    if (component && component.type === "resistor" && red.side !== black.side) {
      return parseElectricalValue(component.value, "resistor");
    }
  }

  if (meterProbes.red === meterProbes.black) {
    return 0;
  }

  const directWire = connections.some((connection) => {
    return (connection.from === meterProbes.red && connection.to === meterProbes.black) ||
      (connection.from === meterProbes.black && connection.to === meterProbes.red);
  });

  return directWire ? 0 : null;
}

function renderProbeControls() {
  pruneInvalidProbes();
  redProbeBtn.classList.toggle("active", activeProbe === "red");
  blackProbeBtn.classList.toggle("active", activeProbe === "black");
  clearProbeBtn.disabled = !meterProbes.red && !meterProbes.black;
  probeStatusText.textContent = getProbeStatusText();
}

function renderProbeMeasurement(model, units) {
  if (!meterProbes.red && !meterProbes.black) {
    return false;
  }

  meterTarget.textContent = getProbeStatusText();

  if (!meterProbes.red || !meterProbes.black) {
    meterReading.textContent = "--";
    meterExplanation.textContent = "请继续放置另一支表笔，才能得到两点之间的测量值。";
    return true;
  }

  if (meterMode === "current") {
    meterReading.textContent = "--";
    meterExplanation.textContent = "双表笔模式主要用于测两点电压差；电流请继续点击元件或导线查看估算值。";
    return true;
  }

  if (meterMode === "resistance") {
    const resistance = getProbeResistance();
    meterReading.textContent = Number.isFinite(resistance) ? formatMeterValue(resistance, units.resistance) : "--";
    meterExplanation.textContent = Number.isFinite(resistance)
      ? "红黑表笔跨接在可识别电阻或同一理想导线两端。"
      : "当前两点之间不是单个可识别电阻，暂不能给出等效电阻。";
    return true;
  }

  if (model.error && !model.openCircuit) {
    meterReading.textContent = "--";
    meterExplanation.textContent = model.error;
    return true;
  }

  const redPotential = getProbePotential(model, meterProbes.red);
  const blackPotential = getProbePotential(model, meterProbes.black);

  if (redPotential === null || blackPotential === null) {
    meterReading.textContent = "--";
    meterExplanation.textContent = model.openCircuit
      ? "开路时只能稳定读取电源两端电压，负载端电位需要闭合回路后才能计算。"
      : "当前两点电位暂时无法由支持的电路结构推导。";
    return true;
  }

  const voltage = redPotential - blackPotential;
  meterReading.textContent = formatMeterValue(voltage, units.voltage);
  meterExplanation.textContent = `红笔电位 ${formatMeterValue(redPotential, "V")}，黑笔电位 ${formatMeterValue(blackPotential, "V")}，读数为红笔减黑笔。`;
  return true;
}

function renderMultimeter() {
  const modeLabels = {
    voltage: "直流电压",
    current: "直流电流",
    resistance: "电阻"
  };
  const units = {
    voltage: "V",
    current: "A",
    resistance: "Ω"
  };
  const component = components.find((item) => item.id === selectedComponentId);
  const connection = selectedConnectionIndex === null ? null : connections[selectedConnectionIndex];
  const model = buildDcMeasurementModel();

  renderProbeControls();
  meterModeLabel.textContent = modeLabels[meterMode];
  meterModeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.meterMode === meterMode);
  });

  if (renderProbeMeasurement(model, units)) {
    return;
  }

  if (!component && !connection) {
    meterReading.textContent = "--";
    meterTarget.textContent = "请选择元件或导线";
    meterExplanation.textContent = "选择档位后，点击画布中的元件或导线开始测量。";
    return;
  }

  if (component) {
    meterTarget.textContent = getComponentLabel(component.id);

    if (meterMode === "resistance" && component.type === "resistor") {
      const resistance = parseElectricalValue(component.value, "resistor");
      meterReading.textContent = resistance === null ? "--" : formatMeterValue(resistance, "Ω");
      meterExplanation.textContent = resistance === null
        ? "无法识别该电阻值，请输入类似 10Ω 或 2.2kΩ。"
        : "电阻档读取元件标称阻值；实际测量时应先断开电源。";
      return;
    }

    if (meterMode === "voltage" && component.type === "source") {
      const voltage = parseElectricalValue(component.value, "source");
      meterReading.textContent = voltage === null ? "--" : formatMeterValue(voltage, "V");
      meterExplanation.textContent = "这是直流电源正负极之间的标称电压。";
      return;
    }

    if (meterMode === "current" && model.openCircuit) {
      meterReading.textContent = "0 A";
      meterExplanation.textContent = "电路没有闭合，因此没有持续电流。";
      return;
    }

    if (model.error) {
      meterReading.textContent = "--";
      meterExplanation.textContent = model.error;
      return;
    }

    const measurement = model.componentMeasurements.get(component.id);

    if (!measurement || !Number.isFinite(measurement[meterMode])) {
      meterReading.textContent = "--";
      meterExplanation.textContent = component.type === "node"
        ? "等电位点可测相对电压，但不能单独定义电流或电阻。"
        : "当前档位暂时不能测量这个元件。";
      return;
    }

    meterReading.textContent = formatMeterValue(measurement[meterMode], units[meterMode]);

    if (component.type === "resistor") {
      meterExplanation.textContent = `${model.circuitType}计算：U=${formatMeterValue(measurement.voltage, "V")}，I=${formatMeterValue(measurement.current, "A")}，P=${formatMeterValue(measurement.power, "W")}。`;
    } else if (component.type === "node") {
      meterExplanation.textContent = `相对于 ${model.source.id} 负极的节点电压。`;
    } else {
      meterExplanation.textContent = `电源正在向当前${model.circuitType}回路提供约 ${formatMeterValue(measurement.power, "W")}。`;
    }

    return;
  }

  meterTarget.textContent = `${connection.from} ↔ ${connection.to}`;

  if (meterMode === "resistance") {
    meterReading.textContent = "0 Ω";
    meterExplanation.textContent = "理想导线电阻按 0Ω 处理。";
    return;
  }

  if (meterMode === "current" && model.openCircuit) {
    meterReading.textContent = "0 A";
    meterExplanation.textContent = "开路状态下，这条导线没有持续电流。";
    return;
  }

  if (model.error) {
    meterReading.textContent = "--";
    meterExplanation.textContent = model.error;
    return;
  }

  const wireMeasurement = getSelectedWireMeasurement(model);
  const value = wireMeasurement ? wireMeasurement[meterMode] : null;
  meterReading.textContent = Number.isFinite(value) ? formatMeterValue(value, units[meterMode]) : "--";
  meterExplanation.textContent = Number.isFinite(value)
    ? (meterMode === "voltage" ? "理想导线两端应为同一电位，因此压降接近 0V。" : "该导线电流由相邻支路电流确定。")
    : "这条导线位于分流节点，单独选择导线无法唯一确定各方向电流。";
}

function renderCalculation() {
  calculationResult.innerHTML = "";

  const calculationLines = getCalculationLines();

  calculationLines.forEach((line) => {
    const item = document.createElement("li");
    item.textContent = line;
    calculationResult.appendChild(item);
  });
}

// 统一生成当前可识别电路的解题步骤，供页面显示、复制和下载复用
function getCalculationLines() {
  const diagnostics = getCircuitDiagnostics();
  const sources = components.filter((component) => component.type === "source");

  if (sources.length === 1 && diagnostics.shortSources.has(sources[0].id)) {
    return [`检测到 ${sources[0].id} 正负极疑似短路，请先加入电阻负载或删除直接短接的导线，再进行计算。`];
  }

  if (sources.length === 1 && !diagnostics.closedSources.has(sources[0].id)) {
    return ["当前电路尚未闭合，无法产生持续电流。请根据“电路体检”中的红色端点提示补全回路。"];
  }

  return calculateMixedCircuit() || calculateParallelCircuit() || calculateSeriesCircuit();
}

function getCalculationText() {
  const lines = getCalculationLines();
  const createdAt = new Date().toLocaleString("zh-CN");

  return [
    "Circuit Problem Solver Lite - 直流电路解题步骤",
    `生成时间：${createdAt}`,
    "",
    ...lines
  ].join("\n");
}

function getProjectReportText() {
  const createdAt = new Date().toLocaleString("zh-CN");
  const componentLines = components.length === 0
    ? ["暂无元件。"]
    : components.map((component) => {
      const rotationText = component.type === "node" ? "" : `，旋转 ${getComponentRotation(component)}°`;
      return `${component.id}：${componentConfig[component.type].label}，数值 ${component.value}，位置 (${component.x}, ${component.y})${rotationText}`;
    });
  const connectionLines = connections.length === 0
    ? ["暂无导线连接。"]
    : connections.map((connection, index) => `${index + 1}. ${getTerminalLabel(connection.from)} ↔ ${getTerminalLabel(connection.to)}`);
  const analysisLines = analyzeCircuit().map((entry) => {
    const result = typeof entry === "string" ? { type: "info", message: entry } : entry;
    return `${result.type}：${result.message}`;
  });
  const calculationLines = getCalculationLines();

  return [
    "Circuit Problem Solver Lite V10 - 中文电路报告",
    `生成时间：${createdAt}`,
    "",
    "一、元件清单",
    ...componentLines,
    "",
    "二、连接关系",
    ...connectionLines,
    "",
    "三、电路体检",
    ...analysisLines,
    "",
    "四、直流计算步骤",
    ...calculationLines,
    "",
    "五、当前万用表读数",
    `档位：${meterModeLabel.textContent}`,
    `对象：${meterTarget.textContent}`,
    `读数：${meterReading.textContent}`,
    `说明：${meterExplanation.textContent}`
  ].join("\n");
}

function analyzeCircuit() {
  const diagnostics = getCircuitDiagnostics();
  if (components.length === 0) {
    return diagnostics.items;
  }
  const graph = buildComponentGraph();
  const connectedIds = getConnectedComponentIds(graph);
  const isolatedComponents = components.filter((component) => graph.get(component.id).degree === 0);
  const nodeCount = components.filter((component) => component.type === "node").length;
  const simplePath = findSimplePath(graph);
  const lines = [
    ...diagnostics.items,
    { type: "info", message: `当前共有 ${components.length} 个元件、${connections.length} 条导线。` }
  ];

  if (isolatedComponents.length > 0) {
    lines.push({ type: "warning", message: `还有 ${isolatedComponents.length} 个元件没有接入电路：${isolatedComponents.map((component) => component.id).join("、")}。` });
  } else {
    lines.push({ type: "success", message: "所有元件都已经至少连接了一条导线。" });
  }

  if (nodeCount > 0) {
    lines.push({ type: "info", message: `检测到 ${nodeCount} 个等电位点，可用于表示同一电位的汇合位置。` });
  }

  if (diagnostics.closedSources.size > 0) {
    lines.push({ type: "success", message: "当前主电源已经形成闭合回路，可以继续进行支持范围内的计算。" });
  } else if (simplePath.length >= 2) {
    lines.push({ type: "info", message: `结构路径：${simplePath.join(" → ")}。` });
  } else if (connectedIds.length > 0) {
    lines.push({ type: "info", message: "当前连接关系包含分支、回路或多个独立部分。" });
  } else {
    lines.push({ type: "info", message: "当前还没有形成可分析的连接路径。" });
  }

  Array.from(graph.values()).forEach((entry) => {
    lines.push({ type: "info", message: describeComponentConnection(entry) });
  });

  return lines;
}

function renderAnalysis() {
  circuitAnalysis.innerHTML = "";

  analyzeCircuit().forEach((entry) => {
    const item = document.createElement("li");
    const result = typeof entry === "string" ? { type: "info", message: entry } : entry;
    item.textContent = result.message;
    item.classList.add(`analysis-${result.type}`);
    circuitAnalysis.appendChild(item);
  });
}

function getComponentConnections(componentId) {
  return connections.filter((connection) => {
    return parseTerminalKey(connection.from).componentId === componentId ||
      parseTerminalKey(connection.to).componentId === componentId;
  });
}

function renderComponentConnectionList(component) {
  componentConnectionList.innerHTML = "";

  if (!component) {
    const item = document.createElement("li");
    item.textContent = "未选择元件";
    componentConnectionList.appendChild(item);
    return;
  }

  const relatedConnections = getComponentConnections(component.id);

  if (relatedConnections.length === 0) {
    const item = document.createElement("li");
    item.textContent = "当前元件还没有连接。";
    componentConnectionList.appendChild(item);
    return;
  }

  relatedConnections.forEach((connection) => {
    const item = document.createElement("li");
    item.textContent = `${getTerminalLabel(connection.from)} ↔ ${getTerminalLabel(connection.to)}`;
    componentConnectionList.appendChild(item);
  });
}

// 更新左侧元件编辑栏
function updateEditor() {
  const component = components.find((item) => item.id === selectedComponentId);
  const selectedConnection = selectedConnectionIndex === null ? null : connections[selectedConnectionIndex];

  if (!component) {
    selectedName.textContent = "未选择元件";
    valueInput.value = "";
    valueInput.disabled = true;
    applyValueBtn.disabled = true;
    rotateBtn.disabled = true;
    duplicateBtn.disabled = true;
    deleteBtn.disabled = true;
  } else {
    selectedName.textContent = component.type === "node"
      ? `当前选择：${component.id}`
      : `当前选择：${component.id}（${getComponentRotation(component)}°）`;
    valueInput.value = component.value;
    valueInput.disabled = false;
    applyValueBtn.disabled = false;
    rotateBtn.disabled = component.type === "node";
    duplicateBtn.disabled = false;
    deleteBtn.disabled = false;
  }

  renderComponentConnectionList(component);
  connectionHint.textContent = pendingTerminal ? `已选择：${pendingTerminal}` : "未选择端点";
  selectedConnectionText.textContent = selectedConnection
    ? `当前导线：${selectedConnection.from} → ${selectedConnection.to}`
    : "未选择导线";
  cancelConnectionBtn.disabled = !pendingTerminal;
  deleteConnectionBtn.disabled = !selectedConnection;
}

// 显示底部操作提示
function setStatus(message, type = "") {
  statusText.textContent = message;
  statusText.className = `status-text ${type}`.trim();
}

// 统一渲染页面
function render() {
  renderConnections();
  renderComponents();
  renderJson();
  renderSummary();
  renderAnalysis();
  renderCalculation();
  renderMultimeter();
  updateEditor();
  updateHistoryButtons();
  updateCanvasView();
  saveProjectToLocalStorage();
}

// 创建工具栏拖拽预览，让拖拽过程更直观
function createToolPreview(type, x, y) {
  const config = componentConfig[type];
  const size = getComponentSize(type);
  const preview = document.createElement("div");
  preview.className = `component type-${type}`;
  preview.style.pointerEvents = "none";
  preview.style.position = "fixed";
  preview.style.left = `${x - size.width / 2}px`;
  preview.style.top = `${y - size.height / 2}px`;
  preview.style.width = `${size.width}px`;
  preview.style.height = `${size.height}px`;
  preview.style.opacity = "0.85";
  preview.innerHTML = `
    ${getSchematicMarkup(type)}
    <span class="component-name">${config.prefix}</span>
    <span class="component-value">${config.value}</span>
  `;
  document.body.appendChild(preview);
  return preview;
}

// 判断鼠标位置是否在画布内部
function isPointInCanvas(x, y) {
  const rect = canvas.getBoundingClientRect();
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function startCanvasPan(event) {
  isPanningCanvas = true;
  panStartX = event.clientX;
  panStartY = event.clientY;
  panStartOffsetX = canvasOffsetX;
  panStartOffsetY = canvasOffsetY;
  canvas.classList.add("panning");
}

// 工具栏拖拽：只使用 Pointer 事件创建元件，避免原生拖拽和自定义拖拽重复触发
toolItems.forEach((tool) => {
  tool.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    draggedToolType = tool.dataset.type;
    currentToolPointerId = event.pointerId;
    toolDragCreated = false;
    toolPreview = createToolPreview(draggedToolType, event.clientX, event.clientY);
    tool.setPointerCapture(event.pointerId);
  });
});

// 允许元件拖拽到画布上
canvas.addEventListener("dragover", (event) => {
  event.preventDefault();
  canvas.classList.add("drag-over");
});

canvas.addEventListener("dragleave", () => {
  canvas.classList.remove("drag-over");
});

// 点击空白画布时取消选中
canvas.addEventListener("click", () => {
  if (suppressNextCanvasClick) {
    suppressNextCanvasClick = false;
    return;
  }

  clearSelection();
  render();
});

wireLayer.addEventListener("pointerdown", (event) => {
  const connectionIndex = event.target.dataset ? event.target.dataset.connectionIndex : null;

  if (connectionIndex !== null && connectionIndex !== undefined) {
    event.preventDefault();
    event.stopPropagation();
    selectConnection(Number(connectionIndex));
    return;
  }

  if (event.target === wireLayer) {
    if (isPanMode) {
      event.preventDefault();
      event.stopPropagation();
      startCanvasPan(event);
      return;
    }

    clearSelection();
    render();
  }
});

// 拖动画布中的已有元件，实时更新 components 中的 x、y
document.addEventListener("pointermove", (event) => {
  if (isPanningCanvas) {
    canvasOffsetX = panStartOffsetX + event.clientX - panStartX;
    canvasOffsetY = panStartOffsetY + event.clientY - panStartY;
    updateCanvasView();
    return;
  }

  if (toolPreview) {
    const size = getComponentSize(draggedToolType);
    toolPreview.style.left = `${event.clientX - size.width / 2}px`;
    toolPreview.style.top = `${event.clientY - size.height / 2}px`;
    canvas.classList.toggle("drag-over", isPointInCanvas(event.clientX, event.clientY));
    return;
  }

  if (draggedWireIndex !== null && connections[draggedWireIndex]) {
    const worldPoint = getWorldPoint(event.clientX, event.clientY);
    const connection = connections[draggedWireIndex];
    const from = getWireAnchorPosition(connection.from);
    const to = getWireAnchorPosition(connection.to);

    if (!from || !to) {
      draggedWireIndex = null;
      return;
    }

    if (from.y === to.y) {
      const minY = Math.min(from.y, to.y) - GRID_SIZE * 3;
      const maxY = Math.max(from.y, to.y) + GRID_SIZE * 3;
      const nextBendY = snapToGrid(worldPoint.y);

      const clampedBendY = Math.min(Math.max(nextBendY, minY), maxY);
      wireDragChanged = wireDragChanged || connection.bendY !== clampedBendY;
      connection.bendY = clampedBendY;
    } else {
      const minX = Math.min(from.x, to.x) - GRID_SIZE * 3;
      const maxX = Math.max(from.x, to.x) + GRID_SIZE * 3;
      const nextBendX = snapToGrid(worldPoint.x);

      const clampedBendX = Math.min(Math.max(nextBendX, minX), maxX);
      wireDragChanged = wireDragChanged || connection.bendX !== clampedBendX;
      connection.bendX = clampedBendX;
    }

    render();
    return;
  }

  if (!draggedComponentId) {
    return;
  }

  const component = components.find((item) => item.id === draggedComponentId);
  const worldPoint = getWorldPoint(event.clientX, event.clientY);

  if (!component) {
    return;
  }

  const position = clampPosition(
    worldPoint.x - dragOffsetX,
    worldPoint.y - dragOffsetY,
    component.type
  );

  componentDragChanged = componentDragChanged || component.x !== position.x || component.y !== position.y;
  component.x = position.x;
  component.y = position.y;
  render();
});

// 松开鼠标时，如果工具栏元件位置在画布内，就创建新元件
document.addEventListener("pointerup", (event) => {
  if (draggedToolType && event.pointerId === currentToolPointerId) {
    if (!toolDragCreated && isPointInCanvas(event.clientX, event.clientY)) {
      const worldPoint = getWorldPoint(event.clientX, event.clientY);
      const size = getComponentSize(draggedToolType);
      addComponent(draggedToolType, worldPoint.x - size.width / 2, worldPoint.y - size.height / 2);
      toolDragCreated = true;
      setStatus("已添加新元件。", "success");
    }

    if (toolPreview) {
      toolPreview.remove();
    }
  }

  if (componentDragChanged || wireDragChanged) {
    recordHistory();
  }

  if (isPanningCanvas) {
    suppressNextCanvasClick = true;
    setStatus("已移动画布视图。", "success");
  }

  toolPreview = null;
  draggedToolType = null;
  currentToolPointerId = null;
  toolDragCreated = false;
  draggedComponentId = null;
  draggedWireIndex = null;
  isPanningCanvas = false;
  componentDragChanged = false;
  wireDragChanged = false;
  canvas.classList.remove("drag-over");
  canvas.classList.remove("panning");
});

// 清空画布、元件数据和连接数据
clearBtn.addEventListener("click", () => {
  const confirmed = window.confirm("确定要清空画布吗？");

  if (!confirmed) {
    return;
  }

  components = [];
  connections = [];
  clearSelection();
  pendingTerminal = null;
  resetProbeState();
  rebuildCounters();
  setStatus("画布已清空。", "success");
  render();
  recordHistory();
});

undoBtn.addEventListener("click", undoProjectChange);
redoBtn.addEventListener("click", redoProjectChange);
meterModeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    meterMode = button.dataset.meterMode;
    renderMultimeter();
  });
});
redProbeBtn.addEventListener("click", () => setActiveProbe("red"));
blackProbeBtn.addEventListener("click", () => setActiveProbe("black"));
clearProbeBtn.addEventListener("click", clearProbes);
restoreSavedBtn.addEventListener("click", () => {
  restoreSavedProject(true);
});

exampleBtn.addEventListener("click", loadExampleCircuit);
parallelExampleBtn.addEventListener("click", loadParallelExampleCircuit);
mixedExampleBtn.addEventListener("click", loadMixedExampleCircuit);
arrangeBtn.addEventListener("click", arrangeCanvas);
zoomOutBtn.addEventListener("click", () => {
  setCanvasScale(canvasScale - 0.1);
});
zoomResetBtn.addEventListener("click", resetCanvasView);
zoomInBtn.addEventListener("click", () => {
  setCanvasScale(canvasScale + 0.1);
});
fitViewBtn.addEventListener("click", fitCanvasView);
panModeBtn.addEventListener("click", () => {
  isPanMode = !isPanMode;
  canvas.classList.toggle("pan-mode", isPanMode);
  updateCanvasView();
  setStatus(isPanMode ? "已开启移动画布模式，拖动画布空白处即可平移。" : "已关闭移动画布模式。", "success");
});
downloadSvgBtn.addEventListener("click", downloadSvg);
downloadPngBtn.addEventListener("click", downloadPng);
rotateBtn.addEventListener("click", rotateSelectedComponent);
duplicateBtn.addEventListener("click", duplicateSelectedComponent);

// 应用左侧编辑栏中的数值修改
applyValueBtn.addEventListener("click", () => {
  const component = components.find((item) => item.id === selectedComponentId);

  if (!component) {
    return;
  }

  component.value = valueInput.value.trim() || component.value;
  setStatus(`已修改 ${component.id} 的数值。`, "success");
  render();
  recordHistory();
});

// 删除按钮
deleteBtn.addEventListener("click", deleteSelectedComponent);
deleteConnectionBtn.addEventListener("click", deleteSelectedConnection);

// 取消当前连线起点
cancelConnectionBtn.addEventListener("click", () => {
  pendingTerminal = null;
  setStatus("已取消当前连线。", "");
  render();
});

// Delete 键删除当前选中元件
document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  const isEditingText = ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName);

  if ((event.ctrlKey || event.metaKey) && key === "z" && !isEditingText) {
    event.preventDefault();
    undoProjectChange();
  } else if ((event.ctrlKey || event.metaKey) && key === "y" && !isEditingText) {
    event.preventDefault();
    redoProjectChange();
  } else if ((event.ctrlKey || event.metaKey) && key === "d" && selectedComponentId && !isEditingText) {
    event.preventDefault();
    duplicateSelectedComponent();
  } else if (key === "r" && selectedComponentId && !isEditingText) {
    event.preventDefault();
    rotateSelectedComponent();
  } else if (event.key === "Delete" && selectedComponentId && !isEditingText) {
    deleteSelectedComponent();
  } else if (event.key === "Delete" && selectedConnectionIndex !== null && !isEditingText) {
    deleteSelectedConnection();
  }
});

// 复制 JSON 到剪贴板
copyJsonBtn.addEventListener("click", async () => {
  await navigator.clipboard.writeText(JSON.stringify(getProjectData(), null, 2));
  setStatus("JSON 已复制到剪贴板。", "success");
});

// 下载 JSON 文件
downloadJsonBtn.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(getProjectData(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "circuit-project.json";
  link.click();
  URL.revokeObjectURL(url);
  setStatus("JSON 文件已开始下载。", "success");
});

// 检查导入的 components 数据是否符合格式
// 复制当前直流电路计算步骤，方便粘贴到报告或作业里
copyCalculationBtn.addEventListener("click", async () => {
  await navigator.clipboard.writeText(getCalculationText());
  setStatus("计算结果已复制到剪贴板。", "success");
});

// 下载当前直流电路计算步骤，保存为 txt 文本文件
downloadCalculationBtn.addEventListener("click", () => {
  const blob = new Blob([getCalculationText()], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "circuit-solution.txt";
  link.click();
  URL.revokeObjectURL(url);
  setStatus("解题步骤文本已开始下载。", "success");
});

copyReportBtn.addEventListener("click", async () => {
  await navigator.clipboard.writeText(getProjectReportText());
  setStatus("中文电路报告已复制到剪贴板。", "success");
});

downloadReportBtn.addEventListener("click", () => {
  const blob = new Blob([getProjectReportText()], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "circuit-report-v10.txt";
  link.click();
  URL.revokeObjectURL(url);
  setStatus("中文电路报告已开始下载。", "success");
});

function normalizeImportedComponents(data) {
  if (!Array.isArray(data)) {
    throw new Error("components 必须是数组。");
  }

  return data.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`第 ${index + 1} 个元件不是有效对象。`);
    }

    if (!componentConfig[item.type]) {
      throw new Error(`第 ${index + 1} 个元件的 type 不支持。`);
    }

    const config = componentConfig[item.type];
    const id = String(item.id || `${config.prefix}${index + 1}`);
    const value = String(item.value || config.value);
    const rotation = [0, 90, 180, 270].includes(Number(item.rotation)) ? Number(item.rotation) : 0;
    const position = clampPosition(Number(item.x) || 0, Number(item.y) || 0, item.type);

    return {
      id,
      type: item.type,
      value,
      rotation: item.type === "node" ? 0 : rotation,
      x: position.x,
      y: position.y
    };
  });
}

// 检查导入的 connections 数据是否符合格式
function normalizeImportedConnections(data, nextComponents) {
  if (!Array.isArray(data)) {
    return [];
  }

  const validIds = new Set(nextComponents.map((component) => component.id));

  return data.filter((connection) => {
    if (!connection || typeof connection !== "object") {
      return false;
    }

    const from = parseTerminalKey(String(connection.from || ""));
    const to = parseTerminalKey(String(connection.to || ""));
    return validIds.has(from.componentId) &&
      validIds.has(to.componentId) &&
      ["left", "right", "center"].includes(from.side) &&
      ["left", "right", "center"].includes(to.side);
  }).map((connection) => {
    const normalized = {
      from: String(connection.from),
      to: String(connection.to)
    };

    if (Number.isFinite(connection.bendX)) {
      normalized.bendX = Number(connection.bendX);
    }

    if (Number.isFinite(connection.bendY)) {
      normalized.bendY = Number(connection.bendY);
    }

    return normalized;
  });
}

// 导入 JSON 并恢复画布，兼容旧版 components 数组
importJsonBtn.addEventListener("click", () => {
  try {
    const imported = JSON.parse(importInput.value);
    const nextComponents = Array.isArray(imported)
      ? normalizeImportedComponents(imported)
      : normalizeImportedComponents(imported.components);
    const nextConnections = Array.isArray(imported)
      ? []
      : normalizeImportedConnections(imported.connections, nextComponents);

    components = nextComponents;
    connections = nextConnections;
    clearSelection();
    pendingTerminal = null;
    resetProbeState();
    rebuildCounters();
    setStatus("JSON 导入成功，画布已恢复。", "success");
    render();
    recordHistory();
  } catch (error) {
    setStatus(`导入失败：${error.message}`, "error");
  }
});

restoreSavedProject(false);
render();
recordHistory();
