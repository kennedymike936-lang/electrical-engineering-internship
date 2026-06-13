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

// 不同元件的默认显示信息
const componentConfig = {
  source: { prefix: "V", label: "直流电源", value: "12V", symbol: "V", terminals: { left: "-", right: "+" } },
  resistor: { prefix: "R", label: "电阻", value: "10Ω", symbol: "R", terminals: { left: "1", right: "2" } },
  capacitor: { prefix: "C", label: "电容", value: "100uF", symbol: "C", terminals: { left: "1", right: "2" } },
  inductor: { prefix: "L", label: "电感", value: "10mH", symbol: "L", terminals: { left: "1", right: "2" } },
  node: { prefix: "N", label: "等电位点", value: "node", symbol: "●", width: 44, height: 44 }
};

const canvas = document.getElementById("canvas");
const wireLayer = document.getElementById("wireLayer");
const componentLayer = document.getElementById("componentLayer");
const jsonOutput = document.getElementById("jsonOutput");
const countText = document.getElementById("countText");
const clearBtn = document.getElementById("clearBtn");
const exampleBtn = document.getElementById("exampleBtn");
const arrangeBtn = document.getElementById("arrangeBtn");
const selectedName = document.getElementById("selectedName");
const valueInput = document.getElementById("valueInput");
const applyValueBtn = document.getElementById("applyValueBtn");
const deleteBtn = document.getElementById("deleteBtn");
const componentConnectionList = document.getElementById("componentConnectionList");
const connectionHint = document.getElementById("connectionHint");
const selectedConnectionText = document.getElementById("selectedConnectionText");
const deleteConnectionBtn = document.getElementById("deleteConnectionBtn");
const cancelConnectionBtn = document.getElementById("cancelConnectionBtn");
const copyJsonBtn = document.getElementById("copyJsonBtn");
const downloadJsonBtn = document.getElementById("downloadJsonBtn");
const importInput = document.getElementById("importInput");
const importJsonBtn = document.getElementById("importJsonBtn");
const statusText = document.getElementById("statusText");
const circuitSummary = document.getElementById("circuitSummary");
const circuitAnalysis = document.getElementById("circuitAnalysis");
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
  const maxX = Math.max(0, canvas.clientWidth - size.width - 20);
  const maxY = Math.max(0, canvas.clientHeight - size.height - 20);

  return {
    x: Math.min(Math.max(0, snapToGrid(x)), snapToGrid(maxX)),
    y: Math.min(Math.max(0, snapToGrid(y)), snapToGrid(maxY))
  };
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

  return {
    x: component.x + (side === "left" ? 0 : size.width),
    y: component.y + size.height / 2
  };
}

// 生成直角折线坐标，让导线更接近电路图中的横平竖直画法。
// 如果导线记录了 bendX / bendY，就使用用户手动拖出的拐点位置。
function getOrthogonalWirePoints(from, to, connection = {}) {
  const hasBendX = Number.isFinite(connection.bendX);
  const hasBendY = Number.isFinite(connection.bendY);
  const midX = hasBendX ? connection.bendX : from.x + (to.x - from.x) / 2;
  const midY = hasBendY ? connection.bendY : from.y + (to.y - from.y) / 2;

  if (from.y === to.y && hasBendY) {
    return `${from.x},${from.y} ${from.x},${midY} ${to.x},${midY} ${to.x},${to.y}`;
  }

  if (from.x === to.x && hasBendX) {
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
    x: position.x,
    y: position.y
  });

  render();
}

