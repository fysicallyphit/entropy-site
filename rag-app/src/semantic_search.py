# user inputs sentence and k 
# loop through embedded_chunks.json and calculate cos similarity
# return top k chunks
import json
from sklearn.metrics.pairwise import cosine_similarity
from sentence_transformers import SentenceTransformer
model = SentenceTransformer("all-MiniLM-L6-v2")

def semantic_search():
    query = input("Search for legal and privacy data: ")
    embedded_query = model.encode(query)
    top_k = []
    while True:
        try: 
            k = int(input("How many results would you like to return? "))
            break
        except ValueError:
            print("invalid input; must be an integer.")
    with open("outputs/embedded_chunks.json", "r") as f:
        data = json.load(f)
    for d in data:
        cos_similarity = cosine_similarity([embedded_query], [d["embedding"]]) #cosine_similarity returns 1x1 matrix of a score
        d["cos_score"] = cos_similarity.tolist()
    ranked = sorted(data, key=lambda data: data["cos_score"], reverse=True) 
    for i in range(k):
        top_k.append(ranked[i])
    result_rank = 0
    for each_k in top_k:
        result_rank += 1
        score = cos_similarity[0][0]
        source = each_k["source"]
        text = each_k["text"]
        print(f"Result: {result_rank}\nScore: {score} \nSource: {source} \nText: {text}")
        
retrieve = semantic_search()
print(retrieve)  