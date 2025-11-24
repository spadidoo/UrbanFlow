import pandas as pd
import os

DATA_DIR = 'data/final'
df = pd.read_csv(os.path.join(DATA_DIR, 'model_training_data.csv'))

print("="*70)
print("TRAINING DATA DISTRIBUTION ANALYSIS")
print("="*70)

# Check overall severity distribution
print("\n📊 Overall Severity Distribution:")
print(df['congestion_severity'].value_counts().sort_index())
print("\nPercentages:")
print(df['congestion_severity'].value_counts(normalize=True).sort_index() * 100)

# Check by hour
print("\n⏰ Severity Distribution by Hour:")
hour_severity = df.groupby('hour')['congestion_severity'].value_counts().unstack(fill_value=0)
print(hour_severity)

# Check nighttime specifically
print("\n🌙 Nighttime (22:00-05:00) Distribution:")
nighttime = df[df['hour'].isin([22, 23, 0, 1, 2, 3, 4, 5])]
print(nighttime['congestion_severity'].value_counts().sort_index())
print("\nPercentages:")
print(nighttime['congestion_severity'].value_counts(normalize=True).sort_index() * 100)

# Check with/without disruption
print("\n🚧 With vs Without Disruption:")
print("\nWITH Disruption:")
with_disr = df[df['has_disruption'] == 1]
print(with_disr['congestion_severity'].value_counts().sort_index())

print("\nWITHOUT Disruption:")
no_disr = df[df['has_disruption'] == 0]
print(no_disr['congestion_severity'].value_counts().sort_index())

# Check if nighttime has disruptions
print("\n🌙 Nighttime WITH disruptions:")
nighttime_disr = df[(df['hour'].isin([22, 23, 0, 1, 2, 3, 4, 5])) & (df['has_disruption'] == 1)]
print(f"Count: {len(nighttime_disr)}")
if len(nighttime_disr) > 0:
    print(nighttime_disr['congestion_severity'].value_counts().sort_index())