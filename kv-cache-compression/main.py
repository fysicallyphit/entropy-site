from src.extract import extract_qkv
from src.compress import compute_svd
from src.evaluate_layer import compression_experiment
from src.plot import plot_results

outputs, Q_head, K_head, V_head = extract_qkv()
svd_K, svd_V = compute_svd(K_head, V_head)
r_range, attention_errors, compressed_KV_memory, full_KV_memory = compression_experiment(Q_head, K_head, V_head, svd_K, svd_V)
plot_results(r_range, attention_errors, compressed_KV_memory, full_KV_memory)

# plt.plot(Sk)
# plt.plot(Sv)
# plt.title('Decay of Singular Values of K and V')
# plt.xlabel("Number of Singular Values")
# plt.ylabel("Effect on Full-Rank Matrix K and V")
# plt.legend()
# plt.show() # see how fast S decays