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
        # Get paths
        current_dir = os.path.dirname(os.path.abspath(__file__))
        
        # Load model
        model_path = os.path.join(current_dir, 'random_forest_model.pkl')
        self.model = joblib.load(model_path)
        
        # Load feature names
        features_path = os.path.join(current_dir, 'feature_names.pkl')
        self.feature_names = joblib.load(features_path)
        
        # Load model info
        info_path = os.path.join(current_dir, 'model_info.pkl')
        self.model_info = joblib.load(info_path)
        
        print(f"✓ Model loaded successfully")
        print(f"  Accuracy: {self.model_info['accuracy']*100:.2f}%")
        print(f"  MAE: {self.model_info['mae']:.4f}")
        print(f"  Features: {self.model_info['n_features']}")
    
    def prepare_features(self, input_data):
        """
        Prepare input data to match training features
        
        Args:
            input_data (dict): User input containing:
                - date: datetime or string 'YYYY-MM-DD'
                - hour: int (0-23)
                - area: str ('Bucal', 'Parian', 'Turbina')
                - road_corridor: str ('Calamba_Pagsanjan', 'Maharlika_Parian', 'Maharlika_Turbina')
                - has_disruption: int (0 or 1)
                - disruption_type: str ('roadwork', 'incident', 'accident', 'weather', 'event') or None
                - total_volume: float (optional, default 0)
                - has_real_status: int (0 or 1, optional)
        
        Returns:
            pd.DataFrame: Features ready for prediction
        """
        
        # Convert date string to datetime if needed
        if isinstance(input_data['date'], str):
            date = pd.to_datetime(input_data['date'])
        else:
            date = input_data['date']
        
        hour = input_data['hour']
        
        # Initialize features dictionary
        features = {}
        
        # ============================================================
        # TEMPORAL FEATURES
        # ============================================================
        
        features['hour'] = hour
        features['hour_sin'] = np.sin(2 * np.pi * hour / 24)
        features['hour_cos'] = np.cos(2 * np.pi * hour / 24)
        features['month'] = date.month
        features['day_of_month'] = date.day
        features['day_of_week_num'] = date.dayofweek  # 0=Monday, 6=Sunday
        features['is_weekend'] = 1 if date.dayofweek >= 5 else 0
        features['is_friday'] = 1 if date.dayofweek == 4 else 0
        
        # Philippine holidays (2024-2025)
        holidays = [
            '2024-01-01', '2024-04-09', '2024-05-01', '2024-06-12', 
            '2024-08-26', '2024-11-01', '2024-11-30', '2024-12-25', '2024-12-30',
            '2025-01-01', '2025-04-18', '2025-05-01', '2025-06-12',
            '2025-08-25', '2025-11-01', '2025-11-30', '2025-12-25', '2025-12-30'
        ]
        features['is_holiday'] = 1 if date.strftime('%Y-%m-%d') in holidays else 0
        
        # Rush hour features
        features['is_rush_hour'] = 1 if (6 <= hour <= 9) or (16 <= hour <= 19) else 0
        features['is_peak_rush'] = 1 if hour in [7, 8, 17, 18] else 0
        
        # ============================================================
        # TRAFFIC FEATURES
        # ============================================================
        
        features['total_volume'] = input_data.get('total_volume', 0)
        
        # ============================================================
        # DISRUPTION FEATURES
        # ============================================================
        
        features['has_disruption'] = input_data.get('has_disruption', 0)
        
        # Disruption type binary features
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
        
        # Calculate completeness score
        features['data_completeness_score'] = (
            features['has_real_status'] + 
            features['has_volume_data'] + 
            features['has_disruption']
        )
        
        # ============================================================
        # ONE-HOT ENCODED FEATURES (ROAD)
        # ============================================================
        
        road_corridor = input_data.get('road_corridor', 'Calamba_Pagsanjan')
        features['road_Calamba_Pagsanjan'] = 1 if road_corridor == 'Calamba_Pagsanjan' else 0
        features['road_Maharlika_Parian'] = 1 if road_corridor == 'Maharlika_Parian' else 0
        features['road_Maharlika_Turbina'] = 1 if road_corridor == 'Maharlika_Turbina' else 0
        
        # ============================================================
        # ONE-HOT ENCODED FEATURES (TIME SEGMENT)
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
        # ONE-HOT ENCODED FEATURES (AREA)
        # ============================================================
        
        area = input_data.get('area', 'Bucal')
        features['area_Bucal'] = 1 if area == 'Bucal' else 0
        features['area_Parian'] = 1 if area == 'Parian' else 0
        features['area_Turbina'] = 1 if area == 'Turbina' else 0
        
        # ============================================================
        # CREATE DATAFRAME WITH CORRECT COLUMN ORDER
        # ============================================================
        
        # Create dataframe with all feature names from training
        df = pd.DataFrame([features])
        
        # Ensure all training features are present (fill missing with 0)
        for feature in self.feature_names:
            if feature not in df.columns:
                df[feature] = 0
        
        # Reorder columns to match training data
        df = df[self.feature_names]
        
        return df
    
    def predict(self, input_data):
        """
        Make a prediction for given input
        
        Args:
            input_data (dict): User input (see prepare_features for format)
        
        Returns:
            dict: Prediction results with severity, confidence, and label
        """
        
        # Prepare features
        features_df = self.prepare_features(input_data)
        
        # Make prediction
        prediction = self.model.predict(features_df)[0]
        
        # Get prediction probabilities
        probabilities = self.model.predict_proba(features_df)[0]
        
        # Map prediction to label
        severity_labels = {
            0: 'Light',
            1: 'Moderate',
            2: 'Heavy'
        }
        
        result = {
            'severity': int(prediction),
            'severity_label': severity_labels[prediction],
            'confidence': float(probabilities[prediction]),
            'probabilities': {
                'light': float(probabilities[0]),
                'moderate': float(probabilities[1]),
                'heavy': float(probabilities[2])
            }
        }
        
        return result
    
    def predict_multiple(self, input_list):
        """
        Make predictions for multiple inputs
        
        Args:
            input_list (list): List of input dictionaries
        
        Returns:
            list: List of prediction results
        """
        
        results = []
        for input_data in input_list:
            result = self.predict(input_data)
            results.append(result)
        
        return results
    
    # backend/models/predictor.py
    # ADD THIS METHOD to your TrafficPredictor class
    def estimate_delay(self, severity, base_travel_time_minutes, road_length_km, impact_factor=0.6, realtime_speed_factor=None):
        """
        Enhanced delay estimation with road characteristics and real-time traffic integration
        
        Parameters:
        -----------
        severity : int or float
            Traffic severity level (0=Light, 1=Moderate, 2=Heavy)
        base_travel_time_minutes : float
            Normal free-flow travel time in minutes
        road_length_km : float
            Length of the affected road segment
        impact_factor : float
            Disruption impact multiplier (0-1), from disruption_factors
        realtime_speed_factor : float, optional
            Real-time speed adjustment (current_speed / free_flow_speed)
            If provided, adjusts predictions based on current traffic conditions
        
        Returns:
        --------
        dict : Delay information including travel times, delays, and speeds
        
        Example:
        --------
        >>> # Without real-time
        >>> delay_info = predictor.estimate_delay(
        ...     severity=2,
        ...     base_travel_time_minutes=10,
        ...     road_length_km=5,
        ...     impact_factor=0.6
        ... )
        
        >>> # With real-time adjustment
        >>> delay_info = predictor.estimate_delay(
        ...     severity=2,
        ...     base_travel_time_minutes=10,
        ...     road_length_km=5,
        ...     impact_factor=0.6,
        ...     realtime_speed_factor=0.75  # Current traffic 75% of normal speed
        ... )
        """
        
        # ✅ VALIDATE INPUTS
        if base_travel_time_minutes <= 0:
            base_travel_time_minutes = 10  # Default fallback
        
        if road_length_km <= 0:
            road_length_km = 1.0  # Default fallback

        # Delay multipliers by severity level
        delay_multipliers = {
            0: 1.1,   # Light: 10% increase
            1: 1.5,   # Moderate: 50% increase
            2: 2.5,   # Heavy: 150% increase
        }
        
        # Handle float severity (from ML model) by rounding to nearest category
        if isinstance(severity, float):
            if severity < 0.5:
                severity_key = 0
            elif severity < 1.5:
                severity_key = 1
            else:
                severity_key = 2
        else:
            severity_key = severity
        
        # Get multiplier for this severity level
        multiplier = delay_multipliers.get(severity_key, 1.5)
        
        # Apply impact factor (from road characteristics)
        adjusted_multiplier = 1 + (multiplier - 1) * impact_factor
        
        # ✅ APPLY REAL-TIME ADJUSTMENT
        if realtime_speed_factor is not None:
            # If current traffic is already slow, increase the delay
            # If current traffic is fast, decrease the delay slightly
            realtime_adjustment = 2 - realtime_speed_factor  # Inverse relationship
            # Blend prediction with real-time (70% prediction, 30% real-time)
            adjusted_multiplier = (adjusted_multiplier * 0.7) + (realtime_adjustment * 0.3)
            
            # Ensure multiplier stays within reasonable bounds
            adjusted_multiplier = max(1.0, min(adjusted_multiplier, 3.0))
        
        # Calculate expected travel time with disruption
        expected_travel_time = base_travel_time_minutes * adjusted_multiplier
        
        # Calculate additional delay
        additional_delay = expected_travel_time - base_travel_time_minutes
        
        # ✅ CLEAN ROUNDING FOR DELAY
        # Round to nearest whole minute for cleaner display
        additional_delay_rounded = round(additional_delay)
        
        # Ensure minimum delays based on severity
        if severity_key == 0 and additional_delay_rounded < 1:
            additional_delay_rounded = 1  # Light: at least 1 min
        elif severity_key == 1 and additional_delay_rounded < 3:
            additional_delay_rounded = 3  # Moderate: at least 3 mins
        elif severity_key == 2 and additional_delay_rounded < 5:
            additional_delay_rounded = 5  # Heavy: at least 5 mins
        
        # Calculate speeds (km/h)
        # ✅ SAFE SPEED CALCULATIONS
        if base_travel_time_minutes > 0:
            normal_speed = (road_length_km / base_travel_time_minutes) * 60
        else:
            normal_speed = 50  # Default speed
        
        if expected_travel_time > 0:
            reduced_speed = (road_length_km / expected_travel_time) * 60
        else:
            reduced_speed = normal_speed * 0.5
        
        # ✅ APPLY REAL-TIME SPEED ADJUSTMENT
        if realtime_speed_factor is not None and realtime_speed_factor > 0:
            # Adjust reduced speed based on current conditions
            reduced_speed = reduced_speed * realtime_speed_factor
            reduced_speed = max(5, reduced_speed)  # Minimum 5 km/h
        
        # Speed reduction
        speed_reduction = normal_speed - reduced_speed
        
        return {
            'base_travel_time_min': round(base_travel_time_minutes, 1),
            'expected_travel_time_min': round(expected_travel_time, 1),
            'additional_delay_min': additional_delay_rounded,  # ✅ Clean integer
            'delay_percentage': round((additional_delay / base_travel_time_minutes) * 100, 1),
            'normal_speed_kmh': round(normal_speed, 1),
            'reduced_speed_kmh': round(reduced_speed, 1),
            'speed_reduction_kmh': round(speed_reduction, 1),
            'realtime_adjusted': realtime_speed_factor is not None,  # ✅ Flag for UI
        }
    


