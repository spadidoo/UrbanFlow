# backend/app.py - COMPLETE VERSION
# Replace your entire app.py with this file

from dotenv import load_dotenv
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from models.predictor import TrafficPredictor
from datetime import datetime, timedelta
import pandas as pd
from services.traffic_api import TrafficAPIService

load_dotenv()

app = Flask(__name__)
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:3000", "http://127.0.0.1:3000"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

print("Loading trained model...")
predictor = TrafficPredictor()
print("✓ Model loaded and ready!")

# After creating the app
traffic_service = TrafficAPIService()

print("Loading traffic API service...")
traffic_service = TrafficAPIService()
print("✓ Traffic API service ready!")

# ============================================================
# NEW ROUTE: Get Real-Time Traffic for Location
# ============================================================

@app.route('/api/realtime-traffic', methods=['POST'])
def get_realtime_traffic():
    """
    Get current real-time traffic data for a specific location
    """
    try:
        data = request.get_json()
        lat = data.get('lat')
        lng = data.get('lng')
        
        if not lat or not lng:
            return jsonify({
                'success': False,
                'error': 'Missing lat/lng'
            }), 400
        
        # Fetch real-time traffic
        traffic_data = traffic_service.get_traffic_flow(lat, lng)
        
        return jsonify(traffic_data)
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# ============================================================
# NEW ROUTE: Get Traffic for Road Segments
# ============================================================

