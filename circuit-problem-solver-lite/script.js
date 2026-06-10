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
const toolItems = document.querySelectorAll(".tool-item");

let selectedComponentId = null;
let draggedComponentId = null;
let draggedToolType = null;
let dragOffsetX = 0;
let dragOffsetY = 0;
let toolPreview = null;

// 把坐标限制在画布范围内，避免元件被拖出画布
function clampPosition(x, y) {
  const maxX = Math.max(0, canvas.clientWidth - 130);
  const maxY = Math.max(0, canvas.clientHeight - 70);

  return {
    x: Math.min(Math.max(0, x), maxX),
    y: Math.min(Math.max(0, y), maxY)
  };
}

// 根据元件类型生成唯一 id，例如 R1、R2、C1
function createComponentId(type) {
  const config = componentConfig[type];
  counters[type] += 1;
  return `${config.prefix}${counters[type]}`;
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

// 渲染画布中的所有元件
function renderCanvas() {
  canvas.innerHTML = "";

  components.forEach((component) => {
    const config = componentConfig[component.type];
    const element = document.createElement("div");

    element.className = "component";
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
      updateEditor();
      renderCanvas();
      renderJson();
    });

    // 鼠标按下后进入画布内拖动模式
    element.addEventListener("pointerdown", (event) => {
      draggedComponentId = component.id;
      selectedComponentId = component.id;
      dragOffsetX = event.offsetX;
      dragOffsetY = event.offsetY;
      element.setPointerCapture(event.pointerId);
      element.classList.add("selected");
      updateEditor();
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
    return;
  }

  selectedName.textContent = `当前选择：${component.id}`;
  valueInput.value = component.value;
  valueInput.disabled = false;
  applyValueBtn.disabled = false;
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
  preview.className = "component";
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
canvas.addEventListener("pointermove", (event) => {
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

// 移动工具栏元件预览
document.addEventListener("pointermove", (event) => {
  if (!toolPreview) {
    return;
  }

  toolPreview.style.left = `${event.clientX - 58}px`;
  toolPreview.style.top = `${event.clientY - 24}px`;
  canvas.classList.toggle("drag-over", isPointInCanvas(event.clientX, event.clientY));
});

// 松开鼠标时，如果位置在画布内，就创建一个新元件
document.addEventListener("pointerup", (event) => {
  if (!draggedToolType) {
    return;
  }

  if (isPointInCanvas(event.clientX, event.clientY)) {
    const rect = canvas.getBoundingClientRect();
    addComponent(draggedToolType, event.clientX - rect.left - 58, event.clientY - rect.top - 24);
  }

  if (toolPreview) {
    toolPreview.remove();
  }

  toolPreview = null;
  draggedToolType = null;
  canvas.classList.remove("drag-over");
});

canvas.addEventListener("pointerup", () => {
  draggedComponentId = null;
});

canvas.addEventListener("pointerleave", () => {
  draggedComponentId = null;
});

// 清空画布和 JSON 数据
clearBtn.addEventListener("click", () => {
  const confirmed = window.confirm("确定要清空画布吗？");

  if (!confirmed) {
    return;
  }

  components = [];
  selectedComponentId = null;
  render();
});

// 应用左侧编辑栏中的数值修改
applyValueBtn.addEventListener("click", () => {
  const component = components.find((item) => item.id === selectedComponentId);

  if (!component) {
    return;
  }

  component.value = valueInput.value.trim() || component.value;
  render();
});

render();
