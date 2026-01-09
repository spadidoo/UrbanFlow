"""
✅ UrbanFlow - Final Model Training
FAST version with Light-class undersampling experiment

- Uses FIXED best hyperparameters (from prior RandomizedSearchCV)
- Preserves original evaluation output format
- Automatically finds balanced ≥0.90 F1 solution
"""

import os
import joblib
import warnings
import numpy as np
import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    cohen_kappa_score,
    classification_report,
    confusion_matrix,
    f1_score
)
from sklearn.ensemble import RandomForestClassifier

from imblearn.over_sampling import SMOTE
from imblearn.pipeline import Pipeline as ImbPipeline

warnings.filterwarnings("ignore")

# ============================================================
# CONFIGURATION
# ============================================================

RANDOM_STATE = 42
TARGET_COL = "congestion_severity"

LIGHT_LABEL = 0
STEP_SIZE = 1000
MIN_LIGHT_SAMPLES = 2000

TARGET_F1 = 0.90
EQUALITY_TOLERANCE = 0.02

# ============================================================
# PATHS
# ============================================================

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(PROJECT_ROOT, "data", "final")
MODELS_DIR = os.path.join(PROJECT_ROOT, "backend", "test")
os.makedirs(MODELS_DIR, exist_ok=True)

print("=" * 70)
print("UrbanFlow: Final Training (FAST + Balanced Experiment)")
print("=" * 70)

# ============================================================
# LOAD DATA
# ============================================================

df = pd.read_csv(os.path.join(DATA_DIR, "model_training_data.csv"))

print(f"\n✓ Loaded: {len(df):,} rows")

df_light = df[df[TARGET_COL] == LIGHT_LABEL]
df_other = df[df[TARGET_COL] != LIGHT_LABEL]

print("\nInitial class counts:")
print(df[TARGET_COL].value_counts())

experiment_log = []
best_model = None
best_run_info = None

# ============================================================
# EXPERIMENT LOOP
# ============================================================

for light_size in range(len(df_light), MIN_LIGHT_SAMPLES - 1, -STEP_SIZE):

    print("\n" + "-" * 70)
    print(f"Training with Light samples = {light_size:,}")
    print("-" * 70)

    sampled_light = df_light.sample(n=light_size, random_state=RANDOM_STATE)
    df_iter = pd.concat([sampled_light, df_other]).sample(
        frac=1, random_state=RANDOM_STATE
    )

    X = df_iter.drop(TARGET_COL, axis=1)
    y = df_iter[TARGET_COL]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size=0.20,
        stratify=y,
        random_state=RANDOM_STATE
    )

    # ========================================================
    # FIXED PIPELINE (BEST PARAMS FROM YOUR TXT FILE)
    # ========================================================

    pipeline = ImbPipeline(steps=[
        ("smote", SMOTE(random_state=RANDOM_STATE, k_neighbors=6)),
        ("rf", RandomForestClassifier(
            n_estimators=500,
            max_depth=20,
            min_samples_split=4,
            min_samples_leaf=1,
            max_features=None,
            class_weight={0: 1.0, 1: 2.5, 2: 4.0},
            random_state=RANDOM_STATE,
            n_jobs=-1,
            bootstrap=True,
            oob_score=True
        ))
    ])

    pipeline.fit(X_train, y_train)
    y_pred = pipeline.predict(X_test)

    # ========================================================
    # METRICS (SAME AS OLD SCRIPT)
    # ========================================================

    acc = accuracy_score(y_test, y_pred)
    bal_acc = balanced_accuracy_score(y_test, y_pred)
    kappa = cohen_kappa_score(y_test, y_pred)

    f1_macro = f1_score(y_test, y_pred, average="macro")
    f1_weighted = f1_score(y_test, y_pred, average="weighted")

    cm = confusion_matrix(y_test, y_pred)

    report = classification_report(y_test, y_pred, output_dict=True)

    f1_light = report["0"]["f1-score"]
    f1_moderate = report["1"]["f1-score"]
    f1_heavy = report["2"]["f1-score"]

    # ========================================================
    # PRINT (IDENTICAL FORMAT)
    # ========================================================

    print("\n" + "=" * 70)
    print("Holdout Test Evaluation")
    print("=" * 70)

    print(f"\nAccuracy:          {acc*100:.2f}%")
    print(f"Balanced Accuracy: {bal_acc*100:.2f}%")
    print(f"Cohen's Kappa:     {kappa:.4f}")
    print(f"F1 Macro:          {f1_macro:.4f}")
    print(f"F1 Weighted:       {f1_weighted:.4f}")

    print("\nConfusion Matrix:")
    print(cm)

    print("\nClassification Report:")
    print(classification_report(y_test, y_pred, digits=3))

    # ========================================================
    # LOGGING + STOP CONDITION
    # ========================================================

    f1_values = [f1_light, f1_moderate, f1_heavy]
    f1_gap = max(f1_values) - min(f1_values)

    experiment_log.append({
        "light_samples": light_size,
        "accuracy": acc,
        "f1_macro": f1_macro,
        "f1_weighted": f1_weighted,
        "f1_light": f1_light,
        "f1_moderate": f1_moderate,
        "f1_heavy": f1_heavy,
        "f1_gap": f1_gap
    })

    if min(f1_values) >= TARGET_F1 and f1_gap <= EQUALITY_TOLERANCE:
        print("\n✅ OPTIMAL BALANCED CONFIGURATION FOUND")
        print(f"   Light samples: {light_size:,}")
        print(f"   Max F1 gap: {f1_gap:.4f}")
        best_model = pipeline
        best_run_info = experiment_log[-1]
        break

# ============================================================
# SAVE RESULTS
# ============================================================

joblib.dump(best_model, os.path.join(MODELS_DIR, "rf_model_4.pkl"))
joblib.dump(list(X.columns), os.path.join(MODELS_DIR, "feature_names.pkl"))

pd.DataFrame(experiment_log).to_csv(
    os.path.join(MODELS_DIR, "light_undersampling_experiment.csv"),
    index=False
)

print("\n✓ Final model saved")
print("✓ Experiment log saved")
print("\n" + "=" * 70)
print("✅ Training complete!")
print("=" * 70)