@app.route('/api/realtime-road-traffic', methods=['POST'])
def get_road_traffic():
    """
    Get real-time traffic for multiple points along a road
    """
    try:
        data = request.get_json()
        coordinates = data.get('coordinates', [])
        
        if not coordinates:
            return jsonify({
                'success': False,
                'error': 'No coordinates provided'
            }), 400
        
        # Sample coordinates (e.g., every 5th point to avoid API limits)
        sampled_coords = coordinates[::5]  # Every 5th point
        
        # Get traffic for sampled points
        traffic_results = traffic_service.get_multiple_segments(sampled_coords)
        
        # Calculate average congestion
        valid_results = [r for r in traffic_results if r.get('success')]
        if valid_results:
            avg_congestion = sum(r.get('congestion_ratio', 0) for r in valid_results) / len(valid_results)
            avg_speed = sum(r.get('current_speed', 0) for r in valid_results) / len(valid_results)
        else:
            avg_congestion = 0
            avg_speed = 0
        
        return jsonify({
            'success': True,
            'segments': traffic_results,
            'summary': {
                'avg_congestion_ratio': avg_congestion,
                'avg_current_speed': avg_speed,
                'total_segments_checked': len(sampled_coords),
                'successful_checks': len(valid_results)
            }
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# ============================================================
# UPDATED: Simulation with Real-Time Data Integration
# ============================================================

@app.route('/api/simulate-disruption-realtime', methods=['POST'])
def simulate_disruption_realtime():
    """
    Enhanced simulation that incorporates real-time traffic data
    """
    try:
        data = request.get_json()
        
        # Get basic simulation parameters
        area = data.get('area', 'Unknown')
        road_corridor = data.get('road_corridor', 'Unknown')
        disruption_type = data.get('disruption_type')
        start_datetime = datetime.strptime(
            f"{data['start_date']} {data['start_time']}", 
            "%Y-%m-%d %H:%M"
        )
        end_datetime = datetime.strptime(
            f"{data['end_date']} {data['end_time']}", 
            "%Y-%m-%d %H:%M"
        )
        
        road_info = data.get('road_info', {})
        coordinates = data.get('coordinates', {})
        
        # ✅ FETCH REAL-TIME TRAFFIC
        realtime_data = traffic_service.get_traffic_flow(
            coordinates.get('lat'),
            coordinates.get('lng')
        )
        
        # Extract current conditions
        current_congestion = 0
        speed_factor = 1.0
        
        if realtime_data.get('success'):
            current_congestion = realtime_data.get('congestion_ratio', 0)
            current_speed = realtime_data.get('current_speed', 40)
            free_flow_speed = realtime_data.get('free_flow_speed', 40)
            speed_factor = current_speed / free_flow_speed if free_flow_speed > 0 else 1.0
        
        # Run simulation with ML model (existing code)
        hourly_predictions = []
        current_datetime = start_datetime
        
        while current_datetime <= end_datetime:
            hour_input = {
                'date': current_datetime.strftime('%Y-%m-%d'),
                'hour': current_datetime.hour,
                'area': area,
                'road_corridor': road_corridor,
                'has_disruption': 1,
                'disruption_type': disruption_type,
                'total_volume': data.get('total_volume', 0),
                'has_real_status': 0
            }
            
            # Make prediction
            prediction = predictor.predict(hour_input)
            
            # ✅ ADJUST PREDICTION BASED ON REAL-TIME CONDITIONS
            # If current traffic is already bad, increase severity
            adjusted_severity = prediction['severity']
            if current_congestion > 0:
                adjusted_severity = min(2, prediction['severity'] + (current_congestion * 0.3))
            
            # Calculate delay
            delay_info = predictor.estimate_delay(
                severity=adjusted_severity,
                base_travel_time_minutes=road_info.get('free_flow_time_minutes', 10),
                road_length_km=road_info.get('length_km', 1.0),
                impact_factor=road_info.get('disruption_factors', {}).get(disruption_type, 0.6)
            )
            
            # Apply real-time speed factor
            delay_info['additional_delay_min'] = delay_info['additional_delay_min'] / speed_factor
            
            hourly_predictions.append({
                'datetime': current_datetime.strftime('%Y-%m-%d %H:%M'),
                'date': current_datetime.strftime('%Y-%m-%d'),
                'hour': current_datetime.hour,
                'day_of_week': current_datetime.strftime('%A'),
                'severity': adjusted_severity,
                'severity_label': 'Light' if adjusted_severity < 0.5 else ('Moderate' if adjusted_severity < 1.5 else 'Heavy'),
                'confidence': round(prediction['confidence'], 3),
                'delay_info': delay_info,
                'realtime_adjusted': realtime_data.get('success', False),
                'probabilities': {
                    k: round(v, 3) for k, v in prediction['probabilities'].items()
                }
            })
            
            current_datetime += timedelta(hours=1)
        
        # Calculate summary (existing code)
        total_hours = len(hourly_predictions)
        light_hours = sum(1 for p in hourly_predictions if p['severity'] < 0.5)
        moderate_hours = sum(1 for p in hourly_predictions if 0.5 <= p['severity'] < 1.5)
        heavy_hours = sum(1 for p in hourly_predictions if p['severity'] >= 1.5)
        avg_severity = sum(p['severity'] for p in hourly_predictions) / total_hours
        avg_delay = sum(p['delay_info']['additional_delay_min'] for p in hourly_predictions) / total_hours
        
        # Time segments
        time_segments = {
            'morning': {'light': 0, 'moderate': 0, 'heavy': 0},
            'afternoon': {'light': 0, 'moderate': 0, 'heavy': 0},
            'night': {'light': 0, 'moderate': 0, 'heavy': 0}
        }
        
        for pred in hourly_predictions:
            hour = pred['hour']
            if pred['severity'] < 0.5:
                sev_label = 'light'
            elif pred['severity'] < 1.5:
                sev_label = 'moderate'
            else:
                sev_label = 'heavy'
            
            if 6 <= hour <= 11:
                time_segments['morning'][sev_label] += 1
            elif 12 <= hour <= 17:
                time_segments['afternoon'][sev_label] += 1
            else:
                time_segments['night'][sev_label] += 1
        
        simulation_id = f"sim_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        return jsonify({
            'success': True,
            'simulation_id': simulation_id,
            'realtime_integration': {
                'enabled': realtime_data.get('success', False),
                'current_congestion': current_congestion,
                'current_speed': realtime_data.get('current_speed', 0),
                'timestamp': realtime_data.get('timestamp')
            },
            'input': {
                'area': area,
                'road_corridor': road_corridor,
                'disruption_type': disruption_type,
                'start': start_datetime.strftime('%Y-%m-%d %H:%M'),
                'end': end_datetime.strftime('%Y-%m-%d %H:%M'),
                'coordinates': coordinates,
                'road_info': road_info
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
                'avg_severity_label': 'Light' if avg_severity < 0.5 else ('Moderate' if avg_severity < 1.5 else 'Heavy'),
                'avg_delay_minutes': round(avg_delay, 1),
                'total_delay_hours': round(sum(p['delay_info']['additional_delay_min'] for p in hourly_predictions) / 60, 1)
            },
            'hourly_predictions': hourly_predictions,
            'time_segments': time_segments
        })
        
    except Exception as e:
        import traceback
        return jsonify({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500

# ============================================================
# ROUTE 1: Home Page
# ============================================================

@app.route('/')
def home():
    """Render the main page"""
    return render_template('index.html')

# ============================================================
# ROUTE 2: Health Check
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
# ROUTE 3: Get Road Info (KEEP THIS - It's still useful!)
# ============================================================

@app.route('/api/get-road-info', methods=['POST'])
def get_road_info():
    """
    Simple coordinate to area mapping (fallback if OSM fails)
    KEEP THIS - Frontend uses it as backup
    """
    data = request.get_json()
    lat = data.get('lat')
    lon = data.get('lon')
    
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
    
    return jsonify({
        'success': False,
        'message': 'Location not in covered area',
        'coordinates': {'lat': lat, 'lon': lon}
    })

# ============================================================
# ROUTE 4: NEW - Process Road Info from OSM
# ============================================================

@app.route('/api/process-road-info', methods=['POST'])
def process_road_info():
    """
    NEW ENDPOINT - Process OSM road data and calculate capacities
    """
    try:
        data = request.get_json()
        
        # Extract road parameters
        lanes = data.get('lanes', 2)
        length_km = float(data.get('length_km', 1.0))
        width_meters = float(data.get('width_meters', 7.0))
        max_speed = int(data.get('max_speed', 40))
        road_type = data.get('road_type', 'tertiary')
        
        # Calculate road capacity (vehicles per hour)
        lane_capacity = calculate_lane_capacity(road_type, max_speed)
        total_capacity = lane_capacity * lanes
        
        # Calculate free-flow travel time (minutes)
        free_flow_time = (length_km / max_speed) * 60
        
        # Estimate congestion thresholds
        capacity_thresholds = {
            'light': total_capacity * 0.4,
            'moderate': total_capacity * 0.7,
            'heavy': total_capacity * 1.0
        }
        
        # Calculate disruption impact factors
        disruption_factors = calculate_disruption_factors(
            lanes=lanes,
            length_km=length_km,
            road_type=road_type
        )
        
        return jsonify({
            'success': True,
            'road_info': {
                **data,  # Include all original data from OSM
                'lane_capacity': lane_capacity,
                'total_capacity': total_capacity,
                'free_flow_time_minutes': round(free_flow_time, 2),
                'capacity_thresholds': capacity_thresholds,
                'disruption_factors': disruption_factors,
            }
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


def calculate_lane_capacity(road_type, max_speed):
    """Calculate per-lane capacity"""
    base_capacities = {
        'motorway': 2400,
        'trunk': 2200,
        'primary': 2000,
        'secondary': 1800,
        'tertiary': 1500,
        'residential': 1200,
    }
    base = base_capacities.get(road_type, 1500)
    speed_factor = min(max_speed / 60, 1.0)
    return int(base * speed_factor)


def calculate_disruption_factors(lanes, length_km, road_type):
    """Calculate how disruptions affect this specific road"""
    base_impacts = {
        'roadwork': 0.6,
        'accident': 0.4,
        'event': 0.7,
        'weather': 0.8,
    }
    
    lane_factor = 1.0 - (lanes - 2) * 0.1
    lane_factor = max(lane_factor, 0.5)
    
    length_factor = 1.0 if length_km < 1.0 else 0.9
    
    importance = {
        'motorway': 1.2,
        'trunk': 1.1,
        'primary': 1.0,
        'secondary': 0.9,
        'tertiary': 0.8,
    }.get(road_type, 0.9)
    
    return {
        disruption: round(impact * lane_factor * length_factor * importance, 2)
        for disruption, impact in base_impacts.items()
    }

# ============================================================
# ROUTE 5: Single Prediction (Keep for testing)
# ============================================================

@app.route('/api/predict', methods=['POST'])
def predict_single():
    """Single prediction endpoint - KEEP THIS"""
    try:
        data = request.get_json()
        
        required_fields = ['date', 'hour', 'area', 'road_corridor']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'error': f'Missing required field: {field}'
                }), 400
        
        result = predictor.predict(data)

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
# ROUTE 6: UPDATED - Simulate Disruption with Road Info
# ============================================================

@app.route('/api/simulate-disruption', methods=['POST'])
def simulate_disruption():
    """
    UPDATED VERSION - Now accepts road_info from OSM
    """
    try:
        data = request.get_json()
        
        # Extract basic disruption parameters
        area = data.get('area', 'Unknown')
        road_corridor = data.get('road_corridor', 'Unknown')
        disruption_type = data.get('disruption_type')
        start_datetime = datetime.strptime(
            f"{data['start_date']} {data['start_time']}", 
            "%Y-%m-%d %H:%M"
        )
        end_datetime = datetime.strptime(
            f"{data['end_date']} {data['end_time']}", 
            "%Y-%m-%d %H:%M"
        )
        
        # NEW: Get road information (from OSM)
        road_info = data.get('road_info', {})
        lanes = road_info.get('lanes', 2)
        length_km = float(road_info.get('length_km', 1.0))
        total_capacity = road_info.get('total_capacity', 3000)
        free_flow_time = road_info.get('free_flow_time_minutes', 10)
        disruption_factors = road_info.get('disruption_factors', {})
        
        # Get disruption impact factor
        impact_factor = disruption_factors.get(disruption_type, 0.6)
        
        # Generate hourly predictions
        hourly_predictions = []
        current_datetime = start_datetime
        
        while current_datetime <= end_datetime:
            # Prepare input
            hour_input = {
                'date': current_datetime.strftime('%Y-%m-%d'),
                'hour': current_datetime.hour,
                'area': area,
                'road_corridor': road_corridor,
                'has_disruption': 1,
                'disruption_type': disruption_type,
                'total_volume': data.get('total_volume', 0),
                'has_real_status': 0
            }
            
            # Make prediction
            prediction = predictor.predict(hour_input)
            
            # IMPORTANT: Calculate delay with road-specific info
            delay_info = predictor.estimate_delay(
                severity=prediction['severity'],
                base_travel_time_minutes=free_flow_time,
                road_length_km=length_km,
                impact_factor=impact_factor
            )
            
            # Add to results
            hourly_predictions.append({
                'datetime': current_datetime.strftime('%Y-%m-%d %H:%M'),
                'date': current_datetime.strftime('%Y-%m-%d'),
                'hour': current_datetime.hour,
                'day_of_week': current_datetime.strftime('%A'),
                'severity': prediction['severity'],
                'severity_label': prediction['severity_label'],
                'confidence': round(prediction['confidence'], 3),
                'delay_info': delay_info,  # ← THIS IS THE KEY LINE
                'probabilities': {
                    k: round(v, 3) for k, v in prediction['probabilities'].items()
                }
            })
            
            current_datetime += timedelta(hours=1)
        
        # Calculate summary statistics
        total_hours = len(hourly_predictions)
        light_hours = sum(1 for p in hourly_predictions if p['severity'] == 0)
        moderate_hours = sum(1 for p in hourly_predictions if p['severity'] == 1)
        heavy_hours = sum(1 for p in hourly_predictions if p['severity'] == 2)
        avg_severity = sum(p['severity'] for p in hourly_predictions) / total_hours
        avg_delay = sum(p['delay_info']['additional_delay_min'] for p in hourly_predictions) / total_hours
        
        # Time segment breakdown
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
        
        simulation_id = f"sim_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        return jsonify({
            'success': True,
            'simulation_id': simulation_id,
            'input': {
                'area': area,
                'road_corridor': road_corridor,
                'disruption_type': disruption_type,
                'start': start_datetime.strftime('%Y-%m-%d %H:%M'),
                'end': end_datetime.strftime('%Y-%m-%d %H:%M'),
                'description': data.get('description', ''),
                'coordinates': data.get('coordinates', {}),
                'road_info': road_info
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
                'avg_severity_label': 'Light' if avg_severity < 0.5 else ('Moderate' if avg_severity < 1.5 else 'Heavy'),
                'avg_delay_minutes': round(avg_delay, 1),
                'total_delay_hours': round(sum(p['delay_info']['additional_delay_min'] for p in hourly_predictions) / 60, 1)
            },
            'hourly_predictions': hourly_predictions,
            'time_segments': time_segments
        })
        
    except Exception as e:
        import traceback
        return jsonify({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500

# ============================================================
# ROUTE 7: Get Recommendations (Keep this)
# ============================================================

@app.route('/api/get-recommendations', methods=['POST'])
def get_recommendations():
    """Get mitigation recommendations"""
    data = request.get_json()
    disruption_type = data.get('disruption_type', 'roadwork')
    avg_severity = data.get('avg_severity', 1.0)
    heavy_percentage = data.get('heavy_percentage', 0)
    
    recommendations = []
    
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
    
    if disruption_type == 'roadwork':
        recommendations.append({
            'priority': 'medium',
            'category': 'communication',
            'recommendation': 'Post advance notices 1 week before start date',
            'reason': 'Allow commuters to plan alternate routes'
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