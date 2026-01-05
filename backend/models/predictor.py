import joblib
import pandas as pd
import numpy as np
import os
from datetime import datetime
import json

class TrafficPredictor:
    """
    Handles traffic congestion predictions using trained Random Forest model
    """
    """
        road_data: List or DataFrame containing road segments.
        Expected keys: 'road_id', 'start_node_id', 'end_node_id', 'length_meters'
     """
    def __init__(self):
        """Load the trained model and feature names"""
        current_dir = os.path.dirname(os.path.abspath(__file__))
        
        model_path = os.path.join(current_dir, 'random_forest_model.pkl')
        self.model = joblib.load(model_path)
        
        features_path = os.path.join(current_dir, 'feature_names.pkl')
        self.feature_names = joblib.load(features_path)
        
        info_path = os.path.join(current_dir, 'model_info.pkl')
        self.model_info = joblib.load(info_path)

        # Load Calamba context data for location-aware predictions
        context_path = os.path.join(current_dir, 'data', 'calamba_context.json')
        if os.path.exists(context_path):
            with open(context_path, 'r') as f:
                self.calamba_context = json.load(f)
            print(f"✓ Calamba context loaded ({len(self.calamba_context.get('schools', []))} schools, {len(self.calamba_context.get('bottlenecks', []))} bottlenecks)")
        else:
            self.calamba_context = None
            print(f"⚠ Calamba context not found at {context_path}")
        
        print(f"✓ Model loaded successfully")
        print(f"  Accuracy: {self.model_info['accuracy']*100:.2f}%")
        print(f"  Features: {len(self.feature_names)}")
    
    def prepare_features(self, input_data):
        """
        Prepare input data to match training features (INCLUDING INTERACTIONS!)
        
        Args:
            input_data (dict): User input containing:
                - date: datetime or string 'YYYY-MM-DD'
                - hour: int (0-23)
                - area: str ('Bucal', 'Parian', 'Turbina')
                - road_corridor: str
                - has_disruption: int (0 or 1)
                - disruption_type: str or None
                - total_volume: float (optional)
                - has_real_status: int (optional)
        
        Returns:
            pd.DataFrame: Features ready for prediction
        """
        
        # Convert date
        if isinstance(input_data['date'], str):
            date = pd.to_datetime(input_data['date'])
        else:
            date = input_data['date']
        
        hour = input_data['hour']
        
        features = {}
        
        # ============================================================
        # TEMPORAL FEATURES
        # ============================================================
        
        features['hour'] = hour
        features['hour_sin'] = np.sin(2 * np.pi * hour / 24)
        features['hour_cos'] = np.cos(2 * np.pi * hour / 24)
        features['month'] = date.month
        features['day_of_month'] = date.day
        features['day_of_week_num'] = date.dayofweek
        features['is_weekend'] = 1 if date.dayofweek >= 5 else 0
        features['is_friday'] = 1 if date.dayofweek == 4 else 0
        
        # ✅ NEW: Individual day flags
        features['is_monday'] = 1 if date.dayofweek == 0 else 0
        features['is_tuesday'] = 1 if date.dayofweek == 1 else 0
        features['is_wednesday'] = 1 if date.dayofweek == 2 else 0
        features['is_thursday'] = 1 if date.dayofweek == 3 else 0
        
        # Holidays
        holidays = [
            '2024-01-01', '2024-04-09', '2024-05-01', '2024-06-12', 
            '2024-08-26', '2024-11-01', '2024-11-30', '2024-12-25', '2024-12-30',
            '2025-01-01', '2025-04-18', '2025-05-01', '2025-06-12',
            '2025-08-25', '2025-11-01', '2025-11-30', '2025-12-25', '2025-12-30'
        ]
        features['is_holiday'] = 1 if date.strftime('%Y-%m-%d') in holidays else 0
        
        # ✅ Rush hour features (EXPANDED)
        features['is_rush_hour'] = 1 if (6 <= hour <= 9) or (16 <= hour <= 19) else 0
        features['is_morning_rush'] = 1 if 6 <= hour <= 9 else 0
        features['is_evening_rush'] = 1 if 16 <= hour <= 19 else 0
        features['is_peak_rush'] = 1 if hour in [7, 8, 17, 18] else 0
        features['is_super_peak'] = 1 if hour in [8, 18] else 0
        
        # ✅ Workday flag
        features['is_workday'] = 1 if (date.dayofweek < 5 and features['is_holiday'] == 0) else 0
        
        # ============================================================
        # TRAFFIC FEATURES
        # ============================================================
        
        features['total_volume'] = input_data.get('total_volume', 0)
        
        # ============================================================
        # DISRUPTION FEATURES
        # ============================================================
        
        features['has_disruption'] = input_data.get('has_disruption', 0)
        
        disruption_type = input_data.get('disruption_type', None)
        features['has_roadwork'] = 1 if disruption_type == 'roadwork' else 0
        features['has_incident'] = 1 if disruption_type == 'incident' else 0
        features['has_accident'] = 1 if disruption_type == 'accident' else 0
        features['has_weather'] = 1 if disruption_type == 'weather' else 0
        features['has_event'] = 1 if disruption_type == 'event' else 0
        
        # ============================================================
        # DATA QUALITY FEATURES
        # ============================================================
        
        features['has_real_status'] = input_data.get('has_real_status', 0)
        features['has_imputed_status'] = 1 - features['has_real_status']
        features['has_volume_data'] = 1 if features['total_volume'] > 0 else 0
        features['data_completeness_score'] = (
            features['has_real_status'] + 
            features['has_volume_data'] + 
            features['has_disruption']
        )
        
        # ============================================================
        # ONE-HOT FEATURES (ROAD)
        # ============================================================
        
        road_corridor = input_data.get('road_corridor', 'Calamba_Pagsanjan')
        features['road_Calamba_Pagsanjan'] = 1 if road_corridor == 'Calamba_Pagsanjan' else 0
        features['road_Maharlika_Parian'] = 1 if road_corridor == 'Maharlika_Parian' else 0
        features['road_Maharlika_Turbina'] = 1 if road_corridor == 'Maharlika_Turbina' else 0
        
        # ============================================================
        # ONE-HOT FEATURES (TIME SEGMENT)
        # ============================================================
        
        if 6 <= hour <= 11:
            time_segment = 'morning'
        elif 12 <= hour <= 17:
            time_segment = 'afternoon'
        else:
            time_segment = 'night'
        
        features['time_afternoon'] = 1 if time_segment == 'afternoon' else 0
        features['time_morning'] = 1 if time_segment == 'morning' else 0
        features['time_night'] = 1 if time_segment == 'night' else 0
        
        # ============================================================
        # ONE-HOT FEATURES (AREA)
        # ============================================================
        
        area = input_data.get('area', 'Bucal')
        features['area_Bucal'] = 1 if area == 'Bucal' else 0
        features['area_Parian'] = 1 if area == 'Parian' else 0
        features['area_Turbina'] = 1 if area == 'Turbina' else 0
        
        # ============================================================
        # ✅ INTERACTION FEATURES (CRITICAL - MUST MATCH TRAINING!)
        # ============================================================
        
        # 1. Rush hour + Disruption
        features['rush_hour_with_disruption'] = features['is_rush_hour'] * features['has_disruption']
        
        # 2. Weekend + Event
        features['weekend_event'] = features['is_weekend'] * features['has_event']
        
        # 3. Morning rush + Roadwork
        features['morning_rush_roadwork'] = features['is_morning_rush'] * features['has_roadwork']
        
        # 4. Evening rush + Roadwork
        features['evening_rush_roadwork'] = features['is_evening_rush'] * features['has_roadwork']
        
        # 5. Holiday + Disruption
        features['holiday_disruption'] = features['is_holiday'] * features['has_disruption']
        
        # 6. Peak + High volume
        volume_high = 1 if features['total_volume'] > 0 else 0  # Adjust threshold if needed
        features['peak_high_volume'] = features['is_peak_rush'] * volume_high
        
        # 7. Workday patterns
        features['workday_morning_rush'] = features['is_workday'] * features['is_morning_rush']
        features['workday_evening_rush'] = features['is_workday'] * features['is_evening_rush']
        
        # 8. Road-specific rush hours
        features['road_Maharlika_Parian_rush'] = features['road_Maharlika_Parian'] * features['is_rush_hour']
        features['road_Maharlika_Turbina_rush'] = features['road_Maharlika_Turbina'] * features['is_rush_hour']
        features['road_Calamba_Pagsanjan_rush'] = features['road_Calamba_Pagsanjan'] * features['is_rush_hour']
        
        # 9. Area-specific morning patterns
        features['area_Bucal_morning'] = features['area_Bucal'] * features['is_morning_rush']
        features['area_Parian_morning'] = features['area_Parian'] * features['is_morning_rush']
        features['area_Turbina_morning'] = features['area_Turbina'] * features['is_morning_rush']
        
        # 10. Area-specific disruption patterns
        features['area_Bucal_disruption'] = features['area_Bucal'] * features['has_disruption']
        features['area_Parian_disruption'] = features['area_Parian'] * features['has_disruption']
        features['area_Turbina_disruption'] = features['area_Turbina'] * features['has_disruption']
        
        # 11. Time-disruption interactions
        features['morning_roadwork'] = features['time_morning'] * features['has_roadwork']
        features['morning_accident'] = features['time_morning'] * features['has_accident']
        features['afternoon_event'] = features['time_afternoon'] * features['has_event']
        features['night_incident'] = features['time_night'] * features['has_incident']
        
        # 12. Friday rush
        features['friday_rush'] = features['is_friday'] * features['is_rush_hour']
        
        # 13. Super peak interactions
        features['super_peak_disruption'] = features['is_super_peak'] * features['has_disruption']
        features['super_peak_roadwork'] = features['is_super_peak'] * features['has_roadwork']
        
        # ============================================================
        # CREATE DATAFRAME WITH CORRECT COLUMN ORDER
        # ============================================================
        
        features_df = pd.DataFrame([features])
        
        # Ensure all training features are present
        for feature in self.feature_names:
            if feature not in features_df.columns:
                features_df[feature] = 0
        
        # Reorder columns to match training
        features_df = features_df[self.feature_names]
        
        # ============================================================
        # ADD FEATURE VALIDATION (CRITICAL!)
        # ============================================================
        
        # Create DataFrame
        features_df = pd.DataFrame([features])
        
        # CRITICAL CHECK: Ensure all training features are present
        missing_features = set(self.feature_names) - set(features_df.columns)
        if missing_features:
            print(f"⚠️  WARNING: Missing features in input:")
            for feat in missing_features:
                print(f"   - {feat}")
                features_df[feat] = 0  # Fill with default value
        
        # Ensure correct feature order (CRITICAL!)
        features_df = features_df[self.feature_names]
        
        # Validate data types
        for col in features_df.columns:
            if not np.issubdtype(features_df[col].dtype, np.number):
                print(f"⚠️  WARNING: Non-numeric value in {col}")
                features_df[col] = pd.to_numeric(features_df[col], errors='coerce').fillna(0)
        
        return features_df
    
    def predict(self, input_data):
        """
        Make a prediction with domain knowledge rules for missing data
        
        IMPORTANT: Training data only has hours 6-21, so we apply rules for 22-5
        """
        hour = input_data.get('hour')
        has_disruption = input_data.get('has_disruption', 0)
        disruption_type = input_data.get('disruption_type')
        date = pd.to_datetime(input_data['date']) if isinstance(input_data['date'], str) else input_data['date']
        is_weekend = 1 if date.dayofweek >= 5 else 0
        
        # ============================================================
        # HANDLE NIGHTTIME (22:00-05:00) - NOT IN TRAINING DATA
        # ============================================================
        if hour >= 22 or hour <= 5:
            print(f"\n⚠️  Nighttime hour {hour} detected (not in training data)")
            print(f"   Applying domain knowledge rules...")
            
            # ✅ NIGHTTIME BASE LOGIC: Most traffic is Light
            # Even with disruptions, nighttime has minimal traffic
            
            if has_disruption == 0:
                # NO disruption = definitely Light
                prediction = 0
                base_confidence = 0.90
                print(f"   ✅ Nighttime + no disruption → Light")
                
            elif disruption_type == 'roadwork':
                # Roadwork at night still has Light traffic (construction hours)
                # Only 1-2 lanes blocked, minimal vehicles affected
                if hour <= 3:  # Deep night (midnight-3 AM)
                    prediction = 0  # Light
                    base_confidence = 0.80
                    print(f"   ✅ Deep night + roadwork → Light (minimal traffic)")
                else:  # 4-5 AM or 22-23 PM
                    prediction = 0  # Still Light, but slightly more traffic
                    base_confidence = 0.75
                    print(f"   ✅ Late night + roadwork → Light")
            
            elif disruption_type == 'accident':
                # Accidents at night can cause some backup
                # (Emergency vehicles, lane closure)
                if hour <= 2:
                    prediction = 0  # Light (very few cars)
                    base_confidence = 0.75
                    print(f"   ✅ Deep night + accident → Light")
                else:
                    prediction = 1  # Moderate (some early commuters)
                    base_confidence = 0.70
                    print(f"   ⚠️  Late night + accident → Moderate")
            
            elif disruption_type == 'event':
                # Late night events (concerts, sports) can cause congestion
                if hour >= 22 or hour <= 1:  # Event ending time
                    prediction = 1  # Moderate
                    base_confidence = 0.70
                    print(f"   🎉 Event hours + late night → Moderate")
                else:
                    prediction = 0  # Light
                    base_confidence = 0.80
                    print(f"   ✅ Post-event hours → Light")
            
            else:
                # Other disruptions (weather, incident) at night
                prediction = 0
                base_confidence = 0.80
                print(f"   ✅ Nighttime + minor disruption → Light")
            
            # Create synthetic probabilities
            if prediction == 0:
                probabilities = [base_confidence, 1 - base_confidence, 0.0]
            elif prediction == 1:
                probabilities = [0.15, base_confidence, 1 - base_confidence - 0.15]
            else:
                probabilities = [0.05, 0.20, base_confidence]
            
            severity_labels = {0: 'Light', 1: 'Moderate', 2: 'Heavy'}
            
            return {
                'severity': int(prediction),
                'severity_label': severity_labels[prediction],
                'confidence': float(base_confidence),
                'probabilities': {
                    'Light': float(probabilities[0]),
                    'Moderate': float(probabilities[1]),
                    'Heavy': float(probabilities[2])
                }
            }
        
        # ============================================================
        # NORMAL PREDICTION FOR HOURS 6-21 (IN TRAINING DATA)
        # ============================================================
        # ============================================================
        # NORMAL PREDICTION FOR HOURS 6-21 (IN TRAINING DATA)
        # ============================================================
        features_df = self.prepare_features(input_data)

        # Get base prediction from model
        base_prediction = self.model.predict(features_df)[0]
        base_probabilities = self.model.predict_proba(features_df)[0]

        # ✅ ADD NATURAL VARIANCE - Real traffic isn't perfectly consistent
        # Calculate variance based on time of day and disruption
        variance_level = self._calculate_variance_level(hour, has_disruption, disruption_type)

        # Apply controlled randomness
        noise = np.random.normal(0, variance_level, size=3)
        adjusted_probs = base_probabilities + noise
        adjusted_probs = np.maximum(adjusted_probs, 0.05)  # No values below 5%
        adjusted_probs = adjusted_probs / adjusted_probs.sum()  # Normalize to sum=1

        # Re-predict based on adjusted probabilities
        prediction = np.argmax(adjusted_probs)
        probabilities = adjusted_probs

        print(f"\n🎲 Variance applied: {variance_level:.2f}")
        print(f"   Base: {base_prediction} → Adjusted: {prediction}")
        print(f"   Probabilities: Light={adjusted_probs[0]:.1%}, Moderate={adjusted_probs[1]:.1%}, Heavy={adjusted_probs[2]:.1%}")
        
        # ✅ Apply business rules for edge cases
        original_prediction = prediction
        
        # RULE 1: Off-peak weekday (10-11 AM, 2-3 PM) with no disruption
        if has_disruption == 0 and not is_weekend and hour in [10, 11, 14, 15]:
            if probabilities[0] > 0.35:  # If Light has decent probability
                prediction = 0
                print(f"   ⚡ Override: Off-peak weekday → Light")
        
        # RULE 2: Weekend mid-day with no disruption
        if is_weekend and has_disruption == 0 and 10 <= hour <= 15:
            if probabilities[0] > 0.30:
                prediction = 0
                print(f"   ⚡ Override: Weekend mid-day → Light")
        
        # RULE 3: Rush hour with major disruption should be at least Moderate
        if has_disruption == 1 and disruption_type in ['roadwork', 'accident']:
            if hour in [7, 8, 17, 18] and prediction == 0:
                prediction = 1
                print(f"   ⚡ Override: Rush hour + disruption → Moderate")
        
        if original_prediction != prediction:
            print(f"   🔄 Prediction adjusted: {original_prediction} → {prediction}")
        
        severity_labels = {0: 'Light', 1: 'Moderate', 2: 'Heavy'}
        
        return {
            'severity': int(prediction),
            'severity_label': severity_labels[prediction],
            'confidence': float(probabilities[prediction]),
            'probabilities': {
                'Light': float(probabilities[0]),
                'Moderate': float(probabilities[1]),
                'Heavy': float(probabilities[2])
            }
        }
    
    def predict_with_confidence(self, input_data):
        """
        Make prediction with confidence intervals
        Research: Random Forest provides prediction uncertainty via tree voting
        """
        
        # Prepare features
        features = self.prepare_features(input_data)
        
        # Get predictions from all trees
        tree_predictions = np.array([tree.predict(features)[0] for tree in self.model.estimators_])
        
        # Final prediction (majority vote)
        prediction = self.model.predict(features)[0]
        
        # Calculate confidence (% of trees agreeing)
        confidence = (tree_predictions == prediction).mean()
        
        # Get prediction probabilities for each class
        probabilities = self.model.predict_proba(features)[0]
        
        return {
            'prediction': int(prediction),
            'confidence': float(confidence),
            'probabilities': {
                'light': float(probabilities[0]),
                'moderate': float(probabilities[1]),
                'heavy': float(probabilities[2])
            },
            'severity_label': ['Light', 'Moderate', 'Heavy'][prediction],
            'interpretation': self._interpret_confidence(confidence)
        }

    def _interpret_confidence(self, confidence):
        """Interpret confidence level"""
        if confidence >= 0.90:
            return "Very High Confidence"
        elif confidence >= 0.75:
            return "High Confidence"
        elif confidence >= 0.60:
            return "Moderate Confidence"
        else:
            return "Low Confidence - Consider additional data"


    def _calculate_variance_level(self, hour, has_disruption, disruption_type):
        """
        Calculate how much variance to apply based on conditions
        
        Returns:
            float: Variance level (0.0 - 0.3)
            - Low variance (0.05-0.10) = Predictable conditions
            - Medium variance (0.10-0.20) = Normal conditions  
            - High variance (0.20-0.30) = Unpredictable conditions
        """
        
        # Base variance by time of day
        if 6 <= hour <= 7:
            base_variance = 0.18  # Early rush - still building up
        elif hour == 8:
            base_variance = 0.25  # Peak rush - most variable
        elif hour == 9:
            base_variance = 0.20  # Late rush - declining
        elif 10 <= hour <= 15:
            base_variance = 0.12  # Midday - stable
        elif 16 <= hour <= 17:
            base_variance = 0.22  # Evening rush starting
        elif hour == 18:
            base_variance = 0.28  # Evening peak - very variable
        elif hour == 19:
            base_variance = 0.18  # Late evening - declining
        else:
            base_variance = 0.15  # Other hours
        
        # Increase variance if there's a disruption
        if has_disruption == 1:
            if disruption_type == 'accident':
                base_variance += 0.08  # Accidents are unpredictable
            elif disruption_type == 'weather':
                base_variance += 0.10  # Weather creates chaos
            elif disruption_type == 'event':
                base_variance += 0.05  # Events are more predictable
            elif disruption_type == 'roadwork':
                base_variance += 0.03  # Roadwork is planned
        
        # Cap maximum variance
        return min(base_variance, 0.30)

    
    def estimate_delay(self, severity, base_travel_time_minutes, road_length_km, 
                   impact_factor=0.6, realtime_speed_factor=None,
                   hour=None, lanes=2, disruption_type=None, area=None):
        """
        Dynamic delay calculation based on multiple real-world factors
        
        Args:
            severity: Traffic severity (0.0-3.0)
            base_travel_time_minutes: Normal travel time
            road_length_km: Road segment length
            impact_factor: Disruption impact (0.0-1.0)
            realtime_speed_factor: Real-time speed adjustment
            hour: Hour of day (0-23) - CRITICAL for rush hour scaling
            lanes: Number of lanes (1-4)
            disruption_type: Type of disruption
            area: Location name (for context awareness)
        """
        
        # Validate inputs
        if base_travel_time_minutes <= 0:
            base_travel_time_minutes = (road_length_km / 40) * 60
        if road_length_km <= 0:
            road_length_km = 1.0
        
        # ============================================================
        # STEP 1: CALCULATE BASE CONGESTION MULTIPLIER
        # ============================================================
        
        # Convert severity to V/C ratio (more aggressive for heavy traffic)
        if severity < 0.5:
            v_c_ratio = 0.50 + (severity * 0.8)  # 0.5-0.9
        elif severity < 1.5:
            v_c_ratio = 0.80 + ((severity - 0.5) * 0.35)  # 0.8-1.15
        else:
            v_c_ratio = 1.05 + ((severity - 1.5) * 0.40)  # 1.05-1.65
            v_c_ratio = min(v_c_ratio, 1.80)
        
        # Apply disruption impact
        v_c_ratio = v_c_ratio * (1 + impact_factor * 0.5)
        
        # BPR parameters (tuned for urban congestion)
        alpha = 0.25
        beta = 5
        
        # Calculate BPR multiplier
        if v_c_ratio <= 1.0:
            multiplier = 1 + alpha * (v_c_ratio ** beta)
        else:
            excess_ratio = v_c_ratio - 1.0
            multiplier = 1 + alpha * (1.0 ** beta) + (excess_ratio ** 1.8) * 4.5
        
        # ============================================================
        # STEP 2: TIME-OF-DAY SCALING (CRITICAL!)
        # ============================================================
        
        time_multiplier = 1.0
        
        if hour is not None:
            if hour in [7, 8, 17, 18]:  # Super peak hours
                time_multiplier = 1.8
            elif hour in [6, 9, 16, 19]:  # Peak hours
                time_multiplier = 1.4
            elif 10 <= hour <= 15:  # Midday
                time_multiplier = 1.0
            elif hour in [20, 21]:  # Early evening
                time_multiplier = 0.8
            elif hour >= 22 or hour <= 5:  # Night
                time_multiplier = 0.4
        
        # ============================================================
        # STEP 3: LANE CAPACITY ADJUSTMENT
        # ============================================================
        
        lane_multiplier = 1.0
        
        if lanes == 1:
            lane_multiplier = 2.2  # Single lane = massive bottleneck
        elif lanes == 2:
            lane_multiplier = 1.5
        elif lanes == 3:
            lane_multiplier = 1.2
        else:  # 4+ lanes
            lane_multiplier = 1.0
        
        # ============================================================
        # STEP 4: DISRUPTION TYPE IMPACT
        # ============================================================
        
        disruption_multiplier = 1.0
        
        if disruption_type:
            disruption_factors = {
                'roadwork': 1.3,      # Predictable but blocks lanes
                'accident': 1.8,      # Sudden chaos, rubbernecking
                'event': 1.4,         # High volume, predictable
                'weather': 1.5,       # Slows all traffic
                'road_closure': 2.0   # Forces detours
            }
            disruption_multiplier = disruption_factors.get(disruption_type, 1.2)
        
        # ============================================================
        # STEP 5: ROAD LENGTH SCALING (NON-LINEAR!)
        # ============================================================
        
        # Longer roads = exponentially worse delays due to cumulative backups
        if road_length_km < 1.0:
            length_factor = 1.0
        elif road_length_km < 3.0:
            length_factor = 1.0 + (road_length_km - 1.0) * 0.2
        else:
            length_factor = 1.4 + (road_length_km - 3.0) * 0.15
        
        # ============================================================
        # STEP 6: SEVERITY-BASED STOP-AND-GO PENALTY
        # ============================================================
        
        stop_go_penalty = 0
        
       # ============================================================
        # STEP 6: SEVERITY-BASED STOP-AND-GO PENALTY (DETERMINISTIC)
        # ============================================================

        stop_go_penalty = 0

        if severity >= 2.0:
            # Severe: constant stopping (adds ~4 min/km on average)
            # Use severity to modulate within range (3-5 min/km)
            penalty_per_km = 3.0 + ((severity - 2.0) / 1.0) * 2.0  # Scales 3→5 as severity 2.0→3.0
            penalty_per_km = min(penalty_per_km, 5.0)  # Cap at 5
            stop_go_penalty = road_length_km * penalty_per_km
            
        elif severity >= 1.5:
            # Heavy: frequent stops (adds ~2.75 min/km on average)
            # Use severity to modulate within range (2-3.5 min/km)
            penalty_per_km = 2.0 + ((severity - 1.5) / 0.5) * 1.5  # Scales 2→3.5 as severity 1.5→2.0
            stop_go_penalty = road_length_km * penalty_per_km
            
        elif severity >= 1.0:
            # Moderate: occasional stops (adds ~1.5 min/km on average)
            # Use severity to modulate within range (1-2 min/km)
            penalty_per_km = 1.0 + ((severity - 1.0) / 0.5) * 1.0  # Scales 1→2 as severity 1.0→1.5
            stop_go_penalty = road_length_km * penalty_per_km
            
        elif severity >= 0.5:
            # Light-moderate: slow crawl (adds ~0.85 min/km on average)
            # Use severity to modulate within range (0.5-1.2 min/km)
            penalty_per_km = 0.5 + ((severity - 0.5) / 0.5) * 0.7  # Scales 0.5→1.2 as severity 0.5→1.0
            stop_go_penalty = road_length_km * penalty_per_km

        else:
            # Very light traffic: minimal penalty
            penalty_per_km = severity * 0.5  # Linear scaling for very low severity
            stop_go_penalty = road_length_km * penalty_per_km
        # ============================================================
        # STEP 7: COMBINE ALL FACTORS
        # ============================================================
        
        # Apply all multipliers
        final_multiplier = (
            multiplier * 
            time_multiplier * 
            lane_multiplier * 
            disruption_multiplier * 
            length_factor
        )
        
        # Calculate expected travel time
        expected_travel_time = base_travel_time_minutes * final_multiplier
        
        # Add stop-and-go penalty
        expected_travel_time += stop_go_penalty
        
        # Apply location-based multiplier if set
        location_multiplier = getattr(self, '_current_location_multiplier', 1.0)
        expected_travel_time *= location_multiplier
        
        # Calculate delay
        additional_delay = expected_travel_time - base_travel_time_minutes
        
        # ============================================================
        # STEP 8: APPLY REALISTIC BOUNDS
        # ============================================================
        
        # Set minimum delays based on severity
        min_delays = {
            (0.0, 0.5): 1,   # Light: 1-3 min
            (0.5, 1.0): 3,   # Light-Moderate: 3-6 min
            (1.0, 1.5): 6,   # Moderate: 6-12 min
            (1.5, 2.0): 12,  # Heavy: 12-20 min
            (2.0, 3.0): 20   # Severe: 20-40 min
        }
        
        min_delay = 1
        for (low, high), delay in min_delays.items():
            if low <= severity < high:
                min_delay = delay
                break
        
        additional_delay = max(additional_delay, min_delay)
        
        # Cap maximum delay at 60 minutes (extreme gridlock)
        additional_delay = min(additional_delay, 60)
        
        # Add natural variance (±10%)
        variance = np.random.uniform(0.9, 1.1)
        additional_delay *= variance
        
        additional_delay_rounded = round(additional_delay)
        
        # ============================================================
        # STEP 9: CALCULATE SPEEDS
        # ============================================================
        
        normal_speed = (road_length_km / base_travel_time_minutes) * 60
        reduced_speed = (road_length_km / expected_travel_time) * 60
        
        if realtime_speed_factor is not None:
            reduced_speed = max(5, reduced_speed * realtime_speed_factor)
        
        speed_reduction = normal_speed - reduced_speed
        
        # ============================================================
        # RETURN DETAILED BREAKDOWN
        # ============================================================
        
        return {
            'base_travel_time_min': round(base_travel_time_minutes, 1),
            'expected_travel_time_min': round(expected_travel_time, 1),
            'additional_delay_min': additional_delay_rounded,
            'delay_percentage': round((additional_delay / max(base_travel_time_minutes, 1)) * 100, 1),
            'normal_speed_kmh': round(normal_speed, 1),
            'reduced_speed_kmh': round(reduced_speed, 1),
            'speed_reduction_kmh': round(speed_reduction, 1),
            
            # Debug info
            'v_c_ratio': round(v_c_ratio, 2),
            'time_multiplier': round(time_multiplier, 2),
            'lane_multiplier': round(lane_multiplier, 2),
            'disruption_multiplier': round(disruption_multiplier, 2),
            'length_factor': round(length_factor, 2),
            'stop_go_penalty_min': round(stop_go_penalty, 1),
            'final_multiplier': round(final_multiplier, 2),
            'location_multiplier': round(location_multiplier, 2),
            'realtime_adjusted': realtime_speed_factor is not None,  # ✅ ADD THIS LINE
        }
    
    def get_location_multiplier(self, lat, lng, hour, day_of_week, is_friday=False):
        """
        Calculate delay multiplier based on proximity to schools, bottlenecks, traffic lights, etc.
        
        Args:
            lat, lng: Coordinates of the disruption
            hour: Hour of day (0-23)
            day_of_week: 0=Monday, 6=Sunday
            is_friday: Boolean for Friday special handling
        
        Returns:
            float: Multiplier to apply to delay (1.0 = no change)
        """
        if not self.calamba_context:
            return 1.0
        
        multiplier = 1.0
        
        def haversine_distance(lat1, lng1, lat2, lng2):
            """Calculate distance in meters between two coordinates"""
            from math import radians, sin, cos, sqrt, atan2
            R = 6371000  # Earth's radius in meters
            lat1, lng1, lat2, lng2 = map(radians, [lat1, lng1, lat2, lng2])
            dlat = lat2 - lat1
            dlng = lng2 - lng1
            a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlng/2)**2
            c = 2 * atan2(sqrt(a), sqrt(1-a))
            return R * c
        
        # Check proximity to schools
        # Check proximity to schools
        for school in self.calamba_context.get('schools', []):
            if school.get('lat', 0) == 0:
                continue
            distance = haversine_distance(lat, lng, school['lat'], school['lng'])
            
            # ✅ CHECK BOTH DISMISSAL AND MORNING RUSH
            if distance <= school.get('impact_radius_m', 300):
                # Check dismissal time
                dismissal_hours = school.get('friday_dismissal_hours' if is_friday else 'dismissal_hours', [])
                if hour in dismissal_hours:
                    school_mult = school.get('delay_multiplier', 1.3)
                    multiplier = max(multiplier, school_mult)
                
                # ✅ ADD THIS: Check morning rush
                morning_hours = school.get('morning_rush_hours', [])
                if hour in morning_hours:
                    morning_mult = school.get('morning_multiplier', 1.5)
                    multiplier = max(multiplier, morning_mult)
            
            # ✅ ADD THIS: Check extended cascade zone
            cascade_radius = school.get('cascade_radius_m', 0)
            if cascade_radius > 0 and distance <= cascade_radius:
                if hour in dismissal_hours or hour in morning_hours:
                    # Still affected but slightly less
                    multiplier = max(multiplier, school_mult * 0.75)
        
        # Check proximity to bottlenecks
        for bottleneck in self.calamba_context.get('bottlenecks', []):
            if bottleneck.get('lat', 0) == 0:
                continue
            distance = haversine_distance(lat, lng, bottleneck['lat'], bottleneck['lng'])
            if distance <= bottleneck.get('impact_radius_m', 300):
                peak_hours = bottleneck.get('friday_peak_hours' if is_friday else 'peak_hours', [])
                if hour in peak_hours:
                    bn_mult = bottleneck.get('friday_multiplier' if is_friday else 'delay_multiplier', 1.3)
                    multiplier = max(multiplier, bn_mult)
        
        # Check proximity to malls
        for mall in self.calamba_context.get('malls_commercial', []):
            if mall.get('lat', 0) == 0:
                continue
            distance = haversine_distance(lat, lng, mall['lat'], mall['lng'])
            if distance <= mall.get('impact_radius_m', 400):
                is_weekend = day_of_week >= 5
                peak_hours = mall.get('weekend_peak_hours' if is_weekend else 'peak_hours', [])
                if hour in peak_hours:
                    if is_friday:
                        mall_mult = mall.get('friday_multiplier', 1.4)
                    elif is_weekend:
                        mall_mult = mall.get('weekend_multiplier', 1.3)
                    else:
                        mall_mult = mall.get('delay_multiplier', 1.2)
                    multiplier = max(multiplier, mall_mult)
        
        # Check proximity to traffic lights (adds base delay)
        for light in self.calamba_context.get('traffic_lights', []):
            if light.get('lat', 0) == 0:
                continue
            distance = haversine_distance(lat, lng, light['lat'], light['lng'])
            if distance <= light.get('impact_radius_m', 100):
                # Traffic lights add ~10-20% during peak hours
                if 7 <= hour <= 9 or 16 <= hour <= 19:
                    multiplier = max(multiplier, multiplier * 1.15)
        
        # Apply Calamba-wide peak patterns
        peak_patterns = self.calamba_context.get('calamba_peak_patterns', {})
        
        if is_friday and 17 <= hour <= 21:
            friday_pattern = peak_patterns.get('friday_evening_special', {})
            multiplier = max(multiplier, friday_pattern.get('multiplier', 1.5))
        elif day_of_week < 5:  # Weekday
            if 7 <= hour <= 9:
                multiplier = max(multiplier, peak_patterns.get('weekday_morning_rush', {}).get('multiplier', 1.3))
            elif 17 <= hour <= 19:
                multiplier = max(multiplier, peak_patterns.get('weekday_evening_rush', {}).get('multiplier', 1.4))
            elif 16 <= hour <= 17:
                multiplier = max(multiplier, peak_patterns.get('school_dismissal', {}).get('multiplier', 1.4))
        
        return round(multiplier, 2)

    def estimate_delay_with_location(self, severity, base_travel_time_minutes, road_length_km,
                                      impact_factor=0.6, realtime_speed_factor=None,
                                      lat=None, lng=None, hour=None, day_of_week=None):
        """
        Enhanced delay estimation with location awareness.
        
        Args:
            ... (same as estimate_delay)
            lat, lng: Coordinates of disruption location
            hour: Hour of day (0-23)
            day_of_week: 0=Monday, 6=Sunday
        """
        # Calculate location multiplier if coordinates provided
        if lat is not None and lng is not None and hour is not None:
            is_friday = (day_of_week == 4) if day_of_week is not None else False
            self._current_location_multiplier = self.get_location_multiplier(
                lat, lng, hour, day_of_week or 0, is_friday
            )
        else:
            self._current_location_multiplier = 1.0
        
        # Call original estimate_delay
        result = self.estimate_delay(
            severity, base_travel_time_minutes, road_length_km,
            impact_factor, realtime_speed_factor
        )
        
        # Add location info to result
        result['location_multiplier'] = self._current_location_multiplier
        result['location_adjusted'] = self._current_location_multiplier != 1.0
        
        # Reset for next call
        self._current_location_multiplier = 1.0
        
        return result
    

        # backend/models/predictor.py - ADD THIS METHOD

    def calculate_dynamic_impact_zones(self, hour, day_of_week, disruption_type, lanes, severity):
        """
        Calculate impact zones that vary by time and context
        Returns distance-based multipliers adjusted for current conditions
        """
        # Base zones
        base_zones = [
            {'min_dist': 0, 'max_dist': 150, 'base_multiplier': 1.0},
            {'min_dist': 150, 'max_dist': 300, 'base_multiplier': 0.75},
            {'min_dist': 300, 'max_dist': 450, 'base_multiplier': 0.50},
            {'min_dist': 450, 'max_dist': 600, 'base_multiplier': 0.30},
        ]
        
        # ✅ TIME-OF-DAY ADJUSTMENT
        if 7 <= hour <= 9 or 17 <= hour <= 19:  # Rush hour
            time_expansion = 1.6  # Congestion spreads 60% further
        elif 10 <= hour <= 16:  # Midday
            time_expansion = 1.2
        elif hour >= 22 or hour <= 5:  # Night
            time_expansion = 0.6  # Impact is localized
        else:
            time_expansion = 1.0
        
        # ✅ DAY-OF-WEEK ADJUSTMENT
        is_weekend = day_of_week >= 5
        day_factor = 0.7 if is_weekend else 1.0
        
        # ✅ DISRUPTION TYPE ADJUSTMENT
        type_factors = {
            'roadwork': 1.2,   # Planned, people avoid
            'accident': 1.5,   # Sudden, spreads chaos
            'event': 1.3,      # Predictable but high volume
            'weather': 1.4     # Unpredictable
        }
        type_factor = type_factors.get(disruption_type, 1.0)
        
        # ✅ LANE CAPACITY ADJUSTMENT
        if lanes == 1:
            lane_factor = 2.0  # Total blockage = massive spread
        elif lanes == 2:
            lane_factor = 1.5
        else:
            lane_factor = 1.0
        
        # ✅ SEVERITY-BASED EXPANSION
        severity_factor = 1.0 + (severity * 0.3)  # Heavy traffic spreads further
        
        # Apply all factors
        combined_factor = time_expansion * day_factor * type_factor * lane_factor * severity_factor
        
        # Adjust zones
        adjusted_zones = []
        for zone in base_zones:
            adjusted_zones.append({
                'min_dist': zone['min_dist'],
                'max_dist': int(zone['max_dist'] * combined_factor),
                'multiplier': zone['base_multiplier'] * (combined_factor ** 0.5),  # Square root dampens extreme values
                'label': f"Impact Zone ({zone['min_dist']}-{int(zone['max_dist'] * combined_factor)}m)"
            })
        
        return adjusted_zones
    
    def predict_disruption_impact(self, input_data):
        """
        Predict traffic delay impact for a route passing through a disruption.
        
        Args:
            input_data (dict): {
                'hour': int (0-23),
                'day_of_week': int (0=Monday, 6=Sunday),
                'disruption_type': str ('roadwork', 'accident', 'event', etc.),
                'location': str,
                'route_distance': float (km),
                'distance_through_disruption': float (km),
                'average_delay_ratio': float (from simulation, e.g., 1.0, 1.1, 1.5),
                'severity_level': str ('moderate', 'heavy', etc.)
            }
        
        Returns:
            float: Predicted delay in minutes
        """
        import pandas as pd
        import numpy as np
        
        # Extract features
        hour = input_data.get('hour', 12)
        day_of_week = input_data.get('day_of_week', 1)
        disruption_type = input_data.get('disruption_type', 'roadwork')
        route_distance = input_data.get('route_distance', 3.0)
        distance_through = input_data.get('distance_through_disruption', 0.5)
        average_delay_ratio = input_data.get('average_delay_ratio', 1.0)  # ✅ Key metric from simulation
        severity_level = input_data.get('severity_level', 'moderate')
        
        # Map disruption type to numeric
        type_mapping = {
            'roadwork': 0,
            'construction': 0,
            'accident': 1,
            'crash': 1,
            'event': 2,
            'parade': 2,
            'weather': 3,
            'flooding': 3,
            'flood': 3
        }
        
        disruption_type_code = type_mapping.get(disruption_type.lower(), 0)
        
        # Map severity to numeric
        severity_mapping = {
            'minor': 0.8,
            'moderate': 1.0,
            'heavy': 1.3,
            'severe': 1.5
        }
        
        severity_multiplier = severity_mapping.get(severity_level.lower(), 1.0)
        
        # Time-based features
        is_rush_hour = 1 if (7 <= hour <= 9) or (17 <= hour <= 19) else 0
        is_weekend = 1 if day_of_week >= 5 else 0
        
        # ✅ Calculate base delay using the average_delay_ratio from simulation
        # The delay ratio represents how much slower traffic moves (1.0 = normal, 1.5 = 50% slower)
        
        # Normal travel time through the disruption zone at 30 km/h
        normal_time_minutes = (distance_through / 30) * 60  # minutes
        
        # Actual travel time with the delay ratio applied
        actual_time_minutes = normal_time_minutes * average_delay_ratio
        
        # Base delay is the difference
        base_delay = actual_time_minutes - normal_time_minutes
        
        # Apply time-of-day multipliers
        if is_rush_hour:
            base_delay *= 1.4
        elif hour >= 10 and hour <= 16:
            base_delay *= 1.15
        else:
            base_delay *= 0.9
        
        # Apply weekend adjustment
        if is_weekend:
            base_delay *= 0.75
        
        # Apply severity multiplier
        base_delay *= severity_multiplier
        
        # Apply route-specific factors
        route_impact = 1.0 + ((route_distance - 3.0) * 0.03)  # Longer routes = slightly more delay
        route_impact = max(0.9, min(1.2, route_impact))
        base_delay *= route_impact
        
        # Try to use ML model if available
        try:
            import pickle
            import os
            
            model_path = os.path.join(os.path.dirname(__file__), 'random_forest_model.pkl')
            
            with open(model_path, 'rb') as f:
                model = pickle.load(f)
            
            # Create feature vector
            features = pd.DataFrame({
                'hour': [hour],
                'day_of_week': [day_of_week],
                'disruption_type': [disruption_type_code],
                'is_rush_hour': [is_rush_hour],
                'is_weekend': [is_weekend],
                'route_distance_km': [route_distance],
                'distance_through_disruption_km': [distance_through],
                'delay_ratio': [average_delay_ratio],
                'severity_multiplier': [severity_multiplier]
            })
            
            # Make prediction
            predicted_congestion = model.predict(features)[0]
            
            # Combine ML prediction with calculated delay
            ml_adjusted_delay = base_delay * (predicted_congestion / 2.5) * 1.2
            
            # Use the higher of the two estimates
            final_delay = max(base_delay, ml_adjusted_delay)
            
            print(f"   ML model prediction: {predicted_congestion:.2f}")
            print(f"   Base calculated delay: {base_delay:.1f} min")
            print(f"   ML adjusted delay: {ml_adjusted_delay:.1f} min")
            
            return max(round(final_delay, 1), 2)
            
        except Exception as e:
            print(f"   ML model not available, using calculated delay: {e}")
            # Return calculated delay
            return max(round(base_delay, 1), 2)
