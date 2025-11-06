from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from models.predictor import TrafficPredictor
from datetime import datetime, timedelta
import pandas as pd

app = Flask(__name__)
# CRITICAL: Configure CORS to allow Next.js (port 3000)
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:3000", "http://127.0.0.1:3000"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

# Initialize the predictor (load model once when app starts)
print("Loading trained model...")
predictor = TrafficPredictor()
print("✓ Model loaded and ready!")

# ============================================================
# ROUTE 1: Home Page
# ============================================================

@app.route('/')
def home():
    """Render the main page"""
    return render_template('index.html')

# ============================================================
# ROUTE 2: Health Check (Test if API is working)
# ============================================================

@app.route('/api/health', methods=['GET'])
def health_check():
    """Check if API and model are loaded"""
    return jsonify({
        'status': 'healthy',
        'model_loaded': True,
        'model_info': {
            'accuracy': f"{predictor.model_info['accuracy']*100:.2f}%",
            'mae': f"{predictor.model_info['mae']:.4f}",
            'features': predictor.model_info['n_features']
        }
    })

# ============================================================
# ROUTE 3: Get Road Info from Coordinates
# ============================================================

@app.route('/api/get-road-info', methods=['POST'])
def get_road_info():
    """
    Convert clicked lat/lon to road segment information
    
    Request JSON:
    {
        "lat": 14.189422,
        "lon": 121.169146
    }
    
    Returns:
    {
        "area": "Bucal",
        "road_corridor": "Calamba_Pagsanjan",
        "road_name": "Calamba-Pagsanjan Road"
    }
    """
    
    data = request.get_json()
    lat = data.get('lat')
    lon = data.get('lon')
    
    # Simple mapping based on coordinates
    # TODO: Replace with proper spatial matching using GeoPandas
    
    # Define approximate bounding boxes for each area
    areas = {
        'Bucal': {
            'lat_range': (14.18, 14.20),
            'lon_range': (121.16, 121.18),
            'road_corridor': 'Calamba_Pagsanjan',
            'road_name': 'Calamba-Pagsanjan Road'
        },
        'Parian': {
            'lat_range': (14.21, 14.22),
            'lon_range': (121.14, 121.16),
            'road_corridor': 'Maharlika_Parian',
            'road_name': 'Maharlika Highway (Parian Section)'
        },
        'Turbina': {
            'lat_range': (14.18, 14.19),
            'lon_range': (121.13, 121.15),
            'road_corridor': 'Maharlika_Turbina',
            'road_name': 'Maharlika Highway (Turbina Section)'
        }
    }
    
    # Find matching area
    for area_name, area_info in areas.items():
        lat_min, lat_max = area_info['lat_range']
        lon_min, lon_max = area_info['lon_range']
        
        if lat_min <= lat <= lat_max and lon_min <= lon <= lon_max:
            return jsonify({
                'success': True,
                'area': area_name,
                'road_corridor': area_info['road_corridor'],
                'road_name': area_info['road_name'],
                'coordinates': {'lat': lat, 'lon': lon}
            })
    
    # Default if not found
    return jsonify({
        'success': False,
        'message': 'Location not in covered area',
        'coordinates': {'lat': lat, 'lon': lon}
    })

# ============================================================
# ROUTE 4: Single Prediction (for testing)
# ============================================================

