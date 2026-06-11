# Circuit Problem Solver Lite V3

Circuit Problem Solver Lite V3 是一个拼图式电路编辑器雏形。当前版本支持拖拽元件、点击端点建立连线，并把电路图保存为结构化 JSON 数据。

本版本仍然不做自动计算、不做复杂仿真，也不接入 AI API。

## 项目用途

这个项目用于练习使用 HTML、CSS 和 JavaScript 构建交互式电路编辑页面。用户可以把元件拖拽到网格画布上，再用左右端点建立连接，形成简单的电路图数据结构。

## 当前功能

- 左侧元件工具栏
- 右侧浅灰色网格画布
- 支持拖拽元件到画布
- 支持元件显示名称和值
- 支持点击元件后修改数值
- 支持删除选中的元件
- 支持 Delete 键删除元件
- 支持拖动画布上的已有元件
- 支持元件自动吸附到网格
- 支持不同元件颜色区分
- 支持点击端点生成连线
- 支持 `components` 数组记录元件
- 支持 `connections` 数组记录连线
- 支持复制 JSON
- 支持下载 JSON
- 支持导入 JSON 恢复画布

## 支持的元件

- 直流电源
- 电阻
- 电容
- 电感
- 导线

## 数据结构

程序内部使用 `components` 和 `connections` 保存电路图。

```js
{
  components: [
    {
      id: "R1",
      type: "resistor",
      value: "10Ω",
      x: 120,
      y: 72
    }
  ],
  connections: [
    {
      from: "V1.right",
      to: "R1.left"
    }
  ]
}
```

字段说明：

- `components`：所有元件
- `connections`：所有连线
- `id`：元件编号，例如 `R1`、`C1`、`V1`
- `type`：元件类型，例如 `resistor`、`capacitor`
- `value`：元件显示值，例如 `10Ω`
- `x`：元件在画布中的横坐标
- `y`：元件在画布中的纵坐标
- `from`：连线起点，例如 `V1.right`
- `to`：连线终点，例如 `R1.left`

## 文件说明

- `index.html`：页面结构
- `style.css`：页面样式
- `script.js`：拖拽、编辑、删除、连线、导入导出和 JSON 数据逻辑

## 使用方法

直接用浏览器打开 `index.html` 文件即可运行。

本项目不需要后端，不需要数据库，也不需要安装额外依赖。

## 暂不支持

- 自动识别串并联
- 电路计算
- 图片识别
- AI 解题
- 电路仿真

## 后续升级方向

- 删除单条连线
- 根据 connections 生成中文电路描述
- 简单串并联识别
- 基于已识别结构做电路计算
