"""
✅ UrbanFlow - Improved Final Model Training
+ Progressive Light-class undersampling experiment (Dean requirement)

This version:
- PRESERVES original pipeline, SMOTE, RF, hyperparameters
- Adds an OUTER LOOP to reduce Light samples by 1000 per run
- Stops automatically when ALL class F1-scores ≥ 0.90
- Logs experiment results for Chapter 4 tables
"""

import os
import joblib
import warnings
import numpy as np
import pandas as pd

from sklearn.model_selection import train_test_split, StratifiedKFold, RandomizedSearchCV
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

# ============================================================
# PATHS
# ============================================================

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(PROJECT_ROOT, "data", "final")
MODELS_DIR = os.path.join(PROJECT_ROOT, "backend", "test")
os.makedirs(MODELS_DIR, exist_ok=True)

print("=" * 70)
print("UrbanFlow: Final Training (with Light Undersampling Experiment)")
print("=" * 70)

# ============================================================
# LOAD DATA
# ============================================================

data_path = os.path.join(DATA_DIR, "model_training_data.csv")
df = pd.read_csv(data_path)

if TARGET_COL not in df.columns:
    raise ValueError(f"Target column '{TARGET_COL}' not found")

print(f"\n✓ Loaded: {len(df):,} rows")
print(f"✓ Features: {len(df.columns) - 1}")

# Split classes
df_light = df[df[TARGET_COL] == LIGHT_LABEL]
df_other = df[df[TARGET_COL] != LIGHT_LABEL]

print("\nInitial class counts:")
print(df[TARGET_COL].value_counts())

# ============================================================
# CV SETUP
# ============================================================

cv = StratifiedKFold(
    n_splits=5,
    shuffle=True,
    random_state=RANDOM_STATE
)

# ============================================================
# HYPERPARAMETER SPACE (UNCHANGED)
# ============================================================

param_distributions = {
    "rf__n_estimators": [300, 500, 800, 1000, 1200],
    "rf__max_depth": [15, 20, 25, 30, 35, None],
    "rf__min_samples_split": [2, 4, 6, 8, 10],
    "rf__min_samples_leaf": [1, 2, 3, 4, 5],
    "rf__max_features": ["sqrt", "log2", None],
    "rf__class_weight": [
        "balanced",
        {0: 1.0, 1: 2.0, 2: 3.0},
        {0: 1.0, 1: 2.5, 2: 4.0},
        {0: 1.0, 1: 3.0, 2: 5.0},
    ],
    "smote__k_neighbors": [3, 4, 5, 6, 7],
}

# ============================================================
# EXPERIMENT LOOP
# ============================================================

experiment_log = []

for light_size in range(len(df_light), MIN_LIGHT_SAMPLES - 1, -STEP_SIZE):

    print("\n" + "-" * 70)
    print(f"Training with Light samples = {light_size:,}")
    print("-" * 70)

    sampled_light = df_light.sample(
        n=light_size,
        random_state=RANDOM_STATE
    )

    df_iter = pd.concat([sampled_light, df_other], axis=0)
    df_iter = df_iter.sample(frac=1, random_state=RANDOM_STATE)

    X = df_iter.drop(TARGET_COL, axis=1)
    y = df_iter[TARGET_COL]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size=0.20,
        stratify=y,
        random_state=RANDOM_STATE
    )

    class_dist = y_train.value_counts(normalize=True)
    imbalance_ratio = class_dist.max() / class_dist.min()
    is_imbalanced = imbalance_ratio > 2.0

    # ========================================================
    # PIPELINE (UNCHANGED)
    # ========================================================

    steps = []
    if is_imbalanced:
        steps.append(("smote", SMOTE(random_state=RANDOM_STATE)))

    steps.append((
        "rf",
        RandomForestClassifier(
            random_state=RANDOM_STATE,
            n_jobs=-1,
            class_weight="balanced",
            oob_score=True,
            bootstrap=True
        )
    ))

    pipeline = ImbPipeline(steps=steps)

    search = RandomizedSearchCV(
        estimator=pipeline,
        param_distributions=param_distributions,
        n_iter=50,
        scoring="f1_macro",
        cv=cv,
        verbose=1,
        n_jobs=-1,
        random_state=RANDOM_STATE
    )

    search.fit(X_train, y_train)
    best_model = search.best_estimator_

    # ========================================================
    # EVALUATION
    # ========================================================

    y_pred = best_model.predict(X_test)

    acc = accuracy_score(y_test, y_pred)
    bal_acc = balanced_accuracy_score(y_test, y_pred)
    kappa = cohen_kappa_score(y_test, y_pred)

    f1_macro = f1_score(y_test, y_pred, average="macro")
    f1_weighted = f1_score(y_test, y_pred, average="weighted")

    report = classification_report(
        y_test,
        y_pred,
        output_dict=True
    )

    f1_light = report["0"]["f1-score"]
    f1_moderate = report["1"]["f1-score"]
    f1_heavy = report["2"]["f1-score"]

    print(f"\nAccuracy: {acc:.4f}")
    print(f"F1 Macro: {f1_macro:.4f}")
    print(f"Light F1: {f1_light:.4f}")
    print(f"Moderate F1: {f1_moderate:.4f}")
    print(f"Heavy F1: {f1_heavy:.4f}")

    experiment_log.append({
        "light_samples": light_size,
        "accuracy": acc,
        "f1_macro": f1_macro,
        "f1_weighted": f1_weighted,
        "f1_light": f1_light,
        "f1_moderate": f1_moderate,
        "f1_heavy": f1_heavy
    })

    # 🎯 STOP CONDITION (Dean requirement)
    if (
        f1_light >= TARGET_F1 and
        f1_moderate >= TARGET_F1 and
        f1_heavy >= TARGET_F1
    ):
        print("\n✅ All classes ≥ 0.90 F1 — stopping experiment")
        break

# ============================================================
# SAVE FINAL MODEL + LOGS
# ============================================================

joblib.dump(best_model, os.path.join(MODELS_DIR, "rf_model_5_DATAREDUCED.pkl"))
joblib.dump(list(X.columns), os.path.join(MODELS_DIR, "feature_names_DATAREDUCED.pkl"))

pd.DataFrame(experiment_log).to_csv(
    os.path.join(MODELS_DIR, "light_undersampling_experiment.csv"),
    index=False
)

print("\n✓ Experiment log saved")
print("✓ Final model saved")
print("\n" + "=" * 70)
print("✅ Training complete!")
print("=" * 70)
