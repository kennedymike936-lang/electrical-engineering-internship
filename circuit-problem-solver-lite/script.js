// 获取页面元素
const voltageInput = document.getElementById("voltage");
const resistorsInput = document.getElementById("resistors");
const connectionTypeSelect = document.getElementById("connectionType");
const solveBtn = document.getElementById("solveBtn");
const messageText = document.getElementById("message");
const equivalentResistanceText = document.getElementById("equivalentResistance");
const totalCurrentText = document.getElementById("totalCurrent");
const resistorDetails = document.getElementById("resistorDetails");
const solutionSteps = document.getElementById("solutionSteps");

// 将数值格式化，避免小数位过长
function formatNumber(value, unit) {
  return `${value.toFixed(3).replace(/\.?0+$/, "")} ${unit}`;
}

// 解析电阻输入，例如 "10, 20, 30" 会转换为 [10, 20, 30]
function parseResistors(text) {
  return text
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((value) => !Number.isNaN(value));
}

// 清空计算结果
function resetResult() {
  equivalentResistanceText.textContent = "--";
  totalCurrentText.textContent = "--";
  resistorDetails.innerHTML = "";
  solutionSteps.innerHTML = "";
}

// 渲染每个电阻的电压和电流
function renderResistorDetails(items) {
  resistorDetails.innerHTML = "";

  items.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "detail-card";
    card.innerHTML = `
      <h3>R${index + 1}</h3>
      <p>电阻：<strong>${formatNumber(item.resistance, "Ω")}</strong></p>
      <p>电压：<strong>${formatNumber(item.voltage, "V")}</strong></p>
      <p>电流：<strong>${formatNumber(item.current, "A")}</strong></p>
    `;
    resistorDetails.appendChild(card);
  });
}

// 渲染中文解题步骤
function renderSteps(steps) {
  solutionSteps.innerHTML = "";

  steps.forEach((step) => {
    const li = document.createElement("li");
    li.textContent = step;
    solutionSteps.appendChild(li);
  });
}

// 计算串联电路
function solveSeries(voltage, resistors) {
  const equivalentResistance = resistors.reduce((sum, value) => sum + value, 0);
  const totalCurrent = voltage / equivalentResistance;

  // 串联电路中，各电阻电流相同，电压按电阻大小分配
  const details = resistors.map((resistance) => ({
    resistance,
    voltage: totalCurrent * resistance,
    current: totalCurrent
  }));

  const steps = [
    `已知电源电压 U = ${formatNumber(voltage, "V")}，电阻为 ${resistors.map((value) => formatNumber(value, "Ω")).join("、")}，连接方式为串联。`,
    `串联电路的等效电阻等于各电阻之和：Req = R1 + R2 + ... = ${formatNumber(equivalentResistance, "Ω")}。`,
    `根据欧姆定律，总电流 I = U / Req = ${formatNumber(voltage, "V")} / ${formatNumber(equivalentResistance, "Ω")} = ${formatNumber(totalCurrent, "A")}。`,
    "串联电路中，各电阻电流相同，所以每个电阻的电流都等于总电流。",
    "各电阻两端电压可用 Ui = I × Ri 计算，所有电阻电压之和等于电源电压。"
  ];

  return { equivalentResistance, totalCurrent, details, steps };
}

// 计算并联电路
function solveParallel(voltage, resistors) {
  const reciprocalSum = resistors.reduce((sum, value) => sum + 1 / value, 0);
  const equivalentResistance = 1 / reciprocalSum;
  const totalCurrent = voltage / equivalentResistance;

  // 并联电路中，各支路电压相同，支路电流按电阻大小分配
  const details = resistors.map((resistance) => ({
    resistance,
    voltage,
    current: voltage / resistance
  }));

  const steps = [
    `已知电源电压 U = ${formatNumber(voltage, "V")}，电阻为 ${resistors.map((value) => formatNumber(value, "Ω")).join("、")}，连接方式为并联。`,
    `并联电路的等效电阻公式为：1 / Req = 1 / R1 + 1 / R2 + ...，计算得到 Req = ${formatNumber(equivalentResistance, "Ω")}。`,
    `根据欧姆定律，总电流 I = U / Req = ${formatNumber(voltage, "V")} / ${formatNumber(equivalentResistance, "Ω")} = ${formatNumber(totalCurrent, "A")}。`,
    "并联电路中，各支路电压相同，所以每个电阻两端电压都等于电源电压。",
    "各支路电流可用 Ii = U / Ri 计算，所有支路电流之和等于总电流。"
  ];

  return { equivalentResistance, totalCurrent, details, steps };
}

// 点击按钮后，根据连接方式计算电路结果
solveBtn.addEventListener("click", function () {
  const voltage = Number(voltageInput.value);
  const resistors = parseResistors(resistorsInput.value);
  const connectionType = connectionTypeSelect.value;

  // 检查电压是否合法
  if (voltage <= 0) {
    messageText.textContent = "请输入大于 0 的电源电压。";
    resetResult();
    return;
  }

  // 检查电阻列表是否合法
  if (resistors.length === 0 || resistors.some((value) => value <= 0)) {
    messageText.textContent = "请输入有效电阻值，多个电阻请用英文逗号分隔，例如：10, 20, 30。";
    resetResult();
    return;
  }

  const result = connectionType === "series"
    ? solveSeries(voltage, resistors)
    : solveParallel(voltage, resistors);

  equivalentResistanceText.textContent = formatNumber(result.equivalentResistance, "Ω");
  totalCurrentText.textContent = formatNumber(result.totalCurrent, "A");
  renderResistorDetails(result.details);
  renderSteps(result.steps);
  messageText.textContent = "";
});
