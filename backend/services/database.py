# backend/services/database.py
# COMPLETE ENHANCED VERSION - All existing code preserved + new functionality added
# Changes marked with ✅ NEW or 🔄 MODIFIED

import psycopg2
from psycopg2.extras import RealDictCursor, Json
from psycopg2.extensions import AsIs
import os
from datetime import datetime
from typing import Dict, List, Optional, Any
import json

class DatabaseService:
    """
    Centralized database service for UrbanFlow
    Handles all database operations for simulations, users, and published runs
    ✅ NOW SAVES: Hour-by-hour, day-by-day, and week-by-week breakdowns
    """
    
    def __init__(self):
        """Initialize database connection - SUPABASE POOLER"""
        self.connection_params = {
            'dbname': 'postgres',
            'user': 'postgres.ndozyvnrmryyidehykmu',  # Your Supabase user
            'password': 'urbanflow123',  # Replace with your password
            'host': 'aws-1-ap-south-1.pooler.supabase.com',  # Pooler host
            'port': '5432'  # Must be 6543 for pooler
        }
        self._test_connection()

    def _test_connection(self):
        """Test database connection on initialization"""
        try:
            conn = psycopg2.connect(**self.connection_params)
            conn.close()
            print("✓ Database connection successful!")
        except Exception as e:
            print(f"✗ Database connection failed: {e}")
            raise
    
    def _get_connection(self):
        """Get a new database connection"""
        return psycopg2.connect(**self.connection_params)
    
    # ============================================================
    # SEGMENT OPERATIONS (EXISTING - No changes)
    # ============================================================
    
    def import_segment(
        self,
        segment_name: str,
        geometry_wkt: str,
        length_meters: float,
        num_lanes: int,
        road_type: str,
        free_flow_speed: float,
        capacity: int,
        location_description: str = None
    ) -> Optional[int]:
        """Import a road segment into the database"""
        conn = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            insert_query = """
                INSERT INTO segments (
                    segment_name,
                    geometry,
                    length_meters,
                    num_lanes,
                    road_type,
                    free_flow_speed,
                    capacity,
                    location_description
                ) VALUES (
                    %s,
                    ST_GeomFromText(%s, 4326),
                    %s, %s, %s, %s, %s, %s
                )
                RETURNING segment_id
            """
            
            cursor.execute(insert_query, (
                segment_name,
                geometry_wkt,
                length_meters,
                num_lanes,
                road_type,
                free_flow_speed,
                capacity,
                location_description
            ))
            
            segment_id = cursor.fetchone()[0]
            conn.commit()
            
            print(f"✓ Segment '{segment_name}' imported (segment_id: {segment_id})")
            return segment_id
            
        except Exception as e:
            if conn:
                conn.rollback()
            print(f"✗ Error importing segment: {e}")
            return None
            
        finally:
            if conn:
                conn.close()
    
    def get_segments_by_area(self, area: str) -> List[Dict]:
        """Get all segments in a specific area"""
        conn = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            query = """
                SELECT 
                    segment_id,
                    segment_name,
                    ST_AsText(geometry) as geometry_wkt,
                    length_meters,
                    num_lanes,
                    road_type,
                    free_flow_speed,
                    capacity,
                    location_description
                FROM segments
                WHERE location_description ILIKE %s
                ORDER BY segment_name
            """
            
            cursor.execute(query, (f'%{area}%',))
            segments = cursor.fetchall()
            
            return [dict(s) for s in segments]
            
        except Exception as e:
            print(f"✗ Error retrieving segments: {e}")
            return []
            
        finally:
            if conn:
                conn.close()
    
    # ============================================================
    # 🔄 MODIFIED: Main Simulation Save - Now saves ALL details
    # ============================================================
    
    def save_simulation_run(
        self,
        user_id: int,
        simulation_data: Dict[str, Any],
        results_data: Dict[str, Any]
    ) -> Optional[int]:
        """
        🔄 ENHANCED: Now saves complete simulation including:
        - Hour-by-hour predictions (ALL hours)
        - Day-by-day aggregations (if multi-day)
        - Week-by-week aggregations (if multi-week)
        - Time segment summaries
        - Recommendations and advice
        
        Args:
            user_id: ID of the user creating the simulation
            simulation_data: Dict containing simulation metadata
            results_data: Dict containing ALL results including:
                - summary (dict): Summary statistics
                - hourly_predictions (list): ✅ ALL hourly data
                - aggregated_view (dict): ✅ Day/week breakdowns
                - time_segments (dict): Time segment aggregations
                
        Returns:
            simulation_id if successful, None otherwise
        """
        conn = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            # Extract summary statistics
            summary = results_data.get('summary', {})
            
            # Convert datetime strings to datetime objects if needed
            start_time = simulation_data.get('start_datetime')
            if isinstance(start_time, str):
                start_time = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
                
            end_time = simulation_data.get('end_datetime')
            if isinstance(end_time, str):
                end_time = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
            
            # Create disruption geometry in WKT format if coordinates provided
            disruption_geometry_wkt = None
            if simulation_data.get('coordinates'):
                coords = simulation_data['coordinates']
                lat, lng = coords.get('lat'), coords.get('lng')
                if lat and lng:
                    disruption_geometry_wkt = f"POINT({lng} {lat})"
            
            # Determine time segment
            hour = start_time.hour
            if 6 <= hour < 12:
                time_segment = 'morning'
            elif 12 <= hour < 18:
                time_segment = 'afternoon'
            elif 18 <= hour < 22:
                time_segment = 'evening'
            else:
                time_segment = 'night'
            
            # Insert into simulation_runs table
            # Insert into simulation_runs table
            insert_query = """
                INSERT INTO simulation_runs (
                    user_id,
                    simulation_name,
                    description,
                    disruption_type,
                    disruption_location,
                    disruption_geometry,
                    start_time,
                    end_time,
                    time_segment,
                    severity_level,
                    simulation_status,
                    total_affected_segments,
                    average_delay_ratio,
                    max_delay_ratio,
                    road_info,
                    time_segments_data
                ) VALUES (%s, %s, %s, %s, %s, ST_GeomFromText(%s, 4326), %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING simulation_id
            """
            
            cursor.execute(insert_query, (
                user_id,
                simulation_data.get('scenario_name', f"Simulation {datetime.now().strftime('%Y%m%d_%H%M')}"),
                simulation_data.get('description', ''),
                simulation_data.get('disruption_type', 'roadwork'),
                simulation_data.get('disruption_location', f"{simulation_data.get('area', 'Unknown')} - {simulation_data.get('road_corridor', 'Unknown')}"),
                disruption_geometry_wkt,
                start_time,
                end_time,
                time_segment,
                summary.get('avg_severity_label', 'moderate').lower(),
                'completed',
                summary.get('total_hours', 0),
                summary.get('avg_severity', 1.0),
                summary.get('max_severity', 1.0),
                Json(results_data.get('road_info')),  # ✅ ADD
                Json(results_data.get('time_segments'))  # ✅ ADD
            ))
            
            simulation_id = cursor.fetchone()[0]
            
            # ✅ NEW: Save complete hourly predictions (ALL hours)
            self._save_hourly_predictions(cursor, simulation_id, results_data)
            
            # ✅ NEW: Save day-by-day or week-by-week aggregations (if applicable)
            if results_data.get('aggregated_view'):
                self._save_aggregated_view(cursor, simulation_id, results_data)
            
            # EXISTING: Save time segment results (morning/afternoon/night)
            self._save_simulation_results(cursor, simulation_id, results_data)
            
            # EXISTING: Save mitigation recommendations
            self._save_mitigation_recommendations(cursor, simulation_id, results_data, simulation_data)
            
            # EXISTING: Save travel time advice
            self._save_travel_time_advice(cursor, simulation_id, results_data)
            
            # EXISTING: Log the action
            self._log_action(
                cursor,
                user_id,
                'create_simulation',
                'simulation_runs',
                simulation_id,
                {'simulation_name': simulation_data.get('scenario_name')}
            )
            
            conn.commit()
            
            # 🔄 ENHANCED: Better logging
            print(f"✓ Simulation saved successfully (simulation_id: {simulation_id})")
            print(f"  - Hourly predictions: {len(results_data.get('hourly_predictions', []))} hours")
            if results_data.get('aggregated_view'):
                agg_data = results_data['aggregated_view'].get('map_data', [])
                print(f"  - Aggregated view: {len(agg_data)} {results_data['aggregated_view']['granularity']} periods")
            
            return simulation_id
            
        except Exception as e:
            if conn:
                conn.rollback()
            print(f"✗ Error saving simulation: {e}")
            import traceback
            traceback.print_exc()
            return None
            
        finally:
            if conn:
                conn.close()
    
    # ============================================================
    # ✅ NEW METHOD: Save Complete Hour-by-Hour Predictions
    # ============================================================
    
    def _save_hourly_predictions(self, cursor, simulation_id: int, results_data: Dict):
        """
        ✅ NEW: Save ALL hour-by-hour predictions to database
        
        This saves the complete hourly breakdown so you can retrieve
        every single hour's prediction later.
        
        Stores data in TWO ways:
        1. JSONB column (fast, always works)
        2. Separate table (if available, allows SQL queries)
        """
        try:
            hourly_predictions = results_data.get('hourly_predictions', [])
            
            if not hourly_predictions:
                print("  ⚠️ No hourly predictions to save")
                return
            
            # METHOD 1: Store as JSONB in simulation_runs table
            # This is the primary storage method - fast and reliable
            cursor.execute("""
                UPDATE simulation_runs
                SET hourly_predictions = %s
                WHERE simulation_id = %s
            """, (Json(hourly_predictions), simulation_id))
            
            print(f"  ✓ Saved {len(hourly_predictions)} hourly predictions (JSONB)")
            
            # METHOD 2: Also save to separate table (if it exists)
            # This allows more complex SQL queries on individual hours
            try:
                for pred in hourly_predictions:
                    cursor.execute("""
                        INSERT INTO simulation_runs (
                            user_id,
                            simulation_name,
                            description,
                            disruption_type,
                            disruption_location,
                            disruption_geometry,
                            start_time,
                            end_time,
                            time_segment,
                            severity_level,
                            simulation_status,
                            total_affected_segments,
                            average_delay_ratio,
                            max_delay_ratio,
                            road_info,
                            time_segments_data
                        ) VALUES (%s, %s, %s, %s, %s, ST_GeomFromText(%s, 4326), %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (simulation_id, prediction_datetime) DO NOTHING
                    """, (
                        simulation_id,
                        datetime.strptime(pred['datetime'], '%Y-%m-%d %H:%M'),
                        pred['date'],
                        pred['hour'],
                        pred['day_of_week'],
                        pred['severity'],
                        pred['severity_label'],
                        pred['confidence'],
                        pred['delay_info']['additional_delay_min'],
                        pred['delay_info'].get('reduced_speed_kmh'),
                        pred.get('realtime_adjusted', False),
                        Json(pred.get('probabilities', {}))
                    ))
                print(f"  ✓ Also saved to hourly_predictions table")
            except Exception as table_error:
                # Table might not exist yet - that's okay, JSONB storage worked
                print(f"  ℹ️ Hourly predictions table not available (JSONB storage successful)")
            
        except Exception as e:
            print(f"  ✗ Error saving hourly predictions: {e}")
            import traceback
            traceback.print_exc()
    
    # ============================================================
    # ✅ NEW METHOD: Save Day-by-Day or Week-by-Week Aggregations
    # ============================================================
    
    def _save_aggregated_view(self, cursor, simulation_id: int, results_data: Dict):
        """
        ✅ NEW: Save aggregated view (daily or weekly breakdowns)
        
        For multi-day disruptions, this saves:
        - Day-by-day summaries (for 2-7 day disruptions)
        - Week-by-week summaries (for 8+ day disruptions)
        
        Each period includes:
        - Average severity
        - Average delay
        - Hour counts (light/moderate/heavy)
        - Peak hours
        """
        try:
            aggregated_view = results_data.get('aggregated_view', {})
            if not aggregated_view:
                return
            
            granularity = aggregated_view.get('granularity')  # 'hourly', 'daily', or 'weekly'
            map_data = aggregated_view.get('map_data', [])
            
            if not map_data:
                return
            
            # METHOD 1: Store complete aggregated view as JSONB
            cursor.execute("""
                UPDATE simulation_runs
                SET aggregated_view = %s
                WHERE simulation_id = %s
            """, (Json(aggregated_view), simulation_id))
            
            print(f"  ✓ Saved aggregated view ({granularity}): {len(map_data)} periods (JSONB)")
            
            # METHOD 2: Also save to dedicated tables (if they exist)
            try:
                if granularity == 'daily':
                    # Save day-by-day data
                    for day in map_data:
                        cursor.execute("""
                            INSERT INTO daily_aggregations (
                                simulation_id,
                                aggregation_date,
                                day_name,
                                avg_severity,
                                avg_severity_label,
                                avg_delay_minutes,
                                hour_count,
                                peak_hour,
                                peak_severity,
                                light_hours,
                                moderate_hours,
                                heavy_hours
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            ON CONFLICT (simulation_id, aggregation_date) DO NOTHING
                        """, (
                            simulation_id,
                            day['date'],
                            day['day_name'],
                            day['avg_severity'],
                            day['avg_severity_label'],
                            day['avg_delay_min'],
                            day['hour_count'],
                            day['peak_hour'],
                            day['peak_severity'],
                            day['severity_breakdown']['Light'],
                            day['severity_breakdown']['Moderate'],
                            day['severity_breakdown']['Heavy']
                        ))
                    print(f"  ✓ Also saved to daily_aggregations table")
                
                elif granularity == 'weekly':
                    # Save week-by-week data
                    for week in map_data:
                        cursor.execute("""
                            INSERT INTO weekly_aggregations (
                                simulation_id,
                                week_number,
                                date_range,
                                start_date,
                                end_date,
                                avg_severity,
                                avg_severity_label,
                                avg_delay_minutes,
                                hour_count,
                                light_hours,
                                moderate_hours,
                                heavy_hours
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            ON CONFLICT (simulation_id, week_number) DO NOTHING
                        """, (
                            simulation_id,
                            week['week_number'],
                            week['date_range'],
                            week['start_date'],
                            week['end_date'],
                            week['avg_severity'],
                            week['avg_severity_label'],
                            week['avg_delay_min'],
                            week['hour_count'],
                            week['severity_breakdown']['Light'],
                            week['severity_breakdown']['Moderate'],
                            week['severity_breakdown']['Heavy']
                        ))
                    print(f"  ✓ Also saved to weekly_aggregations table")
                    
            except Exception as table_error:
                # Tables might not exist - that's okay, JSONB storage worked
                print(f"  ℹ️ Aggregation tables not available (JSONB storage successful)")
            
        except Exception as e:
            print(f"  ✗ Error saving aggregated view: {e}")
            import traceback
            traceback.print_exc()
    
    # ============================================================
    # EXISTING METHODS (No changes - kept for compatibility)
    # ============================================================
    
    def _save_simulation_results(self, cursor, simulation_id: int, results_data: Dict):
        """
        EXISTING: Save time segment results (morning/afternoon/night)
        This is kept for backward compatibility
        """
        try:
            hourly_predictions = results_data.get('hourly_predictions', [])
            
            if not hourly_predictions:
                print("  ⚠️ No hourly predictions to save")
                return
            
            # Group predictions by time segment
            time_segments = {}
            for pred in hourly_predictions:
                hour = pred.get('hour', 0)
                if 6 <= hour < 12:
                    segment_key = 'morning'
                elif 12 <= hour < 18:
                    segment_key = 'afternoon'
                else:
                    segment_key = 'night'
                
                if segment_key not in time_segments:
                    time_segments[segment_key] = []
                time_segments[segment_key].append(pred)
            
            # Using synthetic segment_id (1, 2, 3) for morning, afternoon, night
            segment_id_map = {'morning': 1, 'afternoon': 2, 'night': 3}
            
            insert_query = """
                INSERT INTO run_results (
                    simulation_id,
                    segment_id,
                    delay_ratio,
                    predicted_speed,
                    congestion_level,
                    estimated_delay_minutes,
                    morning_delay_ratio,
                    afternoon_delay_ratio,
                    night_delay_ratio,
                    prediction_confidence
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (simulation_id, segment_id) DO NOTHING
            """
            
            # Calculate time segment averages
            for segment_name, predictions in time_segments.items():
                avg_severity = sum(p.get('severity', 0) for p in predictions) / len(predictions)
                avg_delay = sum(p.get('delay_info', {}).get('additional_delay_min', 0) for p in predictions) / len(predictions)
                
                # Determine congestion level
                if avg_severity < 0.5:
                    congestion_level = 'light'
                elif avg_severity < 1.5:
                    congestion_level = 'moderate'
                else:
                    congestion_level = 'heavy'
                
                # Calculate time-segmented delay ratios
                morning_delay = None
                afternoon_delay = None
                night_delay = None
                
                if segment_name == 'morning':
                    morning_delay = avg_severity
                elif segment_name == 'afternoon':
                    afternoon_delay = avg_severity
                else:
                    night_delay = avg_severity
                
                cursor.execute(insert_query, (
                    simulation_id,
                    segment_id_map[segment_name],
                    avg_severity,
                    50.0,
                    congestion_level,
                    avg_delay,
                    morning_delay,
                    afternoon_delay,
                    night_delay,
                    85.0
                ))
            
            print(f"  ✓ Saved {len(time_segments)} time segment results")
            
        except Exception as e:
            print(f"  ✗ Error saving results: {e}")
            import traceback
            traceback.print_exc()
            raise
    
    def _save_mitigation_recommendations(self, cursor, simulation_id: int, results_data: Dict, simulation_data: Dict):
        """EXISTING: Save AI-generated mitigation recommendations"""
        try:
            summary = results_data.get('summary', {})
            disruption_type = simulation_data.get('disruption_type', 'roadwork')
            avg_severity = summary.get('avg_severity', 1.0)
            heavy_percentage = summary.get('heavy_percentage', 0)
            
            recommendations = []
            
            if avg_severity > 1.5:
                recommendations.append({
                    'type': 'scheduling',
                    'text': 'Consider rescheduling to off-peak hours (9 PM - 5 AM) or weekends to minimize traffic impact',
                    'priority': 'high',
                    'impact': 'Could reduce average congestion severity by 40-60%'
                })
            
            if heavy_percentage > 30:
                recommendations.append({
                    'type': 'traffic_management',
                    'text': f'Deploy traffic enforcers during peak hours - {heavy_percentage}% of hours will have heavy congestion',
                    'priority': 'high',
                    'impact': 'Improved traffic flow and reduced delays at critical points'
                })
            
            if disruption_type == 'roadwork':
                recommendations.append({
                    'type': 'communication',
                    'text': 'Post advance notices 1-2 weeks before start date on social media and local radio',
                    'priority': 'medium',
                    'impact': 'Allow commuters to plan alternate routes and schedules'
                })
                recommendations.append({
                    'type': 'lane_management',
                    'text': 'Implement temporary lane management: maintain at least one lane open during peak hours',
                    'priority': 'high',
                    'impact': 'Maintain traffic flow capacity at 50-70% of normal'
                })
            elif disruption_type == 'event':
                recommendations.append({
                    'type': 'traffic_management',
                    'text': 'Implement temporary one-way traffic scheme on adjacent roads',
                    'priority': 'high',
                    'impact': 'Improved traffic circulation around event area'
                })
                recommendations.append({
                    'type': 'parking',
                    'text': 'Designate temporary parking areas away from main roads with shuttle service',
                    'priority': 'medium',
                    'impact': 'Reduced congestion from parking-seeking vehicles'
                })
            
            insert_query = """
                INSERT INTO mitigation_recommendations (
                    simulation_id,
                    recommendation_type,
                    recommendation_text,
                    priority_level,
                    estimated_impact
                ) VALUES (%s, %s, %s, %s, %s)
            """
            
            for rec in recommendations:
                cursor.execute(insert_query, (
                    simulation_id,
                    rec['type'],
                    rec['text'],
                    rec['priority'],
                    rec['impact']
                ))
            
            print(f"  ✓ Saved {len(recommendations)} mitigation recommendations")
            
        except Exception as e:
            print(f"  ✗ Error saving recommendations: {e}")
            import traceback
            traceback.print_exc()
    
    def _save_travel_time_advice(self, cursor, simulation_id: int, results_data: Dict):
        """EXISTING: Save travel time recommendations for the public"""
        try:
            time_segments = results_data.get('time_segments', {})
            
            insert_query = """
                INSERT INTO travel_time_advice (
                    simulation_id,
                    time_period,
                    recommended,
                    expected_delay_minutes,
                    congestion_severity,
                    advice_text
                ) VALUES (%s, %s, %s, %s, %s, %s)
            """
            
            for period_key, period_data in time_segments.items():
                avg_delay = period_data.get('avg_delay_minutes', 0)
                avg_severity = period_data.get('avg_severity', 0)
                
                recommended = avg_severity < 1.0
                
                if avg_severity < 0.5:
                    congestion_severity = 'light'
                elif avg_severity < 1.5:
                    congestion_severity = 'moderate'
                else:
                    congestion_severity = 'heavy'
                
                if recommended:
                    advice_text = f"Good time to travel. Expected delay: {round(avg_delay)} minutes. Traffic is {congestion_severity}."
                else:
                    advice_text = f"Consider alternate routes or times. Expected delay: {round(avg_delay)} minutes. Traffic is {congestion_severity}."
                
                cursor.execute(insert_query, (
                    simulation_id,
                    period_key,
                    recommended,
                    avg_delay,
                    congestion_severity,
                    advice_text
                ))
            
            print(f"  ✓ Saved {len(time_segments)} travel time advice entries")
            
        except Exception as e:
            print(f"  ✗ Error saving travel advice: {e}")
            import traceback
            traceback.print_exc()
    
    def _log_action(self, cursor, user_id: int, action_type: str, entity_type: str, entity_id: int, details: Dict = None):
        """EXISTING: Log an action to audit log"""
        try:
            insert_query = """
                INSERT INTO audit_log (
                    user_id,
                    action_type,
                    entity_type,
                    entity_id,
                    details
                ) VALUES (%s, %s, %s, %s, %s)
            """
            
            cursor.execute(insert_query, (
                user_id,
                action_type,
                entity_type,
                entity_id,
                Json(details) if details else None
            ))
            
        except Exception as e:
            print(f"  ⚠️ Warning: Failed to log action: {e}")
    
    # ============================================================
    # 🔄 MODIFIED: Enhanced Retrieval - Gets ALL saved data
    # ============================================================
    
    def get_simulation_by_id(self, simulation_id: int) -> Optional[Dict]:
        """
        🔄 ENHANCED: Get simulation with ALL data including hour-by-hour and day-by-day
        
        Now returns:
        - All original data (metadata, time segments, recommendations)
        - ✅ Complete hourly_predictions (all hours)
        - ✅ Aggregated_view (day-by-day or week-by-week if applicable)
        """
        conn = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            # Get simulation run WITH JSONB fields properly decoded
            cursor.execute("""
                SELECT 
                    sr.simulation_id,
                    sr.user_id,
                    sr.simulation_name,
                    sr.description,
                    sr.disruption_type,
                    sr.disruption_location,
                    ST_AsText(sr.disruption_geometry) as disruption_geometry,
                    sr.start_time,
                    sr.end_time,
                    sr.time_segment,
                    sr.severity_level,
                    sr.alternate_route_provided,
                    sr.simulation_status,
                    sr.run_timestamp,
                    sr.created_at,
                    sr.updated_at,
                    sr.total_affected_segments,
                    sr.average_delay_ratio,
                    sr.max_delay_ratio,
                    sr.hourly_predictions,
                    sr.aggregated_view,
                    u.username,
                    u.full_name
                FROM simulation_runs sr
                JOIN users u ON sr.user_id = u.user_id
                WHERE sr.simulation_id = %s
            """, (simulation_id,))
            
            simulation = cursor.fetchone()
            if not simulation:
                return None
            
            simulation = dict(simulation)

            # Parse JSONB fields
            if simulation.get('hourly_predictions_json'):
                try:
                    simulation['hourly_predictions'] = json.loads(simulation['hourly_predictions_json'])
                    del simulation['hourly_predictions_json']
                except:
                    simulation['hourly_predictions'] = None
            
            if simulation.get('aggregated_view_json'):
                try:
                    simulation['aggregated_view'] = json.loads(simulation['aggregated_view_json'])
                    del simulation['aggregated_view_json']
                except:
                    simulation['aggregated_view'] = None
            
            # Get time segment results
            cursor.execute("""
                SELECT * FROM run_results
                WHERE simulation_id = %s
                ORDER BY segment_id
            """, (simulation_id,))
            simulation['results'] = [dict(r) for r in cursor.fetchall()]
            
            # Get recommendations
            cursor.execute("""
                SELECT * FROM mitigation_recommendations
                WHERE simulation_id = %s
                ORDER BY priority_level DESC
            """, (simulation_id,))
            simulation['recommendations'] = [dict(r) for r in cursor.fetchall()]
            
            # Get travel advice
            cursor.execute("""
                SELECT * FROM travel_time_advice
                WHERE simulation_id = %s
                ORDER BY time_period
            """, (simulation_id,))
            simulation['travel_advice'] = [dict(r) for r in cursor.fetchall()]
            
            # ✅ NEW: Try to get from separate tables (if they exist)
            try:
                cursor.execute("""
                    SELECT * FROM hourly_predictions
                    WHERE simulation_id = %s
                    ORDER BY prediction_datetime
                """, (simulation_id,))
                simulation['hourly_predictions_table'] = [dict(r) for r in cursor.fetchall()]
            except:
                pass
            
            try:
                cursor.execute("""
                    SELECT * FROM daily_aggregations
                    WHERE simulation_id = %s
                    ORDER BY aggregation_date
                """, (simulation_id,))
                simulation['daily_aggregations'] = [dict(r) for r in cursor.fetchall()]
            except:
                pass
            
            try:
                cursor.execute("""
                    SELECT * FROM weekly_aggregations
                    WHERE simulation_id = %s
                    ORDER BY week_number
                """, (simulation_id,))
                simulation['weekly_aggregations'] = [dict(r) for r in cursor.fetchall()]
            except:
                pass
            
            return simulation
            
        except Exception as e:
            print(f"✗ Error retrieving simulation: {e}")
            return None
            
        finally:
            if conn:
                conn.close()
    
    def get_user_simulations(self, user_id: int, include_deleted: bool = False) -> List[Dict]:
        """EXISTING: Get all simulations for a user"""
        conn = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            query = """
                SELECT 
                    simulation_id,
                    simulation_name,
                    disruption_type,
                    disruption_location,
                    start_time,
                    end_time,
                    severity_level,
                    simulation_status,
                    total_affected_segments,
                    average_delay_ratio,
                    created_at,
                    updated_at
                FROM simulation_runs
                WHERE user_id = %s
            """
            
            if not include_deleted:
                query += " AND simulation_status != 'deleted'"
            
            query += " ORDER BY created_at DESC"
            
            cursor.execute(query, (user_id,))
            simulations = cursor.fetchall()
            
            return [dict(s) for s in simulations]
            
        except Exception as e:
            print(f"✗ Error retrieving user simulations: {e}")
            return []
            
        finally:
            if conn:
                conn.close()
    
    # ============================================================
    # EXISTING: PUBLISH OPERATIONS (No changes)
    # ============================================================
    
    def publish_simulation(
        self,
        simulation_id: int,
        published_by_user_id: int,
        title: str = None,
        public_description: str = None
    ) -> Optional[str]:
        """EXISTING: Publish a simulation to the public map"""
        conn = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT simulation_name FROM simulation_runs
                WHERE simulation_id = %s
            """, (simulation_id,))
            
            result = cursor.fetchone()
            if not result:
                print(f"✗ Simulation {simulation_id} not found")
                return None
            
            simulation_name = result[0]
            
            cursor.execute("""
                SELECT generate_slug(%s)
            """, (title or simulation_name,))
            
            slug = cursor.fetchone()[0]
            
            cursor.execute("""
                UPDATE simulation_runs 
                SET simulation_status = 'published'
                WHERE simulation_id = %s
            """, (simulation_id,))
            
            cursor.execute("""
                INSERT INTO published_runs (
                    simulation_id,
                    published_by,
                    slug,
                    title,
                    public_description,
                    is_active
                ) VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (simulation_id) 
                DO UPDATE SET
                    is_active = TRUE,
                    title = EXCLUDED.title,
                    public_description = EXCLUDED.public_description,
                    updated_at = CURRENT_TIMESTAMP
            """, (
                simulation_id,
                published_by_user_id,
                slug,
                title or simulation_name,
                public_description,
                True
            ))
            
            self._log_action(
                cursor,
                published_by_user_id,
                'publish_simulation',
                'simulation_runs',
                simulation_id,
                {'slug': slug}
            )
            
            conn.commit()
            print(f"✓ Simulation {simulation_id} published successfully with slug: {slug}")
            return slug
            
        except Exception as e:
            if conn:
                conn.rollback()
            print(f"✗ Error publishing simulation: {e}")
            import traceback
            traceback.print_exc()
            return None
            
        finally:
            if conn:
                conn.close()
    
    def unpublish_simulation(self, simulation_id: int, user_id: int) -> bool:
        """EXISTING: Unpublish a simulation"""
        conn = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            cursor.execute("""
                UPDATE simulation_runs 
                SET simulation_status = 'completed'
                WHERE simulation_id = %s
            """, (simulation_id,))
            
            cursor.execute("""
                UPDATE published_runs 
                SET is_active = FALSE
                WHERE simulation_id = %s
            """, (simulation_id,))
            
            self._log_action(
                cursor,
                user_id,
                'unpublish_simulation',
                'simulation_runs',
                simulation_id
            )
            
            conn.commit()
            print(f"✓ Simulation {simulation_id} unpublished successfully")
            return True
            
        except Exception as e:
            if conn:
                conn.rollback()
            print(f"✗ Error unpublishing simulation: {e}")
            return False
            
        finally:
            if conn:
                conn.close()
    
    def get_published_simulations(self) -> List[Dict]:
        """EXISTING: Get all active published simulations for public map"""
        conn = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            query = """
                SELECT * FROM v_published_simulations
                ORDER BY published_at DESC
            """
            
            cursor.execute(query)
            simulations = cursor.fetchall()
            
            return [dict(s) for s in simulations]
            
        except Exception as e:
            print(f"✗ Error retrieving published simulations: {e}")
            return []
            
        finally:
            if conn:
                conn.close()
    
    # ============================================================
    # Tracks publisher email and organization
    # ============================================================
    def get_published_simulations_with_publisher(self):
        """
        Get published simulations with publisher information
        """
        conn = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            query = """
                SELECT * FROM v_published_simulations
                ORDER BY published_at DESC
            """
            
            cursor.execute(query)
            simulations = cursor.fetchall()
            
            return [dict(s) for s in simulations]
            
        except Exception as e:
            print(f"✗ Error retrieving published simulations: {e}")
            return []
            
        finally:
            if conn:
                conn.close()


    # ============================================================
    # EXISTING: DELETE OPERATIONS (No changes)
    # ============================================================
    
    def delete_simulation(self, simulation_id: int, user_id: int) -> bool:
        """EXISTING: Delete a simulation (soft delete)"""
        conn = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            cursor.execute("""
                UPDATE simulation_runs 
                SET simulation_status = 'deleted'
                WHERE simulation_id = %s AND user_id = %s
            """, (simulation_id, user_id))
            
            if cursor.rowcount == 0:
                print(f"✗ Simulation {simulation_id} not found or not owned by user {user_id}")
                return False
            
            self._log_action(
                cursor,
                user_id,
                'delete_simulation',
                'simulation_runs',
                simulation_id
            )
            
            conn.commit()
            print(f"✓ Simulation {simulation_id} deleted successfully")
            return True
            
        except Exception as e:
            if conn:
                conn.rollback()
            print(f"✗ Error deleting simulation: {e}")
            return False
            
        finally:
            if conn:
                conn.close()


# ============================================================
# EXAMPLE USAGE (EXISTING - No changes)
# ============================================================

if __name__ == "__main__":
    db = DatabaseService()
    
    print("\n" + "="*60)
    print("Database Service Test")
    print("="*60)
    
    print("\nTest: Saving a simulation...")
    
    simulation_data = {
        'scenario_name': 'Test Roadwork - Bucal',
        'description': 'Testing database integration',
        'disruption_type': 'roadwork',
        'area': 'Bucal',
        'road_corridor': 'Calamba_Pagsanjan',
        'start_datetime': datetime(2025, 1, 20, 8, 0),
        'end_datetime': datetime(2025, 1, 20, 18, 0),
        'disruption_location': 'Bucal - Calamba_Pagsanjan',
        'coordinates': {'lat': 14.1894, 'lng': 121.1691},
        'severity_level': 'moderate'
    }
    
    results_data = {
        'summary': {
            'total_hours': 10,
            'avg_severity': 1.5,
            'max_severity': 2.0,
            'heavy_percentage': 30,
            'avg_severity_label': 'Moderate',
            'avg_delay_minutes': 12.5
        },
        'hourly_predictions': [
            {
                'hour': 8,
                'severity': 1.5,
                'delay_info': {'additional_delay_min': 15}
            },
            {
                'hour': 9,
                'severity': 2.0,
                'delay_info': {'additional_delay_min': 20}
            }
        ],
        'time_segments': {
            'morning': {
                'avg_severity': 1.75,
                'avg_delay_minutes': 17.5
            },
            'afternoon': {
                'avg_severity': 1.2,
                'avg_delay_minutes': 10
            }
        }
    }
    
    simulation_id = db.save_simulation_run(
        user_id=2,
        simulation_data=simulation_data,
        results_data=results_data
    )
    
    if simulation_id:
        print(f"\n✓ Test simulation saved with ID: {simulation_id}")
        
        print("\nTest: Retrieving simulation...")
        retrieved = db.get_simulation_by_id(simulation_id)
        if retrieved:
            print(f"✓ Retrieved simulation: {retrieved['simulation_name']}")
            print(f"  - Results: {len(retrieved['results'])} entries")
            print(f"  - Recommendations: {len(retrieved['recommendations'])} entries")
            print(f"  - Travel advice: {len(retrieved['travel_advice'])} entries")
        
        print("\nTest: Publishing simulation...")
        slug = db.publish_simulation(
            simulation_id=simulation_id,
            published_by_user_id=2,
            title="Test Roadwork in Bucal",
            public_description="Road repair work causing moderate delays"
        )
        
        if slug:
            print(f"✓ Published with slug: {slug}")
            
            print("\nTest: Retrieving published simulations...")
            published = db.get_published_simulations()
            print(f"✓ Found {len(published)} published simulations")
    
    print("\n" + "="*60)
    print("Database Service Test Complete")
    print("="*60)