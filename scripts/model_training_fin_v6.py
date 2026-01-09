"""
UrbanFlow – Controlled Capacity + Light Reduction Experiment
Goal:
- Find best achievable model by jointly tuning:
  - Light class count
  - Number of trees
  - Tree depth
- Keep original metrics & output format
"""

import os
import joblib
import numpy as np
import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    cohen_kappa_score,
    f1_score,
    classification_report,
    confusion_matrix
)
from sklearn.ensemble import RandomForestClassifier
from imblearn.over_sampling import SMOTE
from imblearn.pipeline import Pipeline

# ============================================================
# PATHS (UNCHANGED STRUCTURE)
# ============================================================

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DATA_PATH = os.path.join(
    PROJECT_ROOT,
    "data",
    "final",
    "model_training_data.csv"
)

TARGET = "congestion_severity"

MODEL_DIR = os.path.join(PROJECT_ROOT, "backend", "test")
LOG_DIR = os.path.join(PROJECT_ROOT, "backend", "test")

FINAL_MODEL_PATH = os.path.join(MODEL_DIR, "urbanflow_best_model_2.pkl")
EXPERIMENT_LOG_PATH = os.path.join(LOG_DIR, "urbanflow_experiment_log_2.csv")

os.makedirs(MODEL_DIR, exist_ok=True)

RANDOM_STATE = 42

# ============================================================
# LOAD DATA
# ============================================================

df = pd.read_csv(DATA_PATH)

light_df = df[df[TARGET] == 0]
moderate_df = df[df[TARGET] == 1]
heavy_df = df[df[TARGET] == 2]

print("=" * 70)
print("UrbanFlow: Capacity + Balance Experiment")
print("=" * 70)

print("\nInitial class counts:")
print(df[TARGET].value_counts())

# ============================================================
# SEARCH SPACE
# ============================================================

LIGHT_COUNTS = range(len(light_df), 2000, -2000)
N_ESTIMATORS_LIST = [500, 800, 1200]
MAX_DEPTH_LIST = [20, 25, 30, None]

results = []
best_macro_f1 = -1
best_model = None

# ============================================================
# EXPERIMENT LOOP
# ============================================================

for light_n in LIGHT_COUNTS:
    sampled_light = light_df.sample(n=light_n, random_state=RANDOM_STATE)
    exp_df = pd.concat([sampled_light, moderate_df, heavy_df])

    X = exp_df.drop(TARGET, axis=1)
    y = exp_df[TARGET]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size=0.20,
        random_state=RANDOM_STATE,
        stratify=y
    )

    for n_trees in N_ESTIMATORS_LIST:
        for depth in MAX_DEPTH_LIST:

            pipeline = Pipeline(steps=[
                ("smote", SMOTE(random_state=RANDOM_STATE)),
                ("rf", RandomForestClassifier(
                    n_estimators=n_trees,
                    max_depth=depth,
                    min_samples_leaf=2,
                    class_weight="balanced",
                    n_jobs=-1,
                    random_state=RANDOM_STATE
                ))
            ])

            pipeline.fit(X_train, y_train)
            y_pred = pipeline.predict(X_test)

            acc = accuracy_score(y_test, y_pred)
            bal_acc = balanced_accuracy_score(y_test, y_pred)
            kappa = cohen_kappa_score(y_test, y_pred)
            f1_macro = f1_score(y_test, y_pred, average="macro")
            f1_weighted = f1_score(y_test, y_pred, average="weighted")

            results.append({
                "light_samples": light_n,
                "n_estimators": n_trees,
                "max_depth": depth,
                "accuracy": acc,
                "balanced_accuracy": bal_acc,
                "kappa": kappa,
                "f1_macro": f1_macro,
                "f1_weighted": f1_weighted
            })

            if f1_macro > best_macro_f1:
                best_macro_f1 = f1_macro
                best_model = pipeline

            print(f"""
----------------------------------------------------------------------
Light={light_n} | Trees={n_trees} | Depth={depth}
----------------------------------------------------------------------
Accuracy:          {acc*100:.2f}%
Balanced Accuracy: {bal_acc*100:.2f}%
Cohen's Kappa:     {kappa:.4f}
F1 Macro:          {f1_macro:.4f}
F1 Weighted:       {f1_weighted:.4f}
""")

# ============================================================
# SAVE BEST MODEL & LOG
# ============================================================

joblib.dump(best_model, FINAL_MODEL_PATH)

log_df = pd.DataFrame(results)
log_df.to_csv(EXPERIMENT_LOG_PATH, index=False)

print("=" * 70)
print("✅ Training complete!")
print(f"Best Macro-F1: {best_macro_f1:.4f}")
print(f"Model saved to: {FINAL_MODEL_PATH}")
print(f"Experiment log saved to: {EXPERIMENT_LOG_PATH}")
print("=" * 70)
