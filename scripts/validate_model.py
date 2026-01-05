import pandas as pd
import numpy as np
from sklearn.model_selection import TimeSeriesSplit
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, f1_score, cohen_kappa_score
import os

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FINAL_DIR = os.path.join(PROJECT_ROOT, 'data', 'final')

print("="*70)
print("TIME-SERIES CROSS-VALIDATION FOR URBANFLOW")
print("="*70)

# Load data
df = pd.read_csv(os.path.join(FINAL_DIR, 'model_training_data.csv'))
X = df.drop('congestion_severity', axis=1)
y = df['congestion_severity']

# Research: Walk-forward validation preserves temporal order
# Critical for traffic time-series data
tscv = TimeSeriesSplit(n_splits=5)

print(f"\nPerforming 5-fold time-series cross-validation...")
print(f"(Each fold trains on past, tests on future)")

scores = {
    'accuracy': [],
    'f1_macro': [],
    'kappa': []
}

for fold, (train_idx, test_idx) in enumerate(tscv.split(X), 1):
    print(f"\nFold {fold}/5:")
    
    X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
    y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]
    
    # Train model
    model = RandomForestClassifier(
        n_estimators=500,
        max_depth=None,
        min_samples_split=5,
        min_samples_leaf=4,
        max_features='sqrt',
        class_weight='balanced',
        random_state=42,
        n_jobs=-1
    )
    
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)
    
    # Calculate metrics
    acc = accuracy_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred, average='macro')
    kappa = cohen_kappa_score(y_test, y_pred)
    
    scores['accuracy'].append(acc)
    scores['f1_macro'].append(f1)
    scores['kappa'].append(kappa)
    
    print(f"   Accuracy: {acc*100:.2f}%")
    print(f"   F1-Score: {f1:.4f}")
    print(f"   Kappa:    {kappa:.4f}")

print(f"\n" + "="*70)
print(f"CROSS-VALIDATION RESULTS:")
print(f"="*70)

for metric, values in scores.items():
    mean = np.mean(values)
    std = np.std(values)
    print(f"\n{metric.upper()}:")
    print(f"   Mean: {mean:.4f}")
    print(f"   Std:  {std:.4f}")
    print(f"   Range: [{min(values):.4f}, {max(values):.4f}]")

# Stability check
print(f"\nMODEL STABILITY:")
if np.std(scores['accuracy']) < 0.05:
    print(f"   ✓ Excellent stability (std < 0.05)")
elif np.std(scores['accuracy']) < 0.10:
    print(f"   ✓ Good stability (std < 0.10)")
else:
    print(f"   ⚠️  Unstable model (std > 0.10)")
    print(f"   Consider: More data or feature engineering")