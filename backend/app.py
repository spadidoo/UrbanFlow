from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route("/simulate", methods=["POST"])
def simulate():
    data = request.json
    return jsonify({
        "message": "Simulation received",
        "input": data
    })

if __name__ == "__main__":
    app.run(debug=True)

