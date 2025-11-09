# backend/services/traffic_api.py

import requests
from datetime import datetime
import os

class TrafficAPIService:
    """Service to fetch real-time traffic data from TomTom API"""
    
    def __init__(self):
        # Get API key from environment variable
        self.api_key = os.getenv('TOMTOM_API_KEY', 'gTkYjtezuYmWeZeTxueWpvNR8PgzST2L')
        self.base_url = "https://api.tomtom.com/traffic/services/4"
    
    def get_traffic_flow(self, lat, lng, radius=500):
        """
        Get real-time traffic flow data for a location
        
        Args:
            lat (float): Latitude
            lng (float): Longitude
            radius (int): Radius in meters (default 500m)
            
        Returns:
            dict: Traffic flow data including speed and congestion
        """
        try:
            # TomTom Flow Segment Data endpoint
            url = f"{self.base_url}/flowSegmentData/absolute/10/json"
            
            params = {
                'key': self.api_key,
                'point': f"{lat},{lng}",
                'unit': 'KMPH'
            }
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            
            # Extract useful information
            flow_data = data.get('flowSegmentData', {})
            
            return {
                'success': True,
                'timestamp': datetime.now().isoformat(),
                'location': {'lat': lat, 'lng': lng},
                'current_speed': flow_data.get('currentSpeed', 0),
                'free_flow_speed': flow_data.get('freeFlowSpeed', 0),
                'current_travel_time': flow_data.get('currentTravelTime', 0),
                'free_flow_travel_time': flow_data.get('freeFlowTravelTime', 0),
                'confidence': flow_data.get('confidence', 0),
                'road_closure': flow_data.get('roadClosure', False),
                # Calculate congestion level
                'congestion_ratio': self._calculate_congestion_ratio(
                    flow_data.get('currentSpeed', 0),
                    flow_data.get('freeFlowSpeed', 1)
                )
            }
            
        except requests.exceptions.RequestException as e:
            print(f"❌ Traffic API Error: {e}")
            return {
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
    
    def get_incidents(self, bbox):
        """
        Get traffic incidents in a bounding box
        
        Args:
            bbox (dict): Bounding box with minLat, minLon, maxLat, maxLon
            
        Returns:
            list: Traffic incidents (accidents, construction, etc.)
        """
        try:
            url = f"{self.base_url}/incidentDetails/s3/{bbox['minLat']},{bbox['minLon']},{bbox['maxLat']},{bbox['maxLon']}/10/-1/json"
            
            params = {
                'key': self.api_key,
                'fields': '{incidents{type,geometry{type,coordinates},properties{iconCategory,magnitudeOfDelay,events{description,code}}}}'
            }
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            incidents = data.get('incidents', [])
            
            # Process incidents
            processed_incidents = []
            for incident in incidents:
                props = incident.get('properties', {})
                processed_incidents.append({
                    'type': props.get('iconCategory', 'Unknown'),
                    'delay': props.get('magnitudeOfDelay', 0),
                    'description': props.get('events', [{}])[0].get('description', ''),
                    'coordinates': incident.get('geometry', {}).get('coordinates', [])
                })
            
            return {
                'success': True,
                'incidents': processed_incidents,
                'count': len(processed_incidents)
            }
            
        except Exception as e:
            print(f"❌ Incidents API Error: {e}")
            return {
                'success': False,
                'error': str(e),
                'incidents': []
            }
    
    def _calculate_congestion_ratio(self, current_speed, free_flow_speed):
        """Calculate congestion as ratio of current to free-flow speed"""
        if free_flow_speed == 0:
            return 1.0
        
        ratio = current_speed / free_flow_speed
        
        # Classify congestion
        if ratio >= 0.8:
            return 0  # Light/No congestion
        elif ratio >= 0.5:
            return 1  # Moderate congestion
        else:
            return 2  # Heavy congestion
    
    def get_multiple_segments(self, coordinates_list):
        """
        Get traffic data for multiple road segments
        
        Args:
            coordinates_list (list): List of {lat, lng} dicts
            
        Returns:
            list: Traffic data for each segment
        """
        results = []
        
        for coord in coordinates_list:
            flow_data = self.get_traffic_flow(coord['lat'], coord['lng'])
            results.append(flow_data)
        
        return results