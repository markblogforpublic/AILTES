"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

export type Lang = "en" | "zh";

const DICT: Record<string, { en: string; zh: string }> = {
  // Nav
  "nav.home": { en: "Home", zh: "首页" },
  "nav.practice": { en: "Practice", zh: "练习" },
  "nav.dashboard": { en: "Dashboard", zh: "仪表盘" },
  "nav.history": { en: "History", zh: "历史" },
  "nav.settings": { en: "Settings", zh: "设置" },
  "nav.langToggle": { en: "中文", zh: "EN" },

  // Home
  "home.hero.title": {
    en: "AI-Powered English Speaking Practice",
    zh: "AI 驱动的英语口语练习",
  },
  "home.hero.subtitle": {
    en: "Simulate IELTS speaking exams, receive multi-dimensional evaluations, and track your progress over time.",
    zh: "模拟雅思口语考试，获得多维度评估，并持续跟踪你的进步。",
  },
  "home.hero.cta": { en: "Start Practicing", zh: "开始练习" },
  "home.feature1.title": { en: "Realistic IELTS Simulation", zh: "真实的雅思模拟" },
  "home.feature1.desc": {
    en: "Practice with an AI examiner across all 3 parts of the IELTS speaking test.",
    zh: "与AI考官练习雅思口语考试的所有三个部分。",
  },
  "home.feature2.title": { en: "Multi-dimensional Evaluation", zh: "多维度评估" },
  "home.feature2.desc": {
    en: "Get scored on Fluency, Lexical Resource, and Naturalness with detailed evidence.",
    zh: "在流利度、词汇资源、自然度三个维度获得评分和详细依据。",
  },
  "home.feature3.title": { en: "Actionable Feedback", zh: "可执行的反馈" },
  "home.feature3.desc": {
    en: "Receive error highlighting, rewrite suggestions, and personalized improvement tips.",
    zh: "获取错误高亮、改写建议和个性化的改进提示。",
  },

  // Practice
  "practice.title": { en: "Speaking Practice", zh: "口语练习" },
  "practice.start": { en: "Start Practice", zh: "开始练习" },
  "practice.end": { en: "End Session", zh: "结束会话" },
  "practice.starting": { en: "Starting...", zh: "启动中..." },
  "practice.waitingEval": {
    en: "Submit your first response to see evaluation",
    zh: "提交你的第一个回答以查看评估",
  },
  "practice.emptyChat": {
    en: 'Select an exam part and click "Start Practice" to begin',
    zh: '选择一个考试部分，点击"开始练习"开始',
  },
  "practice.inputPlaceholder": { en: "Type your response...", zh: "输入你的回答..." },
  "practice.send": { en: "Send", zh: "发送" },
  "practice.part1": { en: "Part 1", zh: "第一部分" },
  "practice.part1Desc": { en: "Introduction & Daily Topics", zh: "介绍与日常话题" },
  "practice.part2": { en: "Part 2", zh: "第二部分" },
  "practice.part2Desc": { en: "Individual Long Turn", zh: "个人长篇陈述" },
  "practice.part3": { en: "Part 3", zh: "第三部分" },
  "practice.part3Desc": { en: "Two-way Discussion", zh: "双向讨论" },
  "practice.scoreTitle": { en: "Score Overview", zh: "评分概览" },
  "practice.feedbackTitle": { en: "Feedback", zh: "反馈" },
  "practice.errorsTitle": { en: "Errors to Fix", zh: "待修正的错误" },
  "practice.rewritesTitle": { en: "Better Expressions", zh: "更好的表达" },

  // Dashboard
  "dashboard.title": { en: "Dashboard", zh: "仪表盘" },
  "dashboard.scoreTrends": { en: "Score Trends", zh: "分数趋势" },
  "dashboard.areasToImprove": { en: "Areas to Improve", zh: "待改进领域" },
  "dashboard.noData": { en: "No practice data yet", zh: "暂无练习数据" },
  "dashboard.loading": { en: "Loading...", zh: "加载中..." },

  // History
  "history.title": { en: "Practice History", zh: "练习历史" },
  "history.empty": { en: "No practice sessions yet", zh: "暂无练习记录" },
  "history.emptyHint": {
    en: "Complete a practice session to see your history here.",
    zh: "完成一次练习后，你的历史记录将显示在这里。",
  },
  "history.date": { en: "Date", zh: "日期" },
  "history.fluency": { en: "Fluency", zh: "流利度" },
  "history.lexical": { en: "Lexical", zh: "词汇" },
  "history.naturalness": { en: "Naturalness", zh: "自然度" },
  "history.average": { en: "Average", zh: "平均分" },

  // Footer
  "footer.tagline": {
    en: "AI-powered English speaking evaluation to help you achieve your IELTS goals.",
    zh: "AI 驱动的英语口语评估，助你实现雅思目标。",
  },
  "footer.copyright": { en: "All rights reserved.", zh: "保留所有权利。" },

  // Weakness severity
  "weakness.high": { en: "Needs Improvement", zh: "需要改进" },
  "weakness.medium": { en: "Getting Better", zh: "逐渐进步" },
  "weakness.low": { en: "Good", zh: "良好" },

  // Dimension labels
  "dim.fluency": { en: "Fluency", zh: "流利度" },
  "dim.lexical": { en: "Lexical", zh: "词汇" },
  "dim.lexical_resource": { en: "Lexical Resource", zh: "词汇资源" },
  "dim.naturalness": { en: "Naturalness", zh: "自然度" },

  // Device Check
  "devCheck.title": { en: "Device Check", zh: "设备检查" },
  "devCheck.subtitle": { en: "Verifying your configured models...", zh: "正在验证配置的模型..." },
  "devCheck.asr": { en: "Speech Recognition", zh: "语音识别" },
  "devCheck.llm": { en: "Understanding Model", zh: "理解模型" },
  "devCheck.checking": { en: "Checking...", zh: "检查中..." },
  "devCheck.runCheck": { en: "Run Check", zh: "运行检查" },
  "devCheck.checkAgain": { en: "Check Again", zh: "重新检查" },
  "devCheck.startPractice": { en: "Start Practice", zh: "开始练习" },
  "devCheck.asrWarning": { en: "Voice input unavailable. You can still practice using text input.", zh: "语音输入不可用。你仍然可以使用文字输入进行练习。" },
  "devCheck.llmError": { en: "Understanding model check failed. Please verify your API keys and model settings, then check again.", zh: "理解模型检查失败。请检查你的 API 密钥和模型设置，然后重新检查。" },
  "devCheck.micTest": { en: "Test Microphone", zh: "测试麦克风" },
  "devCheck.micRecording": { en: "Recording... click to stop", zh: "录音中... 点击停止" },
  "devCheck.micResult": { en: "Transcription result:", zh: "识别结果：" },
  "devCheck.micFailed": { en: "Microphone test failed", zh: "麦克风测试失败" },
  "devCheck.micPermission": { en: "Microphone access denied. Please allow microphone access in your browser settings.", zh: "麦克风权限被拒绝。请在浏览器设置中允许麦克风访问。" },
  "devCheck.close": { en: "Close", zh: "关闭" },
  "devCheck.apiManager": { en: "API Settings", zh: "API 设置" },
  "devCheck.apiProvider": { en: "Provider", zh: "提供商" },
  "devCheck.apiKey": { en: "API Key", zh: "API 密钥" },
  "devCheck.apiModel": { en: "Model", zh: "模型" },
  "devCheck.apiBaseUrl": { en: "Base URL", zh: "基础地址" },
  "devCheck.apiSaved": { en: "Saved", zh: "已保存" },
  "devCheck.apiSaving": { en: "Saving...", zh: "保存中..." },
  "devCheck.apiSave": { en: "Save & Re-check", zh: "保存并重新检查" },
  "devCheck.noApiKey": { en: "No API key configured", zh: "未配置 API 密钥" },
};

// ---- Context ----

interface LangCtx {
  lang: Lang;
  toggle: () => void;
  t: (key: string) => string;
}

const LangContext = createContext<LangCtx>({
  lang: "en",
  toggle: () => {},
  t: (key: string) => key,
});

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>("en");
  // Persist language preference across page navigations
  useEffect(() => {
    const saved = localStorage.getItem("ais_lang") as Lang | null;
    if (saved === "en" || saved === "zh") setLang(saved);
  }, []);
  const toggle = useCallback(() => {
    setLang((l) => {
      const next = l === "en" ? "zh" : "en";
      localStorage.setItem("ais_lang", next);
      return next;
    });
  }, []);
  const t = useCallback(
    (key: string) => {
      const entry = DICT[key];
      if (!entry) return key;
      return entry[lang];
    },
    [lang]
  );
  return (
    <LangContext.Provider value={{ lang, toggle, t }}>{children}</LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
