import os
import pandas as pd
import numpy as np
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS


# =========================
# Optional AI (Gemini)
# =========================
AI_ENABLED = False
client = None

try:
    from google import genai
    if os.getenv("GEMINI_API_KEY"):
        client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
        AI_ENABLED = True
except Exception as e:
    print("⚠️ Gemini AI disabled:", e)

# =========================
# Custom Utilities
# =========================
from datalens_utils.eda import basic_eda

# =========================
# Flask App Setup
# =========================
app = Flask(__name__, static_folder="static", template_folder="templates")
CORS(app)

ALLOWED_EXTENSIONS = {"csv"}

# =========================
# Helper Functions
# =========================
def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def generate_ai_insights(df):
    """
    Generates AI insights using Gemini if available,
    otherwise returns a fallback intelligent summary.
    """

    summary = f"""
Dataset Overview
----------------
Rows: {df.shape[0]}
Columns: {df.shape[1]}

Column Data Types
-----------------
{df.dtypes.to_string()}

Missing Values
--------------
{df.isnull().sum().to_string()}
"""

    if not AI_ENABLED:
        return (
            "⚠️ AI Insights (Fallback Mode)\n\n"
            "• Dataset loaded successfully\n"
            "• Identify columns with high missing values\n"
            "• Review numerical distributions\n"
            "• Consider feature scaling before modeling\n"
            "• Check categorical columns for imbalance\n\n"
            + summary
        )

    try:
        prompt = f"""
You are a senior data analyst.
Analyze the dataset summary below and provide
clear, concise, actionable insights.

{summary}
"""
        response = client.models.generate_content(
            model="gemini-1.5-flash",
            contents=prompt
        )
        return response.text

    except Exception as e:
        return f"AI insight generation failed.\nReason: {str(e)}"


# =========================
# Routes
# =========================
@app.route("/")
def index():
    return render_template("index.html")


@app.route("/analyze", methods=["POST"])
def analyze():
    try:
        # ---------- File Validation ----------
        if "file" not in request.files:
            return jsonify({"error": "No file uploaded"}), 400

        file = request.files["file"]

        if file.filename == "":
            return jsonify({"error": "No file selected"}), 400

        if not allowed_file(file.filename):
            return jsonify({"error": "Only CSV files are allowed"}), 400

        # ---------- Read CSV (SAFE MODE) ----------
        df = pd.read_csv(
            file,
            encoding="latin1",   # fixes Walmart & real-world CSVs
            low_memory=False
        )

        if df.empty:
            return jsonify({"error": "Uploaded CSV file is empty"}), 400

        print("✅ CSV Loaded Successfully")
        print("Columns:", df.columns.tolist())
        print("Shape:", df.shape)

        # ---------- Basic EDA ----------
        eda = basic_eda(df)

        # ---------- Data Types ----------
        data_types = df.dtypes.astype(str).to_dict()

        # ---------- Correlation ----------
        numeric_df = df.select_dtypes(include=np.number)
        if numeric_df.shape[1] >= 2:
            correlation = numeric_df.corr().fillna(0).round(3).to_dict()
        else:
            correlation = {}

        # ---------- AI Insights ----------
        try:
            ai_insights = generate_ai_insights(df)
        except Exception as ai_error:
            ai_insights = f"AI insights unavailable.\nReason: {ai_error}"

        # ---------- Success Response ----------
        return jsonify({
            "shape": [int(df.shape[0]), int(df.shape[1])],
            "columns": list(df.columns),
            "eda": eda,
            "data_types": data_types,
            "correlation": correlation,
            "ai_insights": ai_insights
        })

    except Exception as e:
        print("🔥 BACKEND ERROR:", e)
        return jsonify({
            "error": "Analysis failed",
            "details": str(e)
        }), 500


# =========================
# Run Server
# =========================
if __name__ == "__main__":
    app.run(debug=True)
