# backend/app.py - COMPLETE VERSION
# Replace your entire app.py with this file
import os
from dotenv import load_dotenv
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from models.predictor import TrafficPredictor
from datetime import datetime, timedelta
import pandas as pd
from services.traffic_api import TrafficAPIService
from services.database import DatabaseService
from werkzeug.utils import secure_filename
from flask import send_file
import random
import string


load_dotenv()

app = Flask(__name__)
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:3000", "http://127.0.0.1:3000"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})
# ============================================================
# File upload configuration
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), '..', 'data', 'processed')
ALLOWED_EXTENSIONS = {'csv'}

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max

# Ensure folder exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def allowed_file(filename):
    """Check if file has allowed extension"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_csv_info(filepath):
    """Get CSV file information (rows, columns)"""
    try:
        df = pd.read_csv(filepath)
        return {
            'rows': len(df),
            'cols': len(df.columns)
        }
    except Exception as e:
        print(f"Error reading CSV {filepath}: {e}")
        return {
            'rows': 0,
            'cols': 0
        }

# ============================================================

print("Loading trained model...")
predictor = TrafficPredictor()
print("✓ Model loaded and ready!")

# After creating the app
traffic_service = TrafficAPIService()

print("Loading traffic API service...")
traffic_service = TrafficAPIService()
print("✓ Traffic API service ready!")

print("Loading database service...")
db = DatabaseService()
print("✓ Database service ready!")


# ============================================================
# NEW ROUTE: Save Simulation to Database
# ============================================================

@app.route('/api/save-simulation', methods=['POST'])
def save_simulation():
    """
    Save a completed simulation to the database
    
    Request body should contain:
    {
        "user_id": 1,  # ID of the user (temporary - will use auth later)
        "simulation_data": {
            "scenario_name": "Roadwork on Bagong Kalsada",
            "description": "Road repair work",
            "disruption_type": "roadwork",
            "area": "Bucal",
            "road_corridor": "Calamba_Pagsanjan",
            "start_datetime": "2025-01-20T08:00:00",
            "end_datetime": "2025-01-20T18:00:00",
            "coordinates": {"lat": 14.1894, "lng": 121.1691}
        },
        "results_data": {
            "summary": {...},
            "hourly_predictions": [...],
            "time_segments": {...}
        }
    }
    """
    try:
        data = request.get_json()
        
        # Extract data
        user_id = data.get('user_id', 2)  # Default to planner1 (id=2)
        simulation_data = data.get('simulation_data', {})
        results_data = data.get('results_data', {})
        
        # Validate required fields
        required_fields = ['scenario_name', 'disruption_type', 'area', 'road_corridor']
        missing_fields = [f for f in required_fields if f not in simulation_data]
        
        if missing_fields:
            return jsonify({
                'success': False,
                'error': f'Missing required fields: {", ".join(missing_fields)}'
            }), 400
        
        # Save to database
        simulation_id = db.save_simulation_run(
            user_id=user_id,
            simulation_data=simulation_data,
            results_data=results_data
        )
        
        if simulation_id:
            return jsonify({
                'success': True,
                'simulation_id': simulation_id,
                'message': 'Simulation saved successfully'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to save simulation'
            }), 500
            
    except Exception as e:
        import traceback
        return jsonify({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500

# ============================================================
# NEW ROUTE: Get User's Simulations
# ============================================================

@app.route('/api/my-simulations', methods=['GET'])
def get_my_simulations():
    """
    Get all simulations for the current user
    
    Query params:
        - user_id: User ID (temporary - will use auth token later)
    """
    try:
        user_id = request.args.get('user_id', 2, type=int)
        
        simulations = db.get_user_simulations(user_id)
        
        return jsonify({
            'success': True,
            'simulations': simulations,
            'count': len(simulations)
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# ============================================================
# NEW ROUTE: Get Simulation Details
# ============================================================

@app.route('/api/simulation/<int:simulation_id>', methods=['GET'])
def get_simulation(simulation_id):
    """Get detailed information about a specific simulation"""
    try:
        simulation = db.get_simulation_by_id(simulation_id)
        
        if simulation:
            return jsonify({
                'success': True,
                'simulation': simulation
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Simulation not found'
            }), 404
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# ============================================================
# NEW ROUTE: Publish Simulation
# ============================================================

@app.route('/api/publish-simulation', methods=['POST'])
def publish_simulation():
    """
    Publish a simulation to the public map
    
    Request body:
    {
        "simulation_id": 1,
        "user_id": 2,
        "title": "Roadwork in Bucal",
        "public_description": "Road repair work causing moderate delays"
    }
    """
    try:
        data = request.get_json()
        
        simulation_id = data.get('simulation_id')
        user_id = data.get('user_id', 2)
        title = data.get('title')
        public_description = data.get('public_description')
        
        if not simulation_id:
            return jsonify({
                'success': False,
                'error': 'simulation_id is required'
            }), 400
        
        slug = db.publish_simulation(
            simulation_id=simulation_id,
            published_by_user_id=user_id,
            title=title,
            public_description=public_description
        )
        
        if slug:
            return jsonify({
                'success': True,
                'slug': slug,
                'message': 'Simulation published successfully',
                'public_url': f'/disruptions/{slug}'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to publish simulation'
            }), 500
            
    except Exception as e:
        import traceback
        return jsonify({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500

# ============================================================
# NEW ROUTE: Unpublish Simulation
# ============================================================

@app.route('/api/unpublish-simulation', methods=['POST'])
def unpublish_simulation():
    """
    Unpublish a simulation from the public map
    
    Request body:
    {
        "simulation_id": 1,
        "user_id": 2
    }
    """
    try:
        data = request.get_json()
        
        simulation_id = data.get('simulation_id')
        user_id = data.get('user_id', 2)
        
        if not simulation_id:
            return jsonify({
                'success': False,
                'error': 'simulation_id is required'
            }), 400
        
        success = db.unpublish_simulation(simulation_id, user_id)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Simulation unpublished successfully'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to unpublish simulation'
            }), 500
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# ============================================================
# NEW ROUTE: Get Published Simulations (For Public Map)
# ============================================================

@app.route('/api/published-disruptions', methods=['GET'])
def get_published_disruptions():
    """
    Get all published simulations for the public map
    This replaces the mock data in HomeMapWithSidebar.jsx
    """
    try:
        simulations = db.get_published_simulations()
        
        # Transform to match frontend format
        disruptions = []
        for sim in simulations:
            disruptions.append({
                'id': sim['published_id'],
                'simulation_id': sim['simulation_id'],
                'title': sim['title'],
                'description': sim['public_description'],
                'location': sim['disruption_location'],
                'type': sim['disruption_type'],
                'status': 'Active',
                'start_date': sim['start_time'].isoformat() if sim['start_time'] else None,
                'end_date': sim['end_time'].isoformat() if sim['end_time'] else None,
                'severity_level': sim['severity_level'],
                'congestion_level': sim['severity_level'].capitalize(),
                'avg_severity': float(sim['average_delay_ratio']) if sim['average_delay_ratio'] else 1.0,
                'expected_delay': round(float(sim['average_delay_ratio']) * 10) if sim['average_delay_ratio'] else 10,
                'published_at': sim['published_at'].isoformat() if sim['published_at'] else None,
                'slug': sim['slug'],
                'view_count': sim['view_count'],
                'organization': sim['organization']
            })
        
        return jsonify({
            'success': True,
            'disruptions': disruptions,
            'count': len(disruptions)
        })
        
    except Exception as e:
        import traceback
        return jsonify({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500

# ============================================================
# NEW ROUTE: Delete Simulation
# ============================================================

@app.route('/api/delete-simulation/<int:simulation_id>', methods=['DELETE'])
def delete_simulation(simulation_id):
    """
    Delete (soft delete) a simulation
    
    Query params:
        - user_id: User ID (temporary - will use auth later)
    """
    try:
        user_id = request.args.get('user_id', 2, type=int)
        
        success = db.delete_simulation(simulation_id, user_id)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Simulation deleted successfully'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to delete simulation or not authorized'
            }), 403
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# ============================================================
# UPDATED ROUTE: Simulate Disruption (Save After Simulation)
# ============================================================


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
    Smart simulation that uses real-time data ONLY for same-day disruptions (0-6 hours ahead)
    Future disruptions use historical patterns only
    """
    try:
        data = request.get_json()
        
        # Extract basic parameters
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

        # ✅ VALIDATE DATES
        if end_datetime <= start_datetime:
            return jsonify({
                'success': False,
                'error': 'End date/time must be after start date/time'
            }), 400
        
        duration_hours = (end_datetime - start_datetime).total_seconds() / 3600
        
        if duration_hours > 720:  # 30 days
            return jsonify({
                'success': False,
                'error': 'Disruption duration cannot exceed 30 days'
            }), 400
        
        if duration_hours < 1:
            return jsonify({
                'success': False,
                'error': 'Disruption duration must be at least 1 hour'
            }), 400
        
        road_info = data.get('road_info', {})
        coordinates = data.get('coordinates', {})
        
        # ✅ VALIDATE COORDINATES
        if not coordinates.get('lat') or not coordinates.get('lng'):
            return jsonify({
                'success': False,
                'error': 'Missing location coordinates'
            }), 400

        
        road_info = data.get('road_info', {})
        coordinates = data.get('coordinates', {})
        
        # ============================================================
        # ✅ SMART DECISION: Should we use real-time data?
        # ============================================================
        
        now = datetime.now()
        today = now.date()
        disruption_start_date = start_datetime.date()
        
        # Calculate hours until disruption starts
        hours_until_disruption = (start_datetime - now).total_seconds() / 3600
        
        # ✅ USE REAL-TIME ONLY IF:
        # 1. Disruption starts today
        # 2. Within next 6 hours (or already started)
        use_realtime = (
            disruption_start_date == today and 
            hours_until_disruption <= 6 and 
            hours_until_disruption >= -24  # Allow up to 24h past start (ongoing disruption)
        )
        
        realtime_data = None
        realtime_speed_factor = None
        current_congestion = 0
        
        if use_realtime:
            print("\n" + "="*60)
            print("🌐 FETCHING REAL-TIME TRAFFIC DATA")
            print("="*60)
            print(f"📍 Location: {coordinates.get('lat')}, {coordinates.get('lng')}")
            print(f"⏰ Current Time: {now.strftime('%Y-%m-%d %H:%M')}")
            print(f"🚧 Disruption Start: {start_datetime.strftime('%Y-%m-%d %H:%M')}")
            print(f"⏱️  Hours Until Start: {hours_until_disruption:.1f}h")
            print(f"✅ USING REAL-TIME (disruption happening soon)")
            
            # Fetch real-time traffic
            realtime_data = traffic_service.get_traffic_flow(
                coordinates.get('lat'),
                coordinates.get('lng')
            )
            
            if realtime_data.get('success'):
                current_speed = realtime_data.get('current_speed', 40)
                free_flow_speed = realtime_data.get('free_flow_speed', 40)
                current_congestion = realtime_data.get('congestion_ratio', 0)
                
                if free_flow_speed > 0:
                    realtime_speed_factor = current_speed / free_flow_speed
                
                print(f"✅ Real-time API Success")
                print(f"🚗 Current Speed: {current_speed} km/h")
                print(f"🏁 Free Flow Speed: {free_flow_speed} km/h")
                print(f"📊 Speed Factor: {realtime_speed_factor:.2f}")
                print(f"📊 Congestion Level: {current_congestion} (0=light, 1=moderate, 2=heavy)")
            else:
                print(f"❌ Real-time API Failed: {realtime_data.get('error')}")
                use_realtime = False  # Fall back to historical
            
            print("="*60 + "\n")
            
        else:
            print("\n" + "="*60)
            print("📅 FUTURE DISRUPTION - USING HISTORICAL PATTERNS")
            print("="*60)
            print(f"⏰ Current Time: {now.strftime('%Y-%m-%d %H:%M')}")
            print(f"🚧 Disruption Start: {start_datetime.strftime('%Y-%m-%d %H:%M')}")
            
            if disruption_start_date > today:
                days_away = (disruption_start_date - today).days
                print(f"📆 Disruption is {days_away} day(s) away")
            else:
                print(f"⏱️  Disruption is {hours_until_disruption:.1f} hours away")
            
            print(f"✅ Using ML model trained on historical data")
            print(f"📊 Real-time data not applicable for future predictions")
            print("="*60 + "\n")
        
        # ============================================================
        # Generate Hourly Predictions
        # ============================================================
        
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
            
            # Make prediction using ML model
            prediction = predictor.predict(hour_input)
            
            # ✅ ONLY apply real-time factor to predictions within next 6 hours
            hours_until_this_prediction = (current_datetime - now).total_seconds() / 3600
            apply_realtime_to_this_hour = (
                use_realtime and 
                -1 <= hours_until_this_prediction <= 6  # Current hour to 6 hours ahead
            )
            
            # Calculate delay with optional real-time adjustment
            delay_info = predictor.estimate_delay(
                severity=prediction['severity'],
                base_travel_time_minutes=road_info.get('free_flow_time_minutes', 10),
                road_length_km=road_info.get('length_km', 1.0),
                impact_factor=road_info.get('disruption_factors', {}).get(disruption_type, 0.6),
                realtime_speed_factor=realtime_speed_factor if apply_realtime_to_this_hour else None
            )
            
            hourly_predictions.append({
                'datetime': current_datetime.strftime('%Y-%m-%d %H:%M'),
                'date': current_datetime.strftime('%Y-%m-%d'),
                'hour': current_datetime.hour,
                'day_of_week': current_datetime.strftime('%A'),
                'severity': round(prediction['severity'], 2),
                'severity_label': prediction['severity_label'],
                'confidence': round(prediction['confidence'], 2),
                'delay_info': delay_info,
                'realtime_adjusted': delay_info.get('realtime_adjusted', False),
                'probabilities': {
                    k: round(v, 2) for k, v in prediction['probabilities'].items()
                }
            })
            
            current_datetime += timedelta(hours=1)
        
        # ============================================================
        # Smart Aggregation for Map Display
        # ============================================================

        def aggregate_predictions_smart(hourly_predictions, start_datetime, end_datetime):
            """
            Intelligently aggregate predictions based on duration
            Returns appropriate time granularity for visualization
            """
            duration_days = (end_datetime - start_datetime).days
            
            if duration_days <= 1:
                # Short disruption: Show hour-by-hour
                return {
                    'granularity': 'hourly',
                    'display_label': 'Hour-by-Hour View',
                    'map_data': hourly_predictions  # All hours
                }
            
            elif duration_days <= 7:
                # Medium disruption: Show day-by-day
                daily_aggregates = []
                current_date = start_datetime.date()
                end_date = end_datetime.date()
                
                while current_date <= end_date:
                    # Get all predictions for this day
                    day_predictions = [
                        p for p in hourly_predictions 
                        if datetime.strptime(p['datetime'], '%Y-%m-%d %H:%M').date() == current_date
                    ]
                    
                    if day_predictions:
                        # Calculate daily averages
                        avg_severity = sum(p['severity'] for p in day_predictions) / len(day_predictions)
                        avg_delay = sum(p['delay_info']['additional_delay_min'] for p in day_predictions) / len(day_predictions)
                        
                        # Determine dominant severity
                        severity_counts = {
                            'Light': sum(1 for p in day_predictions if p['severity'] < 0.5),
                            'Moderate': sum(1 for p in day_predictions if 0.5 <= p['severity'] < 1.5),
                            'Heavy': sum(1 for p in day_predictions if p['severity'] >= 1.5)
                        }
                        dominant_severity = max(severity_counts, key=severity_counts.get)
                        
                        daily_aggregates.append({
                            'date': current_date.strftime('%Y-%m-%d'),
                            'day_name': current_date.strftime('%A'),
                            'avg_severity': round(avg_severity, 2),
                            'avg_severity_label': dominant_severity,
                            'avg_delay_min': round(avg_delay),
                            'hour_count': len(day_predictions),
                            'severity_breakdown': severity_counts,
                            'peak_hour': max(day_predictions, key=lambda x: x['severity'])['hour'],
                            'peak_severity': max(p['severity'] for p in day_predictions)
                        })
                    
                    current_date += timedelta(days=1)
                
                return {
                    'granularity': 'daily',
                    'display_label': 'Day-by-Day View',
                    'map_data': daily_aggregates
                }
            
            elif duration_days <= 30:
                # Long disruption: Show week-by-week
                weekly_aggregates = []
                current_date = start_datetime.date()
                end_date = end_datetime.date()
                week_num = 1
                
                while current_date <= end_date:
                    week_end = min(current_date + timedelta(days=6), end_date)
                    
                    # Get all predictions for this week
                    week_predictions = [
                        p for p in hourly_predictions 
                        if current_date <= datetime.strptime(p['datetime'], '%Y-%m-%d %H:%M').date() <= week_end
                    ]
                    
                    if week_predictions:
                        avg_severity = sum(p['severity'] for p in week_predictions) / len(week_predictions)
                        avg_delay = sum(p['delay_info']['additional_delay_min'] for p in week_predictions) / len(week_predictions)
                        
                        severity_counts = {
                            'Light': sum(1 for p in week_predictions if p['severity'] < 0.5),
                            'Moderate': sum(1 for p in week_predictions if 0.5 <= p['severity'] < 1.5),
                            'Heavy': sum(1 for p in week_predictions if p['severity'] >= 1.5)
                        }
                        dominant_severity = max(severity_counts, key=severity_counts.get)
                        
                        weekly_aggregates.append({
                            'week_number': week_num,
                            'date_range': f"{current_date.strftime('%b %d')} - {week_end.strftime('%b %d')}",
                            'start_date': current_date.strftime('%Y-%m-%d'),
                            'end_date': week_end.strftime('%Y-%m-%d'),
                            'avg_severity': round(avg_severity, 2),
                            'avg_severity_label': dominant_severity,
                            'avg_delay_min': round(avg_delay),
                            'hour_count': len(week_predictions),
                            'severity_breakdown': severity_counts
                        })
                    
                    current_date = week_end + timedelta(days=1)
                    week_num += 1
                
                return {
                    'granularity': 'weekly',
                    'display_label': 'Week-by-Week View',
                    'map_data': weekly_aggregates
                }
            
            else:
                # Very long disruption: Monthly view
                return {
                    'granularity': 'monthly',
                    'display_label': 'Month-by-Month View',
                    'map_data': []  # Implement if needed
                }


        # ✅ ADD THIS AFTER CALCULATING hourly_predictions, BEFORE THE RETURN STATEMENT
        aggregated_view = aggregate_predictions_smart(hourly_predictions, start_datetime, end_datetime)
        
        # ============================================================
        # Calculate Summary Statistics
        # ============================================================
        
        total_hours = len(hourly_predictions)

        # ✅ SAFETY CHECK - Prevent division by zero
        if total_hours == 0:
            return jsonify({
                'success': False,
                'error': 'No predictions generated. Check start and end dates.'
            }), 400

        light_hours = sum(1 for p in hourly_predictions if p['severity'] < 0.5)
        moderate_hours = sum(1 for p in hourly_predictions if 0.5 <= p['severity'] < 1.5)
        heavy_hours = sum(1 for p in hourly_predictions if p['severity'] >= 1.5)
        
        # ✅ SAFE DIVISION
        avg_severity = sum(p['severity'] for p in hourly_predictions) / max(total_hours, 1)
        avg_delay = sum(p['delay_info']['additional_delay_min'] for p in hourly_predictions) / max(total_hours, 1)

        # Time segment breakdown
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
        
        # ============================================================
        # Return Response
        # ============================================================
        
        return jsonify({
            'success': True,
            'simulation_id': simulation_id,
            'realtime_integration': {
                'enabled': use_realtime and realtime_data and realtime_data.get('success', False),
                'applicable': use_realtime,
                'reason': (
                    'Same-day disruption - adjusted for current traffic' if use_realtime 
                    else f'Future disruption ({(disruption_start_date - today).days} days away) - using historical patterns'
                ),
                'current_speed': round(realtime_data.get('current_speed', 0), 1) if realtime_data else None,
                'free_flow_speed': round(realtime_data.get('free_flow_speed', 0), 1) if realtime_data else None,
                'speed_factor': round(realtime_speed_factor, 2) if realtime_speed_factor else None,
                'current_congestion': current_congestion,
                'timestamp': realtime_data.get('timestamp') if realtime_data else None,
                'hours_adjusted': sum(1 for p in hourly_predictions if p['realtime_adjusted'])
            },
            'input': {
                'area': area,
                'road_corridor': road_corridor,
                'disruption_type': disruption_type,
                'start': start_datetime.strftime('%Y-%m-%d %H:%M'),
                'end': end_datetime.strftime('%Y-%m-%d %H:%M'),
                'description': data.get('description', ''),
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
                'avg_severity': round(avg_severity, 1),
                'avg_severity_label': 'Light' if avg_severity < 0.5 else ('Moderate' if avg_severity < 1.5 else 'Heavy'),
                'avg_delay_minutes': round(avg_delay),
                'total_delay_hours': round(sum(p['delay_info']['additional_delay_min'] for p in hourly_predictions) / 60, 1)
            },
            'hourly_predictions': hourly_predictions,
            'time_segments': time_segments,
            'aggregated_view': aggregated_view,
            'has_multiple_days': (end_datetime - start_datetime).days > 1
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
# (Data/Uploaded) ROUTE 1: List All Files
# ============================================================

@app.route('/api/files/list', methods=['GET'])
def list_files():
    """
    Get list of all CSV files in data/final folder
    Returns file metadata including name, size, rows, cols, last modified
    """
    try:
        files = []
        
        if not os.path.exists(UPLOAD_FOLDER):
            return jsonify({
                'success': True,
                'files': []
            })
        
        for filename in os.listdir(UPLOAD_FOLDER):
            if filename.endswith('.csv'):
                filepath = os.path.join(UPLOAD_FOLDER, filename)
                
                # Get file stats
                file_stats = os.stat(filepath)
                file_size = file_stats.st_size
                modified_time = datetime.fromtimestamp(file_stats.st_mtime)
                
                # Get CSV info (rows/cols)
                csv_info = get_csv_info(filepath)
                
                files.append({
                    'id': filename,  # Using filename as ID
                    'name': filename,
                    'size_bytes': file_size,
                    'size_mb': round(file_size / (1024 * 1024), 2),
                    'rows': csv_info['rows'],
                    'cols': csv_info['cols'],
                    'updated': modified_time.strftime('%Y-%m-%d'),
                    'updated_full': modified_time.strftime('%Y-%m-%d %H:%M:%S')
                })
        
        # Sort by most recent first
        files.sort(key=lambda x: x['updated_full'], reverse=True)
        
        return jsonify({
            'success': True,
            'files': files,
            'count': len(files)
        })
        
    except Exception as e:
        print(f"Error listing files: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# ============================================================
# (Data/Uploaded) ROUTE 2: Upload File
# ============================================================

@app.route('/api/files/upload', methods=['POST'])
def upload_file():
    """
    Upload a CSV file to data/final folder
    """
    try:
        # Check if file is in request
        if 'file' not in request.files:
            return jsonify({
                'success': False,
                'error': 'No file provided'
            }), 400
        
        file = request.files['file']
        
        # Check if file was selected
        if file.filename == '':
            return jsonify({
                'success': False,
                'error': 'No file selected'
            }), 400
        
        # Validate file type
        if not allowed_file(file.filename):
            return jsonify({
                'success': False,
                'error': 'Only CSV files are allowed'
            }), 400
        
        # Secure the filename
        filename = secure_filename(file.filename)
        
        # Check if file already exists
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        if os.path.exists(filepath):
            return jsonify({
                'success': False,
                'error': f'File "{filename}" already exists. Please rename or delete the existing file first.'
            }), 409
        
        # Save file
        file.save(filepath)
        
        # Get file info
        csv_info = get_csv_info(filepath)
        file_stats = os.stat(filepath)
        
        return jsonify({
            'success': True,
            'message': f'File "{filename}" uploaded successfully',
            'file': {
                'name': filename,
                'rows': csv_info['rows'],
                'cols': csv_info['cols'],
                'size_mb': round(file_stats.st_size / (1024 * 1024), 2),
                'updated': datetime.fromtimestamp(file_stats.st_mtime).strftime('%Y-%m-%d')
            }
        })
        
    except Exception as e:
        print(f"Error uploading file: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# ============================================================
# (Data/Uploaded) ROUTE 3: Download Single File
# ============================================================

@app.route('/api/files/download/<filename>', methods=['GET'])
def download_file(filename):
    """
    Download a specific file
    """
    try:
        # Secure the filename
        filename = secure_filename(filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        
        # Check if file exists
        if not os.path.exists(filepath):
            return jsonify({
                'success': False,
                'error': 'File not found'
            }), 404
        
        # Send file
        return send_file(
            filepath,
            as_attachment=True,
            download_name=filename,
            mimetype='text/csv'
        )
        
    except Exception as e:
        print(f"Error downloading file: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# ============================================================
# (Data/Uploaded) ROUTE 4: Download Multiple Files (as ZIP)
# ============================================================

@app.route('/api/files/download-multiple', methods=['POST'])
def download_multiple_files():
    """
    Download multiple files as a ZIP archive
    """
    try:
        import zipfile
        import io
        
        data = request.get_json()
        filenames = data.get('filenames', [])
        
        if not filenames:
            return jsonify({
                'success': False,
                'error': 'No files selected'
            }), 400
        
        # Create in-memory ZIP file
        memory_file = io.BytesIO()
        
        with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
            for filename in filenames:
                filename = secure_filename(filename)
                filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                
                if os.path.exists(filepath):
                    zf.write(filepath, arcname=filename)
        
        memory_file.seek(0)
        
        # Generate ZIP filename with timestamp
        zip_filename = f'urbanflow_datasets_{datetime.now().strftime("%Y%m%d_%H%M%S")}.zip'
        
        return send_file(
            memory_file,
            as_attachment=True,
            download_name=zip_filename,
            mimetype='application/zip'
        )
        
    except Exception as e:
        print(f"Error creating ZIP: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# ============================================================
# (Data/Uploaded) ROUTE 5: Delete File(s)
# ============================================================

@app.route('/api/files/delete', methods=['POST'])
def delete_files():
    """
    Delete one or more files
    """
    try:
        data = request.get_json()
        filenames = data.get('filenames', [])
        
        if not filenames:
            return jsonify({
                'success': False,
                'error': 'No files selected for deletion'
            }), 400
        
        deleted = []
        failed = []
        
        for filename in filenames:
            try:
                filename = secure_filename(filename)
                filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                
                if os.path.exists(filepath):
                    os.remove(filepath)
                    deleted.append(filename)
                else:
                    failed.append({
                        'filename': filename,
                        'reason': 'File not found'
                    })
            except Exception as e:
                failed.append({
                    'filename': filename,
                    'reason': str(e)
                })
        
        return jsonify({
            'success': len(failed) == 0,
            'deleted': deleted,
            'failed': failed,
            'message': f'Successfully deleted {len(deleted)} file(s)'
        })
        
    except Exception as e:
        print(f"Error deleting files: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# ============================================================
# (Data/Uploaded) ROUTE 6: Get File Preview (first 10 rows)
# ============================================================

@app.route('/api/files/preview/<filename>', methods=['GET'])
def preview_file(filename):
    """
    Get preview of CSV file (first 10 rows)
    """
    try:
        filename = secure_filename(filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        
        if not os.path.exists(filepath):
            return jsonify({
                'success': False,
                'error': 'File not found'
            }), 404
        
        # Read CSV
        df = pd.read_csv(filepath)
        
        # Get first 10 rows
        preview_data = df.head(10).to_dict('records')
        columns = df.columns.tolist()
        
        return jsonify({
            'success': True,
            'filename': filename,
            'columns': columns,
            'preview': preview_data,
            'total_rows': len(df)
        })
        
    except Exception as e:
        print(f"Error previewing file: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# ============================================================
# OTP GENERATION AND VERIFICATION
# ============================================================

@app.route('/api/send-publish-otp', methods=['POST'])
def send_publish_otp():
    """
    Generate and send OTP for publishing verification
    In production, this would send an email. For now, we'll return it in response for testing.
    """
    try:
        data = request.get_json()
        user_id = data.get('user_id', 2)
        simulation_id = data.get('simulation_id')
        
        if not simulation_id:
            return jsonify({
                'success': False,
                'error': 'simulation_id is required'
            }), 400
        
        # Generate 6-digit OTP
        otp_code = ''.join(random.choices(string.digits, k=6))
        
        # Store OTP in database
        conn = None
        try:
            conn = db._get_connection()
            cursor = conn.cursor()
            
            # Set expiry to 10 minutes from now
            expires_at = datetime.now() + timedelta(minutes=10)
            
            cursor.execute("""
                INSERT INTO verification_otps (user_id, simulation_id, otp_code, expires_at)
                VALUES (%s, %s, %s, %s)
            """, (user_id, simulation_id, otp_code, expires_at))
            
            # Get user email
            cursor.execute("SELECT email, full_name FROM users WHERE user_id = %s", (user_id,))
            user = cursor.fetchone()
            
            conn.commit()
            
            # TODO: In production, send email here using SendGrid/AWS SES
            # For now, return OTP in response (REMOVE THIS IN PRODUCTION!)
            
            print(f"📧 OTP for simulation {simulation_id}: {otp_code}")
            print(f"   User: {user[1]} ({user[0]})")
            print(f"   Expires: {expires_at}")
            
            return jsonify({
                'success': True,
                'message': f'OTP sent to {user[0]}',
                # REMOVE THIS IN PRODUCTION - only for testing:
                'otp_for_testing': otp_code,  
                'expires_in_minutes': 10
            })
            
        finally:
            if conn:
                conn.close()
                
    except Exception as e:
        print(f"✗ Error sending OTP: {e}")
        import traceback
        return jsonify({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500


@app.route('/api/verify-publish-otp', methods=['POST'])
def verify_publish_otp():
    """
    Verify OTP and publish simulation if valid
    """
    try:
        data = request.get_json()
        
        simulation_id = data.get('simulation_id')
        otp_code = data.get('otp_code')
        user_id = data.get('user_id', 2)
        title = data.get('title')
        public_description = data.get('public_description')
        
        if not simulation_id or not otp_code:
            return jsonify({
                'success': False,
                'error': 'simulation_id and otp_code are required'
            }), 400
        
        conn = None
        try:
            conn = db._get_connection()
            cursor = conn.cursor()
            
            # Verify OTP
            cursor.execute("""
                SELECT otp_id, expires_at, is_used
                FROM verification_otps
                WHERE simulation_id = %s 
                  AND otp_code = %s 
                  AND user_id = %s
                ORDER BY created_at DESC
                LIMIT 1
            """, (simulation_id, otp_code, user_id))
            
            otp_record = cursor.fetchone()
            
            if not otp_record:
                return jsonify({
                    'success': False,
                    'error': 'Invalid OTP code'
                }), 400
            
            otp_id, expires_at, is_used = otp_record
            
            # Check if already used
            if is_used:
                return jsonify({
                    'success': False,
                    'error': 'OTP code has already been used'
                }), 400
            
            # Check if expired
            if datetime.now() > expires_at:
                return jsonify({
                    'success': False,
                    'error': 'OTP code has expired'
                }), 400
            
            # Mark OTP as used
            cursor.execute("""
                UPDATE verification_otps
                SET is_used = TRUE, used_at = CURRENT_TIMESTAMP
                WHERE otp_id = %s
            """, (otp_id,))
            
            # Publish the simulation
            slug = db.publish_simulation(
                simulation_id=simulation_id,
                published_by_user_id=user_id,
                title=title,
                public_description=public_description
            )
            
            if slug:
                return jsonify({
                    'success': True,
                    'slug': slug,
                    'message': 'Simulation published successfully',
                    'public_url': f'/disruptions/{slug}'
                })
            else:
                return jsonify({
                    'success': False,
                    'error': 'Failed to publish simulation'
                }), 500
            
        finally:
            if conn:
                conn.close()
                
    except Exception as e:
        print(f"✗ Error verifying OTP: {e}")
        import traceback
        return jsonify({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500


# ============================================================
# BATCH DELETE SIMULATIONS
# ============================================================

@app.route('/api/delete-simulations-batch', methods=['POST'])
def delete_simulations_batch():
    """
    Delete multiple simulations at once
    """
    try:
        data = request.get_json()
        simulation_ids = data.get('simulation_ids', [])
        user_id = data.get('user_id', 2)
        
        if not simulation_ids:
            return jsonify({
                'success': False,
                'error': 'No simulation IDs provided'
            }), 400
        
        deleted_count = 0
        failed_ids = []
        
        for sim_id in simulation_ids:
            success = db.delete_simulation(sim_id, user_id)
            if success:
                deleted_count += 1
            else:
                failed_ids.append(sim_id)
        
        return jsonify({
            'success': True,
            'deleted_count': deleted_count,
            'failed_count': len(failed_ids),
            'failed_ids': failed_ids,
            'message': f'Successfully deleted {deleted_count} simulation(s)'
        })
        
    except Exception as e:
        print(f"✗ Error deleting simulations: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# ============================================================
# RUN APP
# ============================================================

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)