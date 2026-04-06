import numpy as np
import matplotlib.pyplot as plt
from scipy.special import softmax
try:
    # Preferred when running as a module: `python -m src.evaluate_layer`
    from .extract import extract_qkv
    from .compress import compute_svd
except ImportError:  # pragma: no cover
    # Fallback when running as a script: `python src/evaluate_layer.py`
    from src.extract import extract_qkv
    from src.compress import compute_svd

outputs, Q_layers, K_layers, V_layers = extract_qkv()
svd_K, svd_V = compute_svd(K_layers, V_layers)

def quantize_dequantize_int4(x: np.ndarray, *, per_channel: str = "tensor", eps: float = 1e-12):
    """
    Symmetric uniform int4 quantization with dequantization.

    per_channel:
      - "tensor": one scale for entire tensor
      - "row": one scale per row (axis=1)
      - "col": one scale per column (axis=0)
    """
    if per_channel not in {"tensor", "row", "col"}:
        raise ValueError(f"per_channel must be one of {{'tensor','row','col'}}, got {per_channel!r}")

    x = np.asarray(x, dtype=np.float32)
    qmin, qmax = -8, 7  # signed int4 range

    if per_channel == "tensor":
        maxabs = float(np.max(np.abs(x)))
        scale = max(maxabs / qmax, eps)
        q = np.clip(np.round(x / scale), qmin, qmax).astype(np.int8)
        x_hat = (q.astype(np.float32) * scale).astype(np.float32)
        return x_hat, scale

    axis = 1 if per_channel == "row" else 0
    maxabs = np.max(np.abs(x), axis=axis, keepdims=True).astype(np.float32)
    scale = np.maximum(maxabs / qmax, eps).astype(np.float32)
    q = np.clip(np.round(x / scale), qmin, qmax).astype(np.int8)
    x_hat = (q.astype(np.float32) * scale).astype(np.float32)
    return x_hat, scale


def quantization_experiment(Q_layers, K_layers, V_layers, *, d_k: int = 64, per_channel: str = "tensor"):
    """
    Quantize K and V to int4 (with dequant) and measure relative error in attention output per layer.
    """
    assert len(Q_layers) == len(K_layers) == len(V_layers)
    attention_errors = []

    for i in range(len(Q_layers)):
        Q = np.asarray(Q_layers[i], dtype=np.float32)
        K = np.asarray(K_layers[i], dtype=np.float32)
        V = np.asarray(V_layers[i], dtype=np.float32)

        attention = softmax((Q @ K.T) / np.sqrt(d_k), axis=-1) @ V

        K_hat, _ = quantize_dequantize_int4(K, per_channel=per_channel)
        V_hat, _ = quantize_dequantize_int4(V, per_channel=per_channel)
        attention_hat = softmax((Q @ K_hat.T) / np.sqrt(d_k), axis=-1) @ V_hat

        err = np.linalg.norm(attention - attention_hat) / np.linalg.norm(attention)
        attention_errors.append(float(err))

    return attention_errors


def compression_experiment(Q_layers, K_layers, V_layers, svd_K, svd_V, X = 15):
    attention_errors = []
    adapted_rs = []
    compressed_KV_memories = []
    full_KV_memories = []

    # GROUND TRUTH:
    d_k = 64
    r_candidates = [1,2,4,8,16,32,64]
    
    assert len(Q_layers) == len(K_layers) == len(V_layers) == len(svd_K) == len(svd_V)
    
    for i in range(len(Q_layers)):
        Uk, Sk, Vtk = svd_K[i]
        Uv, Sv, Vtv = svd_V[i]
        Q = Q_layers[i]
        K = K_layers[i]
        V = V_layers[i]
        
        attention = softmax((Q @ K.T)/np.sqrt((d_k)), axis = -1) @ V
        
        chosen_r = r_candidates[-1]
        chosen_err = None
        chosen_mem = None

        for r in r_candidates:
            K_approx = Uk[:,:r] @ np.diag(Sk[:r]) @ Vtk[:r, :]
            Uk_approx = (Uk[:,:r]) # coordinates of each token as a linear combination of basis vectors
            Vtk_approx = (Vtk[:r, :]) # r basis vectors 

            V_approx = Uv[:,:r] @ np.diag(Sv[:r]) @ Vtv[:r, :]
            Uv_approx = (Uv[:,:r]) 
            Vtv_approx = (Vtv[:r, :]) 

            attention_approx = softmax((Q @ K_approx.T)/np.sqrt(d_k), axis = -1) @ V_approx
            r_error = np.linalg.norm(attention - attention_approx) / np.linalg.norm(attention)
            memory = Uk_approx.nbytes + Sk[:r].nbytes + Vtk_approx.nbytes + Uv_approx.nbytes + Sv[:r].nbytes + Vtv_approx.nbytes
            
            if r_error< X/100:
                chosen_r = r
                chosen_err = r_error
                chosen_mem = memory
                break
        
        if chosen_err is None:
            chosen_err = r_error
            chosen_mem = memory

        full_KV_memory = K.nbytes + V.nbytes

        adapted_rs.append(chosen_r)
        attention_errors.append(chosen_err)
        compressed_KV_memories.append(chosen_mem)
        full_KV_memories.append(full_KV_memory)     

    return adapted_rs, attention_errors, compressed_KV_memories, full_KV_memories

adapted_rs, attention_errors, compressed_KV_memories, full_KV_memories = compression_experiment(
    Q_layers, K_layers, V_layers, svd_K, svd_V, X = 10
)

# plt.plot(adapted_rs)
# plt.xlabel("Layers")
# plt.ylabel("Rank")
# plt.title("Adaptive Rank per Layer")
# plt.show()

attention_errors_4bit = quantization_experiment(Q_layers, K_layers, V_layers, per_channel="tensor")
plt.plot(range(len(attention_errors_4bit)), attention_errors_4bit)
plt.xlabel("Layer")
plt.ylabel("Relative Attention Output Error")
plt.title("4-bit Quantization Error by Layer (K,V int4)")
plt.show()

# plt.scatter(compressed_KV_memories, attention_errors, label="compressed")
# plt.scatter(full_KV_memories, [0]*len(full_KV_memories), label="full")
# plt.xlabel("Storage (bytes)")
# plt.ylabel("Relative Attention Error")
# plt.title("Adaptive Rank: Error vs Storage")
# plt.legend()
# plt.show()

# plt.plot(range(len(attention_errors)), attention_errors)
# plt.xlabel("Layer")
# plt.ylabel("Attention Error SSE")
# plt.title("Adapted Rank Compressibility by Layer")
# plt.show()

