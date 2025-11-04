import pandas as pd
import numpy as np
from pathlib import Path

# Define paths
DATA_DIR = Path("data")
PROCESSED_DIR = DATA_DIR / "processed"
FINAL_DIR = DATA_DIR / "final"

# Create final directory if it doesn't exist
FINAL_DIR.mkdir(parents=True, exist_ok=True)

# Load cleaned datasets
print("Loading cleaned datasets...")
poso_df = pd.read_csv(PROCESSED_DIR / "Final_fixed_POSO_Data.csv")
dpwh_df = pd.read_csv(PROCESSED_DIR / "Final_fixed_DPWH_Data.csv")
disruptions_df = pd.read_csv(PROCESSED_DIR / "Final_fixed_Disruptions_Data.csv")

# Convert date columns to datetime
poso_df['date'] = pd.to_datetime(poso_df['date'])
dpwh_df['date'] = pd.to_datetime(dpwh_df['date'])
disruptions_df['date_start'] = pd.to_datetime(disruptions_df['date_start'])
disruptions_df['date_end'] = pd.to_datetime(disruptions_df['date_end'])

print("\n" + "="*60)
print("STEP 1: MERGE POSO AND DPWH DATA")
print("="*60)

# Merge POSO and DPWH on date, hour, and road_corridor
merged_df = pd.merge(
    poso_df,
    dpwh_df,
    on=['date', 'hour', 'road_corridor'],
    how='left',
    suffixes=('_poso', '_dpwh')
)

print(f"After merging POSO and DPWH: {len(merged_df)} records")
print(f"Columns: {merged_df.columns.tolist()}")

# Consolidate duplicate columns
if 'day_of_week_poso' in merged_df.columns and 'day_of_week_dpwh' in merged_df.columns:
    merged_df['day_of_week'] = merged_df['day_of_week_poso'].fillna(merged_df['day_of_week_dpwh'])
    merged_df.drop(['day_of_week_poso', 'day_of_week_dpwh'], axis=1, inplace=True)

print("\n" + "="*60)
print("STEP 2: ADD DISRUPTION FLAGS")
print("="*60)

# Initialize disruption columns
merged_df['has_disruption'] = 0
merged_df['disruption_type'] = 'none'
merged_df['disruption_description'] = ''

# For each disruption, mark affected dates
for _, disruption in disruptions_df.iterrows():
    mask = (
        (merged_df['date'] >= disruption['date_start']) &
        (merged_df['date'] <= disruption['date_end']) &
        (merged_df['road_corridor'] == disruption['road_corridor'])
    )
    
    merged_df.loc[mask, 'has_disruption'] = 1
    merged_df.loc[mask, 'disruption_type'] = disruption['disruption_type']
    merged_df.loc[mask, 'disruption_description'] = disruption['description']

disruption_count = merged_df['has_disruption'].sum()
print(f"Records with disruptions: {disruption_count} ({disruption_count/len(merged_df)*100:.2f}%)")
print(f"\nDisruption type distribution:")
print(merged_df['disruption_type'].value_counts())

print("\n" + "="*60)
print("STEP 3: FEATURE ENGINEERING")
print("="*60)

# Add temporal features
merged_df['month'] = merged_df['date'].dt.month
merged_df['day_of_month'] = merged_df['date'].dt.day
merged_df['is_weekend'] = merged_df['day_of_week'].isin(['Saturday', 'Sunday']).astype(int)

# Add time-of-day categories
def categorize_time(hour):
    if 6 <= hour < 9:
        return 'morning_rush'
    elif 9 <= hour < 12:
        return 'morning'
    elif 12 <= hour < 14:
        return 'lunch'
    elif 14 <= hour < 17:
        return 'afternoon'
    elif 17 <= hour < 20:
        return 'evening_rush'
    elif 20 <= hour < 24:
        return 'night'
    else:
        return 'early_morning'

merged_df['time_category'] = merged_df['hour'].apply(categorize_time)

# Encode traffic status as numeric severity
status_encoding = {
    'light': 0,
    'moderate': 1,
    'heavy': 2
}
merged_df['status_encoded'] = merged_df['status'].map(status_encoding)

# Create rush hour flag
merged_df['is_rush_hour'] = merged_df['time_category'].isin(['morning_rush', 'evening_rush']).astype(int)

# Add peak indicators from DPWH data (if available)
if 'is_peak_am_time' in merged_df.columns:
    merged_df['is_peak_am'] = (merged_df['is_peak_am_time'] == 'yes').astype(int)
    merged_df['is_peak_pm'] = (merged_df['is_peak_pm_time'] == 'yes').astype(int)
    merged_df.drop(['is_peak_am_time', 'is_peak_pm_time'], axis=1, inplace=True)

# Add Philippine holidays (simple version - you can expand this)
holidays_2024 = [
    '2024-01-01', '2024-03-28', '2024-03-29', '2024-04-09', '2024-05-01',
    '2024-06-12', '2024-08-21', '2024-08-26', '2024-11-01', '2024-11-30',
    '2024-12-08', '2024-12-25', '2024-12-30'
]
holidays_2025 = [
    '2025-01-01', '2025-04-17', '2025-04-18', '2025-05-01', '2025-06-12',
    '2025-08-21', '2025-08-25', '2025-11-01', '2025-11-30', '2025-12-08',
    '2025-12-25', '2025-12-30'
]
all_holidays = holidays_2024 + holidays_2025
merged_df['is_holiday'] = merged_df['date'].dt.strftime('%Y-%m-%d').isin(all_holidays).astype(int)

