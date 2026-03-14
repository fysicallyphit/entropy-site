import numpy as np 

def compute_svd(K_layers, V_layers):
    svd_K = []
    svd_V = [] 
    for i in range(len(K_layers)):
        Uk, Sk, Vtk = np.linalg.svd(K_layers[i], full_matrices = False)
        Uv, Sv, Vtv = np.linalg.svd(V_layers[i], full_matrices = False)
        svd_K.append((Uk, Sk, Vtk))
        svd_V.append((Uv, Sv, Vtv))
    return svd_K, svd_V

    #plt.plot(Sk)
    #plt.plot(Sv)
    #plt.show() # see how fast S decays