# ============================================================
# EXAMPLE USAGE
# ============================================================

if __name__ == "__main__":
    # Test the predictor
    predictor = TrafficPredictor()
    
    # Example 1: Weekday morning rush with roadwork
    print("\n" + "="*60)
    print("Example 1: Monday 8 AM, Bucal, with roadwork")
    print("="*60)
    
    test_input = {
        'date': '2025-01-13',  # Monday
        'hour': 8,
        'area': 'Bucal',
        'road_corridor': 'Calamba_Pagsanjan',
        'has_disruption': 1,
        'disruption_type': 'roadwork',
        'total_volume': 0,
        'has_real_status': 0
    }
    
    result = predictor.predict(test_input)
    
    print(f"\nPrediction: {result['severity_label']}")
    print(f"Confidence: {result['confidence']*100:.1f}%")
    print(f"\nProbabilities:")
    print(f"  Light:    {result['probabilities']['light']*100:.1f}%")
    print(f"  Moderate: {result['probabilities']['moderate']*100:.1f}%")
    print(f"  Heavy:    {result['probabilities']['heavy']*100:.1f}%")
    
    # Example 2: Weekend afternoon, no disruption
    print("\n" + "="*60)
    print("Example 2: Saturday 2 PM, Parian, no disruption")
    print("="*60)
    
    test_input2 = {
        'date': '2025-01-18',  # Saturday
        'hour': 14,
        'area': 'Parian',
        'road_corridor': 'Maharlika_Parian',
        'has_disruption': 0,
        'disruption_type': None,
        'total_volume': 0,
        'has_real_status': 0
    }
    
    result2 = predictor.predict(test_input2)
    
    print(f"\nPrediction: {result2['severity_label']}")
    print(f"Confidence: {result2['confidence']*100:.1f}%")
    print(f"\nProbabilities:")
    print(f"  Light:    {result2['probabilities']['light']*100:.1f}%")
    print(f"  Moderate: {result2['probabilities']['moderate']*100:.1f}%")
    print(f"  Heavy:    {result2['probabilities']['heavy']*100:.1f}%")