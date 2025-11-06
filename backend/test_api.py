import requests
import json

BASE_URL = "http://localhost:5000"

print("="*70)
print("TESTING URBANFLOW API - WITH DELAY ESTIMATES")
print("="*70)

# Test 1: Health Check
print("\n1. Testing Health Check...")
response = requests.get(f"{BASE_URL}/api/health")
print(f"   Status: {response.status_code}")
if response.status_code == 200:
    result = response.json()
    print(f"   ✓ API is {result['status']}")
    print(f"   ✓ Model loaded: {result['model_loaded']}")
    print(f"   ✓ Accuracy: {result['model_info']['accuracy']}")

# Test 2: Single Prediction with Delay
print("\n2. Testing Single Prediction with Delay...")
test_data = {
    "date": "2025-01-13",
    "hour": 8,
    "area": "Bucal",
    "road_corridor": "Calamba_Pagsanjan",
    "has_disruption": 1,
    "disruption_type": "roadwork"
}
response = requests.post(f"{BASE_URL}/api/predict", json=test_data)
print(f"   Status: {response.status_code}")

if response.status_code == 200:
    result = response.json()
    if result['success']:
        pred = result['prediction']
        print(f"\n   📍 Prediction Results:")
        print(f"      Severity: {pred['severity_label']}")
        print(f"      Confidence: {pred['confidence']*100:.1f}%")
        
        # Check if delay_info exists
        if 'delay_info' in pred:
            delay = pred['delay_info']
            print(f"\n   ⏱️  Delay Estimates:")
            print(f"      Normal travel time: {delay['base_travel_time_min']} min")
            print(f"      With congestion: {delay['congested_travel_time_min']} min")
            print(f"      Additional delay: +{delay['additional_delay_min']} min")
            print(f"      Speed reduction: {delay['speed_reduction_percent']}%")
        else:
            print(f"\n   ⚠️  No delay information found!")

# Test 3: Full Disruption Simulation with Delays
print("\n3. Testing Disruption Simulation with Delays...")
sim_data = {
    "area": "Bucal",
    "road_corridor": "Calamba_Pagsanjan",
    "disruption_type": "roadwork",
    "start_date": "2025-01-13",
    "start_time": "06:00",
    "end_date": "2025-01-13",
    "end_time": "18:00",
    "description": "Road repair with delay estimates"
}
response = requests.post(f"{BASE_URL}/api/simulate-disruption", json=sim_data)
print(f"   Status: {response.status_code}")

if response.status_code == 200:
    result = response.json()
    if result['success']:
        print(f"\n   📊 Simulation Summary:")
        print(f"      Simulation ID: {result['simulation_id']}")
        print(f"      Total hours: {result['summary']['total_hours']}")
        print(f"      Duration: {result['summary']['duration_days']} days")
        
        print(f"\n   🚦 Traffic Distribution:")
        print(f"      Light:    {result['summary']['light_percentage']}%")
        print(f"      Moderate: {result['summary']['moderate_percentage']}%")
        print(f"      Heavy:    {result['summary']['heavy_percentage']}%")
        print(f"      Overall:  {result['summary']['avg_severity_label']}")
        
        # Check delays in hourly predictions
        print(f"\n   ⏱️  Sample Hourly Delays:")
        for i, pred in enumerate(result['hourly_predictions'][:5]):  # Show first 5 hours
            if 'delay_info' in pred:
                delay = pred['delay_info']
                print(f"      {pred['datetime']}: {pred['severity_label']:8} | Delay: +{delay['additional_delay_min']} min")
            else:
                print(f"      {pred['datetime']}: {pred['severity_label']:8} | ⚠️  No delay info")
        
        # Calculate average delay across all hours
        if 'delay_info' in result['hourly_predictions'][0]:
            total_delay = sum(p['delay_info']['additional_delay_min'] for p in result['hourly_predictions'])
            avg_delay = total_delay / len(result['hourly_predictions'])
            max_delay = max(p['delay_info']['additional_delay_min'] for p in result['hourly_predictions'])
            
            print(f"\n   📈 Delay Statistics:")
            print(f"      Average delay: +{avg_delay:.1f} min")
            print(f"      Maximum delay: +{max_delay:.1f} min")
            print(f"      Total delay (all hours): +{total_delay:.0f} min")

# Test 4: Get Recommendations
print("\n4. Testing Recommendations...")
rec_data = {
    "disruption_type": "roadwork",
    "avg_severity": 1.8,
    "heavy_percentage": 53.8,
    "peak_hours_affected": True
}
response = requests.post(f"{BASE_URL}/api/get-recommendations", json=rec_data)
print(f"   Status: {response.status_code}")

if response.status_code == 200:
    result = response.json()
    if result['success']:
        print(f"\n   💡 Mitigation Recommendations:")
        for i, rec in enumerate(result['recommendations'], 1):
            print(f"      {i}. [{rec['priority'].upper()}] {rec['recommendation']}")
            print(f"         Reason: {rec['reason']}")

print("\n" + "="*70)
print("✓ ALL TESTS COMPLETE!")
print("="*70)