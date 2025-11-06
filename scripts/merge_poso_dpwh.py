import pandas as pd
import os

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROCESSED_DIR = os.path.join(PROJECT_ROOT, 'data', 'processed')

print("="*60)
print("STEP 1: MERGING POSO + DPWH (KEEP ALL COLUMNS)")
print("="*60)

# Load data
print("\nLoading datasets...")
poso_df = pd.read_csv(os.path.join(PROCESSED_DIR, 'Final_fixed_POSO_Data.csv'))
dpwh_df = pd.read_csv(os.path.join(PROCESSED_DIR, 'Final_fixed_DPWH_Data.csv'))

print(f"POSO records: {len(poso_df)}")
print(f"POSO columns: {poso_df.columns.tolist()}")

print(f"\nDPWH records: {len(dpwh_df)}")
print(f"DPWH columns: {dpwh_df.columns.tolist()}")

# DPWH has multiple lanes per hour - we need to aggregate
print("\nAggregating DPWH data (summing volumes across all lanes)...")
dpwh_agg = dpwh_df.groupby(['date', 'hour', 'road_corridor', 'location']).agg({
    'total_volume': 'sum',  # Sum all lanes
    'direction': 'first',   # Keep first direction
    'day_of_week': 'first',
    'is_peak_am_time': 'first',
    'is_peak_pm_time': 'first'
}).reset_index()

print(f"DPWH after aggregation: {len(dpwh_agg)} records")

# Rename DPWH columns to avoid conflicts with POSO
dpwh_agg = dpwh_agg.rename(columns={
    'location': 'dpwh_location',
    'direction': 'dpwh_direction',
    'day_of_week': 'dpwh_day_of_week'
})

# Merge on: date + hour + road_corridor
print("\nMerging POSO + DPWH (keeping ALL columns)...")
merged_df = poso_df.merge(
    dpwh_agg,
    on=['date', 'hour', 'road_corridor'],
    how='left'  # Keep all POSO records, add DPWH data where available
)

print(f"\nMerged records: {len(merged_df)}")
print(f"Records with DPWH data: {merged_df['total_volume'].notna().sum()}")
print(f"Records without DPWH data: {merged_df['total_volume'].isna().sum()}")

# Show what columns we now have
print(f"\nAll columns after merge:")
for i, col in enumerate(merged_df.columns, 1):
    null_count = merged_df[col].isna().sum()
    print(f"  {i}. {col:25} - {null_count} nulls")

# Save WITHOUT filling nulls (keep them as-is)
output_path = os.path.join(PROCESSED_DIR, 'poso_dpwh_merged.csv')
merged_df.to_csv(output_path, index=False)

print(f"\n✓ Saved to: {output_path}")

print("\nSample of merged data (showing key columns):")
sample_cols = ['date', 'hour', 'area', 'status', 'total_volume', 'dpwh_location', 'road_corridor']
print(merged_df[sample_cols].head(10))

print("\n" + "="*60)
print("STEP 1 COMPLETE!")
print("="*60)
print("✓ All POSO columns kept")
print("✓ All DPWH columns added (with 'dpwh_' prefix to avoid conflicts)")
print("✓ Nulls preserved where data doesn't align")