function loadExampleCircuit() {
  components = [
    { id: "V1", type: "source", value: "12V", x: 72, y: 120 },
    { id: "R1", type: "resistor", value: "10Ω", x: 288, y: 120 },
    { id: "N1", type: "node", value: "node", x: 504, y: 144 }
  ];

  connections = [
    { from: "V1.right", to: "R1.left" },
    { from: "R1.right", to: "N1.center" }
  ];

  clearSelection();
  pendingTerminal = null;
  rebuildCounters();
  setStatus("已生成示例电路。", "success");
  render();
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

  components.forEach((component) => {
    const config = componentConfig[component.type];
    const element = document.createElement("div");

    element.className = `component type-${component.type}`;
    element.dataset.id = component.id;
    element.style.left = `${component.x}px`;
    element.style.top = `${component.y}px`;
    element.style.width = `${getComponentSize(component.type).width}px`;
    element.style.height = `${getComponentSize(component.type).height}px`;

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
        <span class="component-symbol">${config.symbol}</span>
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
      selectedComponentId = component.id;
      selectedConnectionIndex = null;
      dragOffsetX = event.offsetX;
      dragOffsetY = event.offsetY;
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
    const from = getTerminalPosition(connection.from);
    const to = getTerminalPosition(connection.to);

    if (!from || !to) {
      return;
    }

    const lineGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const hitArea = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    const line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    const points = getOrthogonalWirePoints(from, to, connection);

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

function analyzeCircuit() {
  if (components.length === 0) {
    return ["当前还没有元件。"];
  }

  const graph = buildComponentGraph();
  const connectedIds = getConnectedComponentIds(graph);
  const isolatedComponents = components.filter((component) => graph.get(component.id).degree === 0);
  const nodeCount = components.filter((component) => component.type === "node").length;
  const simplePath = findSimplePath(graph);
  const lines = [
    `当前共有 ${components.length} 个元件、${connections.length} 条导线。`
  ];

  if (isolatedComponents.length > 0) {
    lines.push(`还有 ${isolatedComponents.length} 个元件没有接入电路：${isolatedComponents.map((component) => component.id).join("、")}。`);
  } else {
    lines.push("所有元件都已经至少连接了一条导线。");
  }

  if (nodeCount > 0) {
    lines.push(`检测到 ${nodeCount} 个等电位点，可用于表示同一电位的汇合位置。`);
  }

  if (simplePath.length >= 2) {
    lines.push(`初步判断：${simplePath.join(" → ")} 形成一条简单连接路径，后续可以在这里继续做串联识别。`);
  } else if (connectedIds.length > 0) {
    lines.push("当前连接关系不是单一路径，可能存在分支、回路或多个独立部分。");
  } else {
    lines.push("当前还没有形成可分析的连接路径。");
  }

  Array.from(graph.values()).forEach((entry) => {
    lines.push(describeComponentConnection(entry));
  });

  return lines;
}

function renderAnalysis() {
  circuitAnalysis.innerHTML = "";

  analyzeCircuit().forEach((line) => {
    const item = document.createElement("li");
    item.textContent = line;
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
    deleteBtn.disabled = true;
  } else {
    selectedName.textContent = `当前选择：${component.id}`;
    valueInput.value = component.value;
    valueInput.disabled = false;
    applyValueBtn.disabled = false;
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
  updateEditor();
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
    <span class="component-symbol">${config.symbol}</span>
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
    clearSelection();
    render();
  }
});

// 拖动画布中的已有元件，实时更新 components 中的 x、y
document.addEventListener("pointermove", (event) => {
  if (toolPreview) {
    const size = getComponentSize(draggedToolType);
    toolPreview.style.left = `${event.clientX - size.width / 2}px`;
    toolPreview.style.top = `${event.clientY - size.height / 2}px`;
    canvas.classList.toggle("drag-over", isPointInCanvas(event.clientX, event.clientY));
    return;
  }

  if (draggedWireIndex !== null && connections[draggedWireIndex]) {
    const rect = canvas.getBoundingClientRect();
    const connection = connections[draggedWireIndex];
    const from = getTerminalPosition(connection.from);
    const to = getTerminalPosition(connection.to);

    if (!from || !to) {
      draggedWireIndex = null;
      return;
    }

    if (from.y === to.y) {
      const minY = Math.min(from.y, to.y) - GRID_SIZE * 3;
      const maxY = Math.max(from.y, to.y) + GRID_SIZE * 3;
      const nextBendY = snapToGrid(event.clientY - rect.top);

      connection.bendY = Math.min(Math.max(nextBendY, minY), maxY);
    } else {
      const minX = Math.min(from.x, to.x) - GRID_SIZE * 3;
      const maxX = Math.max(from.x, to.x) + GRID_SIZE * 3;
      const nextBendX = snapToGrid(event.clientX - rect.left);

      connection.bendX = Math.min(Math.max(nextBendX, minX), maxX);
    }

    render();
    return;
  }

  if (!draggedComponentId) {
    return;
  }

  const component = components.find((item) => item.id === draggedComponentId);
  const rect = canvas.getBoundingClientRect();

  if (!component) {
    return;
  }

  const position = clampPosition(
    event.clientX - rect.left - dragOffsetX,
    event.clientY - rect.top - dragOffsetY,
    component.type
  );

  component.x = position.x;
  component.y = position.y;
  render();
});

// 松开鼠标时，如果工具栏元件位置在画布内，就创建新元件
document.addEventListener("pointerup", (event) => {
  if (draggedToolType && event.pointerId === currentToolPointerId) {
    if (!toolDragCreated && isPointInCanvas(event.clientX, event.clientY)) {
      const rect = canvas.getBoundingClientRect();
      const size = getComponentSize(draggedToolType);
      addComponent(draggedToolType, event.clientX - rect.left - size.width / 2, event.clientY - rect.top - size.height / 2);
      toolDragCreated = true;
      setStatus("已添加新元件。", "success");
    }

    if (toolPreview) {
      toolPreview.remove();
    }
  }

  toolPreview = null;
  draggedToolType = null;
  currentToolPointerId = null;
  toolDragCreated = false;
  draggedComponentId = null;
  draggedWireIndex = null;
  canvas.classList.remove("drag-over");
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
  rebuildCounters();
  setStatus("画布已清空。", "success");
  render();
});

exampleBtn.addEventListener("click", loadExampleCircuit);
arrangeBtn.addEventListener("click", arrangeCanvas);

// 应用左侧编辑栏中的数值修改
applyValueBtn.addEventListener("click", () => {
  const component = components.find((item) => item.id === selectedComponentId);

  if (!component) {
    return;
  }

  component.value = valueInput.value.trim() || component.value;
  setStatus(`已修改 ${component.id} 的数值。`, "success");
  render();
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
  if (event.key === "Delete" && selectedComponentId) {
    deleteSelectedComponent();
  } else if (event.key === "Delete" && selectedConnectionIndex !== null) {
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
    const position = clampPosition(Number(item.x) || 0, Number(item.y) || 0, item.type);

    return {
      id,
      type: item.type,
      value,
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
    rebuildCounters();
    setStatus("JSON 导入成功，画布已恢复。", "success");
    render();
  } catch (error) {
    setStatus(`导入失败：${error.message}`, "error");
  }
});

render();
