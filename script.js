// 获取页面中的输入框、按钮、结果和提示信息
const voltageInput = document.getElementById("voltage");
const currentInput = document.getElementById("current");
const powerFactorInput = document.getElementById("powerFactor");
const calculateBtn = document.getElementById("calculateBtn");
const singlePhasePowerText = document.getElementById("singlePhasePower");
const threePhasePowerText = document.getElementById("threePhasePower");
const messageText = document.getElementById("message");

// 将计算结果格式化为 W 或 kW，方便阅读
function formatPower(power) {
  if (power >= 1000) {
    return `${(power / 1000).toFixed(2)} kW`;
  }

  return `${power.toFixed(2)} W`;
}

// 点击计算按钮后执行功率计算
calculateBtn.addEventListener("click", function () {
  const voltage = Number(voltageInput.value);
  const current = Number(currentInput.value);
  const powerFactor = Number(powerFactorInput.value);

  // 检查输入是否有效
  if (voltage <= 0 || current <= 0 || powerFactor <= 0 || powerFactor > 1) {
    messageText.textContent = "请输入有效数值：电压和电流要大于 0，功率因数要在 0 到 1 之间。";
    singlePhasePowerText.textContent = "--";
    threePhasePowerText.textContent = "--";
    return;
  }

  // 单相功率公式：P = U * I * cosφ
  const singlePhasePower = voltage * current * powerFactor;

  // 三相功率公式：P = √3 * U * I * cosφ
  const threePhasePower = Math.sqrt(3) * voltage * current * powerFactor;

  singlePhasePowerText.textContent = formatPower(singlePhasePower);
  threePhasePowerText.textContent = formatPower(threePhasePower);
  messageText.textContent = "";
});
