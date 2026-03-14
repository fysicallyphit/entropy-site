import numpy as np
from scipy.special import softmax

def compression_experiment(Q_head, K_head, V_head, Uk, Sk, Vtk, Uv, Sv, Vtv):
    K_errors = []
    V_errors = []
    attention_errors = []
    compressed_KV_memories = []

    r_range = [1, 2, 4, 8, 16, 32, 64]

    # GROUND TRUTH:
    d_k = 64
    attention_weights = softmax((Q_head @ K_head.T)/np.sqrt((d_k)), axis = -1)
    attention = attention_weights @ V_head

    for r in r_range:
        K_approx = Uk[:, :r] @ np.diag(Sk[:r]) @ Vtk[:r, :]
        Uk_approx = (Uk[:, :r]) # coordinates of each token as a linear combination of basis vectors
        Vtk_approx = (Vtk[:r, :]) # r basis vectors 

        V_approx = Uv[:, :r] @ np.diag(Sv[:r]) @ Vtv[:r, :]
        Uv_approx = (Uv[:, :r]) 
        Vtv_approx = (Vtv[:r, :]) 

        K_error = np.linalg.norm(K_head - K_approx) # Frobenius norm = SSE
        V_error = np.linalg.norm(V_head - V_approx)
        K_errors.append(K_error)
        V_errors.append(V_error)

        attention_weights_approx = softmax((Q_head @ (Uk_approx @ np.diag(Sk[:r]) @ Vtk_approx).T)/np.sqrt(d_k), axis = -1)
        attention_approx = attention_weights_approx @ (Uv_approx @ np.diag(Sv[:r]) @ Vtv_approx)

        attention_error = np.linalg.norm(attention - attention_approx)
        attention_errors.append(attention_error)

        full_KV_memory = K_head.nbytes + V_head.nbytes
        compressed_KV_memory =(Uk_approx.nbytes +Vtk_approx.nbytes + Uv_approx.nbytes + Vtv_approx.nbytes)
        
        compressed_KV_memories.append(compressed_KV_memory)
    print('Full rank memory (bytes)' , np.max(full_KV_memory) )
    print('Compressed memory (bytes): ' , compressed_KV_memory)
    print('Compression Ratio: ', full_KV_memory/(compressed_KV_memory))
    return r_range, attention_errors, compressed_KV_memory, full_KV_memory

