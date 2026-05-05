# AI English Speaking Evaluation System [![License: GPL v3+](https://img.shields.io/badge/License-GPL%20v3%2B-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
# AI 英语口语评估系统

AI-driven interactive IELTS speaking practice platform with multi-dimensional expression quality evaluation.

AI 驱动的交互式雅思口语练习平台，支持多维度表达质量评估。

**Built by Mark** · [https://markblogforpublic.github.io](https://markblogforpublic.github.io/index.html)

---

## Motivation | 项目动机

IELTS speaking preparation traditionally requires expensive one-on-one tutoring or language school enrollment. Learners in underserved regions may never access a qualified examiner for mock tests. Meanwhile, LLM and ASR technologies have matured to the point where they can reliably assess spoken language across multiple dimensions — fluency, vocabulary range, and naturalness — with feedback comparable to human evaluators.

This project bridges that gap: a fully open-source, locally-runnable AI examiner that simulates all three parts of the IELTS speaking test, scores every response on a 1-9 band scale, and provides actionable corrections — for free, on your own hardware, with no data leaving your machine.

雅思口语备考传统上需要昂贵的一对一辅导或语言学校课程。欠发达地区的学习者可能永远无法接触到合格的考官进行模拟测试。与此同时，LLM 和 ASR 技术已足够成熟，能够从流利度、词汇范围、自然度等多个维度可靠评估口语表达，反馈质量可与人工评估媲美。

本项目桥接这一鸿沟：一个完全开源、可本地运行的 AI 考官，模拟雅思口语全部三个部分，按 1-9 分制评估每次回答，提供可执行的改进建议——完全免费，运行在你自己的硬件上，数据不出你的电脑。

---

## ⚖️ LICENSE — GNU GPL v3+ (Non-Commercial)
[![License: GPL v3+](https://img.shields.io/badge/License-GPL%20v3%2B-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
```
This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

Non-Commercial Restriction: Commercial use, sale, or incorporation
into paid products or services is NOT permitted without explicit
author consent. Personal, educational, and research use is allowed.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.
```

**Key terms | 核心条款：**

| | English | 中文 |
|---|---|---|
| ✅ | Run, study, modify, share for personal / educational / research use | 自由运行、研究、修改、分享（个人/教育/研究） |
| ✅ | Full source code access, share freely | 完整源码可自由分享 |
| 🔒 | **Copyleft**: Modified versions MUST be released under GPL | **著佐权**：修改版本必须以 GPL 公开 |
| 🔒 | **Copyleft**: Code linking GPL must also be GPL | **著佐权**：链接 GPL 代码的软件也必须 GPL |
| ⛔ | **Non-Commercial**: No commercial use, sale, or paid integration without consent | **非商业**：未经许可不得商用、销售或付费集成 |
| ⛔ | Provide source with binaries; no sublicensing; no warranty | 分发须附源码；不得再许可；无担保 |

Full license text: https://www.gnu.org/licenses/gpl-3.0.html

---

## Features | 功能特性

- **IELTS Speaking Simulation / 雅思口语模拟** — Practice all 3 parts (Introduction, Long Turn, Discussion) with an AI examiner / 模拟雅思口语全部 3 个部分
- **Multi-dimensional Scoring / 多维度评分** — Fluency, Lexical Resource, and Naturalness on a 1-9 IELTS band scale / 流利度、词汇资源、自然度，1-9 雅思评分制
- **Actionable Feedback / 可执行反馈** — Error highlighting, rewrite suggestions, and personalized improvement tips / 错误高亮、改写建议、改进提示
- **Voice Input / 语音输入** — Speak your answers; ASR transcribes in real time / 直接口语作答，实时语音识别
- **Batch Mode / 批量评分** — Collect all responses first, evaluate together at the end / 先收集全部回答，最后统一评分
- **Countdown Timer / 倒计时** — Per-question timer with configurable duration / 每道题可设置倒计时
- **Progress Dashboard / 学习看板** — Track score trends and identify weak areas / 追踪分数趋势，定位薄弱环节
- **Multiple LLM / 多模型后端** — OpenAI API, Anthropic-compatible API, or local GGUF models / 支持多种 API 和本地 GGUF 模型
- **GPU Acceleration / GPU 加速** — CUDA, Vulkan, or CPU — switch via launcher / 通过启动器一键切换

---

## Pages & Menus | 页面与菜单详解

### 🏠 Home (`/`)
Landing page with feature overview and call-to-action to start practicing.

首页，展示功能概览和开始练习入口。


<img width="1722" height="1191" alt="屏幕截图 2026-05-05 112152" src="https://github.com/user-attachments/assets/2d22648d-afd0-4a1c-96c4-7d8a1e0ecba9" />


### 🎯 Practice (`/practice`)
The core speaking practice interface. On first visit, a **Device Check** modal runs automatically to verify ASR and LLM are configured correctly.

核心口语练习界面。首次访问时自动弹出**设备检查**窗口验证语音识别和理解模型。

<img width="741" height="710" alt="屏幕截图 2026-05-05 112449" src="https://github.com/user-attachments/assets/52d82648-1302-4ce9-bbfa-076c60d69eeb" />


**Toolbar | 工具栏：**
| Control | Function | 功能 |
|---|---|---|
| `ExamSelector` | Choose IELTS Part 1 / 2 / 3 and topic | 选择雅思 Part 1/2/3 及话题 |
| `Batch: ON/OFF` | Toggle batch evaluation — collect all responses, analyze at the end | 批量评分模式开关——收集全部回答后统一分析 |
| `Timer: ON/OFF` | Enable per-question countdown with configurable duration | 每道题倒计时开关，可设时长 |
| `Submit All (N)` | (Batch mode) Evaluate all pending responses at once | 一次性评分所有待处理回答 |
| `End Session` | End practice — auto-evaluates pending batch responses | 结束练习——自动评分批量模式下待处理回答 |

**Chat Area | 对话区：**
- Examiner asks questions; user types or speaks responses
- Each response gets scored (Fluency / Lexical / Naturalness) and detailed feedback
- Radar chart visualizes scores; feedback panel shows errors and rewrite suggestions
- Voice input: speak → ASR transcribes → fills input box → user manually sends

考官的 AI 提问，用户打字或语音回答。每次回答获得评分（流利度/词汇/自然度）和反馈。雷达图可视化评分，反馈面板显示错误和改进建议。语音输入：录音→转写→填入输入框→用户自己发送。

### 📊 Dashboard (`/dashboard`)
Score trends over time and weakness analysis. Charts show progress across Fluency, Lexical Resource, and Naturalness dimensions. Weakness tags identify specific areas to improve with actionable advice.

分数趋势和薄弱环节分析。图表展示流利度、词汇资源、自然度的进步趋势。薄弱标签定位具体改进领域并给出建议。

### 📋 History (`/history`)
Chronological list of past practice sessions with average scores per dimension. Review previous performance at a glance.

按时间排列的历次练习记录，附各维度平均分。一览过往表现。
<img width="1698" height="344" alt="屏幕截图 2026-05-05 112223" src="https://github.com/user-attachments/assets/ebfdb700-3c9f-448b-aefe-e52d35b9c38a" />



### ⚙️ Settings (`/settings`)
Full system configuration page:

**完整系统配置页面：**

| Section | Function | 功能 |
|---|---|---|
| **Hardware Info** | GPU model, VRAM, RAM, acceleration backend | 显示 GPU 型号、显存、内存、加速后端 |
| **GPU Recommendation** | Suggested model sizes based on available VRAM | 根据可用显存推荐模型大小 |
| **Speech Recognition (ASR)** | Choose engine (Whisper / Local GGUF / Online API), download Whisper models, import custom ASR models, disable voice | 选择引擎、下载 Whisper 模型、导入自定义 ASR 模型、禁用语音 |
| **Understanding Models (LLM)** | Select API or local model, configure API keys, import GGUF models | 选择 API 或本地模型、配置 API 密钥、导入 GGUF 模型 |
| **API Configuration** | Manage Anthropic / OpenAI keys, model names, base URLs | 管理 Anthropic / OpenAI 密钥、模型名、API 地址 |
| **Import Model** | File picker → auto-detect GGUF metadata → one-click register | 文件选择→自动探测模型信息→一键注册 |
| **License & Disclaimer** | GPL v3+ terms, educational use notice | GPL v3+ 条款、教育用途声明 |

---

<img width="1459" height="993" alt="屏幕截图 2026-05-05 112244" src="https://github.com/user-attachments/assets/084c2420-4513-4e24-a522-875bb7fa814a" />
<img width="1406" height="672" alt="屏幕截图 2026-05-05 112237" src="https://github.com/user-attachments/assets/da74d2ba-3adb-4d77-a84e-541f4cc77b2e" />




## Architecture | 架构

```
frontend (Next.js 16 + React 19)     backend (FastAPI + Python)
┌──────────────────────────┐         ┌──────────────────────────────┐
│  Practice / Dashboard    │  REST   │  /api/conversation/start     │
│  Settings / History      │◄──────►│  /api/conversation/respond   │
│                          │         │  /api/conversation/transcribe│
│  Components:             │         │  /api/system/check           │
│  - ChatPanel             │         │  /api/analytics/progress     │
│  - AudioRecorder         │         │  /api/models/probe           │
│  - DevCheckModal         │         │  /api/models/pick-file       │
│  - ScoreCard / RadarChart│         │  /api/models/register        │
│  - FeedbackPanel         │         │                              │
└──────────────────────────┘         │  Core:                       │
                                     │  - evaluator (LLM scoring)   │
                                     │  - feedback_generator        │
                                     │  - dialogue_generator        │
                                     │  - asr (speech recognition)  │
                                     │  - model_manager (GPU/DLL)   │
                                     └──────────────────────────────┘
```

---

## Quick Start | 快速开始

### Prerequisites | 环境要求

- Python 3.11+
- Node.js 18+
- (Optional) MongoDB for session persistence / MongoDB（可选，用于持久化会话记录）

### 1. Backend Setup | 后端安装

```bash
cd backend
pip install -r requirements.txt
```

### 2. Frontend Setup | 前端安装

```bash
cd frontend
npm install
```

### 3. Download GPU Resource Packages | 下载 GPU 资源包

GPU acceleration libraries are distributed separately due to their large size.
Download the package matching your GPU and extract it to `backend/resources/`.

GPU 加速库因体积较大单独分发。根据你的 GPU 选择下载，解压到 `backend/resources/`：

| Package | Size | GPU Needed | Download | 说明 |
|---------|------|------------|----------|------|
| `resources_cuda.zip` | 722 MB | ✅ NVIDIA GPU + CUDA Toolkit | [⬇ Download](downloads/resources_cuda.zip) | NVIDIA CUDA 加速。包含 CUDA 运行时 DLL + cuBLAS，适合有 NVIDIA GPU 的用户 |
| `resources_vulkan.zip` | 18 MB | ✅ Any GPU with Vulkan driver | [⬇ Download](downloads/resources_vulkan.zip) | Vulkan 通用 GPU 加速。AMD、Intel、NVIDIA 均可用，无需 CUDA Toolkit |
| `resources_cpu.zip` | 4 MB | ❌ No GPU required | [⬇ Download](downloads/resources_cpu.zip) | 纯 CPU 运行。最安全兼容，速度最慢。无 GPU 用户的默认选择 |

**Extract | 解压：**
```bash
# Move the downloaded zip to the backend directory, then:
cd backend
unzip resources_cuda.zip   # or resources_vulkan.zip / resources_cpu.zip
# Result: backend/resources/{cuda,vulkan,cpu}/
```

The launcher reads from `backend/resources/<backend>/` — no further setup needed.

启动器自动读取 `backend/resources/<backend>/` 目录，无需额外配置。

### 4. Launch | 启动

```bash
cd backend
python launcher.py
```

The launcher will / 启动器会：
- Detect your GPU and let you choose CUDA / Vulkan / CPU backend / 检测 GPU，选择加速后端
- Apply the correct GPU DLLs from `resources/<backend>/` / 从 `backend/resources/` 复制对应 GPU DLL
- Start backend on http://localhost:8000 / 启动后端
- Start frontend on http://localhost:3000 / 启动前端

### 4. Configure | 配置

Open http://localhost:3000/settings to / 打开设置页面：

- Set up your API key (Anthropic-compatible or OpenAI) / 配置 API 密钥
- Choose ASR engine and download model / 选择语音识别引擎并下载模型
- Select understanding model (API or import local GGUF) / 选择理解模型或导入本地 GGUF
- Import your own GGUF models via file picker / 通过文件选择器导入自己的 GGUF 模型

---

## GPU Backends | GPU 后端

Three pre-bundled backends in `backend/resources/` / 三种预编译后端：

| Backend | Best For | Setup |
|---------|----------|-------|
| CUDA | NVIDIA GPUs | Select [1] in launcher |
| Vulkan | AMD / Intel / NVIDIA | Select [2] in launcher |
| CPU | No GPU / safest default | Select [3] in launcher (default) |

Switching backends is instant — the launcher copies the correct DLLs, no downloads needed.

切换后端瞬时完成——启动器直接从本地复制 DLL，无需下载。

---

## Configuration | 配置项

Copy `backend/.env.example` to `backend/.env` and fill in your values / 复制后填写：

| Variable | Description | 说明 |
|----------|-------------|------|
| `ANTHROPIC_API_KEY` | API key for Anthropic-compatible services | Anthropic 兼容 API 密钥 |
| `OPENAI_API_KEY` | API key for OpenAI | OpenAI API 密钥 |
| `LLM_PROVIDER` | `anthropic`, `openai`, or `local` | 模型提供方 |
| `LLM_MODEL` | Model name (e.g. `deepseek-v4-flash`) | 模型名称 |
| `ASR_PROVIDER` | `whisper`, `qwen_asr`, or `online_api` | 语音识别引擎 |
| `ASR_MODEL` | Whisper model size | Whisper 模型大小 |
| `GPU_BACKEND` | `cuda`, `vulkan`, or `cpu` | GPU 加速后端 |
| `MONGODB_URL` | MongoDB connection (optional) | MongoDB 连接地址（可选） |

---

## Local Model Support | 本地模型

Set `LLM_PROVIDER=local` and import your GGUF model via the Settings page. The file picker auto-detects model metadata (name, architecture, size). Local model inference is slower (30+ seconds per response) — a warning banner reminds users of this.

在设置页面通过文件选择器导入 GGUF 模型，自动探测模型信息。本地模型推理较慢（每次 30 秒以上）——页面显示黄色提示条。

---

## Disclaimer | 免责声明

This software is for **educational and practice purposes only**. AI-generated evaluations are not official IELTS scores and should not be used as such. All trademarks belong to their respective owners. This project is not affiliated with or endorsed by IELTS, Cambridge Assessment, or any testing organization.

本软件仅供**教育和练习用途**。AI 生成的评分并非官方雅思成绩，不应作为正式成绩使用。所有商标均为其各自所有者财产。本项目与雅思、剑桥大学考试委员会或任何其他考试机构无关联。

---

## Developer | 开发者

**Mark** — [https://markblogforpublic.github.io/index.html](https://markblogforpublic.github.io/index.html)
