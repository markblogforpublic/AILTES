"use client";

import { useEffect, useState, useCallback } from "react";
import { useLang } from "@/lib/i18n";
import {
  Cpu, Mic, Globe, AlertTriangle, CheckCircle2, Info,
  Plus, Server, Wifi, HardDrive, Loader2
} from "lucide-react";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ─── Types ───

interface GPUInfo { available: boolean; name: string; vendor: string; backend: string; vram_gb: number; ram_gb: number; devices: {id:number;name:string;vram_gb:number}[]; cuda_device: number }
interface ModelEntry {
  name: string; display: string; type: string; format: string;
  size_gb: number; param_b: string; path: string;
  is_loaded: boolean; estimated_vram_gb: number; is_custom: boolean;
}
interface Formats { [key: string]: { [fmt: string]: { description: string; extensions: string[] } } }
interface SystemStatus {
  gpu: GPUInfo; models: ModelEntry[]; formats: Formats; recommendation: string;
  current: { asr: { provider: string; model: string }; llm: { provider: string; model: string } };
  voice_disabled?: boolean;
}

// ─── Whisper sizes ───

const WHISPER_SIZES = [
  { id: "tiny",   desc: "~1 GB",   minVRAM: 0,   cpu: true },
  { id: "base",   desc: "~1.5 GB", minVRAM: 0,   cpu: true },
  { id: "small",  desc: "~3 GB",   minVRAM: 0.5, cpu: true },
  { id: "medium", desc: "~6 GB",   minVRAM: 3,   cpu: false },
  { id: "large",  desc: "~12 GB",  minVRAM: 6,   cpu: false },
];

// ─── Shared Model Registration Modal ───

