from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # LLM
    openai_api_key: str = ""
    openai_base_url: str = ""      # custom base URL for OpenAI-compatible APIs
    anthropic_api_key: str = ""
    anthropic_base_url: str = ""  # custom base URL for Anthropic-compatible APIs (e.g., DeepSeek)
    llm_provider: str = "openai"  # "openai" | "anthropic" | "local"
    llm_model: str = "gpt-4o"
    llm_local_model_path: str = ""  # path to local GGUF model for provider="local"

    # MongoDB
    mongodb_url: str = "mongodb://localhost:27017"
    mongodb_db_name: str = "aiscoring"

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"  # comma-separated, use "*" for any

    # ASR (Automatic Speech Recognition)
    asr_provider: str = "whisper"      # "whisper" | "qwen_asr" | "online_api"
    asr_model: str = "small"           # whisper: tiny / base / small / medium / large
    qwen_asr_model_path: str = ""
    qwen_asr_mmproj_path: str = ""
    online_asr_url: str = ""           # OpenAI-compatible ASR endpoint (e.g. https://api.openai.com/v1)
    online_asr_key: str = ""           # API key for online ASR
    online_asr_model: str = "whisper-1"

    # GPU settings
    cuda_device: int = 0    # which NVIDIA GPU device to use
    gpu_backend: str = "cuda"  # "cuda" | "vulkan" | "cpu" — local model acceleration backend

    # Feature toggles
    voice_disabled: bool = False  # if True, skip ASR and hide voice button

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
