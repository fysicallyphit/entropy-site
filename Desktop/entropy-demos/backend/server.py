from flask import Flask, request, jsonify
from flask_cors import CORS
from generate_tea import generate_tea_report
from generate_hpa import generate_hpa_report

app = Flask(__name__)
CORS(app)

@app.route("/api/generate-report", methods=["POST"])
def generate_report():
    specs = request.get_json()
    result = generate_tea_report(specs)
    return jsonify(result)

@app.route("/api/generate-hpa", methods=["POST"])
def generate_hpa():
    specs = request.get_json()
    result = generate_hpa_report(specs)
    return jsonify(result)

if __name__ == "__main__":
    app.run(port=5001, debug=True)