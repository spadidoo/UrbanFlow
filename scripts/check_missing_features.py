import pandas as pd
import joblib
import os

# Load current model's expected features
model_dir = 'backend/models'
feature_names = joblib.load(os.path.join(model_dir, 'feature_names.pkl'))

print("="*70)
print("CURRENT MODEL FEATURES")
print("="*70)
print(f"\nModel expects: {len(feature_names)} features")
print("\nFeatures list:")
for i, feat in enumerate(feature_names, 1):
    print(f"  {i:2}. {feat}")

# Load training data
data_path = 'data/final/model_training_data.csv'
df = pd.read_csv(data_path)

print(f"\n" + "="*70)
print("TRAINING DATA FEATURES")
print("="*70)
print(f"\nTraining CSV has: {len(df.columns)-1} features (excluding target)")

# Find missing features
csv_features = set(df.columns) - {'congestion_severity'}
model_features = set(feature_names)

missing_in_model = csv_features - model_features
missing_in_csv = model_features - csv_features

if missing_in_csv:
    print(f"\n⚠️  MISSING IN CSV ({len(missing_in_csv)} features):")
    for feat in sorted(missing_in_csv):
        print(f"   - {feat}")

if missing_in_model:
    print(f"\n✅ NEW IN CSV ({len(missing_in_model)} features):")
    for feat in sorted(missing_in_model):
        print(f"   - {feat}")

if not missing_in_csv and not missing_in_model:
    print("\n✅ Perfect match! Model and CSV have same features.")
else:
    print(f"\n⚠️  MISMATCH DETECTED - Need to retrain model!")