# MeasureTool

**A browser-based measurement and inspection tool for web designers and developers.**

[English]

MeasureTool is a Chrome extension that overlays measurement data directly on any webpage. Inspect element dimensions, visualize CSS box models, place pixel-perfect guides, and measure distances — all without leaving the browser.

---

## Features

- **Element Inspector** — hover to preview, click to lock; shows box model, CSS properties, and layout gaps
- **Guide Lines** — place draggable horizontal and vertical guides with snap-to-element alignment
- **Multi-select & Marquee** — select multiple elements with Shift+Click or drag to measure distances between them
- **Box Model Overlay** — color-coded margin / border / padding / content visualization on canvas
- **Layout Gap Visualization** — renders flex/grid gaps and inter-element margins as colored regions with labels
- **CSS Grid Lines** — overlays column and row boundaries for grid containers
- **DOM Navigation** — traverse parent/child elements with arrow keys
- **8 Measurement Units** — px, rem, vw, vh, pt, in, cm, mm; cycle with `U`
- **Light & Dark Themes** — adapts to your preference
- **Fully Local** — no network requests, no data collection

---

## Installation

1. Download or clone this repository.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select the project folder.
5. The MeasureTool icon appears in your toolbar.

---

## Getting Started

Press **Ctrl+Shift+M** (Windows/Linux) or **Alt+M** (Mac) on any page to activate the tool. Press the same shortcut again to deactivate.

A floating control panel appears at the bottom of the viewport. Use the three mode buttons — or keys `1`, `2`, `3` — to switch modes.

---

## Modes

### Inspector Mode `1`

Inspect individual elements and measure distances between them.

**Selecting elements**

| Action | Result |
|--------|--------|
| Hover over an element | Highlights the element and shows its size badge |
| Click an element | Locks the selection |
| Shift + Click | Adds to / removes from the selection |
| Drag on empty space | Draws a marquee to select all elements within the rectangle |
| Escape | Clears all selections |

**DOM navigation** (while an element is selected)

| Key | Action |
|-----|--------|
| ↑ | Move selection to the parent element |
| ↓ | Move selection to the last child element |

**What appears on the canvas**

| Overlay | Description |
|---------|-------------|
| Box model rings | Color-coded margin / border / padding / content areas with dimension labels |
| Layout gap regions | Colored bands between child elements showing gap and margin sizes |
| CSS Grid lines | Dashed lines tracing row and column boundaries |
| Element extension lines | Red dashed lines extending each selected element's edges to the viewport boundary |
| Neighbor distance labels | Distance from the selected element to its nearest siblings and parent edges |
| Distance lines (multi-select) | Connecting lines with pixel measurements between selected elements |

**Inspector panel**

The side panel shows the following for the selected element:

- **Quick info** — tag name, selector (ID / class), width × height
- **Viewport position** — `top` and `left` from `getBoundingClientRect()`
- **Typography** — font family, size, weight, line height, color, text align, letter spacing
- **Layout** — display, position, z-index, overflow, align-items, justify-content, gap
- **Visual** — background color, opacity, border radius, cursor
- **Box model values** — margin, border, padding, and content dimensions for all four sides

---

### Guides Mode `2`

Place pixel-perfect reference lines across the page.

**Adding guides**

| Action | Result |
|--------|--------|
| Click on the page | Places a guide; direction is determined by drag direction (more vertical movement → horizontal guide; more horizontal movement → vertical guide) |
| `H` | Adds a horizontal guide at the current cursor position |
| `V` | Adds a vertical guide at the current cursor position |

**Moving guides**

| Action | Result |
|--------|--------|
| Drag a guide | Moves it freely |
| Click a guide to select it, then ← → ↑ ↓ | Nudges the selected guide ±1 px |
| Shift + arrow keys | Nudges the selected guide ±10 px |

**Snap alignment**

Press `S` to toggle snap mode. When active, guides snap to element edges as you drag, and a crosshair cursor appears at the nearest snap point.

**Clearing guides**

Press `Q` to remove all guides.

**Distance labels**

MeasureTool automatically draws distance labels between consecutive guides (horizontal guides show vertical spacing; vertical guides show horizontal spacing).

---

### Cursor Mode `3`

Suspends all MeasureTool interaction so you can use the page normally — click links, scroll, fill forms — while the panel remains visible.

---

## Keyboard Shortcuts

### Global

