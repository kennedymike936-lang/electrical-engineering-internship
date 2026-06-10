// 获取页面中的输入框、按钮、结果和提示信息
const voltageInput = document.getElementById("voltage");
const currentInput = document.getElementById("current");
const powerFactorInput = document.getElementById("powerFactor");
const useHoursInput = document.getElementById("useHours");
const priceInput = document.getElementById("price");
const calculateBtn = document.getElementById("calculateBtn");
const singlePhasePowerText = document.getElementById("singlePhasePower");
const threePhasePowerText = document.getElementById("threePhasePower");
const singlePhaseEnergyText = document.getElementById("singlePhaseEnergy");
const threePhaseEnergyText = document.getElementById("threePhaseEnergy");
const singlePhaseCostText = document.getElementById("singlePhaseCost");
const threePhaseCostText = document.getElementById("threePhaseCost");
const messageText = document.getElementById("message");

// 将功率结果格式化为 W 或 kW，方便阅读
function formatPower(power) {
  if (power >= 1000) {
    return `${(power / 1000).toFixed(2)} kW`;
  }

  return `${power.toFixed(2)} W`;
}

// 将耗电量格式化为 kWh
function formatEnergy(energy) {
  return `${energy.toFixed(2)} kWh`;
}

// 将电费格式化为人民币金额
function formatCost(cost) {
  return `¥${cost.toFixed(2)}`;
}

// 清空所有计算结果
function resetResults() {
  singlePhasePowerText.textContent = "--";
  threePhasePowerText.textContent = "--";
  singlePhaseEnergyText.textContent = "--";
  threePhaseEnergyText.textContent = "--";
  singlePhaseCostText.textContent = "--";
  threePhaseCostText.textContent = "--";
}

// 点击计算按钮后执行功率和电费计算
calculateBtn.addEventListener("click", function () {
  const voltage = Number(voltageInput.value);
  const current = Number(currentInput.value);
  const powerFactor = Number(powerFactorInput.value);
  const useHours = Number(useHoursInput.value);
  const price = Number(priceInput.value);

  // 检查功率计算输入是否有效
  if (voltage <= 0 || current <= 0 || powerFactor <= 0 || powerFactor > 1) {
    messageText.textContent = "请输入有效数值：电压和电流要大于 0，功率因数要在 0 到 1 之间。";
    resetResults();
    return;
  }

  // 检查电费估算输入是否有效
  if (useHours < 0 || price < 0) {
    messageText.textContent = "使用时间和电价不能为负数。";
    resetResults();
    return;
  }

  // 单相功率公式：P = U * I * cosφ，单位为 W
  const singlePhasePower = voltage * current * powerFactor;

  // 三相功率公式：P = √3 * U * I * cosφ，单位为 W
  const threePhasePower = Math.sqrt(3) * voltage * current * powerFactor;

  // 耗电量公式：E = 功率(kW) * 使用时间(h)
  const singlePhaseEnergy = (singlePhasePower / 1000) * useHours;
  const threePhaseEnergy = (threePhasePower / 1000) * useHours;

  // 电费公式：费用 = 耗电量(kWh) * 电价(元/kWh)
  const singlePhaseCost = singlePhaseEnergy * price;
  const threePhaseCost = threePhaseEnergy * price;

  singlePhasePowerText.textContent = formatPower(singlePhasePower);
  threePhasePowerText.textContent = formatPower(threePhasePower);
  singlePhaseEnergyText.textContent = formatEnergy(singlePhaseEnergy);
  threePhaseEnergyText.textContent = formatEnergy(threePhaseEnergy);
  singlePhaseCostText.textContent = formatCost(singlePhaseCost);
  threePhaseCostText.textContent = formatCost(threePhaseCost);
  messageText.textContent = "";
});