@app.route('/api/predict', methods=['POST'])
def predict_single():
    """
    Make a single prediction
    
    Request JSON:
    {
        "date": "2025-01-13",
        "hour": 8,
        "area": "Bucal",
        "road_corridor": "Calamba_Pagsanjan",
        "has_disruption": 1,
        "disruption_type": "roadwork",
        "total_volume": 0
    }
    
    Returns:
    {
        "severity": 2,
        "severity_label": "Heavy",
        "confidence": 0.85,
        "probabilities": {...}
    }
    """
    
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['date', 'hour', 'area', 'road_corridor']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'error': f'Missing required field: {field}'
                }), 400
        
        # Make prediction
        result = predictor.predict(data)

        # ADD THIS (after the prediction):
        # Calculate delay estimate
        delay_info = predictor.estimate_delay(
            severity=result['severity'],
            base_travel_time_minutes=10,
            road_length_km=5
        )
        result['delay_info'] = delay_info
        
        return jsonify({
            'success': True,
            'prediction': result,
            'input': data
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
   
# ============================================================
# ROUTE 5: Simulate Disruption (Main Feature!)
# ============================================================

@app.route('/api/simulate-disruption', methods=['POST'])
def simulate_disruption():
    """
    Simulate traffic for a disruption over its entire duration
    
    Request JSON:
    {
        "area": "Bucal",
        "road_corridor": "Calamba_Pagsanjan",
        "disruption_type": "roadwork",
        "start_date": "2025-01-13",
        "start_time": "06:00",
        "end_date": "2025-01-15",
        "end_time": "18:00",
        "description": "Road repair",
        "coordinates": {"lat": 14.189, "lon": 121.169}
    }
    
    Returns:
    {
        "success": true,
        "simulation_id": "sim_20250113_083045",
        "summary": {
            "total_hours": 36,
            "light_hours": 10,
            "moderate_hours": 15,
            "heavy_hours": 11,
            "avg_severity": 1.5
        },
        "hourly_predictions": [
            {
                "datetime": "2025-01-13 06:00",
                "hour": 6,
                "severity": 1,
                "severity_label": "Moderate",
                "confidence": 0.82
            },
            ...
        ],
        "time_segments": {
            "morning": {"light": 3, "moderate": 5, "heavy": 4},
            "afternoon": {...},
            "night": {...}
        }
    }
    """
    
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['area', 'road_corridor', 'disruption_type', 
                          'start_date', 'start_time', 'end_date', 'end_time']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'error': f'Missing required field: {field}'
                }), 400
        
        # Parse dates and times
        start_datetime = datetime.strptime(
            f"{data['start_date']} {data['start_time']}", 
            "%Y-%m-%d %H:%M"
        )
        end_datetime = datetime.strptime(
            f"{data['end_date']} {data['end_time']}", 
            "%Y-%m-%d %H:%M"
        )
        
        # Generate hourly predictions for entire duration
        hourly_predictions = []
        current_datetime = start_datetime
        
        while current_datetime <= end_datetime:
            # Prepare input for this hour
            hour_input = {
                'date': current_datetime.strftime('%Y-%m-%d'),
                'hour': current_datetime.hour,
                'area': data['area'],
                'road_corridor': data['road_corridor'],
                'has_disruption': 1,
                'disruption_type': data['disruption_type'],
                'total_volume': data.get('total_volume', 0),
                'has_real_status': 0  # Since this is a simulation
            }
            
            # Make prediction
            prediction = predictor.predict(hour_input)
            
            # Add to results
            hourly_predictions.append({
                'datetime': current_datetime.strftime('%Y-%m-%d %H:%M'),
                'date': current_datetime.strftime('%Y-%m-%d'),
                'hour': current_datetime.hour,
                'day_of_week': current_datetime.strftime('%A'),
                'severity': prediction['severity'],
                'severity_label': prediction['severity_label'],
                'confidence': round(prediction['confidence'], 3),
                'probabilities': {
                    k: round(v, 3) for k, v in prediction['probabilities'].items()
                }
            })
            
            # Move to next hour
            current_datetime += timedelta(hours=1)
        
        # Calculate summary statistics
        total_hours = len(hourly_predictions)
        light_hours = sum(1 for p in hourly_predictions if p['severity'] == 0)
        moderate_hours = sum(1 for p in hourly_predictions if p['severity'] == 1)
        heavy_hours = sum(1 for p in hourly_predictions if p['severity'] == 2)
        avg_severity = sum(p['severity'] for p in hourly_predictions) / total_hours
        
        # Calculate time segment breakdown
        time_segments = {
            'morning': {'light': 0, 'moderate': 0, 'heavy': 0},
            'afternoon': {'light': 0, 'moderate': 0, 'heavy': 0},
            'night': {'light': 0, 'moderate': 0, 'heavy': 0}
        }
        
        for pred in hourly_predictions:
            hour = pred['hour']
            severity_label = pred['severity_label'].lower()
            
            if 6 <= hour <= 11:
                time_segments['morning'][severity_label] += 1
            elif 12 <= hour <= 17:
                time_segments['afternoon'][severity_label] += 1
            else:
                time_segments['night'][severity_label] += 1
        
        # Add this to app.py in the simulate_disruption route
        # After making prediction, calculate delay
        for pred in hourly_predictions:
            delay_info = predictor.estimate_delay(
                severity=pred['severity'],
                base_travel_time_minutes=10,  # Can be customized per road
                road_length_km=5
            )
            pred['delay_info'] = delay_info

        # Generate simulation ID
        simulation_id = f"sim_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        # Prepare response
        response = {
            'success': True,
            'simulation_id': simulation_id,
            'input': {
                'area': data['area'],
                'road_corridor': data['road_corridor'],
                'disruption_type': data['disruption_type'],
                'start': start_datetime.strftime('%Y-%m-%d %H:%M'),
                'end': end_datetime.strftime('%Y-%m-%d %H:%M'),
                'description': data.get('description', ''),
                'coordinates': data.get('coordinates', {})
            },
            'summary': {
                'total_hours': total_hours,
                'duration_days': round((end_datetime - start_datetime).total_seconds() / 86400, 1),
                'light_hours': light_hours,
                'moderate_hours': moderate_hours,
                'heavy_hours': heavy_hours,
                'light_percentage': round(light_hours / total_hours * 100, 1),
                'moderate_percentage': round(moderate_hours / total_hours * 100, 1),
                'heavy_percentage': round(heavy_hours / total_hours * 100, 1),
                'avg_severity': round(avg_severity, 2),
                'avg_severity_label': 'Light' if avg_severity < 0.5 else ('Moderate' if avg_severity < 1.5 else 'Heavy')
            },
            'hourly_predictions': hourly_predictions,
            'time_segments': time_segments
        }
        
        return jsonify(response)
        
    except Exception as e:
        import traceback
        return jsonify({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500

# ============================================================
# ROUTE 6: Get Mitigation Recommendations
# ============================================================

@app.route('/api/get-recommendations', methods=['POST'])
def get_recommendations():
    """
    Get mitigation recommendations based on simulation results
    
    Request JSON:
    {
        "disruption_type": "roadwork",
        "avg_severity": 1.8,
        "heavy_percentage": 45,
        "peak_hours_affected": true
    }
    
    Returns recommendations
    """
    
    data = request.get_json()
    disruption_type = data.get('disruption_type', 'roadwork')
    avg_severity = data.get('avg_severity', 1.0)
    heavy_percentage = data.get('heavy_percentage', 0)
    
    recommendations = []
    
    # General recommendations
    if avg_severity > 1.5:
        recommendations.append({
            'priority': 'high',
            'category': 'scheduling',
            'recommendation': 'Consider rescheduling to off-peak hours or weekends',
            'reason': 'High average congestion severity predicted'
        })
    
    if heavy_percentage > 30:
        recommendations.append({
            'priority': 'high',
            'category': 'traffic_management',
            'recommendation': 'Deploy traffic enforcers during peak hours',
            'reason': f'{heavy_percentage}% of hours will have heavy congestion'
        })
    
    # Disruption-specific recommendations
    if disruption_type == 'roadwork':
        recommendations.append({
            'priority': 'medium',
            'category': 'communication',
            'recommendation': 'Post advance notices 1 week before start date',
            'reason': 'Allow commuters to plan alternate routes'
        })
        
        recommendations.append({
            'priority': 'medium',
            'category': 'infrastructure',
            'recommendation': 'Set up clear detour signage',
            'reason': 'Guide drivers to alternate routes'
        })
    
    elif disruption_type == 'event':
        recommendations.append({
            'priority': 'high',
            'category': 'traffic_management',
            'recommendation': 'Implement temporary one-way traffic scheme',
            'reason': 'Manage event-related traffic flow'
        })
    
    return jsonify({
        'success': True,
        'recommendations': recommendations
    })

# ============================================================
# RUN APP
# ============================================================

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
