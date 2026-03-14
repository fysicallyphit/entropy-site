from transformers import AutoTokenizer, AutoModel

tokenizer = AutoTokenizer.from_pretrained("bert-base-uncased")
model = AutoModel.from_pretrained("bert-base-uncased")

def extract_qkv():
    Q_matrices = []
    K_matrices = []
    V_matrices = []

    def hook_Q(module, input, output):
        Q_matrices.append(output) 

    def hook_K(module, input, output):
        K_matrices.append(output)

    def hook_V(module, input, output):
        V_matrices.append(output)  

    Q_layers = []
    K_layers = []
    V_layers = []
    for i in range(12):    
        model.encoder.layer[i].attention.self.query.register_forward_hook(hook_Q)
        model.encoder.layer[i].attention.self.key.register_forward_hook(hook_K)
        model.encoder.layer[i].attention.self.value.register_forward_hook(hook_V)

    inputs = tokenizer("the quick brown fox jumped over the lazy dog" * 20,  return_tensors ="pt")
    K_matrices.clear() 
    V_matrices.clear()
    Q_matrices.clear() 
    outputs = model(**inputs)
    seq_len = inputs["input_ids"].shape[1]
    
    for i in range(12):
        Q = Q_matrices[i]
        Q = Q.reshape(1, seq_len, 12, 64).transpose(1,2)
        Q_layers.append(Q[0,0,:,:].detach().numpy())

        K = K_matrices[i]
        K = K.reshape(1, seq_len, 12, 64).transpose(1,2)
        K_layers.append(K[0,0,:,:].detach().numpy())

        V = V_matrices[i]
        V = V.reshape(1, seq_len, 12, 64).transpose(1,2)
        V_layers.append(V[0,0,:,:].detach().numpy())

    return outputs, Q_layers, K_layers, V_layers