function ModelRegModal({ title, probing, probeResult, path, name, params, onBrowse, onClose, onRegister, _tr }: {
  title: string;
  probing: boolean;
  probeResult: any;
  path: string;
  name: string;
  params: string;
  onBrowse: () => void;
  onClose: () => void;
  onRegister: () => void;
  _tr: (en: string, zh: string) => string;
}) {
  const detected = probeResult && probeResult.ok !== false;
  const probeFailed = !probing && path && !detected;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900 mb-4">{title}</h3>
        <div className="space-y-3">
          {/* Browse button — always available when no path or probing */}
          {(!path || probing) && (
            <button onClick={onBrowse} disabled={probing}
              className="w-full rounded-lg border-2 border-dashed border-indigo-200 bg-indigo-50/50 px-4 py-12 text-sm text-indigo-600 hover:bg-indigo-100 hover:border-indigo-400 disabled:opacity-50 transition-colors">
              {probing ? <Loader2 size={24} className="animate-spin mx-auto" /> : (
                <span className="flex flex-col items-center gap-2">
                  <HardDrive size={28} />
                  {_tr("Click to select a .gguf file", "点击选择 .gguf 文件")}
                </span>
              )}
            </button>
          )}

          {/* File selected */}
          {path && !probing && (
            <>
              <div className="flex items-start gap-2">
                <code className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 break-all font-mono">{path}</code>
                <button onClick={onBrowse} title={_tr("Change file", "更换文件")}
                  className="shrink-0 rounded-lg border border-gray-200 bg-white px-2 py-2 text-xs text-gray-400 hover:text-indigo-600 hover:border-indigo-300">
                  <HardDrive size={14} />
                </button>
              </div>

              {/* Probe success */}
              {detected && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 text-xs space-y-1">
                  <p><span className="text-gray-400">{_tr("Detected:", "检测到：")}</span> <span className="font-semibold text-gray-700">{probeResult.name || path.split(/[\\/]/).pop()}</span></p>
                  {probeResult.architecture && <p className="text-gray-500">{_tr("Architecture:", "架构：")} {probeResult.architecture}</p>}
                  <p className="text-gray-500">{_tr("File size:", "文件大小：")} {probeResult.size_gb} GB</p>
                  {probeResult.estimated_params && <p className="text-gray-500">{_tr("Est. params:", "预估参数：")} {probeResult.estimated_params}</p>}
                </div>
              )}

              {/* Probe failed — allow retry or manual register */}
              {probeFailed && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                  {_tr("Auto-detection failed. You can still register manually, or change file and retry.", "自动识别失败。你仍可手动注册，或更换文件重试。")}
                </div>
              )}
            </>
          )}

          {/* Probing spinner */}
          {probing && path && (
            <div className="flex items-center justify-center py-4 text-gray-400 text-xs gap-2">
              <Loader2 size={14} className="animate-spin" />
              {_tr("Detecting model info...", "正在识别模型信息...")}
            </div>
          )}
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">{_tr("Cancel", "取消")}</button>
          <button onClick={onRegister} disabled={probing || !path}
            className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 py-2.5 text-sm font-medium text-white disabled:opacity-50">
            {probing ? _tr("Detecting...", "探测中...") : _tr("Register", "注册")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Component ───

export default function SettingsPage() {
  const { lang } = useLang();
  const tr = (en: string, zh: string) => lang === "zh" ? zh : en;

  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // Form fields
  const [asrProvider, setAsrProvider] = useState("whisper");
  const [asrModel, setAsrModel] = useState("small");
  const [llmProvider, setLlmProvider] = useState("anthropic");
  const [llmModel, setLlmModel] = useState("deepseek-v4-flash");
  const [onlineAsrUrl, setOnlineAsrUrl] = useState("");
  const [onlineAsrKey, setOnlineAsrKey] = useState("");
  const [onlineAsrModel, setOnlineAsrModel] = useState("whisper-1");
  const [ramOffload, setRamOffload] = useState(false);
  const [voiceDisabled, setVoiceDisabled] = useState(false);

  // API config info (read-only, from backend)
  const [apiInfo, setApiInfo] = useState<{
    openai: { configured: boolean; model: string };
    anthropic: { configured: boolean; base_url: string; model: string };
    current_provider: string;
  } | null>(null);

  // API config form
  const [showAPIConfig, setShowAPIConfig] = useState(false);
  const [apiProvider, setApiProvider] = useState<"openai"|"anthropic">("anthropic");
  const [apiKey, setApiKey] = useState("");
  const [apiModel, setApiModel] = useState("");
  const [apiBaseUrl, setApiBaseUrl] = useState("");

  // ── ASR model registration ──
  const [showAsrForm, setShowAsrForm] = useState(false);
  const [asrProbing, setAsrProbing] = useState(false);
  const [asrProbeResult, setAsrProbeResult] = useState<any>(null);
  const [asrPath, setAsrPath] = useState("");
  const [asrName, setAsrName] = useState("");
  const [asrParams, setAsrParams] = useState("");

  // ── Understanding model registration ──
  const [showLlmForm, setShowLlmForm] = useState(false);
  const [llmProbing, setLlmProbing] = useState(false);
  const [llmProbeResult, setLlmProbeResult] = useState<any>(null);
  const [llmPath, setLlmPath] = useState("");
  const [llmName, setLlmName] = useState("");
  const [llmParams, setLlmParams] = useState("");

  const handleBrowse = async (type: "asr" | "understanding") => {
    setError("");
    try {
      const r = await fetch(`${BASE}/api/models/pick-file`);
      const data = await r.json();
      if (!data.ok) throw new Error(data.error || "File picker failed");
      if (data.path) {
        if (type === "asr") { setAsrPath(data.path); await probePath(data.path, type); }
        else { setLlmPath(data.path); await probePath(data.path, type); }
      }
    } catch (e: any) {
      setError(e.message || "File picker failed. Paste path manually.");
    }
  };

  const probePath = async (path: string, type: "asr" | "understanding") => {
    const setProbing = type === "asr" ? setAsrProbing : setLlmProbing;
    const setProbeResult = type === "asr" ? setAsrProbeResult : setLlmProbeResult;
    const setName = type === "asr" ? setAsrName : setLlmName;
    const setParams = type === "asr" ? setAsrParams : setLlmParams;

    setProbing(true);
    setProbeResult(null);
    try {
      const r = await fetch(`${BASE}/api/models/probe`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      const data = await r.json();
      if (!data.ok) throw new Error(data.detail || "Probe failed");
      setProbeResult(data);
      setName(data.name || "");
      setParams(data.estimated_params || "");
    } catch (e: any) {
      setError(e.message || "Probe failed. Fill form manually.");
    } finally {
      setProbing(false);
    }
  };

  const handleRegisterModel = async (type: "asr" | "understanding") => {
    const path = type === "asr" ? asrPath : llmPath;
    const name = type === "asr" ? asrName : llmName;
    const params = type === "asr" ? asrParams : llmParams;
    const probeOk = type === "asr" ? asrProbeResult : llmProbeResult;

    // Generate fallback name from filename
    const fallbackName = path ? path.replace(/\\/g, "/").split("/").pop()?.replace(".gguf", "") || "" : "";
    const finalName = name || fallbackName;

    if (!path) {
      setError("Please select a model file first. / 请先选择模型文件。");
      return;
    }
    if (!finalName) {
      setError("Could not determine model name. / 无法确定模型名称。");
      return;
    }

    setError("");
    // Set probing state to show loading on button
    if (type === "asr") setAsrProbing(true);
    else setLlmProbing(true);

    try {
      const r = await fetch(`${BASE}/api/models/register`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: finalName, path, type, param_b: params, format: "gguf" }),
      });
      if (!r.ok) {
        const detail = await r.json().then(d => d.detail || d.error || "Registration failed").catch(() => `HTTP ${r.status}`);
        throw new Error(detail);
      }
      const data = await r.json();
      if (!data.ok) throw new Error(data.error || "Registration failed");

      // Success
      const closeAsr = () => { setShowAsrForm(false); setAsrPath(""); setAsrName(""); setAsrParams(""); setAsrProbeResult(null); };
      const closeLlm = () => { setShowLlmForm(false); setLlmPath(""); setLlmName(""); setLlmParams(""); setLlmProbeResult(null); };
      if (type === "asr") closeAsr(); else closeLlm();
      await loadStatus();
    } catch (e: any) {
      setError(e.message || "Registration failed");
      if (type === "asr") setShowAsrForm(false);
      else setShowLlmForm(false);
    } finally {
      if (type === "asr") setAsrProbing(false);
      else setLlmProbing(false);
    }
  };

  // Download
  const [downloadTarget, setDownloadTarget] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  // Save
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const loadStatus = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/api/models/status`);
      const data: SystemStatus = await r.json();
      setStatus(data);
      setAsrProvider(data.current?.asr?.provider || "whisper");
      setAsrModel(data.current?.asr?.model || "small");
      setLlmProvider(data.current?.llm?.provider || "anthropic");
      setLlmModel(data.current?.llm?.model || "deepseek-v4-flash");
      if (data.voice_disabled !== undefined) setVoiceDisabled(data.voice_disabled);
    } catch { /* ignore */ }
    // Fetch API config info
    try {
      const r2 = await fetch(`${BASE}/api/models/api-config`);
      setApiInfo(await r2.json());
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, []);

  useEffect(() => { loadStatus() }, [loadStatus]);

  // ─── Whisper download ───

  const handleDownloadWhisper = async (size: string) => {
    setDownloadTarget(size);
    setDownloading(true);
    setError("");
    try {
      const r = await fetch(`${BASE}/api/models/download-asr`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ model_name: size }),
      });
      const data = await r.json();
      if (!data.ok) throw new Error(data.error);
      await loadStatus();
    } catch (e: any) {
      setError(e.message || "Download failed");
    }
    finally { setDownloading(false); setDownloadTarget(null) }
  };

  // ─── Register custom model (handled inline above) ───

  // ─── Save settings ───

  const handleSave = async () => {
    setSaving(true); setError("");
    try {
      const r = await fetch(`${BASE}/api/models/select`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ asr_provider: asrProvider, asr_model: asrModel, llm_provider: llmProvider, llm_model: llmModel }),
      });
      const data = await r.json();
      if (!data.ok) throw new Error("Save failed");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  };

  // ─── Loading ───

  if (loading) return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3"><div className="h-10 w-10 animate-pulse rounded-xl bg-gray-200" /><div className="h-6 w-32 animate-pulse rounded-full bg-gray-200" /></div>
      <LoadingSkeleton type="card" count={4} />
    </div>
  );

  const gpu = status?.gpu;
  const hasGPU = gpu?.available && gpu.vram_gb > 0;
  const whisperModels = status?.models.filter(m => m.format === "whisper") || [];
  const understandingModels = status?.models.filter(m => m.type === "understanding") || [];

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl">

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md"><Cpu size={20} /></div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{tr("Model Settings", "模型设置")}</h1>
          <p className="text-sm text-gray-400">{tr("Configure ASR and understanding models", "配置语音识别和理解模型")}</p>
        </div>
      </div>

      {/* ── Error toast ── */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* ── Hardware Info ── */}
      <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4"><Server size={16} className="text-blue-500" /><h2 className="text-sm font-bold text-gray-700">{tr("Hardware Info", "硬件信息")}</h2></div>
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-gray-50 p-3.5">
            <p className="text-xs text-gray-400 mb-1">{tr("GPU Status", "GPU 状态")}</p>
            <p className={`text-sm font-bold flex items-center gap-1.5 ${hasGPU ? "text-emerald-600" : "text-amber-600"}`}>
              {hasGPU ? <><CheckCircle2 size={14} />{gpu!.name}</> : <><AlertTriangle size={14} />{tr("Not detected", "未检测到")}</>}
            </p>
          </div>
          <div className="rounded-xl bg-gray-50 p-3.5">
            <p className="text-xs text-gray-400 mb-1">VRAM</p>
            <p className="text-sm font-bold text-gray-700">{hasGPU ? `${gpu!.vram_gb} GB` : "N/A"}</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-3.5">
            <p className="text-xs text-gray-400 mb-1">RAM</p>
            <p className="text-sm font-bold text-gray-700">{gpu?.ram_gb ? `${gpu.ram_gb} GB` : "N/A"}</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-3.5">
            <p className="text-xs text-gray-400 mb-1">{tr("Backend", "加速后端")}</p>
            <p className="text-sm font-bold flex items-center gap-1.5">
              {gpu?.backend === "cuda" && gpu?.vendor === "nvidia"
                ? <><CheckCircle2 size={14} className="text-emerald-500" /> CUDA</>
                : gpu?.backend === "vulkan"
                  ? <><CheckCircle2 size={14} className="text-emerald-500" /> Vulkan</>
                  : gpu?.backend === "metal"
                    ? <><CheckCircle2 size={14} className="text-emerald-500" /> Metal</>
                    : <><AlertTriangle size={14} className="text-amber-500" /> CPU</>
              }
            </p>
          </div>
        </div>
        {/* GPU backend info (control moved to launcher.py) */}
        <div className="mt-3 rounded-lg bg-indigo-50/50 border border-indigo-100 px-3 py-2">
          <p className="text-xs text-indigo-600">
            {tr(
              "GPU backend is managed by the launcher. Run: python launcher.py",
              "GPU 加速后端由启动器管理。运行: python launcher.py"
            )}
          </p>
        </div>
        {/* GPU device selector (multi-GPU systems) */}
        {gpu?.devices && gpu.devices.length > 1 && (
          <div className="mt-3 flex items-center gap-3">
            <label className="text-xs font-medium text-gray-500">{tr("GPU Device:", "GPU 设备:")}</label>
            <select value={gpu.cuda_device ?? 0} onChange={async (e) => {
              const val = parseInt(e.target.value);
              await fetch(`${BASE}/api/models/select`, {
                method: "POST", headers: {"Content-Type": "application/json"},
                body: JSON.stringify({ cuda_device: val }),
              });
            }}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs outline-none focus:border-indigo-400">
              {gpu.devices.map((d) => (
                <option key={d.id} value={d.id}>
                  #{d.id} — {d.name} ({d.vram_gb} GB)
                </option>
              ))}
            </select>
          </div>
        )}
        {/* CUDA Toolkit hint for NVIDIA users */}
        {hasGPU && gpu?.vendor === "nvidia" && gpu?.backend !== "cuda" && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs text-amber-800 flex items-start gap-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>
                <strong>NVIDIA {gpu.name}</strong> {tr("detected but CUDA Toolkit not installed.", "已检测但 CUDA Toolkit 未安装。")}<br />
                {tr("Install CUDA Toolkit 12.x for GPU acceleration:", "安装 CUDA Toolkit 12.x 启用 GPU 加速:")}<br />
                <code className="text-amber-900 text-[10px] break-all">https://developer.nvidia.com/cuda-downloads</code>
              </span>
            </p>
          </div>
        )}
        {/* Vulkan hint for AMD users */}
        {hasGPU && gpu?.vendor === "amd" && (
          <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3">
            <p className="text-xs text-blue-800 flex items-start gap-2">
              <span>
                <strong>AMD {gpu.name}</strong> {tr("detected. Install Vulkan backend:", "已检测。安装 Vulkan 后端:")}<br />
                <code className="text-blue-900 text-[10px] break-all">pip install llama-cpp-python --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/vulkan</code>
              </span>
            </p>
          </div>
        )}
        {/* RAM offload toggle */}
        <div className="mt-3 flex items-center gap-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={ramOffload} onChange={() => setRamOffload(!ramOffload)} className="sr-only peer" />
            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600" />
          </label>
          <span className="text-xs text-gray-500">{tr("Enable RAM offload when VRAM is insufficient", "VRAM不足时使用RAM加载模型")}</span>
        </div>
      </div>

      {/* ── Recommendation ── */}
      {status?.recommendation && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
          <div className="flex items-start gap-2.5"><Info size={18} className="mt-0.5 shrink-0 text-blue-500" /><p className="text-sm text-blue-800 leading-relaxed">{status.recommendation}</p></div>
        </div>
      )}

      {/* ================================================================ */}
      {/* ── ASR Section ── */}
      {/* ================================================================ */}
      <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4"><Mic size={16} className="text-indigo-500" /><h2 className="text-sm font-bold text-gray-700">{tr("Speech Recognition (ASR)", "语音识别 (ASR)")}</h2></div>

        {/* Provider selector */}
        <label className="text-xs font-medium text-gray-500 mb-2 block">{tr("ASR Engine", "ASR 引擎")}</label>
        <div className="flex gap-3 mb-4">
          {[
            { id: "whisper",   icon: HardDrive, label: "Whisper",       desc: tr("Local (openai-whisper)", "本地 openai-whisper") },
            { id: "qwen_asr",  icon: HardDrive, label: tr("Local GGUF", "本地 GGUF"), desc: tr("Local GGUF model", "本地 GGUF 模型") },
            { id: "online_api",icon: Wifi,      label: "Online API",    desc: tr("OpenAI-compatible", "在线 API") },
          ].map(opt => (
            <button key={opt.id} onClick={() => setAsrProvider(opt.id)}
              className={`flex-1 rounded-xl border-2 p-3 text-left transition-all ${asrProvider === opt.id ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-gray-300"}`}>
              <div className="flex items-center gap-2"><opt.icon size={14} className="text-gray-400" /><span className="text-sm font-bold text-gray-800">{opt.label}</span></div>
              <div className="text-xs text-gray-400 mt-0.5">{opt.desc}</div>
            </button>
          ))}
        </div>

        {/* Whisper: model size selector + download */}
        {asrProvider === "whisper" && (
          <div>
            <label className="text-xs font-medium text-gray-500 mb-2 block">{tr("Whisper Model Size", "Whisper 模型大小")}</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {WHISPER_SIZES.map(s => {
                const cached = whisperModels.find(m => m.name === `whisper-${s.id}`)?.is_loaded;
                const vramOk = hasGPU ? (s.minVRAM <= gpu!.vram_gb) : s.cpu;
                return (
                  <div key={s.id} className="relative">
                    <button onClick={() => setAsrModel(s.id)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                        asrModel === s.id ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-600 hover:border-gray-300"
                      } ${!vramOk ? "opacity-50" : ""}`}
                      title={!vramOk ? tr(`Needs ${s.minVRAM} GB VRAM`, `需要 ${s.minVRAM} GB 显存`) : ""}
                    >
                      {s.id}
                      <span className="text-gray-400 ml-1">({s.desc})</span>
                      {cached && <CheckCircle2 size={12} className="inline ml-1 text-emerald-500" />}
                    </button>
                    {!cached && (
                      <button onClick={() => handleDownloadWhisper(s.id)} disabled={downloading}
                        className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50"
                        title={tr("Download", "下载")}>
                        {downloading && downloadTarget === s.id ? <div className="h-2 w-2 rounded-full border border-white border-t-transparent animate-spin" /> : <Plus size={10} />}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-gray-400">{tr("Green check = already cached. Click + to download new models.", "绿色勾 = 已缓存。点击 + 下载新模型。")}</p>
          </div>
        )}

        {/* Imported ASR models (dynamic) */}
        {asrProvider === "qwen_asr" && (
          <div className="rounded-xl bg-gray-50 p-3.5">
            <p className="text-xs text-gray-500 mb-2">{tr("Imported ASR models:", "已导入的 ASR 模型：")}</p>
            {(() => {
              const asrModels = status?.models.filter(m => m.type === "asr" && m.is_custom) || [];
              if (asrModels.length === 0) return (
                <p className="text-xs text-amber-600">
                  {tr("No ASR models imported yet. Use 'Import Custom ASR Model' below to register one.",
                      "尚未导入 ASR 模型。请使用下方'导入自定义 ASR 模型'注册。")}
                </p>
              );
              return asrModels.map(m => (
                <div key={m.name} className="text-xs text-gray-600 mb-1">
                  <span className="font-semibold">{m.display || m.name}</span>
                  {m.path && <code className="ml-2 text-gray-400 break-all text-[11px]">{m.path}</code>}
                  {m.param_b && <span className="ml-2 text-gray-400">({m.param_b})</span>}
                </div>
              ));
            })()}
            <p className="text-xs text-gray-400 mt-2">{tr("Requires: model.gguf + mmproj.gguf for multimodal audio support.", "需要: model.gguf + mmproj.gguf 支持多模态音频输入。")}</p>
          </div>
        )}

        {/* Online API config */}
        {asrProvider === "online_api" && (
          <div className="space-y-3">
            <p className="text-xs text-blue-600 bg-blue-50 rounded-lg p-2.5">
              {tr("Compatible with any OpenAI Whisper API endpoint. Examples:",
                  "兼容任何 OpenAI Whisper API 兼容的端点。例如：")}<br />
              <code className="text-blue-800">• https://api.openai.com/v1</code> (whisper-1)<br />
              <code className="text-blue-800">• https://api.groq.com/openai/v1</code> (whisper-large-v3)<br />
            </p>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">{tr("API Base URL", "API 基础地址")}</label>
              <input value={onlineAsrUrl} onChange={e => setOnlineAsrUrl(e.target.value)}
                placeholder="https://api.openai.com/v1" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">{tr("API Key", "API 密钥")}</label>
                <input type="password" value={onlineAsrKey} onChange={e => setOnlineAsrKey(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">{tr("Model Name", "模型名称")}</label>
                <input value={onlineAsrModel} onChange={e => setOnlineAsrModel(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400" />
              </div>
            </div>
          </div>
        )}

        {/* Disable Voice Toggle */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">{tr("Disable Voice Input", "禁用语音输入")}</p>
              <p className="text-xs text-gray-400">{tr("Skip ASR checks and hide voice recording in practice", "跳过语音检测，在练习中隐藏录音按钮")}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={voiceDisabled} onChange={async () => {
                const next = !voiceDisabled;
                setVoiceDisabled(next);
                try {
                  await fetch(`${BASE}/api/models/select`, {
                    method: "POST", headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({ voice_disabled: next }),
                  });
                } catch { /* ignore */ }
              }} className="sr-only peer" />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600" />
            </label>
          </div>
        </div>

        {/* Import custom ASR model */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-500 mb-2">{tr("Import Custom ASR Model", "导入自定义 ASR 模型")}</p>
          <button onClick={() => setShowAsrForm(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-100 transition-colors">
            <Plus size={14} /> {tr("Register ASR Model", "注册 ASR 模型")}
          </button>
          {status?.models.filter(m => m.type === "asr" && m.is_custom).map(m => (
            <span key={m.name} className="ml-2 inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-600">
              <HardDrive size={12} className="text-gray-400" />{m.display || m.name}
              <button onClick={async () => { await fetch(`${BASE}/api/models/register/${m.name}`, { method: "DELETE" }); await loadStatus(); }}
                className="ml-1 text-red-400 hover:text-red-600">✕</button>
            </span>
          ))}
        </div>
      </div>

      {/* ================================================================ */}
      {/* ── Understanding Models ── */}
      {/* ================================================================ */}
      <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4"><Globe size={16} className="text-emerald-500" /><h2 className="text-sm font-bold text-gray-700">{tr("Understanding Models (LLM)", "理解模型 (LLM)")}</h2></div>

        {/* Format info */}
        <div className="rounded-xl bg-amber-50/70 border border-amber-100 p-3 mb-4">
          <p className="text-xs text-amber-800">
            <strong>{tr("Supported format:", "支持格式:")}</strong> {tr("GGUF only (llama.cpp compatible). ", "仅 GGUF (llama.cpp 兼容)。")}
            {tr("Online: OpenAI or Anthropic-compatible API.", "在线: OpenAI/Anthropic 兼容 API。")}
          </p>
        </div>

        {/* Registered models grid — clickable for selection */}
        <p className="text-xs text-gray-500 mb-3">{tr("Click a model to select it:", "点击选择理解模型:")}</p>
        <div className="grid gap-3 sm:grid-cols-2 mb-4">
          {understandingModels.map(m => {
            const overflow = m.estimated_vram_gb > 0 && hasGPU && m.estimated_vram_gb > gpu!.vram_gb;
            const isAnthropicApi = m.name === "deepseek-api";
            const isOpenAI = m.name === "openai-api";
            const isApi = m.format === "api";
            const isActive = isApi
              ? (isAnthropicApi && llmProvider === "anthropic") || (isOpenAI && llmProvider === "openai")
              : (llmProvider === "local" && llmModel === m.name);
            return (
              <button key={m.name} onClick={async () => {
                setSaving(true); setError("");
                try {
                  if (isAnthropicApi) {
                    await fetch(`${BASE}/api/models/select`, {
                      method: "POST", headers: {"Content-Type": "application/json"},
                      body: JSON.stringify({ llm_provider: "anthropic", llm_model: llmModel }),
                    });
                    setLlmProvider("anthropic");
                  } else if (isOpenAI) {
                    await fetch(`${BASE}/api/models/select`, {
                      method: "POST", headers: {"Content-Type": "application/json"},
                      body: JSON.stringify({ llm_provider: "openai", llm_model: llmModel }),
                    });
                    setLlmProvider("openai");
                  } else if (m.path) {
                    await fetch(`${BASE}/api/models/select`, {
                      method: "POST", headers: {"Content-Type": "application/json"},
                      body: JSON.stringify({ llm_provider: "local", llm_model: m.name, llm_local_model_path: m.path }),
                    });
                    setLlmProvider("local");
                    setLlmModel(m.name);
                  }
                  await loadStatus();
                } catch (e: any) {
                  setError(e.message || "API unreachable - check backend");
                } finally {
                  setSaving(false);
                }
              }}
              className={`text-left rounded-xl p-4 transition-all cursor-pointer ${
                isActive
                  ? "ring-2 ring-indigo-500 bg-indigo-50 shadow-md shadow-indigo-100 scale-[1.02]"
                  : overflow
                    ? "border border-amber-200 bg-amber-50/50 hover:border-amber-300 hover:shadow-sm"
                    : isApi
                      ? "border border-gray-200 bg-white hover:border-indigo-300 hover:shadow-sm"
                      : "border border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
              }`}>
                {/* Top row: icon + name + active badge */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                      isActive
                        ? "bg-indigo-500 text-white shadow-sm"
                        : isApi
                          ? "bg-blue-100 text-blue-600"
                          : "bg-gray-100 text-gray-500"
                    }`}>
                      {isActive ? <CheckCircle2 size={16} /> : isApi ? <Wifi size={16} /> : <HardDrive size={16} />}
                    </div>
                    <div>
                      <span className={`text-sm font-bold ${isActive ? "text-indigo-800" : "text-gray-800"}`}>
                        {m.display || m.name}
                      </span>
                      {isActive && (
                        <span className="ml-2 text-[10px] font-bold text-white bg-indigo-500 px-2 py-0.5 rounded-full">
                          {tr("Active", "当前")}
                        </span>
                      )}
                    </div>
                  </div>
                  {isApi && (
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      isAnthropicApi ? "bg-indigo-100 text-indigo-700" : "bg-green-100 text-green-700"
                    }`}>
                      {isAnthropicApi ? "Anthropic" : "OpenAI"}
                    </span>
                  )}
                </div>
                {/* Description line */}
                <p className="text-xs text-gray-400">
                  {isApi
                    ? isAnthropicApi
                      ? "Anthropic-compatible API"
                      : "OpenAI-compatible API"
                    : `${m.param_b || "?"} | GGUF${m.size_gb > 0 ? ` | ${m.size_gb.toFixed(1)} GB` : ""}`
                  }
                </p>
                {/* File path for local models */}
                {m.path && !isApi && (
                  <p className="text-xs text-gray-400 mt-1.5 font-mono truncate bg-gray-50 rounded px-2 py-1" title={m.path}>
                    📁 {m.path}
                  </p>
                )}
                {/* VRAM warnings */}
                {overflow && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 rounded-lg px-2 py-1.5">
                    <AlertTriangle size={12} />
                    {tr(`Needs ${m.estimated_vram_gb} GB VRAM (have ${gpu?.vram_gb} GB)`, `需要 ${m.estimated_vram_gb} GB 显存 (仅有 ${gpu?.vram_gb} GB)`)}
                    {ramOffload && <span className="text-amber-500 ml-1">· RAM</span>}
                  </div>
                )}
                {!overflow && m.estimated_vram_gb > 0 && (
                  <p className="text-xs text-gray-400 mt-1.5">VRAM: ~{m.estimated_vram_gb} GB</p>
                )}
              </button>
            );
          })}
        </div>

        {/* Current model status bar */}
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-3.5">
          <div className="flex items-center gap-2 mb-1">
            <Wifi size={14} className="text-indigo-500" />
            <span className="text-sm font-bold text-indigo-700">{tr("Current Model:", "当前模型:")}</span>
          </div>
          <p className="text-xs text-indigo-600/80">
            {tr("Provider:", "提供方:")} {llmProvider === "anthropic" ? "Anthropic-compatible API" : llmProvider} |
            {tr(" Model:", " 模型:")} {llmModel}
          </p>
          <p className="text-xs text-indigo-600/60 mt-1">
            {tr("Compatible with OpenAI and Anthropic API formats.", "兼容 OpenAI 和 Anthropic API 格式。")}
          </p>
        </div>

        {/* ── Saved API status card ── */}
        {apiInfo && (apiInfo.anthropic.configured || apiInfo.openai.configured) && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-500 mb-2">{tr("Saved API Configuration", "已保存的 API 配置")}</p>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 space-y-1.5">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-500" />
                <span className="text-sm font-semibold text-gray-800">
                  {apiInfo.current_provider === "anthropic" ? "Anthropic" : "OpenAI"}
                </span>
                <span className="text-xs text-gray-400">
                  {apiInfo.current_provider === "anthropic"
                    ? apiInfo.anthropic.model
                    : apiInfo.openai.model}
                </span>
              </div>
              {apiInfo.current_provider === "anthropic" && (
                <p className="text-xs text-gray-400 ml-6 font-mono">
                  {apiInfo.anthropic.base_url}
                </p>
              )}
              <div className="flex items-center gap-2 ml-6">
                <span className="text-xs text-gray-400">
                  {tr("API Key:", "API 密钥:")} {apiInfo.current_provider === "anthropic"
                    ? "sk-ant-...****"
                    : "sk-...****"}
                </span>
              </div>
              <button
                onClick={() => {
                  setApiProvider(apiInfo.current_provider as "anthropic" | "openai");
                  setApiModel(apiInfo.current_provider === "anthropic" ? apiInfo.anthropic.model : apiInfo.openai.model);
                  if (apiInfo.current_provider === "anthropic") setApiBaseUrl(apiInfo.anthropic.base_url);
                  setShowAPIConfig(true);
                }}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700 mt-1"
              >
                {tr("Edit", "编辑")}
              </button>
            </div>
          </div>
        )}

        {/* ── Configure API ── */}
        <div className={apiInfo && (apiInfo.anthropic.configured || apiInfo.openai.configured) ? "mt-3" : "mt-4 pt-4 border-t border-gray-100"}>
          <button onClick={() => setShowAPIConfig(!showAPIConfig)}
            className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700">
            <Wifi size={14} /> {showAPIConfig ? tr("Hide API config", "收起 API 配置") : tr("Configure API key / model", "配置 API 密钥/模型")}
          </button>

          {showAPIConfig && (
            <div className="mt-3 space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
              {/* Provider tabs */}
              <div className="flex gap-2">
                {[{id:"anthropic" as const, label:"Anthropic"}, {id:"openai" as const, label:"OpenAI"}].map(p => (
                  <button key={p.id} onClick={() => setApiProvider(p.id)}
                    className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition-all ${
                      apiProvider === p.id
                        ? "border-indigo-400 bg-indigo-100 text-indigo-800"
                        : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                    }`}>
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Anthropic fields */}
              {apiProvider === "anthropic" && (
                <div className="space-y-2.5">
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">API Key *</label>
                    <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
                      placeholder="sk-ant-..." className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs outline-none focus:border-indigo-400 font-mono" />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">{tr("Model", "模型")}</label>
                      <input value={apiModel} onChange={e => setApiModel(e.target.value)}
                        placeholder="deepseek-v4-flash / claude-sonnet-4-20250506" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs outline-none focus:border-indigo-400" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Base URL</label>
                      <input value={apiBaseUrl} onChange={e => setApiBaseUrl(e.target.value)}
                        placeholder="https://api.deepseek.com/anthropic" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs outline-none focus:border-indigo-400 font-mono" />
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">{tr("Leave empty for official Anthropic API. For compatible APIs (e.g. DeepSeek), set the custom base URL.", "留空使用 Anthropic 官方 API。使用兼容 API（如 DeepSeek）时填写自定义地址。")}</p>
                </div>
              )}

              {/* OpenAI fields */}
              {apiProvider === "openai" && (
                <div className="space-y-2.5">
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">API Key *</label>
                    <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
                      placeholder="sk-..." className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs outline-none focus:border-indigo-400 font-mono" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">{tr("Model", "模型")}</label>
                    <input value={apiModel} onChange={e => setApiModel(e.target.value)}
                      placeholder="gpt-4o / gpt-4o-mini" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs outline-none focus:border-indigo-400" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Base URL</label>
                    <input value={apiBaseUrl} onChange={e => setApiBaseUrl(e.target.value)}
                      placeholder="https://api.openai.com/v1" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs outline-none focus:border-indigo-400 font-mono" />
                  </div>
                  <p className="text-xs text-gray-400">{tr("Leave empty for default. Compatible with any OpenAI-format proxy.", "留空使用默认值。兼容任何 OpenAI 格式的代理。")}</p>
                </div>
              )}

              {/* Save button */}
              <div className="flex items-center gap-3 pt-1">
                <button onClick={async () => {
                  if (!apiKey) { setError("API Key is required"); return }
                  setSaving(true); setError("")
                  try {
                    const r = await fetch(`${BASE}/api/models/save-api`, {
                      method: "POST", headers: {"Content-Type": "application/json"},
                      body: JSON.stringify({
                        provider: apiProvider, api_key: apiKey,
                        model: apiModel, base_url: apiBaseUrl,
                      }),
                    })
                    const data = await r.json()
                    if (!data.ok) throw new Error(data.error || "Save failed")
                    setApiKey(""); setApiModel(""); setApiBaseUrl("")
                    setShowAPIConfig(false)
                    setSaved(true); setTimeout(() => setSaved(false), 3000)
                    await loadStatus()
                    // Update llm state to reflect new provider
                    if (apiProvider === "openai") setLlmProvider("openai")
                    else setLlmProvider("anthropic")
                    if (apiModel) setLlmModel(apiModel)
                  } catch (e: any) { setError(e.message) }
                  finally { setSaving(false) }
                }} disabled={saving || !apiKey}
                  className="rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 hover:shadow-md transition-all">
                  {saving ? tr("Saving...", "保存中...") : tr("Save & Activate", "保存并激活")}
                </button>
                {saved && <span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 size={12} /> {tr("Activated", "已激活")}</span>}
              </div>
            </div>
          )}
        </div>

        {/* Add custom understanding model */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <button onClick={() => setShowLlmForm(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-100 transition-colors">
            <Plus size={14} /> {tr("Register Model", "注册模型")}
          </button>
          {status?.models.filter(m => m.type === "understanding" && m.is_custom).map(m => (
            <span key={m.name} className="ml-2 inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-600">
              <HardDrive size={12} className="text-gray-400" />{m.display || m.name}
              <button onClick={async () => { await fetch(`${BASE}/api/models/register/${m.name}`, { method: "DELETE" }); await loadStatus(); }}
                className="ml-1 text-red-400 hover:text-red-600">✕</button>
            </span>
          ))}
        </div>
      </div>

      {/* ================================================================ */}
      {/* ── ASR Model Registration Modal ── */}
      {/* ================================================================ */}
      {showAsrForm && <ModelRegModal
        title={tr("Register ASR Model", "注册 ASR 模型")}
        probing={asrProbing}
        probeResult={asrProbeResult}
        path={asrPath}
        name={asrName}
        params={asrParams}
        onBrowse={() => handleBrowse("asr")}
        onClose={() => { setShowAsrForm(false); setAsrProbeResult(null); }}
        onRegister={() => handleRegisterModel("asr")}
        _tr={tr}
      />}

      {/* ================================================================ */}
      {/* ── Understanding Model Registration Modal ── */}
      {/* ================================================================ */}
      {showLlmForm && <ModelRegModal
        title={tr("Register Understanding Model", "注册理解模型")}
        probing={llmProbing}
        probeResult={llmProbeResult}
        path={llmPath}
        name={llmName}
        params={llmParams}
        onBrowse={() => handleBrowse("understanding")}
        onClose={() => { setShowLlmForm(false); setLlmProbeResult(null); }}
        onRegister={() => handleRegisterModel("understanding")}
        _tr={tr}
      />}

      {/* ── Save ── */}
      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-2.5 text-sm font-medium text-white shadow-md transition-all hover:shadow-lg hover:scale-105 disabled:opacity-50">
          {saving ? tr("Saving...", "保存中...") : tr("Save Settings", "保存设置")}
        </button>
        {saved && <span className="text-sm text-emerald-600 animate-fade-in flex items-center gap-1"><CheckCircle2 size={14} /> {tr("Saved", "已保存")}</span>}
      </div>

      {/* ── License & Disclaimer ── */}
      <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm text-xs text-gray-500 space-y-3">
        <div>
          <span className="font-semibold text-gray-600">
            {tr("License", "许可协议")}
          </span>
          <p className="mt-1">
            {tr(
              "This project is open-sourced under GNU General Public License v3.0+ (GPL v3+) with Non-Commercial restriction.",
              "本项目以 GNU GPL v3.0+ 开源，附加非商业使用限制。"
            )}
          </p>
          <ul className="mt-2 space-y-1 list-disc list-inside text-gray-400">
            <li>
              {tr(
                "Freedom: You may run, study, modify, and share this software for personal, educational, or research purposes.",
                "自由：您可以为个人、教育或研究目的运行、研究、修改和分享本软件。"
              )}
            </li>
            <li>
              {tr(
                "Freedom: You have access to the complete source code and may share it freely.",
                "自由：您可以获取完整源代码并自由分享。"
              )}
            </li>
            <li>
              {tr(
                "Copyleft: If you distribute modified versions, you MUST release your modifications under the same GPL license.",
                "Copyleft：分发修改版本时必须以相同 GPL 许可证公开您的修改。"
              )}
            </li>
            <li>
              {tr(
                "Copyleft: Any software that includes or links to GPL-licensed code must also be distributed under GPL.",
                "Copyleft：任何包含或链接 GPL 代码的软件也必须以 GPL 许可分发。"
              )}
            </li>
            <li>
              {tr(
                "Non-Commercial: Commercial use, sale, or incorporation into paid products or services is NOT permitted without explicit author consent.",
                "非商业：未经作者明确许可，不得用于商业用途、销售或集成到付费产品或服务中。"
              )}
            </li>
            <li>
              {tr(
                "Restriction: Provide source with binaries. No sublicensing. No warranty.",
                "限制：分发二进制须附源码。不得再许可。不提供任何担保。"
              )}
            </li>
          </ul>
        </div>
        <div>
          <span className="font-semibold text-gray-600">
            {tr("Disclaimer", "免责声明")}
          </span>
          <p className="mt-1">
            {tr(
              "This software is for educational and practice purposes only. AI-generated evaluations are not official IELTS scores and should not be used as such.",
              "本软件仅供教育和练习用途。AI 生成的评分并非官方雅思成绩，不应作为正式成绩使用。"
            )}
          </p>
        </div>
        <div>
          <span className="font-semibold text-gray-600">
            {tr("Non-infringement", "不侵权声明")}
          </span>
          <p className="mt-1">
            {tr(
              "All trademarks, service marks, and trade names referenced in this project are the property of their respective owners. This project is not affiliated with, endorsed by, or sponsored by IELTS, Cambridge Assessment, or any other testing organization.",
              "本项目引用的所有商标、服务标志和商号均为其各自所有者的财产。本项目与雅思、剑桥大学考试委员会或任何其他考试机构无关联、未经其认可或赞助。"
            )}
          </p>
        </div>
        <div className="pt-2 border-t border-gray-100">
          <p>
            {tr("Developed by", "开发者 ")}
            <a
              href="https://markblogforpublic.github.io/index.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-500 hover:text-indigo-700 font-medium underline underline-offset-2"
            >
              Mark
            </a>
          </p>
        </div>
      </div>

    </div>
  );
}
