import pandas as pd
import os

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROCESSED_DIR = os.path.join(PROJECT_ROOT, 'data', 'processed')

print("="*60)
print("EXAMINING CLEANED DATASETS")
print("="*60)

# 1. POSO Data
print("\n1. POSO DATA")
print("-"*60)
poso_path = os.path.join(PROCESSED_DIR, 'Final_fixed_POSO_Data.csv')
poso_df = pd.read_csv(poso_path)
print(f"Shape: {poso_df.shape}")
print(f"Columns: {poso_df.columns.tolist()}")
print(f"\nFirst 3 rows:")
print(poso_df.head(3))
print(f"\nDate range: {poso_df['timestamp'].min()} to {poso_df['timestamp'].max()}" if 'timestamp' in poso_df.columns else "No timestamp column")
print(f"Unique road corridors: {poso_df['road_corridor'].unique()}")
print(f"Records per corridor:")
for corridor in poso_df['road_corridor'].unique():
    count = len(poso_df[poso_df['road_corridor'] == corridor])
    print(f"  {corridor}: {count}")

# 2. DPWH Data
print("\n2. DPWH HOURLY VOLUME DATA")
print("-"*60)
dpwh_path = os.path.join(PROCESSED_DIR, 'Final_fixed_DPWH_Data.csv')
dpwh_df = pd.read_csv(dpwh_path)
print(f"Shape: {dpwh_df.shape}")
print(f"Columns: {dpwh_df.columns.tolist()}")
print(f"\nFirst 3 rows:")
print(dpwh_df.head(3))
print(f"\nDate range: {dpwh_df['date'].min()} to {dpwh_df['date'].max()}" if 'date' in dpwh_df.columns else "No date column")
print(f"Unique road corridors: {dpwh_df['road_corridor'].unique()}")
print(f"Records per corridor:")
for corridor in dpwh_df['road_corridor'].unique():
    count = len(dpwh_df[dpwh_df['road_corridor'] == corridor])
    print(f"  {corridor}: {count}")

# 3. Disruptions Data
print("\n3. DISRUPTIONS DATA")
print("-"*60)
disruption_path = os.path.join(PROCESSED_DIR, 'Final_fixed_Disruptions_Data.csv')
disruption_df = pd.read_csv(disruption_path)
print(f"Shape: {disruption_df.shape}")
print(f"Columns: {disruption_df.columns.tolist()}")
print(f"\nFirst 3 rows:")
print(disruption_df.head(3))
print(f"\nDate range: {disruption_df['date_start'].min()} to {disruption_df['date_end'].max()}")
print(f"Unique road corridors: {disruption_df['road_corridor'].unique()}")
print(f"Records per corridor:")
for corridor in disruption_df['road_corridor'].unique():
    count = len(disruption_df[disruption_df['road_corridor'] == corridor])
    print(f"  {corridor}: {count}")
print(f"\nDisruption types:")
for dtype in disruption_df['disruption_type'].unique():
    count = len(disruption_df[disruption_df['disruption_type'] == dtype])
    print(f"  {dtype}: {count}")

print("\n" + "="*60)
print("SUMMARY")
print("="*60)
print(f"POSO records: {len(poso_df)}")
print(f"DPWH records: {len(dpwh_df)}")
print(f"Disruption records: {len(disruption_df)}")
print("\nReady to merge!")