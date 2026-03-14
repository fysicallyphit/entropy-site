import numpy as np
import matplotlib.pyplot as plt
from scipy.special import softmax
from src.extract import extract_qkv
from src.compress import compute_svd

outputs, Q_layers, K_layers, V_layers = extract_qkv()
svd_K, svd_V = compute_svd(K_layers, V_layers)

def compression_experiment(Q_layers, K_layers, V_layers, svd_K, svd_V):
    K_errors = []
    V_errors = []
    attention_errors = []
    compressed_KV_memories = []

    r_range = [1, 2, 4, 8, 16, 32, 64]

    # GROUND TRUTH:
    d_k = 64
    for i in range(len(Q_layers)):
        Uk, Sk, Vtk = svd_K[i]
        Uv, Sv, Vtv = svd_V[i]
        Q = Q_layers[i]
        K = K_layers[i]
        V = V_layers[i]
        
        attention_weights = softmax((Q @ K.T)/np.sqrt((d_k)), axis = -1)
        attention = attention_weights @ V

        K_approx = Uk[:,:16] @ np.diag(Sk[:16]) @ Vtk[:16, :]
        Uk_approx = (Uk[:,:16]) # coordinates of each token as a linear combination of basis vectors
        Vtk_approx = (Vtk[:16, :]) # r basis vectors 

        V_approx = Uv[:,:16] @ np.diag(Sv[:16]) @ Vtv[:16, :]
        Uv_approx = (Uv[:,:16]) 
        Vtv_approx = (Vtv[:16, :]) 

        K_error = np.linalg.norm(K - K_approx) # Frobenius norm = SSE
        V_error = np.linalg.norm(V - V_approx)
        K_errors.append(K_error)
        V_errors.append(V_error)

        attention_weights_approx = softmax((Q @ (Uk_approx @ np.diag(Sk[:16]) @ Vtk_approx).T)/np.sqrt(d_k), axis = -1)
        attention_approx = attention_weights_approx @ (Uv_approx @ np.diag(Sv[:16]) @ Vtv_approx)

        attention_error = np.linalg.norm(attention - attention_approx)
        attention_errors.append(attention_error)

        full_KV_memory = K.nbytes + V.nbytes
        compressed_KV_memory =(Uk_approx.nbytes +Vtk_approx.nbytes + Uv_approx.nbytes + Vtv_approx.nbytes)
        
        compressed_KV_memories.append(compressed_KV_memory)
    print('Full rank memory (bytes)' , np.max(full_KV_memory) )
    print('Compressed memory (bytes): ' , compressed_KV_memory)
    print('Compression Ratio: ', full_KV_memory/(compressed_KV_memory))
    return r_range, attention_errors, compressed_KV_memory, full_KV_memory

    plt.plot(range(12), attention_errors)
    plt.xlabel('Layer')
    plt.ylabel('Attention Error at r=16')
    plt.title('Compressibility by Layer')
    plt.show()

x = compression_experiment(Q_layers, K_layers, V_layers, svd_K, svd_V)
# print(x)

