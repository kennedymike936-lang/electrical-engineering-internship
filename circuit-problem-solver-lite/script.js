// components 数组用于保存画布中的所有元件数据
let components = [];

// counters 用于给不同类型的元件自动生成编号
const counters = {
  source: 0,
  resistor: 0,
  capacitor: 0,
  inductor: 0,
  wire: 0
};

// 网格大小：元件坐标会自动吸附到 24px 网格
const GRID_SIZE = 24;

// 不同元件的默认显示信息
const componentConfig = {
  source: { prefix: "V", label: "直流电源", value: "12V", symbol: "V" },
  resistor: { prefix: "R", label: "电阻", value: "10Ω", symbol: "R" },
  capacitor: { prefix: "C", label: "电容", value: "100uF", symbol: "C" },
  inductor: { prefix: "L", label: "电感", value: "10mH", symbol: "L" },
  wire: { prefix: "W", label: "导线", value: "wire", symbol: "W" }
};

const canvas = document.getElementById("canvas");
const jsonOutput = document.getElementById("jsonOutput");
const countText = document.getElementById("countText");
const clearBtn = document.getElementById("clearBtn");
const selectedName = document.getElementById("selectedName");
const valueInput = document.getElementById("valueInput");
const applyValueBtn = document.getElementById("applyValueBtn");
const deleteBtn = document.getElementById("deleteBtn");
const copyJsonBtn = document.getElementById("copyJsonBtn");
const downloadJsonBtn = document.getElementById("downloadJsonBtn");
const importInput = document.getElementById("importInput");
const importJsonBtn = document.getElementById("importJsonBtn");
const statusText = document.getElementById("statusText");
const toolItems = document.querySelectorAll(".tool-item");

let selectedComponentId = null;
let draggedComponentId = null;
let draggedToolType = null;
let dragOffsetX = 0;
let dragOffsetY = 0;
let toolPreview = null;

// 将普通坐标吸附到最近的网格点
function snapToGrid(value) {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

// 把坐标限制在画布范围内，避免元件被拖出画布
function clampPosition(x, y) {
  const maxX = Math.max(0, canvas.clientWidth - 130);
  const maxY = Math.max(0, canvas.clientHeight - 70);

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

// 根据拖拽落点创建一个新元件
function addComponent(type, x, y) {
  const config = componentConfig[type];
  const position = clampPosition(x, y);

  components.push({
    id: createComponentId(type),
    type,
    value: config.value,
    x: position.x,
    y: position.y
  });

  render();
}

// 删除当前选中的元件
function deleteSelectedComponent() {
  if (!selectedComponentId) {
    return;
  }

  components = components.filter((component) => component.id !== selectedComponentId);
  selectedComponentId = null;
  setStatus("已删除选中的元件。", "success");
  render();
}

// 渲染画布中的所有元件
function renderCanvas() {
  canvas.innerHTML = "";

  components.forEach((component) => {
    const config = componentConfig[component.type];
    const element = document.createElement("div");

    element.className = `component type-${component.type}`;
    element.dataset.id = component.id;
    element.style.left = `${component.x}px`;
    element.style.top = `${component.y}px`;

    if (component.id === selectedComponentId) {
      element.classList.add("selected");
    }

    element.innerHTML = `
      <span class="component-symbol">${config.symbol}</span>
      <span class="component-name">${component.id}</span>
      <span class="component-value">${component.value}</span>
    `;

    // 单击元件：选中元件，并在左侧编辑栏中修改数值
    element.addEventListener("click", (event) => {
      event.stopPropagation();
      selectedComponentId = component.id;
      render();
    });

    // 鼠标按下后进入画布内拖动模式
    element.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
      draggedComponentId = component.id;
      selectedComponentId = component.id;
      dragOffsetX = event.offsetX;
      dragOffsetY = event.offsetY;
      element.setPointerCapture(event.pointerId);
      render();
    });

    canvas.appendChild(element);
  });
}

// 渲染底部 JSON 数据
function renderJson() {
  jsonOutput.textContent = JSON.stringify(components, null, 2);
  countText.textContent = `${components.length} 个元件`;
}

// 更新左侧元件编辑栏
function updateEditor() {
  const component = components.find((item) => item.id === selectedComponentId);

  if (!component) {
    selectedName.textContent = "未选择元件";
    valueInput.value = "";
    valueInput.disabled = true;
    applyValueBtn.disabled = true;
    deleteBtn.disabled = true;
    return;
  }

  selectedName.textContent = `当前选择：${component.id}`;
  valueInput.value = component.value;
  valueInput.disabled = false;
  applyValueBtn.disabled = false;
  deleteBtn.disabled = false;
}

// 显示底部操作提示
function setStatus(message, type = "") {
  statusText.textContent = message;
  statusText.className = `status-text ${type}`.trim();
}