print("Added temporal features:")
print(f"  - month, day_of_month")
print(f"  - is_weekend, is_rush_hour, is_holiday")
print(f"  - time_category")
print(f"  - status_encoded")

print("\n" + "="*60)
print("STEP 4: AGGREGATE VOLUME DATA BY CORRIDOR AND HOUR")
print("="*60)

# Aggregate DPWH volume by corridor, date, and hour
if 'total_volume' in merged_df.columns:
    volume_agg = merged_df.groupby(['road_corridor', 'date', 'hour'])['total_volume'].agg([
        ('avg_volume', 'mean'),
        ('total_volume', 'sum'),
        ('volume_count', 'count')
    ]).reset_index()
    
    # Merge aggregated volume back
    merged_df = merged_df.drop('total_volume', axis=1, errors='ignore')
    merged_df = pd.merge(
        merged_df,
        volume_agg,
        on=['road_corridor', 'date', 'hour'],
        how='left'
    )
    
    print(f"Volume statistics added")
    print(f"  - avg_volume, total_volume, volume_count")

print("\n" + "="*60)
print("STEP 5: CREATE LAGGED FEATURES (for time-series)")
print("="*60)

# Sort by corridor, date, hour
merged_df = merged_df.sort_values(['road_corridor', 'date', 'hour'])

# Create lagged features for status
for lag in [1, 2, 3, 24]:  # Previous hour, 2 hours, 3 hours, and same hour yesterday
    merged_df[f'status_lag_{lag}h'] = merged_df.groupby('road_corridor')['status_encoded'].shift(lag)

# Create rolling averages for volume (if available)
if 'avg_volume' in merged_df.columns:
    for window in [3, 6, 24]:  # 3-hour, 6-hour, and 24-hour windows
        merged_df[f'volume_rolling_avg_{window}h'] = (
            merged_df.groupby('road_corridor')['avg_volume']
            .transform(lambda x: x.rolling(window=window, min_periods=1).mean())
        )

print("Lagged features created:")
print(f"  - status_lag_1h, status_lag_2h, status_lag_3h, status_lag_24h")
if 'avg_volume' in merged_df.columns:
    print(f"  - volume_rolling_avg_3h, volume_rolling_avg_6h, volume_rolling_avg_24h")

print("\n" + "="*60)
print("STEP 6: HANDLE MISSING VALUES")
print("="*60)

# Check missing values
missing_summary = merged_df.isnull().sum()
missing_summary = missing_summary[missing_summary > 0]

if len(missing_summary) > 0:
    print("Missing values detected:")
    print(missing_summary)
    
    # Fill lagged features with forward fill (assuming similar patterns)
    lag_cols = [col for col in merged_df.columns if 'lag' in col or 'rolling' in col]
    for col in lag_cols:
        merged_df[col] = merged_df.groupby('road_corridor')[col].fillna(method='ffill')
    
    # Fill any remaining numerical missing values with 0
    numeric_cols = merged_df.select_dtypes(include=[np.number]).columns
    merged_df[numeric_cols] = merged_df[numeric_cols].fillna(0)
    
    print("\nMissing values handled")
else:
    print("No missing values detected")

print("\n" + "="*60)
print("STEP 7: SAVE FINAL DATASET")
print("="*60)

# Save the complete merged dataset
final_path = FINAL_DIR / "training_dataset.csv"
merged_df.to_csv(final_path, index=False)
print(f"✓ Saved complete dataset: {final_path}")
print(f"  Shape: {merged_df.shape}")

# Create a summary of features
feature_summary = pd.DataFrame({
    'Feature': merged_df.columns,
    'Type': merged_df.dtypes,
    'Missing': merged_df.isnull().sum(),
    'Unique': merged_df.nunique()
})
summary_path = FINAL_DIR / "feature_summary.csv"
feature_summary.to_csv(summary_path, index=False)
print(f"✓ Saved feature summary: {summary_path}")

# Save a separate dataset for each corridor (useful for corridor-specific models)
for corridor in merged_df['road_corridor'].unique():
    corridor_df = merged_df[merged_df['road_corridor'] == corridor]
    corridor_path = FINAL_DIR / f"training_dataset_{corridor.lower()}.csv"
    corridor_df.to_csv(corridor_path, index=False)
    print(f"✓ Saved {corridor} dataset: {corridor_path} ({len(corridor_df)} records)")

print("\n" + "="*60)
print("FINAL DATASET SUMMARY")
print("="*60)
print(f"Total records: {len(merged_df)}")
print(f"Date range: {merged_df['date'].min()} to {merged_df['date'].max()}")
print(f"Total features: {len(merged_df.columns)}")
print(f"\nTarget variable distribution (status):")
print(merged_df['status'].value_counts())
print(f"\nDisruption coverage:")
print(f"  Records with disruptions: {merged_df['has_disruption'].sum()}")
print(f"  Records without disruptions: {(1 - merged_df['has_disruption']).sum()}")

# Show sample of final dataset
print(f"\nFirst 5 rows of final dataset:")
print(merged_df.head())

print("\n" + "="*60)
print("MERGE COMPLETE!")
print("="*60)
print(f"\nYour training dataset is ready at: {final_path}")
print("You can now proceed to model training!")