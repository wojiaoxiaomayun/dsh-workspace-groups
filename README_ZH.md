<p align="right">
  <a href="./README.md">English</a> · <strong>简体中文</strong>
</p>

# @dsh-xhl/workspace-groups

![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![DSH](https://img.shields.io/badge/DSH-0.1.7--rc.2-purple.svg)
<img src="https://img.shields.io/badge/DeepSeek%20Harness-plugin-202724" alt="DeepSeek Harness plugin">

> **DeepSeek Harness（DSH）Web 客户端插件：完整的工作区分组管理工具。**
> 把 GUI 侧边栏的工作区列表从两层「项目 → 会话」升级为三层
> **「分类文件夹 → 项目文件夹 → 会话」**，并围绕它提供完整的分组管理能力——
> 手动建组、重命名/删除分组、拖拽归类、项目与分组的自由排序、规则自动归类、
> 树形搜索。所有操作**即时生效并持久化**，对官方数据**零侵入**。

典型场景：多个 DSH 插件项目（SkillsManagePlugins / Documentation-Driven AI Coding /
DeepSeek峰谷小组件 等）归入一个「DSH 插件」分类文件夹，点开是各项目，再点开是各自会话；
临时项目随手建个「临时」分组拖进去，用完删除分组，项目全部回归**顶层**。

## 截图

<img src="screenshot.png" alt="@dsh-xhl/workspace-groups 工作区分组管理" width="280" />

## 特性

### 分组树浏览
- **分组文件夹 → 项目文件夹 → 会话行**，分组/项目均可折叠；展开状态独立持久化
  （`dsh.workspace.groups.view.v1`，刷新/重启保留）
- **顶层项目行**：不归组的项目（不匹配任何规则、被移出分组、删除分组后回归的）
  直接显示在分组列表之后，与分组平级——**没有「未分类」桶**
- **一条「花枝」沿树下行，并生长到你当前所在的行**。移植自
  [RewampUI Flower Sidebar](https://www.rewampui.com/components/flower-sidebar)：行背后一条
  连续的 SVG 枝干，**每个点都锚在自己那一行的标记上**——文件夹的点落在它的展开三角上，
  会话的点落在它的状态点上——于是三个层级形成三条整齐的竖列，而不是一条浮在旁边的枝干。
  淡淡虚线（ghost）画出整条路线，实线只画到当前行——所以枝干看起来是「长」到你这里的；
  该行的点会绽放（r 3.2 vs 2）。横纵坐标都是**逐行实测**的（这棵树行高不一，且用
  padding 逐行缩进，所以单一间距或单一竖线 x 都不成立）。整层 SVG 是
  `pointer-events: none` 且绘制在行**背后**，因此点击/悬停/拖拽仍完全属于行本身。
  宿主主题没有可借用的强调色（`--dsw-alias-brand-primary` 与主文本色同为近黑；
  唯一饱和的是状态色，借用会被误读为「运行中 / 需处理」），所以绽放改由
  **尺寸 + 全强度墨色**表达。
- **一眼就能看出会话属于哪个工作区**。除花枝外还有 3 个互相独立的线索，而不是只看
  缩进（此前 20px 缩进 + 两级字号完全相同，是区分「子会话」与「同级项目行」的
  **唯一**线索）：
  1. **字重**：文件夹 600（含当前会话的那个 700）；会话标题 400（当前会话 500）。
  2. **字体**：文件夹名用**等宽字体**，会话标题用界面字体。这条不依赖颜色，
     任何主题下都成立。
  3. **颜色**：文件夹用主文本色，会话标题用次级文本色——当前会话回到主色。

### 分组管理（完整生命周期）
- **手动新建分组**：区头「新建分组」按钮即建即显，空分组也渲染
- **重命名 / 删除任意分组**：每个分组行（**含规则分类**）悬停 `⋯` 菜单；
  删除分组后组内所有项目回到**顶层**；规则分类的改名/删除经 overlay 生效
  （`renamed` / `hidden`），**规则 YAML 原样保留**
- **规则自动归类**：sidecar YAML 声明分类规则（`pathPrefix` / `pathExact` /
  `nameContains` / `basenameContains`），改配置即可调整归类，无需改代码

### 拖拽归类 + 排序
- **拖项目进分组**：拖到任意分组行 / 分组内项目行即移入（跨组移动 = 覆盖规则归类）
- **从分组拖出**：拖动时**整个顶层区域都是移出落点**，用**插入横线**指示（非高亮框）——
  拖到任意顶层项目行（插到它前/后）、拖到最后一行下方空白（追加末尾）、顶层为空时
  在最后一个分组行下方显示独立横线 = 移出分组；分组内项目行的菜单「移出分组」
  （规则归类项目也有）
- **项目组内排序**：拖到项目行上半 = 插到它前面、下半 = 插到它后面
- **顶层项目排序**：顶层项目行也可拖拽排序（上半 = 插到它前、下半 = 插到它后），
  顺序持久化在 `workspaceOrder["__topLevel__"]`
- **分组排序**：分组行可拖动，拖到另一分组行上半 = 移到它前面、下半 = 移到它后面
- **插入位置指示线**：拖动中实时显示 2px 指示线（行上/下方），松手落点所见即所得
- **按级别收起 + 结束后恢复**：拖项目只收起项目行（分组内 + 顶层，分组行不收）；
  拖分组只收起分组行（项目行不收）；dragend 自动恢复拖动前的展开状态
- **行图标可区分**：分组行是文件夹图标、项目行是项目符号图标（官方同款），
  分组与项目一眼可分

### 搜索与操作
- **树形搜索**：命中后仍保留三层树结构（分类 → 项目 → 命中会话），命中行高亮 +
  内容摘要，防抖 250ms
- **工作区/会话操作不退化**：Add Workspace、项目重命名/删除、新建/打开/重命名/
  派生/归档会话
- **在文件夹中打开**：项目行菜单在该 host 解析出系统文件管理器时多一项
  「在文件夹中打开」（复用官方 open-in-app 路由，插件自身不加 host 路由）

### 会话标签页
- **标签代表「正在进行」，而不是「曾经打开过」**。会话只有在**真正开始对话且仍在进行中**
  时才获得标签：**运行中**、**在等你**（审批 / 计划评审 / 提问）、或**你离开时刚刚完成**
  （未读标记——标签就是提醒你回来的东西）。空白草稿在发出第一条消息前不占标签；
  **翻阅已完成的历史会话不会在标签栏留下任何东西**。已经存在的标签不会被关掉，
  这条规则只管**新标签**是否出现。（翻历史是侧栏的职责，标签栏是工作集。
  旧的 `!blank` 规则之所以有问题，是因为一周前就结束的会话同样是非空白的。）
- **每个标签做成「文件夹」形状**：上面一行是**较短的工作区名**，下面一行是**较长的会话标题**，
  两行叠在一起就像带标签的文件夹，而不是两串无关文字。工作区行用等宽字体、更小（10px）、
  次级色；标题 12px、主文本色——会话才是标签的主体。两行各自按内容宽度收缩
  （`align-items: flex-start`），这正是「上短下长」的来源。每个标签有一圈淡描边、
  当前标签描边加深，因此一排标签读起来是**一个个独立对象**，而不是一条连续的色带。
  不属于任何工作区的会话只显示标题并垂直居中。悬浮提示给出完整的
  `工作区 · 标题` 与目录路径。
- **标签保存在 HOST 侧，刷新、重启、换端口都不丢**。存放在 `$DSH_HOME` 下的 JSON sidecar
  （`workspace-groups.tabs.json`），经 `GET|PUT /workspace-groups/tabs` 读写。
  浏览器存储**做不到**这件事：origin 包含**端口**，而每次启动端口都不同，
  `localStorage` / `sessionStorage` 都按 origin 隔离，所以存在那里的标签下次启动必然是空的。
  读取**刻意不加任何浏览器会话标记**：标记本身也只能存在浏览器存储里，
  换端口就会把它抹掉，于是每次重启都被当成新会话（这个 bug 确实发布过一次，
  会静默丢掉用户的标签）。sidecar 就是标签栏的记忆；旧版本（带标记）写出的文件
  仍能正常加载——多出来的字段会被忽略。
- **会话开始工作的那一刻出现标签**：侧栏任意会话行、工作区「+」（新建会话）、
  Ctrl+R 快速切换、会话头部面包屑——从任何入口打开会话，一旦它开始运行、在等你、
  或你离开时刚完成，就会在会话列顶部出现标签；再打开一个就多一个（同一会话只有一个标签）
- **标签位置一旦确定就不再变动**：标签在**首次打开**时定好位置，之后永不改变。
  切换标签、或重开一个已有标签的会话，只移动**高亮**；标签本身待在原地不动，
  因此点击绝不会让标签从光标下滑走。只有两种情况会改变顺序：会话**首次**打开
  （追加到末尾）与标签被关闭
- **放不下时横向滚动，但不显示滚动条**：标签保持自身宽度、**不被压缩**，
  因此超出可用宽度后整行横向滚动。滚动条本身被隐藏
  （`scrollbar-width: none` + `::-webkit-scrollbar`），标签栏始终只有一行高。
  普通鼠标滚轮即可横向滚动；切换会话时当前标签会自动滚入可视区，
  因此靠右的标签不会被甩到屏幕外
- **只有你能关掉标签**。标签右侧 `×` 是它消失的**唯一**途径——插件自己从不修剪标签栏。
  归档不关、Host 端删除不关、会话从目录里消失也不关：你开过的标签会一直留着，
  而且刷新与重启后依然在（见下面的持久化说明）。这是刻意的：自动清理迟早会吃掉
  用户想留的标签；而且它在机制上也站不住——会话目录在每次加载的瞬间都是空的，
  于是「会话没了就关标签」这条规则会在会话到达之前就把还原出来的标签全删掉。
- **可显示状态**：标签左侧状态点沿用侧栏会话行的同一套语义——
  黄点 = 有待处理的提问/审批/计划评审、绿点 = 正在运行（含子代理）、
  灰点 = 空闲（未读完成提醒同样以完成点渲染）
- **当前标签**：标签会话即当前会话时以官方选中行同款底色高亮；点击后台标签走官方
  `ctx.uiWorkspace.openSession` 切换（与侧栏点行完全同一条导航路径）
- **双击改名**：双击标签直接打开会话重命名对话框（与侧栏 `⋯` 菜单同一对话框）
- **空草稿不入标签**：空白的新会话不占标签，发出第一条消息、会话拿到标题后
  自动出现标签
- 标签顺序与选中状态**持久化**（`dsh.workspace.groups.tabs.v1`），刷新后顺序不变

### 持久化与零侵入
- 所有手动操作（分组、归类、排序、改名、隐藏）写入插件自有 overlay
  （`~/.dsh/workspace-groups.manual.json`），host 校验后**原子写入**（写坏返回 400 并
  保留原文件）
- **零侵入**：不修改 `~/.dsh/storages/workspace.json`、不修改会话落盘结构、不修改官方
  `@deepseek-ai/dsh-client-ui-workspace` 包；规则 YAML 永不改写
- **产物自包含**：`lib/` 已构建并随仓库分发，Git 安装无需执行任何依赖脚本

## 工作原理

- 本插件是 **client 插件**，只有一处 slot 注册 + 一处 DOM 座位：
  1. 侧栏浏览器：注册进官方 sidebar shell 声明的 `sidebar.workspaces`
     slot（`kind: 'single'`，`scope: 'root'`），以 `priority: -1` 顶替官方默认
     WorkspaceBrowser（官方以 priority 0 注册；single 槽位最低 priority 胜出）。
  2. 会话标签栏**不是** slot occupant：它用 React portal 渲染进一个被注入为
     **会话列（ui-layout AppFrame 的 `centerCol`）第一个子节点**的容器——也就是
     会话面板正上方那一行。
- **为什么用 DOM 座位而不是 slot**：会话列**没有声明任何子 slot**——它唯一的子节点
  是 `main` slot 的 occupant（会话界面或全局面板），所以标签栏**无处可注册**。
  附近唯一现成的 `conversation.composer.dock` 在输入框卡片**下方**，位置根本不对。
  因此标签栏自己占一个真实 DOM 节点：`tab-seat.ts` 用 CSS Modules 永远保留的
  `_centerCol` 类名后缀定位会话列（**不**匹配构建期哈希前缀），把自有 `<div>`
  插到最前；若 React 重整该列子节点把它挤掉，就把**同一个元素**重新插回。
  `MutationObserver` 加有限次 `requestAnimationFrame` 重试覆盖「会话列在
  `apply()` 之后才挂载」的情况，两者都随 effect 一起销毁。
- **一个 handle 只能挂一个 scope**：DOM 座位同时也是标签 store 能成立的原因。
  DSH 的 slot registry 强制 *one handle, one scope*——把同一个 store handle 同时挂在
  `sidebar.workspaces`（`root`）和一个 session 域 slot（`session`）上会抛错，并让
  整个 client `apply()` 中断。标签栏是浏览器入口的子组件、而不是第二次注册，
  store 因此只被挂载一次。
- **标签栏的归属**：标签是**视图**，不是第二套导航。标签生命周期（谁有标签、
  排序）归侧栏浏览器——它本来就要推导当前会话，所以「打开的会话是否需要
  一个标签」只需在一处判断（副作用对同一会话幂等）；标签栏只负责渲染 + 提供
  导航动词，其 tab store、会话 hooks 与导航回调都由那一个组件作为普通 props 传入。
- 数据源全部复用运行时 API：`useWorkspaces` / `useSessions` / `useSessionStatus`
  全局 hooks 与 `ctx.workspaces.*` / `ctx.sessions.*` / `ctx.uiWorkspace.*`，
  分类只是**展示层变换**。
- host 半做两件事：把 sidecar YAML 解析为 JSON 与运行时 overlay 合并，经
  `GET /workspace-groups/config` 路由（`Cache-Control: no-cache`）供 client 获取；
  `PUT /workspace-groups/manual` 接收整份 overlay（手动分组、每工作区归类覆盖、
  分组/项目排序、规则分类改名与隐藏），校验后原子写入
  `$DSH_HOME/workspace-groups.manual.json`。
- **归类优先级**：手动覆盖（拖拽/菜单写入；`null` = 强制顶层、规则匹配也无效）→
  YAML 规则自动归类（被隐藏的规则分类失效）→ **顶层**（不归组的项目显示为顶层行）。
  YAML 永不改写。

## 安装（npm）

> 前置：已安装 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
> （`dsh` 命令可用），并已初始化好目标 profile（如内置 `web`）。
>
> 版本对应：本插件 `0.3.x` 起对齐 `dsh 0.1.7-rc.2` 客户端契约
> （`useSessionStatus` / `ctx.uiWorkspace` / `mainView` 选中模型）；
> 运行在 `0.1.2-rc.1` 时代的 dsh 上请使用 `0.1.2`。
>
> `0.3.0` 说明：`dsh 0.1.7` 把 `dsh-client-ui-primitives` 的整套图标从尺寸后缀
> 改为字重后缀（`IconCloseFill14` → `IconCloseFillMedium` / `…Regular`，且不保留
> 旧名别名），本版本所有调用点已直接改用新名。

```sh
dsh plugin --profile web add @dsh-xhl/workspace-groups
```

这会自动：

1. 在 `~/.dsh/profiles/web/package.json` 的 `dependencies` 加入
   `"@dsh-xhl/workspace-groups": "^0.3.0"`
2. 在 `dsh.profile.bundles` 末尾追加 `"@dsh-xhl/workspace-groups"`
3. 运行 pnpm 安装并校验 bundle 层

**安装后重启 web profile**（bundle 与 host 半只有在重启后才会被加载）：

```sh
# 停止现有 dsh web 进程后重新启动，例如：
dsh web
```

验证安装：

```sh
dsh --profile web --dump-config | grep -A3 workspace-groups
# 应出现 - id: workspace-groups / name: @dsh-xhl/workspace-groups / config: {}
curl http://127.0.0.1:3080/workspace-groups/config
# 应返回 sidecar YAML 解析后的 JSON
```

### 备选：从 GitHub 安装

```sh
dsh plugin --profile web add github:z-col/dsh-workspace-groups
```

这种方式会在 `dependencies` 写入
`"dsh-workspace-groups": "github:z-col/dsh-workspace-groups"`（含版本/commit），
直接使用仓库内已提交的 `lib/` 产物，无需先发布。

## 卸载

```sh
dsh plugin --profile web remove @dsh-xhl/workspace-groups
```

这会自动从 `dependencies` 删除该依赖并从 `dsh.profile.bundles` 移除对应行。
同样需要**重启 web profile** 后生效。

> 手动等价做法（任选其一，不要重复）：编辑 `~/.dsh/profiles/web/package.json`，
> 从 `dependencies` 删除 `@dsh-xhl/workspace-groups` 行、从 `dsh.profile.bundles`
> 删除 `"@dsh-xhl/workspace-groups"`，然后在该目录 `pnpm install`。

## 分类配置（sidecar）

默认位置 `~/.dsh/workspace-groups.yaml`（也可用 `$DSH_HOME` 环境变量覆盖家目录）。
模板见仓库根目录 `workspace-groups.example.yaml`。

```yaml
categories:
  - name: DSH 插件
    rules:
      - pathPrefix: /Users/zcol/Project/SkillsManagePlugins
      - nameContains: 插件
      - basenameContains: plugin
  - name: 个人项目
    rules:
      - pathPrefix: /Users/zcol/Project/yeluzi
```

规则字段（每个 rule 是 OR 关系，任一命中即归类；分类按序匹配，先到先得）：

| 字段 | 含义 |
|---|---|
| `pathPrefix` | 项目绝对路径前缀 |
| `pathExact` | 项目绝对路径精确匹配 |
| `nameContains` | 项目显示标题包含（忽略大小写） |
| `basenameContains` | 项目目录名包含（忽略大小写） |

未命中任何分类、或被移出分组的项目显示为**顶层项目行**（与分组平级），不会被隐藏。

## 手动分组与拖拽归类（runtime overlay）

规则 YAML 之外，还有一份插件自有的运行时 overlay，**只记录 UI 里的手动操作**，
默认位置 `$DSH_HOME/workspace-groups.manual.json`（例如 `~/.dsh/workspace-groups.manual.json`）：

```json
{
  "categories": ["临时", "归档"],
  "assignments": {
    "a1b2c3d4-e5f6-7890-abcd-ef1234567890": "临时",
    "a1b2c3d4-e5f6-7890-abcd-ef1234567891": null
  },
  "categoryOrder": ["临时", "DSH 插件"],
  "workspaceOrder": { "临时": ["a1b2c3d4-e5f6-7890-abcd-ef1234567890"] },
  "renamed": { "DSH 插件": "插件集" },
  "hidden": ["文档"]
}
```

- `categories` —— 手动新建的分组名（无规则，空分组也渲染）。
- `assignments` —— 工作区 → 分组的归类覆盖，键是稳定的工作区 id（重命名不影响）。
  **优先级高于 YAML 规则**；值为 `null` 表示**强制移到顶层**（即使规则能匹配）。
- `categoryOrder` —— 分组显示顺序（顶层项目不在此列，恒显示在分组之后）。
- `workspaceOrder` —— 每个分组内项目的手动排序（拖拽排序写入）。
- `renamed` / `hidden` —— 规则分类的 UI 改名/删除（隐藏后其规则失效，匹配项目
  变顶层）；规则 YAML 原样保留。
- 文件由浏览器 UI 全量写入（`PUT /workspace-groups/manual`，原子替换），手工编辑
  同样生效（下次加载时读取）；写坏会返回 400 并保留原文件，不会破坏规则 YAML。

| 操作 | 入口 |
|---|---|
| 新建分组 | 区头「新建分组」按钮（文件夹图标），弹窗输入名称 |
| 重命名/删除分组 | **任意分组**（含规则分类）悬停 `⋯` 菜单；删除后组内项目回顶层 |
| 拖项目进分组 | 拖动项目行到目标分组行 / 分组内任意项目行，松手即移入 |
| 项目排序 | 拖动项目行到同组另一项目行：**上半 = 插到它前、下半 = 插到它后**（指示线显示落点）；拖动时所有项目行收起、dragend 恢复 |
| 顶层排序 | 拖动顶层项目行到另一顶层行：**上半 = 插到它前、下半 = 插到它后**；顺序持久化 `workspaceOrder["__topLevel__"]` |
| 移出分组 | 拖到**顶层区域任意位置**（用插入横线指示落点——拖到顶层行前/后、最后一行下方追加、顶层为空时最后分组行下方独立横线），或项目行菜单「移出分组」（强制移到顶层） |
| 分组排序 | 拖动分组行到另一分组行：**上半 = 移到它前、下半 = 移到它后**（指示线显示落点；拖动时所有分组收起、dragend 恢复） |
| 在文件夹中打开 | 项目行菜单「在文件夹中打开」——在系统文件管理器中打开该项目目录（非项目行自身的能力，见下） |

### 在文件夹中打开（复用官方 open-in-app）

项目行菜单的「在文件夹中打开」**不自带任何启动逻辑**：它复用官方
`@deepseek-ai/dsh-host-open-in-app` 已解析好的能力——`GET /open-in-app/apps`
读回该 host 已验证可启动的应用，插件从中取本平台的文件管理器
（Windows `explorer` / macOS `finder` / Linux `filemanager`），再把项目目录
`POST /open-in-app/open` 交给其**已验证的启动器**。

- 该 host 半未解析出任何文件管理器（例如 SSH 启动的远端部署）时，
  **菜单里不会出现这一项**，而不是点了才报错；同样地，项目目录不存在的项目
  由 host 返回 404，插件以顶部横幅提示「打开文件夹失败」。
- 因此插件自身的 host 半**零改动**：不加路由、不 spawn 进程，权限与
  Host/Origin 校验仍由官方那三条路由统一承担。

## 收录标签（topics）

本仓库面向 DSH 插件生态的自动收录（社区市场靠 GitHub topic 扫描发现），已设置：

- `dsh-plugin`（核心标签，[1024Store](https://github.com/imsai-sh/awesome-deepseek-harness-plugins)
  等市场定时按此 topic 自动发现，并校验 `package.json` + 插件 bundle 清单
  （`cordis.patch.yml`））
- `deepseek-harness` / `deepseek-harness-plugin` / `dsh`
- `sidebar` / `workspace` / `workspace-groups`

`package.json` 同时提供 `keywords` 便于 npm/搜索索引。

## 开发

```sh
pnpm install
pnpm typecheck   # host + client 双 program 类型检查
pnpm test        # 核心规则、overlay、树派生单测
pnpm build       # 构建 lib/（node 半 + client bundle）
pnpm watch       # tsdown 监听（client HMR）
node scripts/verify-groups.mjs   # 真机 CDP 验证（host 已重启时；自启独立 headless Chrome，自动恢复现场）
```

产物契约（与官方 client 包一致）：

- `lib/index.js` —— host 半（ESM；读取 sidecar + `/workspace-groups/config` 路由，
  js-yaml 已内联，无运行时依赖）
- `lib/client.js` —— browser 半（`window.__ModuleLoader__.load({id, factory})`；
  仅 require 平台 seed：react / react/jsx-runtime / @deepseek-ai/dsh-client-runtime/client /
  @deepseek-ai/dsh-client-ui-primitives；跨插件值 import 在构建期被 purity 门拒绝）
- `lib/types/**` —— 声明文件

> 发布策略说明：`lib/` 构建产物随仓库提交（无 `prepare` 脚本），因此
> `dsh plugin add github:...` 全程无需执行第三方构建脚本，安装即用。

## 目录结构

```
src/
  index.ts              # host 半：config 快照路由 + manual 写路由
  host-config.ts        # sidecar YAML 读取/校验
  host-manual.ts        # runtime overlay 读写/校验（原子发布）
  host-tabs.ts          # 会话标签 sidecar：原子写入 + 浏览器会话生命周期
  context-types.ts      # host 侧 cordis 服务结构类型
  core/
    types.ts            # 配置类型（两半共享）
    matcher.ts          # 分类规则 + 手动覆盖优先级 + 排序纯函数（两半共享）
  client/
    index.ts            # apply：注册 sidebar.workspaces（priority -1）；只挂载一次 tab store
    contract.ts         # 注入面类型（浏览器）+ 标签栏的普通 props
    stores.ts           # 展开状态 store（persist: dsh.workspace.groups.view.v1）
    tab-store.ts        # 会话标签 store（由 host 读取后 hydrate）
    tab-persist.ts      # 客户端收发 /workspace-groups/tabs（标签存于 host）
    tabs.ts             # 标签纯状态：追加/关闭/还原/指示点派生
    store-hook.ts       # store 实例的选择器 hook（框架只为 slot 座位绑定这个）
    tab-seat.ts         # DOM 座位：把标签容器注入为会话列的第一个子节点
    tree.ts             # 三层树派生 + 树形搜索派生
    branch.ts           # 花枝几何：弯曲枝干、拐点、以及每行的点
    GroupsBrowser.tsx   # 浏览区域组件（分组弹窗 + 拖拽归类/排序 + 插入指示线）
    SessionTabs.tsx     # 会话标签栏组件（portal 进列首座位）
    FlowerBranch.tsx    # 把枝干「生长」到当前行的 SVG 覆盖层
    rows.tsx            # 分类/项目/会话/搜索结果行（拖拽源/目标）
    open-folder.ts      # 「在文件夹中打开」传输层（官方 open-in-app 路由客户端）
    locales.ts          # 中英文案
    styles.css          # 内联样式（浏览区 + 标签栏）
tests/
  core.test.ts          # 分类规则 + 手动覆盖优先级 + moveBefore/moveAfter + 配置解析
  manual.test.ts        # overlay 校验 + 文件原子往返
  tree.test.ts          # 树派生渲染契约（手动分组空渲染/覆盖优先）
  store.test.ts         # 展开状态语义（折叠写 false 不删 key）
  quick.test.ts         # 快速切换面板数据整形（运行中优先/搜索排序）
  tabs.test.ts          # 标签状态（追加/关闭/还原/空草稿不入标签/状态点/无自动清理）
  tab-seat.test.ts      # DOM 座位（首位插入/会话列晚挂载/被 React 移除后原位重插/销毁）
  branch.test.ts        # 花枝几何（每个分组一个拐点、每行一个点落在自身 y、实线止于当前行）
  host-tabs.test.ts     # host 侧标签存储（原子写入、无会话门控、旧文件兼容、坏数据降级）
  styles.test.ts        # 标签栏布局契约（标签不压缩、整行可横滚、滚动条隐藏）
  open-folder.test.ts   # open-in-app 传输层（文件管理器挑选 + 读取/POST 契约）
scripts/
  verify-groups.mjs     # 真机 CDP 验证（自启 headless Chrome，自动恢复现场）
```

> 开发文档（`docs/` 五级框架与 `AGENTS.md`）是开发用工程文件，**不随仓库分发**
> （已在 `.gitignore` 排除）。

## 验证记录

- v0.1/v0.2 真实组合验证（headless Chrome + CDP 实操）：三层树顶替生效、分类正确、
  展开持久化、搜索保留归属；`workspace.json` / 会话落盘 / 官方 store 零侵入。
- v0.3 真机验证 24/24（`scripts/verify-groups.mjs`：建组/拖拽/排序/收起/规则分类
  菜单/重命名/删除回顶层/现场恢复，零侵入断言）。
- v0.4 真机验证 30/30（新增：插入指示线、项目/分组**向下拖**（行下半 → 插到目标
  之后）、分组向上拖（行上半 → 移到目标之前）；现场恢复通过）。
- v0.4.1 真机验证 34/34（新增：**从分组拖出**——顶层落点区/顶层行 drop =
  强制顶层；分组内项目行菜单「移出分组」）。
- v0.5 真机验证 35/35（模型变更：**无「未分类」桶**——顶层项目行、删除分组成员
  回顶层、拖拽/菜单移出到顶层、树中不存在未分类桶；现场恢复）。
- v0.6 真机验证 40/40（新增：**按级别收起**——拖项目只收起项目行（分组行不收）、
  拖分组只收起分组行（项目行不收）；dragend 还原拖动前展开快照）。
- v0.6.1 真机验证 42/42（新增：**整个顶层区域为移出落点**且拖拽中有可见高亮提示；
  分组/项目行图标区分；现场恢复）。
- v0.7 真机验证 46/46（新增：顶层落点改用**插入横线**（非高亮框）——拖到顶层行前/后、
  最后一行下方追加、顶层为空时独立横线；**顶层项目可排序**，顺序持久化
  `workspaceOrder["__topLevel__"]`；并修复 host 校验拒绝 `__topLevel__` 与
  「拖到两行之间却落在上一行上面」的落点定位 bug；现场恢复）。
- v0.8：项目行新增**「在文件夹中打开」**，复用官方 open-in-app 的 host 路由
  （按平台挑文件管理器；host 未解析出时菜单不出现该项；启动失败以顶部横幅提示）。
- v0.9：新增**会话标签页**——**会话列顶部**一行标签（会话列没有子 slot，附近唯一
  现成的 `conversation.composer.dock` 在输入框卡片下方，位置不对，因此标签栏以 DOM
  注入方式占住会话列第一个子节点）；点会话即开标签、可关闭、状态点复用侧栏语义、
  双击改名、空草稿不入标签、标签顺序持久化。
- v0.9.1：适配 **DSH 0.1.7-rc.2**——客户端契约的图标集从尺寸后缀
  （`IconCloseFill14`）改为字重后缀（`IconCloseFillMedium` / `…Regular`）；
  标签 store 改为单一 scope 挂载（slot 版本把同一个 handle 同时挂在 `root` 与
  `session` 两个 scope，registry 会直接抛错）。
- v0.9.2：**标签位置稳定**——标签栏不再把当前标签拉到最前，切换会话只换高亮、
  标签本身不动；store 的 `touch` / `close` 变换在无变化时改为完全空操作，
  避免每次目录更新都空转 arrival 计数器。
- v0.9.3：**超出宽度时横向滚动、且不显示滚动条**——标签改为保持自身宽度不被压缩
  （`flex: 0 0 auto`），普通滚轮即可横向滚动，切换会话时当前标签自动滚入可视区；
  当前标签改用官方选中行同款底色，去掉硬编码蓝色强调条
  （`--dsw-accent` / `--dsw-bg-selected` 并非产品主题 token，此前一直落到蓝色字面量）。
- v0.9.4：**标签显示所属项目**（`项目名 · 标题`，等宽前缀，提示含路径）；并且
  **侧栏树层级一眼可辨**——文件夹用更重的等宽字体、会话标题用更轻的正文字体。
- v0.10：**花枝**——侧栏树中一条连续的 SVG 枝干，在每个项目处拐弯，每行一个点落在
  曲线上；虚线 ghost 画出整条路线，实线生长到当前行，该行的点绽放。取代原先
  每个文件夹各自的引导竖线。
- v0.10.1：**标签代表「正在进行」而非「曾经打开过」**——会话只在运行中、在等你、
  或刚完成未读时才获得标签，因此翻阅已完成的历史不再堆满标签栏；
  空白草稿在发出第一条消息前不占标签。
- v0.10.2：**标签改为「文件夹」形状**——工作区在较短的上一行，会话标题在较长的下一行，
  两行各自按内容宽度收缩。
- v0.11：**标签更宽松**（整条 56px、内边距 8/10px、标签间距 6px、两行间距 3px、
  每个标签带内描边）；并且**标签改为存到 HOST**（`$DSH_HOME/…tabs.json`，
  经 `GET|PUT /workspace-groups/tabs`）——浏览器存储按 origin 隔离而端口每次都变，
  根本不可能还原标签栏。验证过程中查出两个 bug：持久化订阅在 host 读取返回前
  就把 store 的**初始空状态**写回去、覆盖了已存标签（用 hydration 闩锁修复）；
  以及自动清理误删还原的标签。
- v0.11.1：**标签只由用户关闭**。所有自动修剪都已移除：不再按目录清理，
  归档 / Host 端删除也不再关标签。这条规则是你的要求（「除非我关闭，程序不能删」），
  而且自动清理在机制上也站不住——会话目录在每次加载瞬间都是空的，
  它会在会话到达前删掉还原出来的标签。持久化订阅现在只在**真实状态变化**时写入，
  因此读取失败或读到空值都不会再清空已存标签。
- v0.11.2：**重启修复**。去掉 `X-WG-Session` 标记——它存在 `sessionStorage` 里，
  换端口就被抹掉，于是每次重启都是新标记，host 就把已存标签扣住不发；
  这正是「重启后标签不显示」的原因。现在 sidecar 原样返回，
  旧文件多出的 `sessionKey` 字段直接忽略。同时 `restore` 改为**合并**而非
  「非空就跳过」：启动期间新开的标签和已存标签现在都能保留。
- v0.12（发布 `0.3.0`）：合并远端 `0.2.1` 的图标改名修复——所有调用点统一改用
  `dsh 0.1.7` 的字重后缀新名（`IconCloseFillMedium` / `…Regular`），因此远端那层
  `icons.ts` 别名表不再需要，已删除；同时保留远端的注入面修复：补齐
  `hooks.directoryFlow` 保留隔间（官方 entry 仍注册在本插件之后，并据此决定是否
  显示自己的「添加工作区」），以及 `SessionStatusSnapshot` 的 map / 记录双形状读取。
- 类型检查 + 构建通过（含 client bundle purity 门）。
- 单测 179 用例全绿（vitest：`core` / `manual` / `tree` / `store` / `quick` / `tabs` /
  `tab-seat` / `host-tabs` / `branch` / `styles` / `open-folder`）。
- 真机验证（test profile，Playwright 驱动）：标签容器注入 `pI_x6G_centerCol` 且
  **为其第一个子节点**（几何测量 `seatTop == colTop`、宽度占满整列）；点会话出标签、
  再点一个出第二个、点后台标签可切换且**标签位置不变**（实测点击第 3 个标签后
  三个标签的 x 坐标仍为 `[288, 458, 660]`，与点击前一致）、`×` 可关闭；
  9 个标签时实测 `scrollWidth 1714 > clientWidth 984`（可横滚）、
  `offsetHeight - clientHeight = 0`（滚动条不可见）、滚轮 `deltaY` 使 `scrollLeft`
  400 → 600、点击最右标签后自动滚到 `scrollLeft = 730`（最大值）且完全可见；
  标签项目前缀实测：10 个标签全部带项目名、标签最大宽 260px、
  `scrollWidth 2473 > clientWidth 984` 仍可横滚且滚动条不可见；
  项目前缀为次级色 `rgb(97,102,107)`、标题为主色 `rgb(15,17,21)`（**可区分**），
  分隔线 1px×10px，暗色下分别为 `rgb(207,211,214)` / `rgb(249,250,251)`；
  侧栏树实测：竖线 x 坐标与文件夹折叠箭头**完全对齐**（同时为 40），
  会话状态点/标题分别在其右（60 / 80），展开 4 个文件夹时 4 条竖线一一对应，
  含当前会话的文件夹竖线 2px、其余 1px；层级实测字重为
  分组 600 / 项目 600（当前 700）/ 会话 400（当前 500），
  文件夹为等宽字体、会话为界面字体；
  亮/暗两套主题下 token 均正确解析；控制台无 slot entry crash。
- 可复跑的自动化真机验证：`node scripts/verify-groups.mjs`（需 host 已重启）。

## License

MIT