| Key | Action |
|-----|--------|
| Ctrl+Shift+M / Alt+M | Toggle the tool on / off |
| `1` | Switch to Inspector mode |
| `2` | Switch to Guides mode |
| `3` | Switch to Cursor mode |
| `M` | Collapse / expand the control panel |
| `U` | Cycle measurement unit (px → rem → vw → vh → pt → in → cm → mm) |

### Inspector Mode

| Key | Action |
|-----|--------|
| Click | Select element |
| Shift + Click | Add to / remove from selection |
| Drag | Marquee multi-select |
| `↑` | Select parent element |
| `↓` | Select last child element |
| Escape | Clear selection |

### Guides Mode

| Key | Action |
|-----|--------|
| Click | Place guide |
| `H` | Add horizontal guide at cursor |
| `V` | Add vertical guide at cursor |
| `S` | Toggle snap alignment |
| `Q` | Clear all guides |
| `← → ↑ ↓` | Nudge selected guide ±1 px |
| Shift + `← → ↑ ↓` | Nudge selected guide ±10 px |

---

## Measurement Units

Press `U` to cycle through all available units. The rem root value (default 16 px) can be changed in the Settings panel.

| Unit | Description |
|------|-------------|
| `px` | Pixels — the default CSS unit |
| `rem` | Root em — relative to the document root font size |
| `vw` | Viewport width percentage |
| `vh` | Viewport height percentage |
| `pt` | Points (1 pt = 1/72 in) |
| `in` | Inches |
| `cm` | Centimeters |
| `mm` | Millimeters |

---

## Visual Overlays Reference

| Overlay | Color | Triggered by |
|---------|-------|--------------|
| Margin area | Orange | Selected element |
| Border area | Yellow | Selected element |
| Padding area | Green | Selected element |
| Content area | Blue | Selected element |
| Layout gap (flex / grid / other) | Purple | Selected element with child elements |
| Inter-element margin | Amber | Selected element with child elements |
| CSS Grid column / row lines | Purple dashed | Selected grid container |
| Element extension lines | Red dashed | Selected element |
| Neighbor distance labels | White chip | Selected element |
| Guide lines | Blue | Guides mode |
| Guide distance labels | White chip | Guides mode, 2+ parallel guides |
| Snap crosshair | White cross | Guides mode with snap enabled |
| Hover highlight | Blue outline | Any hoverable element (Inspector mode) |
| Selection highlight | Blue filled outline | Selected element |
| Marquee rectangle | Blue dashed | Drag-select in progress |

---

## Control Panel

The floating panel can be repositioned and customized.

**Repositioning**

Drag the panel handle to move it anywhere on screen. When **Auto Position** is enabled, the panel snaps to one of six grid positions (top-left, top-center, top-right, bottom-left, bottom-center, bottom-right). Disable Auto Position for free placement.

**Collapsing**

Press `M` or click the collapse button to shrink the panel to a compact floating button. Press `M` again or click the button to expand it.

**Resizing the inspector columns**

Drag the vertical divider between the Box Model column and the Properties column to adjust their widths.

**Settings**

| Setting | Description |
|---------|-------------|
| Auto Position | Snap panel to nearest grid position when dragged |
| Units | Select the default measurement unit |
| Rem Root | Set the base font size used for rem conversions (1–512 px) |
| Theme | Switch between Light and Dark color schemes |

All settings are saved locally and restored when you reopen the extension.

---

## Privacy

MeasureTool operates entirely in your browser:

- No data is sent to any server
- No analytics or telemetry
- Settings are stored with `chrome.storage.local` on your own device only

---

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome 102+ | Full support |
| Edge (Chromium) | Full support |
| Other browsers | Not supported (Manifest V3) |

# MeasureTool

**專為網頁設計師與開發者打造的瀏覽器測量與檢查工具。**

[繁體中文]

MeasureTool 是一款 Chrome 擴充功能，可在任何網頁上直接疊加顯示測量資料。無需離開瀏覽器，即可檢查元素尺寸、視覺化 CSS 盒模型、放置像素級精確的參考線，以及測量元素之間的距離。

---

## 功能特色

- **元素檢查器** — 懸停預覽、點擊鎖定；顯示盒模型、CSS 屬性與佈局間隙
- **參考線** — 拖動式水平與垂直參考線，支援自動吸附至元素邊緣
- **多選與矩形框選** — 使用 Shift+Click 或拖動框選多個元素，量測彼此之間的距離
- **盒模型疊加層** — 以彩色區塊在 Canvas 上視覺化 margin / border / padding / content
- **佈局間隙視覺化** — 以彩色色塊標示 flex/grid 間隙與元素間距，並顯示數值標籤
- **CSS Grid 線條** — 疊加顯示 Grid 容器的欄與列邊界
- **DOM 導航** — 使用方向鍵在父/子元素之間切換
- **8 種測量單位** — px、rem、vw、vh、pt、in、cm、mm；按 `U` 循環切換
- **亮色 / 暗色主題** — 依個人偏好自由切換
- **完全本地運作** — 無網路請求、無任何資料收集

