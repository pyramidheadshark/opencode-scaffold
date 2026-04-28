# Model Quantization for Local Inference

## When to Quantize

Use quantized models when:
- Running on CPU (no GPU available)
- GPU VRAM is limited (< 16GB for 7B models)
- Latency matters more than absolute quality

## GGUF via llama-cpp-python (CPU-friendly)

```python
from llama_cpp import Llama


class LlamaCppAdapter:
    def __init__(self, model_path: str, n_ctx: int = 4096, n_gpu_layers: int = 0) -> None:
        self._llm = Llama(
            model_path=model_path,
            n_ctx=n_ctx,
            n_gpu_layers=n_gpu_layers,
            verbose=False,
        )

    def generate(self, prompt: str, max_tokens: int = 512) -> str:
        output = self._llm(
            prompt,
            max_tokens=max_tokens,
            stop=["<|end|>", "</s>"],
            echo=False,
        )
        return output["choices"][0]["text"].strip()
```

Download GGUF models from HuggingFace:
```bash
pip install huggingface-hub
huggingface-cli download Qwen/Qwen2.5-7B-Instruct-GGUF \
  qwen2.5-7b-instruct-q4_k_m.gguf \
  --local-dir models/weights/
```

## AWQ via AutoAWQ (GPU-efficient)

```python
from awq import AutoAWQForCausalLM
from transformers import AutoTokenizer


def load_awq_model(model_path: str):
    tokenizer = AutoTokenizer.from_pretrained(model_path)
    model = AutoAWQForCausalLM.from_quantized(
        model_path,
        fuse_layers=True,
        trust_remote_code=False,
        safetensors=True,
    )
    return model, tokenizer
```

## Quantization Size Guide

| Model | Full (fp16) | Q4 (GGUF) | Q8 (GGUF) |
|---|---|---|---|
| 3B | ~6 GB | ~2 GB | ~3 GB |
| 7B | ~14 GB | ~4 GB | ~7 GB |
| 13B | ~26 GB | ~8 GB | ~13 GB |

For YC GPU VM (T4, 16GB VRAM): 7B Q4 runs comfortably, 7B fp16 is tight.
For YC GPU VM (A100, 80GB VRAM): 13B fp16 and larger models run fine.
