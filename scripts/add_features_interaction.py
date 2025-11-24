import pandas as pd
import numpy as np
import os

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(PROJECT_ROOT, 'data', 'final')

print("="*70)
print("🔧 ADDING INTERACTION FEATURES")
print("="*70)

df = pd.read_csv(os.path.join(DATA_DIR, 'model_training_data.csv'))
print(f"\n📊 Current features: {len(df.columns)}")

# ===== INTERACTION FEATURES (Domain Knowledge-Based) =====

features_added = 0

# 1. Rush hour + Disruption (critical combination - traffic worst when both true)
df['rush_hour_with_disruption'] = df['is_rush_hour'] * df['has_disruption']
features_added += 1

# 2. Weekend + Event (events on weekends have different impact than weekdays)
df['weekend_event'] = df['is_weekend'] * df['has_event']
features_added += 1

# 3. Morning rush + Roadwork (particularly disruptive to commuters)
if 'is_morning_rush' in df.columns:
    df['morning_rush_roadwork'] = df['is_morning_rush'] * df['has_roadwork']
    features_added += 1

# 4. Evening rush + Roadwork
if 'is_evening_rush' in df.columns:
    df['evening_rush_roadwork'] = df['is_evening_rush'] * df['has_roadwork']
    features_added += 1

# 5. Holiday + Any disruption (reduced traffic even with disruptions)
df['holiday_disruption'] = df['is_holiday'] * df['has_disruption']
features_added += 1

# 6. Peak rush + Heavy volume (if volume data available)
if 'total_volume' in df.columns and df['total_volume'].sum() > 0:
    volume_high = (df['total_volume'] > df['total_volume'].quantile(0.75)).astype(int)
    df['peak_high_volume'] = df['is_peak_rush'] * volume_high
    features_added += 1

# 7. Workday + Rush hours (commuter pattern)
if 'is_workday' in df.columns:
    if 'is_morning_rush' in df.columns:
        df['workday_morning_rush'] = df['is_workday'] * df['is_morning_rush']
        features_added += 1
    if 'is_evening_rush' in df.columns:
        df['workday_evening_rush'] = df['is_workday'] * df['is_evening_rush']
        features_added += 1

# 8. Road-specific rush hours (some roads worse during rush hour)
for road in ['road_Maharlika_Parian', 'road_Maharlika_Turbina', 'road_Calamba_Pagsanjan']:
    if road in df.columns:
        df[f'{road}_rush'] = df[road] * df['is_rush_hour']
        features_added += 1

# 9. Area-specific morning patterns
for area in ['area_Bucal', 'area_Parian', 'area_Turbina']:
    if area in df.columns:
        if 'is_morning_rush' in df.columns:
            df[f'{area}_morning'] = df[area] * df['is_morning_rush']
            features_added += 1
        df[f'{area}_disruption'] = df[area] * df['has_disruption']
        features_added += 1

# 10. Critical time-disruption interactions
if 'time_morning' in df.columns:
    df['morning_roadwork'] = df['time_morning'] * df['has_roadwork']
    df['morning_accident'] = df['time_morning'] * df['has_accident']
    features_added += 2

if 'time_afternoon' in df.columns:
    df['afternoon_event'] = df['time_afternoon'] * df['has_event']
    features_added += 1

if 'time_night' in df.columns:
    df['night_incident'] = df['time_night'] * df['has_incident']
    features_added += 1

# 11. Friday + Rush hour (Friday evening is particularly bad)
if 'is_friday' in df.columns:
    df['friday_rush'] = df['is_friday'] * df['is_rush_hour']
    features_added += 1

# 12. Super peak interactions
if 'is_super_peak' in df.columns:
    df['super_peak_disruption'] = df['is_super_peak'] * df['has_disruption']
    df['super_peak_roadwork'] = df['is_super_peak'] * df['has_roadwork']
    features_added += 2

print(f"\n✅ Added {features_added} interaction features")
print(f"📊 New total: {len(df.columns)} features")

# ===== SAVE =====

# Create backup
backup_path = os.path.join(DATA_DIR, 'model_training_data_before_interactions.csv')
if not os.path.exists(backup_path):
    original = pd.read_csv(os.path.join(DATA_DIR, 'model_training_data.csv'))
    original.to_csv(backup_path, index=False)
    print(f"\n💾 Backup saved: {backup_path}")

# Save enhanced dataset
df.to_csv(os.path.join(DATA_DIR, 'model_training_data.csv'), index=False)
print(f"💾 Enhanced dataset saved")

# ===== SUMMARY =====

print("\n" + "="*70)
print("📝 INTERACTION FEATURES SUMMARY")
print("="*70)

print(f"\n🎯 Why these features?")
print(f"   • Rush hour + Disruption: Compounds congestion effect")
print(f"   • Weekend events: Different traffic patterns")
print(f"   • Workday rush: Commuter-specific patterns")
print(f"   • Road-specific: Each road has unique characteristics")
print(f"   • Time-disruption: Impact varies by time of day")

print(f"\n🔍 Sample new features:")
new_features = [c for c in df.columns if c not in pd.read_csv(backup_path).columns]
for i, feat in enumerate(new_features[:15], 1):
    count = df[feat].sum()
    pct = (df[feat] > 0).sum() / len(df) * 100
    print(f"   {i:2}. {feat:40} - Active: {pct:.1f}% of records")

print(f"\n✅ Ready for retraining!")

print(f"\n   Expected gain: +1-2% accuracy from interactions")

print("\n" + "="*70)