import os
import numpy as np

# Use a pipeline as a high-level helper
from transformers import pipeline

pipe = pipeline("text-generation", model="sshleifer/tiny-gpt2")

# Load model directly
from transformers import AutoTokenizer, AutoModelForCausalLM

tokenizer = AutoTokenizer.from_pretrained("sshleifer/tiny-gpt2")
model = AutoModelForCausalLM.from_pretrained("sshleifer/tiny-gpt2")

def model_data(model, tokenizer, use_cache = True):
    prompt = "hello there"
    tokens = tokenizer(prompt, return_tensors= "pt")
    for step in range(10):
        output = model(**tokens, use_cache = use_cache)
        cache = output.past_key_values()
        print("STEP: ", step, cache.get_seq_len())
        
        next_token = np.argmax(output.logits)
        tokens = next_token
        
        