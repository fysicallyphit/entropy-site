import matplotlib.pyplot as plt

def plot_results(r_range, attention_errors, compressed_KV_memories, full_KV_memory):
    plt.figure(1)
    plt.plot(r_range, attention_errors)
    plt.ylim(0, 20)
    plt.xlabel('r (0-64)')
    plt.ylabel('SSE between Attention and Attention Approximation')
    plt.title("Error over r singular values")
    plt.show()

    plt.figure(2)
    plt.plot(compressed_KV_memories, attention_errors)
    plt.gca().invert_xaxis()
    plt.axvline(x = full_KV_memory, color='red')
    plt.ylim(0, 20)
    plt.xlabel('Storage (bytes)')
    plt.ylabel('SSE between Attention and Attention Approximation')
    plt.title("Error vs memory")
    plt.show()