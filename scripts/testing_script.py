import sys
import os

# Add project root to Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.models.predictor import TrafficPredictor

predictor = TrafficPredictor()

print("="*70)
print("TESTING ALL 24 HOURS - NO DISRUPTION")
print("="*70)

test_hours = [
    (0, "Midnight"),
    (3, "3 AM"),
    (6, "6 AM"),
    (8, "8 AM - Rush"),
    (10, "10 AM - Off-peak"),
    (12, "Noon"),
    (14, "2 PM"),
    (17, "5 PM - Rush"),
    (18, "6 PM - Rush"),
    (20, "8 PM"),
    (22, "10 PM"),
    (23, "11 PM")
]

for hour, label in test_hours:
    test_input = {
        'date': '2025-01-15',
        'hour': hour,
        'area': 'Bucal',
        'road_corridor': 'Calamba_Pagsanjan',
        'has_disruption': 0,
        'disruption_type': None,
        'total_volume': 0,
        'has_real_status': 0
    }
    
    result = predictor.predict(test_input)
    
    print(f"\n{label:15} → {result['severity_label']:8} (confidence: {result['confidence']*100:.1f}%)")

print("\n" + "="*70)
print("TESTING NIGHTTIME WITH DISRUPTION")
print("="*70)

test_input = {
    'date': '2025-01-15',
    'hour': 23,
    'area': 'Bucal',
    'road_corridor': 'Calamba_Pagsanjan',
    'has_disruption': 1,
    'disruption_type': 'roadwork',
    'total_volume': 0,
    'has_real_status': 0
}

result = predictor.predict(test_input)
print(f"\n11 PM + Roadwork → {result['severity_label']} (confidence: {result['confidence']*100:.1f}%)")
