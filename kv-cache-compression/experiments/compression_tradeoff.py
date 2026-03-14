import numpy as np
from scipy.special import softmax

# import sys
# sys.path.append('..')
from src.extract import extract_qkv
from src.compress import compute_svd

outputs, Q_head, K_head, V_head = extract_qkv()
Uk, Sk, Vtk, Uv, Sv, Vtv = compute_svd(K_head, V_head)

# 16 singular values 
def sv_16(Q_head, K_head, V_head, Uk, Sk, Vtk, Uv, Sv, Vtv):
    # GROUND TRUTH:
    d_k = 64
    attention_weights = softmax((Q_head @ K_head.T)/np.sqrt((d_k)), axis = -1)
    attention = attention_weights @ V_head

    K_approx = Uk[:, :16] @ np.diag(Sk[:16]) @ Vtk[:16, :]
    Uk_approx = (Uk[:, :16]) # coordinates of each token as a linear combination of basis vectors
    Vtk_approx = (Vtk[:16, :]) # r basis vectors 

    V_approx = Uv[:, :16] @ np.diag(Sv[:16]) @ Vtv[:16, :]
    Uv_approx = (Uv[:, :16]) 
    Vtv_approx = (Vtv[:16, :]) 

    # K_error = np.linalg.norm(K_head - K_approx) # Frobenius norm = SSE
    # V_error = np.linalg.norm(V_head - V_approx)

    attention_weights_approx = softmax((Q_head @ (Uk_approx @ np.diag(Sk[:16]) @ Vtk_approx).T)/np.sqrt(d_k), axis = -1)
    attention_approx = attention_weights_approx @ (Uv_approx @ np.diag(Sv[:16]) @ Vtv_approx)
    attention_error = np.linalg.norm(attention - attention_approx)

    full_KV_memory = K_head.nbytes + V_head.nbytes
    compressed_KV_memory =(Uk_approx.nbytes +Vtk_approx.nbytes + Uv_approx.nbytes + Vtv_approx.nbytes)
        
    return attention_error, compressed_KV_memory, full_KV_memory

attention_error, compressed_KV_memory, full_KV_memory = sv_16(Q_head, K_head, V_head, Uk, Sk, Vtk, Uv, Sv, Vtv)
print('Full rank memory (bytes)' , np.max(full_KV_memory) )
print('Compressed memory (bytes): ' , compressed_KV_memory)
print('Compression Ratio: ', full_KV_memory/(compressed_KV_memory))
print('Error: ', attention_error)