---

## 安裝方式

1. 下載或複製本專案。
2. 開啟 Chrome，前往 `chrome://extensions`。
3. 開啟右上角的**開發人員模式**。
4. 點擊**載入未封裝項目**，選擇專案資料夾。
5. 工具列中將出現 MeasureTool 圖示。

---

## 快速上手

在任意頁面按下 **Ctrl+Shift+M**（Windows/Linux）或 **Alt+M**（Mac）以啟動工具。再次按下相同快捷鍵可停用。

視口底部會出現一個浮動控制面板。使用三個模式按鈕，或按鍵 `1`、`2`、`3` 來切換模式。

---

## 模式說明

### 檢查器模式 `1`

檢查個別元素，並量測元素之間的距離。

**選取元素**

| 操作 | 結果 |
|------|------|
| 懸停於元素上 | 高亮顯示該元素，並顯示尺寸標籤 |
| 點擊元素 | 鎖定選取 |
| Shift + 點擊 | 加入 / 移除選取 |
| 在空白處拖動 | 繪製矩形框選，選取範圍內的所有元素 |
| Escape | 清除所有選取 |

**DOM 導航**（已選取元素時）

| 按鍵 | 動作 |
|------|------|
| ↑ | 移至父元素 |
| ↓ | 移至最後一個子元素 |

**Canvas 上顯示的疊加層**

| 疊加層 | 說明 |
|--------|------|
| 盒模型色環 | 以彩色區塊標示 margin / border / padding / content，並附上數值標籤 |
| 佈局間隙色塊 | 在子元素之間顯示彩色色塊，標示 gap 與 margin 的大小 |
| CSS Grid 線條 | 虛線標示 Grid 容器的欄與列邊界 |
| 元素延伸線 | 紅色虛線從選取元素的四個邊延伸至視口邊界 |
| 鄰近元素距離標籤 | 顯示選取元素至最近相鄰元素及父元素邊緣的距離 |
| 距離連線（多選） | 在已選取的多個元素之間繪製連線，並標示像素距離 |

**檢查器面板**

側邊面板針對選取元素顯示以下資訊：

- **快速資訊** — 標籤名稱、選擇器（ID / class）、寬 × 高
- **視口位置** — `getBoundingClientRect()` 的 `top` 與 `left` 值
- **排版** — 字體家族、大小、粗細、行高、顏色、文字對齊、字母間距
- **佈局** — display、position、z-index、overflow、align-items、justify-content、gap
- **視覺** — 背景色、透明度、圓角、cursor
- **盒模型數值** — 四個邊的 margin、border、padding 與 content 尺寸

---

### 參考線模式 `2`

在頁面上放置像素級精確的參考線。

**新增參考線**

| 操作 | 結果 |
|------|------|
| 點擊頁面 | 放置一條參考線；方向依拖動方向自動判斷（垂直移動較多 → 水平參考線；水平移動較多 → 垂直參考線） |
| `H` | 在目前游標位置新增水平參考線 |
| `V` | 在目前游標位置新增垂直參考線 |

**移動參考線**

| 操作 | 結果 |
|------|------|
| 拖動參考線 | 自由移動 |
| 點擊參考線以選取，再按 ← → ↑ ↓ | 以 ±1 px 微調選取的參考線 |
| Shift + 方向鍵 | 以 ±10 px 微調選取的參考線 |

**吸附對齊**

按 `S` 切換吸附模式。啟用後，拖動參考線時會自動吸附至元素邊緣，游標會顯示十字準心指示最近的吸附點。

**清除參考線**

按 `Q` 移除所有參考線。

**距離標籤**

MeasureTool 會自動在相鄰的平行參考線之間繪製距離標籤（水平參考線顯示垂直間距；垂直參考線顯示水平間距）。

---

### 游標模式 `3`

暫停所有 MeasureTool 互動，讓你可以正常使用頁面——點擊連結、捲動、填寫表單——同時控制面板仍保持顯示。

---

## 鍵盤快捷鍵

### 全局

