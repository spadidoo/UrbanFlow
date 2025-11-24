"""
🔥 PHASE 4: FEATURE SELECTION & FINAL OPTIMIZATION
Remove weak features and max out tree count for final push

Expected improvement: +0.5-1% accuracy
Time: 30-60 minutes
"""

import pandas as pd
import numpy as np
import os
import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold
from sklearn.metrics import (
    accuracy_score, 
    cohen_kappa_score,
    balanced_accuracy_score,
    classification_report
)
import warnings
warnings.filterwarnings('ignore')
from imblearn.over_sampling import SMOTE

# ============================================================
# SETUP
# ============================================================

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(PROJECT_ROOT, 'data', 'final')
MODELS_DIR = os.path.join(PROJECT_ROOT, 'backend', 'models')

print("="*70)
print("PHASE 4: FEATURE SELECTION & FINAL OPTIMIZATION")
print("="*70)

# ============================================================
# LOAD DATA
# ============================================================

print("\nLoading data...")
data_path = os.path.join(DATA_DIR, 'model_training_data.csv')
df = pd.read_csv(data_path)

X = df.drop('congestion_severity', axis=1)
y = df['congestion_severity']

print(f"✓ Current features: {len(X.columns)}")

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.20, random_state=42, stratify=y
)

class_dist = y_train.value_counts(normalize=True)
is_imbalanced = class_dist.max() / class_dist.min() > 2.0

if is_imbalanced:
    print("\n⚖️  Applying SMOTE...")
    smote = SMOTE(random_state=42, k_neighbors=5)
    X_train, y_train = smote.fit_resample(X_train, y_train)
    print(f"   After SMOTE: {len(X_train):,} samples")
# ============================================================
# STEP 1: TRAIN BASELINE MODEL
# ============================================================

print("\n" + "="*70)
print("🌲 STEP 1: Training baseline model...")

baseline_model = RandomForestClassifier(
    n_estimators=300,
    max_depth=30,
    min_samples_split=10,
    min_samples_leaf=4,
    class_weight='balanced',
    random_state=42,
    oob_score=True,
    n_jobs=-1
)

baseline_model.fit(X_train, y_train)
baseline_pred = baseline_model.predict(X_test)
baseline_acc = accuracy_score(y_test, baseline_pred)

print(f"✓ Baseline accuracy: {baseline_acc*100:.2f}%")
print(f"✓ Features used: {len(X.columns)}")

# ============================================================
# STEP 2: FEATURE IMPORTANCE ANALYSIS
# ============================================================

print("\n" + "="*70)
print("STEP 2: Analyzing feature importance...")

importances = baseline_model.feature_importances_
feature_names = X.columns

importance_df = pd.DataFrame({
    'feature': feature_names,
    'importance': importances
}).sort_values('importance', ascending=False)

print(f"\nFeature importance distribution:")
print(f"   Top 10 average: {importance_df.head(10)['importance'].mean():.4f}")
print(f"   Bottom 10 average: {importance_df.tail(10)['importance'].mean():.4f}")

# Identify weak features
threshold = 0.001  # Features contributing < 0.1%
weak_features = importance_df[importance_df['importance'] < threshold]['feature'].tolist()

print(f"\n⚠️  Weak features (importance < {threshold}):")
print(f"   Count: {len(weak_features)}")
if len(weak_features) > 0:
    print(f"\n   Weakest features:")
    for feat in weak_features[:20]:  # Show first 20
        imp = importance_df[importance_df['feature'] == feat]['importance'].values[0]
        print(f"      {feat:40} {imp:.6f}")

# ============================================================
# STEP 3: REMOVE WEAK FEATURES
# ============================================================

if len(weak_features) > 0:
    print("\n" + "="*70)
    print(f"🔧 STEP 3: Removing {len(weak_features)} weak features...")
    
    X_filtered = X.drop(columns=weak_features)
    X_train_filtered = X_train.drop(columns=weak_features)
    X_test_filtered = X_test.drop(columns=weak_features)
    
    print(f"✓ Features reduced: {len(X.columns)} → {len(X_filtered.columns)}")
    
    # Retrain with filtered features
    print(f"\n🌲 Retraining with {len(X_filtered.columns)} features...")
    
    filtered_model = RandomForestClassifier(
        n_estimators=300,
        max_depth=30,
        min_samples_split=10,
        min_samples_leaf=4,
        class_weight='balanced',
        random_state=42,
        oob_score=True,
        n_jobs=-1
    )
    
    filtered_model.fit(X_train_filtered, y_train)
    filtered_pred = filtered_model.predict(X_test_filtered)
    filtered_acc = accuracy_score(y_test, filtered_pred)
    
    print(f"\n📊 After feature selection:")
    print(f"   Accuracy: {baseline_acc*100:.2f}% → {filtered_acc*100:.2f}%")
    print(f"   Change: {(filtered_acc - baseline_acc)*100:+.2f}%")
    
    if filtered_acc >= baseline_acc - 0.005:  # Within 0.5%
        print(f"   ✅ Feature selection successful!")
        X_train = X_train_filtered
        X_test = X_test_filtered
        X = X_filtered
        current_acc = filtered_acc
    else:
        print(f"   ❌ Feature selection hurt performance, reverting...")
        current_acc = baseline_acc
else:
    print("\n✓ All features are important (none < threshold)")
    current_acc = baseline_acc

