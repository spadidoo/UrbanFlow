import joblib
import pandas as pd
import numpy as np
import os
from datetime import datetime

class TrafficPredictor:
    """
    Handles traffic congestion predictions using trained Random Forest model
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
        
        df = pd.DataFrame([features])
        
        # Ensure all training features are present
        for feature in self.feature_names:
            if feature not in df.columns:
                df[feature] = 0
        
        # Reorder columns to match training
        df = df[self.feature_names]
        
        return df
    
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
        features_df = self.prepare_features(input_data)
        
        prediction = self.model.predict(features_df)[0]
        probabilities = self.model.predict_proba(features_df)[0]
        
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
    
    def estimate_delay(self, severity, base_travel_time_minutes, road_length_km, 
                   impact_factor=0.6, realtime_speed_factor=None):
        """
        Calculate delay using BPR (Bureau of Public Roads) function
        
        Reference: Bureau of Public Roads (1964) "Traffic Assignment Manual"
        Extended by Davidson (1966) and widely used in VISUM, TransCAD, etc.
        
        BPR Formula: t = t₀ * [1 + α * (V/C)^β]
        Where:
        - t₀ = free-flow travel time
        - V/C = volume-to-capacity ratio
        - α = 0.15 (standard), β = 4 (standard for urban roads)
        
        Severity mapping to V/C ratio:
        - Light (0-0.5): V/C = 0.4-0.7 (LOS B-C)
        - Moderate (0.5-1.5): V/C = 0.7-0.95 (LOS D-E)
        - Heavy (1.5-3.0): V/C = 0.95-1.2 (LOS F)
        """
        
        # Validate inputs
        if base_travel_time_minutes <= 0:
            base_travel_time_minutes = (road_length_km / 40) * 60  # Assume 40 km/h default
        if road_length_km <= 0:
            road_length_km = 1.0
        
        # Map severity to Volume/Capacity ratio
        # Based on HCM 2016 Level of Service thresholds
        if isinstance(severity, float):
            if severity < 0.5:
                v_c_ratio = 0.40 + (severity * 0.6)  # 0.4-0.7 (LOS B-C)
            elif severity < 1.5:
                v_c_ratio = 0.70 + ((severity - 0.5) * 0.25)  # 0.7-0.95 (LOS D-E)
            else:
                v_c_ratio = 0.95 + ((severity - 1.5) * 0.167)  # 0.95-1.2 (LOS F)
                v_c_ratio = min(v_c_ratio, 1.20)  # Cap at 1.2
        else:
            # Integer severity (0, 1, 2)
            v_c_map = {0: 0.55, 1: 0.82, 2: 1.08}
            v_c_ratio = v_c_map.get(severity, 0.82)
        
        # Apply disruption impact factor
        v_c_ratio = v_c_ratio * (1 + impact_factor * 0.5)
        
        # BPR function parameters
        alpha = 0.15  # Standard BPR coefficient
        beta = 4      # Standard BPR exponent (urban roads)
        
        # Calculate travel time multiplier
        if v_c_ratio <= 1.0:
            # Standard BPR for under-capacity conditions
            multiplier = 1 + alpha * (v_c_ratio ** beta)
        else:
            # Over-capacity: use hypercongestion model
            # Reference: Daganzo (2007) "Urban Gridlock"
            multiplier = 1 + alpha + (v_c_ratio - 1.0) * 2.5
        
        # Apply real-time adjustment if available
        if realtime_speed_factor is not None and realtime_speed_factor > 0:
            # Blend predicted and real-time (70/30 weight)
            realtime_multiplier = 2 - realtime_speed_factor
            realtime_multiplier = max(1.0, min(realtime_multiplier, 3.0))
            multiplier = (multiplier * 0.70) + (realtime_multiplier * 0.30)
        
        # Calculate times
        expected_travel_time = base_travel_time_minutes * multiplier
        additional_delay = expected_travel_time - base_travel_time_minutes
        additional_delay_rounded = round(additional_delay)
        
        # Apply minimum realistic delays per severity
        if severity < 0.5 and additional_delay_rounded < 1:
            additional_delay_rounded = 1
        elif 0.5 <= severity < 1.5 and additional_delay_rounded < 2:
            additional_delay_rounded = 2
        elif severity >= 1.5 and additional_delay_rounded < 5:
            additional_delay_rounded = 5
        
        # Calculate speeds
        normal_speed = (road_length_km / base_travel_time_minutes) * 60
        reduced_speed = (road_length_km / expected_travel_time) * 60
        
        if realtime_speed_factor is not None:
            reduced_speed = max(5, reduced_speed * realtime_speed_factor)
        
        speed_reduction = normal_speed - reduced_speed
        
        return {
            'base_travel_time_min': round(base_travel_time_minutes, 1),
            'expected_travel_time_min': round(expected_travel_time, 1),
            'additional_delay_min': additional_delay_rounded,
            'delay_percentage': round((additional_delay / max(base_travel_time_minutes, 1)) * 100, 1),
            'normal_speed_kmh': round(normal_speed, 1),
            'reduced_speed_kmh': round(reduced_speed, 1),
            'speed_reduction_kmh': round(speed_reduction, 1),
            'v_c_ratio': round(v_c_ratio, 2),
            'bpr_multiplier': round(multiplier, 2),
            'realtime_adjusted': realtime_speed_factor is not None,
        }