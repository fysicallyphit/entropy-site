from transformers import AutoTokenizer, AutoModelForCausalLM

tokenizer = AutoTokenizer.from_pretrained("sshleifer/tiny-gpt2")
model = AutoModelForCausalLM.from_pretrained("sshleifer/tiny-gpt2")


def kv_data(model, tokenizer, prompt="hello there", steps=10):
    tokens = tokenizer(prompt, return_tensors="pt")

    cache = None
    next_input_ids = None

    for step in range(steps):
        if step == 0:
            output = model(**tokens, use_cache=True)
        else:
            output = model(input_ids=next_input_ids, past_key_values=cache, use_cache=True)

        cache = output.past_key_values

        total_elements = 0
        total_bytes = 0

        for layer in cache.layers:
            total_elements += layer.keys.numel() + layer.values.numel()
            total_bytes += (
                layer.keys.numel() * layer.keys.element_size()
                + layer.values.numel() * layer.values.element_size()
            )

        seq_len = cache.get_seq_length()

        print(f"step {step} | seq_len {seq_len} | kv_elements {total_elements} | kv_bytes {total_bytes}")

        next_input_ids = output.logits[:, -1, :].argmax(dim=-1, keepdim=True)

    return output


output = kv_data(model, tokenizer)