// 统一渲染页面
function render() {
  renderCanvas();
  renderJson();
  updateEditor();
}

// 创建工具栏拖拽预览，让拖拽过程更直观
function createToolPreview(type, x, y) {
  const config = componentConfig[type];
  const preview = document.createElement("div");
  preview.className = `component type-${type}`;
  preview.style.pointerEvents = "none";
  preview.style.position = "fixed";
  preview.style.left = `${x - 58}px`;
  preview.style.top = `${y - 24}px`;
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

// 工具栏拖拽：记录当前拖拽的元件类型，兼容浏览器原生拖拽
toolItems.forEach((tool) => {
  tool.addEventListener("dragstart", (event) => {
    event.dataTransfer.setData("component-type", tool.dataset.type);
  });

  // 自定义拖拽逻辑：比原生 HTML5 拖拽更稳定
  tool.addEventListener("pointerdown", (event) => {
    draggedToolType = tool.dataset.type;
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

// 在画布落点创建元件
canvas.addEventListener("drop", (event) => {
  event.preventDefault();
  canvas.classList.remove("drag-over");

  const type = event.dataTransfer.getData("component-type");

  if (!type || !componentConfig[type]) {
    return;
  }

  const rect = canvas.getBoundingClientRect();
  addComponent(type, event.clientX - rect.left - 58, event.clientY - rect.top - 24);
});

// 点击空白画布时取消选中
canvas.addEventListener("click", () => {
  selectedComponentId = null;
  render();
});

// 拖动画布中的已有元件，实时更新 components 中的 x、y
document.addEventListener("pointermove", (event) => {
  if (toolPreview) {
    toolPreview.style.left = `${event.clientX - 58}px`;
    toolPreview.style.top = `${event.clientY - 24}px`;
    canvas.classList.toggle("drag-over", isPointInCanvas(event.clientX, event.clientY));
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
    event.clientY - rect.top - dragOffsetY
  );

  component.x = position.x;
  component.y = position.y;
  render();
});

// 松开鼠标时，如果工具栏元件位置在画布内，就创建新元件
document.addEventListener("pointerup", (event) => {
  if (draggedToolType) {
    if (isPointInCanvas(event.clientX, event.clientY)) {
      const rect = canvas.getBoundingClientRect();
      addComponent(draggedToolType, event.clientX - rect.left - 58, event.clientY - rect.top - 24);
      setStatus("已添加新元件。", "success");
    }

    if (toolPreview) {
      toolPreview.remove();
    }
  }

  toolPreview = null;
  draggedToolType = null;
  draggedComponentId = null;
  canvas.classList.remove("drag-over");
});

// 清空画布和 JSON 数据
clearBtn.addEventListener("click", () => {
  const confirmed = window.confirm("确定要清空画布吗？");

  if (!confirmed) {
    return;
  }

  components = [];
  selectedComponentId = null;
  rebuildCounters();
  setStatus("画布已清空。", "success");
  render();
});

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

// Delete 键删除当前选中元件
document.addEventListener("keydown", (event) => {
  if (event.key === "Delete" && selectedComponentId) {
    deleteSelectedComponent();
  }
});

// 复制 JSON 到剪贴板
copyJsonBtn.addEventListener("click", async () => {
  await navigator.clipboard.writeText(JSON.stringify(components, null, 2));
  setStatus("JSON 已复制到剪贴板。", "success");
});

// 下载 JSON 文件
downloadJsonBtn.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(components, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "circuit-components.json";
  link.click();
  URL.revokeObjectURL(url);
  setStatus("JSON 文件已开始下载。", "success");
});

// 检查导入的 JSON 数据是否符合 components 数组格式
function normalizeImportedComponents(data) {
  if (!Array.isArray(data)) {
    throw new Error("JSON 顶层必须是数组。");
  }

  return data.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`第 ${index + 1} 项不是有效对象。`);
    }

    if (!componentConfig[item.type]) {
      throw new Error(`第 ${index + 1} 项的 type 不支持。`);
    }

    const config = componentConfig[item.type];
    const id = String(item.id || `${config.prefix}${index + 1}`);
    const value = String(item.value || config.value);
    const position = clampPosition(Number(item.x) || 0, Number(item.y) || 0);

    return {
      id,
      type: item.type,
      value,
      x: position.x,
      y: position.y
    };
  });
}

// 导入 JSON 并恢复画布
importJsonBtn.addEventListener("click", () => {
  try {
    const imported = JSON.parse(importInput.value);
    components = normalizeImportedComponents(imported);
    selectedComponentId = null;
    rebuildCounters();
    setStatus("JSON 导入成功，画布已恢复。", "success");
    render();
  } catch (error) {
    setStatus(`导入失败：${error.message}`, "error");
  }
});

render();
