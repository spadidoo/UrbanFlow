# ======================================================================
# UrbanFlow: FINAL FAST + BALANCED TRAINING WITH AUTO MODEL SELECTION
# ======================================================================

import pandas as pd
import numpy as np
import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    f1_score,
    cohen_kappa_score,
    confusion_matrix,
    classification_report
)
from datetime import datetime
import os

# ======================================================================
# CONFIGURATION (UNCHANGED CORE)
# ======================================================================
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DATA_PATH = os.path.join(
    PROJECT_ROOT,
    "data",
    "final",
    "model_training_data.csv"   # <-- change ONLY this filename
)

TARGET = "congestion_severity"

MODEL_DIR = os.path.join(PROJECT_ROOT, "backend", "test")
LOG_DIR = os.path.join(PROJECT_ROOT, "backend", "test")

FINAL_MODEL_PATH = os.path.join(MODEL_DIR, "urbanflow_best_model.pkl")
EXPERIMENT_LOG_PATH = os.path.join(LOG_DIR, "urbanflow_experiment_log.csv")

RANDOM_STATE = 42
TEST_SIZE = 0.2

LIGHT_START = 18047
LIGHT_END = 2047
STEP = 1000

os.makedirs(MODEL_DIR, exist_ok=True)
os.makedirs(LOG_DIR, exist_ok=True)

# ======================================================================
# LOAD DATA
# ======================================================================

df = pd.read_csv(DATA_PATH)
print(f"\n✓ Loaded: {len(df):,} rows")

X = df.drop(columns=[TARGET])
y = df[TARGET]

print("\nInitial class counts:")
print(y.value_counts())

# ======================================================================
# FIXED HOLDOUT SPLIT (VERY IMPORTANT)
# ======================================================================

X_train_full, X_test, y_train_full, y_test = train_test_split(
    X,
    y,
    test_size=TEST_SIZE,
    stratify=y,
    random_state=RANDOM_STATE
)

# Separate classes (FAST + BALANCED CORE)
light_X = X_train_full[y_train_full == 0]
moderate_X = X_train_full[y_train_full == 1]
heavy_X = X_train_full[y_train_full == 2]

# ======================================================================
# EXPERIMENT TRACKING
# ======================================================================

experiments = []

best_score = -1
best_model = None
best_light_size = None

print("\n======================================================================")
print("UrbanFlow: Final Training (FAST + Balanced Experiment)")
print("======================================================================")

# ======================================================================
# TRAINING LOOP (ORIGINAL LOGIC + SELECTION)
# ======================================================================

for light_size in range(LIGHT_START, LIGHT_END - 1, -STEP):

    print("\n----------------------------------------------------------------------")
    print(f"Training with Light samples = {light_size:,}")
    print("----------------------------------------------------------------------")

    sampled_light = light_X.sample(
        n=min(light_size, len(light_X)),
        random_state=RANDOM_STATE
    )

    X_train = pd.concat([sampled_light, moderate_X, heavy_X])
    y_train = y_train_full.loc[X_train.index]

    model = RandomForestClassifier(
        n_estimators=300,
        max_depth=18,
        min_samples_split=10,
        min_samples_leaf=5,
        class_weight="balanced",
        random_state=RANDOM_STATE,
        n_jobs=-1
    )

    model.fit(X_train, y_train)

    preds = model.predict(X_test)

    acc = accuracy_score(y_test, preds)
    bal_acc = balanced_accuracy_score(y_test, preds)
    f1_macro = f1_score(y_test, preds, average="macro")
    f1_weighted = f1_score(y_test, preds, average="weighted")
    kappa = cohen_kappa_score(y_test, preds)

    print("\nHoldout Test Evaluation")
    print(f"Accuracy:          {acc:.2%}")
    print(f"Balanced Accuracy: {bal_acc:.2%}")
    print(f"Cohen's Kappa:     {kappa:.4f}")
    print(f"F1 Macro:          {f1_macro:.4f}")
    print(f"F1 Weighted:       {f1_weighted:.4f}")

    experiments.append({
        "light_samples": light_size,
        "accuracy": acc,
        "balanced_accuracy": bal_acc,
        "f1_macro": f1_macro,
        "f1_weighted": f1_weighted,
        "kappa": kappa
    })

    # ==============================================================
    # 🔑 MODEL SELECTION SCORE
    # ==============================================================

    selection_score = (bal_acc + f1_macro + kappa) / 3

    if selection_score > best_score:
        best_score = selection_score
        best_model = model
        best_light_size = light_size

# ======================================================================
# SAVE FINAL BEST MODEL
# ======================================================================

joblib.dump(best_model, FINAL_MODEL_PATH)

# ======================================================================
# SAVE EXPERIMENT LOG
# ======================================================================

log_df = pd.DataFrame(experiments)
log_df["timestamp"] = datetime.now()
log_df.to_csv(EXPERIMENT_LOG_PATH, index=False)

print("\n======================================================================")
print("✅ TRAINING COMPLETE")
print(f"🏆 BEST MODEL SELECTED")
print(f"➡ Light samples used: {best_light_size:,}")
print(f"➡ Model saved to: {FINAL_MODEL_PATH}")
print("➡ Experiment log saved")
print("======================================================================")