# ============================================================
# STEP 4: INCREASE TREES FOR FINAL MODEL
# ============================================================

print("\n" + "="*70)
print("STEP 4: Training FINAL model with maximum trees...")

final_model = RandomForestClassifier(
    n_estimators=1000,  # MAX OUT TREES
    max_depth=35,       # Slightly increase depth
    min_samples_split=8,  # Allow more splits
    min_samples_leaf=3,   # Smaller leaves
    max_features='sqrt',
    class_weight='balanced',
    random_state=42,
    oob_score=True,
    bootstrap=True,
    n_jobs=-1,
    verbose=1  # Show progress
)

print(f"\n🔧 Final configuration:")
print(f"   Trees: {final_model.n_estimators}")
print(f"   Max depth: {final_model.max_depth}")
print(f"   Features: {len(X.columns)}")

print(f"\n   Training... (this will take 5-10 minutes)")

final_model.fit(X_train, y_train)

print(f"\n   ✓ Training complete!")

# ============================================================
# STEP 5: FINAL EVALUATION
# ============================================================

print("\n" + "="*70)
print("STEP 5: Final evaluation...")

final_pred = final_model.predict(X_test)
final_acc = accuracy_score(y_test, final_pred)
final_kappa = cohen_kappa_score(y_test, final_pred)
final_balanced = balanced_accuracy_score(y_test, final_pred)

print(f"\n🏆 FINAL MODEL PERFORMANCE:")
print(f"   Overall Accuracy:    {final_acc*100:.2f}%")
print(f"   Cohen's Kappa:       {final_kappa:.4f}")
print(f"   Balanced Accuracy:   {final_balanced*100:.2f}%")
if hasattr(final_model, 'oob_score_'):
    print(f"   OOB Score:           {final_model.oob_score_*100:.2f}%")

# Cross-validation
print(f"\nCross-validation (5-fold)...")
skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
cv_scores = cross_val_score(final_model, X, y, cv=skf, scoring='accuracy', n_jobs=-1)

print(f"\n   CV Results:")
for i, score in enumerate(cv_scores, 1):
    print(f"      Fold {i}: {score*100:.2f}%")
print(f"      Mean:   {cv_scores.mean()*100:.2f}%")
print(f"      Std:    ±{cv_scores.std()*100:.2f}%")

# Per-class report
print(f"\n   Classification Report:")
print(classification_report(y_test, final_pred, 
                           target_names=['Light', 'Moderate', 'Heavy'],
                           digits=3))

# ============================================================
# STEP 6: PROGRESSION SUMMARY
# ============================================================

print("\n" + "="*70)
print("PROGRESSION SUMMARY")
print("="*70)

print(f"\n   Baseline (300 trees):     {baseline_acc*100:.2f}%")
if len(weak_features) > 0:
    print(f"   After feature selection:  {filtered_acc*100:.2f}% ({(filtered_acc-baseline_acc)*100:+.2f}%)")
print(f"   Final (1000 trees):       {final_acc*100:.2f}% ({(final_acc-current_acc)*100:+.2f}%)")
print(f"   ─────────────────────────────────────")
print(f"   Total improvement:        {(final_acc-baseline_acc)*100:+.2f}%")

# ============================================================
# STEP 7: SAVE FINAL MODEL
# ============================================================

print("\n" + "="*70)
print("STEP 7: Saving final optimized model...")

model_path = os.path.join(MODELS_DIR, 'random_forest_model.pkl')
joblib.dump(final_model, model_path)
print(f"✓ Model saved: {model_path}")

feature_path = os.path.join(MODELS_DIR, 'feature_names.pkl')
joblib.dump(list(X.columns), feature_path)
print(f"✓ Features saved: {feature_path}")

info = {
    'accuracy': final_acc,
    'cohen_kappa': final_kappa,
    'balanced_accuracy': final_balanced,
    'oob_score': final_model.oob_score_,
    'cv_mean': cv_scores.mean(),
    'cv_std': cv_scores.std(),
    'n_features': len(X.columns),
    'n_estimators': final_model.n_estimators,
    'max_depth': final_model.max_depth,
    'features_removed': len(weak_features),
    'training_samples': len(X_train),
    'test_samples': len(X_test)
}

info_path = os.path.join(MODELS_DIR, 'model_info.pkl')
joblib.dump(info, info_path)
print(f"✓ Info saved: {info_path}")

# ============================================================
# FINAL SUMMARY
# ============================================================

print("\n" + "="*70)
print("✅  ALL OPTIMIZATION PHASES COMPLETE! 🎉")
print("="*70)

print(f"\n ULTIMATE FINAL RESULTS:")
print(f"   Accuracy:            {final_acc*100:.2f}%")
print(f"   Cohen's Kappa:       {final_kappa:.4f}")
print(f"   Balanced Accuracy:   {final_balanced*100:.2f}%")
print(f"   OOB Score:           {final_model.oob_score_*100:.2f}%")
print(f"   CV (5-fold):         {cv_scores.mean()*100:.2f}% (±{cv_scores.std()*100:.2f}%)")

print(f"\n Model Configuration:")
print(f"   Algorithm:           Random Forest Classifier")
print(f"   Trees:               {final_model.n_estimators}")
print(f"   Max depth:           {final_model.max_depth}")
print(f"   Features:            {len(X.columns)}")
print(f"   Training samples:    {len(X_train):,}")

