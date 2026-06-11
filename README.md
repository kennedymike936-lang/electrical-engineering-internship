# Electrical Engineering Internship

这个仓库用于保存电气工程学习和实习相关的小项目。

## 项目列表

### 1. Electrical Power Calculator

电功率与电费估算工具。

位置：

```text
electrical-power-calculator/
```

主要功能：

- 计算单相功率
- 计算三相功率
- 估算耗电量
- 估算电费

### 2. Circuit Problem Solver Lite V3

拼图式电路编辑器雏形。

位置：

```text
circuit-problem-solver-lite/
```

主要功能：

- 左侧元件工具栏
- 右侧网格画布
- 拖拽直流电源、电阻、电容、电感、导线到画布
- 点击元件后修改数值
- 删除元件
- 网格吸附
- 点击端点生成连线
- 导入 / 导出 JSON
- 元件颜色区分
- 使用 `components` 数组记录元件数据
- 使用 `connections` 数组记录连线数据
- 页面底部实时显示项目 JSON 数据

## 使用方法

进入对应项目文件夹，直接用浏览器打开其中的 `index.html` 文件即可运行。

两个项目都只使用 HTML、CSS 和 JavaScript，不需要后端，不需要数据库。