| 按鍵 | 動作 |
|------|------|
| Ctrl+Shift+M / Alt+M | 啟用 / 停用工具 |
| `1` | 切換至檢查器模式 |
| `2` | 切換至參考線模式 |
| `3` | 切換至游標模式 |
| `M` | 摺疊 / 展開控制面板 |
| `U` | 循環切換測量單位（px → rem → vw → vh → pt → in → cm → mm） |

### 檢查器模式

| 按鍵 | 動作 |
|------|------|
| 點擊 | 選取元素 |
| Shift + 點擊 | 加入 / 移除選取 |
| 拖動 | 矩形框選多個元素 |
| `↑` | 移至父元素 |
| `↓` | 移至最後一個子元素 |
| Escape | 清除選取 |

### 參考線模式

| 按鍵 | 動作 |
|------|------|
| 點擊 | 放置參考線 |
| `H` | 在游標位置新增水平參考線 |
| `V` | 在游標位置新增垂直參考線 |
| `S` | 切換吸附對齊 |
| `Q` | 清除所有參考線 |
| `← → ↑ ↓` | 以 ±1 px 微調選取的參考線 |
| Shift + `← → ↑ ↓` | 以 ±10 px 微調選取的參考線 |

---

## 測量單位

按 `U` 循環切換所有可用單位。rem 根值（預設 16 px）可在設定面板中調整。

| 單位 | 說明 |
|------|------|
| `px` | 像素 — 預設 CSS 單位 |
| `rem` | 根 em — 相對於文件根字體大小 |
| `vw` | 視口寬度百分比 |
| `vh` | 視口高度百分比 |
| `pt` | 點（1 pt = 1/72 英寸） |
| `in` | 英寸 |
| `cm` | 公分 |
| `mm` | 公厘 |

---

## 視覺疊加層速查表

| 疊加層 | 顏色 | 觸發條件 |
|--------|------|----------|
| Margin 區域 | 橙色 | 選取元素 |
| Border 區域 | 黃色 | 選取元素 |
| Padding 區域 | 綠色 | 選取元素 |
| Content 區域 | 藍色 | 選取元素 |
| 佈局間隙（flex / grid / 其他） | 紫色 | 選取含子元素的容器 |
| 元素間距（margin） | 琥珀色 | 選取含子元素的容器 |
| CSS Grid 欄 / 列線 | 紫色虛線 | 選取 Grid 容器 |
| 元素延伸線 | 紅色虛線 | 選取元素 |
| 鄰近距離標籤 | 白色晶片 | 選取元素 |
| 參考線 | 藍色 | 參考線模式 |
| 參考線距離標籤 | 白色晶片 | 參考線模式，兩條以上平行參考線 |
| 吸附十字準心 | 白色十字 | 參考線模式且吸附已啟用 |
| 懸停高亮 | 藍色外框 | 檢查器模式下可懸停的元素 |
| 選取高亮 | 藍色填充外框 | 已選取元素 |
| 矩形框選 | 藍色虛線 | 拖動框選進行中 |

---

## 控制面板

浮動面板可自由調整位置與外觀。

**移動位置**

拖動面板頂部的拖動把手即可移動。啟用**自動定位**時，面板會吸附至六個預設位置之一（左上、中上、右上、左下、中下、右下）。停用自動定位可自由放置。

**摺疊面板**

按 `M` 或點擊摺疊按鈕，可將面板縮小為浮動按鈕。再次按 `M` 或點擊按鈕即可展開。

**調整檢查器欄位寬度**

拖動盒模型欄與屬性欄之間的垂直分隔線，即可調整兩欄的寬度。

**設定選項**

| 設定 | 說明 |
|------|------|
| 自動定位 | 拖動時將面板吸附至最近的預設位置 |
| 測量單位 | 選擇預設測量單位 |
| Rem 根值 | 設定用於 rem 換算的基礎字體大小（1–512 px） |
| 主題 | 切換亮色或暗色配色方案 |

所有設定會儲存於本地，下次開啟擴充功能時自動還原。

---

## 隱私說明

MeasureTool 完全在你的瀏覽器本地運作：

- 不傳送任何資料至伺服器
- 不進行任何數據分析或遙測
- 設定透過 `chrome.storage.local` 儲存於你的裝置本地

---

## 瀏覽器相容性

| 瀏覽器 | 支援狀況 |
|--------|----------|
| Chrome 102+ | 完整支援 |
| Edge（Chromium） | 完整支援 |
| 其他瀏覽器 | 不支援（Manifest V3） |
