# backend/services/database.py
# ✅ FIXED VERSION - Saves EVERYTHING including severity lines

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
    ✅ NOW SAVES:
    - Hour-by-hour predictions
    - Day-by-day aggregations
    - Severity lines (map visualization data)
    - Time segments
    - Recommendations
    - Travel advice
    """
    
    def __init__(self):
        """Initialize database connection - SUPABASE POOLER"""
        self.connection_params = {
            'dbname': 'postgres',
            'user': 'postgres.ndozyvnrmryyidehykmu',  # Your Supabase user
            'password': 'urbanflow123',  # Replace with your password
            'host': 'aws-1-ap-south-1.pooler.supabase.com',  # Pooler host
            'port': '6543'  # Must be 6543 for pooler
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
    # ✅ FIXED: Main Simulation Save
    # ============================================================
    
    def save_simulation_run(
        self,
        user_id: int,
        simulation_data: Dict[str, Any],
        results_data: Dict[str, Any]
    ) -> Optional[int]:
        """
        ✅ FIXED: Now saves EVERYTHING:
        - Simulation metadata
        - Hour-by-hour predictions
        - Day-by-day aggregations
        - Severity lines for map
        - Time segments
        - Recommendations
        - Travel advice
        """
        conn = None
        cursor = None

        print("\n🔍 DEBUG: save_simulation_run inputs:")
        print(f"  - simulation_data keys: {simulation_data.keys()}")
        print(f"  - results_data keys: {results_data.keys()}")
        if 'road_info' in results_data:
            print(f"  - road_info keys: {results_data['road_info'].keys()}")
            print(f"  - has coordinates: {'coordinates' in results_data['road_info']}")

        try:
            conn = self._get_connection()
            cursor = conn.cursor()

            # ✅ Parse datetime strings
            start_datetime_str = simulation_data.get('start_datetime')
            end_datetime_str = simulation_data.get('end_datetime')
            
            start_time = None
            end_time = None
            
            if start_datetime_str:
                start_time = datetime.fromisoformat(start_datetime_str.replace('Z', '+00:00'))
        
            if end_datetime_str:
                end_time = datetime.fromisoformat(end_datetime_str.replace('Z', '+00:00'))

            print(f"💾 Saving simulation with times:")
            print(f"   Start: {start_time}")
            print(f"   End: {end_time}")
            
            # ✅ CRITICAL: Extract and save road coordinates from road_info
            road_coordinates = None
            road_info = simulation_data.get('road_info', {})

            # Try multiple possible keys
            if isinstance(road_info, dict):
                road_coordinates = (
                    road_info.get('coordinates') or
                    road_info.get('coords') or
                    road_info.get('geometry') or
                    road_info.get('path')
                )
                
                # Ensure it's in the right format [lat, lng] not {lat, lng}
                if road_coordinates and isinstance(road_coordinates, list) and len(road_coordinates) > 0:
                    print(f"💾 Found road coordinates: {len(road_coordinates)} points")
                    # Store in results_data so _save_severity_lines can access it
                    if 'road_info' not in results_data:
                        results_data['road_info'] = {}
                    results_data['road_info']['coordinates'] = road_coordinates
                else:
                    print("⚠️ No valid road coordinates in road_info")

            # Create disruption geometry
            disruption_geometry_wkt = None
            if simulation_data.get('coordinates'):
                coords = simulation_data['coordinates']
                lat, lng = coords.get('lat'), coords.get('lng')
                if lat and lng:
                    disruption_geometry_wkt = f"POINT({lng} {lat})"
            
            # Determine time segment
            hour = start_time.hour if start_time else 12
            if 6 <= hour < 12:
                time_segment = 'morning'
            elif 12 <= hour < 18:
                time_segment = 'afternoon'
            elif 18 <= hour < 22:
                time_segment = 'evening'
            else:
                time_segment = 'night'
            
            # Extract summary
            summary = results_data.get('summary', {})
            
            # ✅ SINGLE INSERT - No duplicates
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
                    time_segments_data,
                    hourly_predictions,
                    aggregated_view,
                    is_edited,
                    last_edited_at
                ) VALUES (
                    %s, %s, %s, %s, %s, 
                    ST_GeomFromText(%s, 4326), 
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                )
                RETURNING simulation_id
            """

            is_edited = simulation_data.get('is_edited', False)
            last_edited = datetime.now() if is_edited else None

            print(f"💾 Saving edit metadata:")
            print(f"   is_edited: {is_edited}")
            print(f"   last_edited_at: {last_edited}")

            
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
                max(p.get('severity', 0) for p in results_data.get('hourly_predictions', [{'severity': 1.0}])),
                Json(results_data.get('road_info')),
                Json(results_data.get('time_segments')),
                Json(results_data.get('hourly_predictions', [])),  # ✅ Save hourly data
                Json(results_data.get('aggregated_view')),  # ✅ Save aggregated view
                simulation_data.get('is_edited', False),
                datetime.now() if simulation_data.get('is_edited') else None
            ))
            
            simulation_id = cursor.fetchone()[0]
            print(f"✅ Created simulation_id: {simulation_id}")
            
            # ✅ Save severity lines (map visualization data)
            self._save_severity_lines(cursor, simulation_id, results_data)
            
            # ✅ Save time segment summaries
            self._save_time_segment_results(cursor, simulation_id, results_data)
            
            # ✅ Save recommendations
            self._save_mitigation_recommendations(cursor, simulation_id, results_data, simulation_data)
            
            # ✅ Save travel advice
            self._save_travel_time_advice(cursor, simulation_id, results_data)
            
            # ✅ Log the action
            self._log_action(
                cursor,
                user_id,
                'create_simulation',
                'simulation_runs',
                simulation_id,
                {'simulation_name': simulation_data.get('scenario_name')}
            )
            
            conn.commit()
            
            print(f"✅ Simulation saved successfully!")
            print(f"  - ID: {simulation_id}")
            print(f"  - Hourly predictions: {len(results_data.get('hourly_predictions', []))} hours")
            if results_data.get('aggregated_view'):
                agg_data = results_data['aggregated_view'].get('map_data', [])
                print(f"  - Aggregated view: {len(agg_data)} {results_data['aggregated_view']['granularity']} periods")
            
            return simulation_id
            
        except Exception as e:
            if conn:
                conn.rollback()
            print(f"❌ Error saving simulation: {e}")
            import traceback
            traceback.print_exc()
            return None
            
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()
                
    
    def _save_severity_lines(self, cursor, simulation_id: int, results_data: Dict):
        """
        ✅ FIXED: Save severity lines with guaranteed valid coordinates
        """
        try:
            severity_lines = []
            
            # Build severity_lines from hourly predictions
            hourly_preds = results_data.get('hourly_predictions', [])
            if hourly_preds and len(hourly_preds) <= 24:
                for pred in hourly_preds:
                    severity_lines.append({
                        'time_period': pred.get('datetime'),
                        'severity_level': pred.get('severity_label', 'moderate').lower(),
                        'severity_value': pred.get('severity', 1.0),
                        'delay_minutes': pred.get('delay_info', {}).get('additional_delay_min', 0),
                        'hour': pred.get('hour'),
                        'granularity': 'hourly'
                    })
            
            # OR from aggregated view (multi-day)
            agg_view = results_data.get('aggregated_view', {})
            if agg_view and agg_view.get('map_data'):
                for period in agg_view['map_data']:
                    severity_lines.append({
                        'time_period': period.get('date') or period.get('date_range'),
                        'severity_level': period.get('avg_severity_label', 'moderate').lower(),
                        'severity_value': period.get('avg_severity', 1.0),
                        'delay_minutes': period.get('avg_delay_min', 0),
                        'granularity': agg_view.get('granularity', 'daily')
                    })

            if not severity_lines:
                print("  ⚠️ No severity lines - creating empty array")
                # Still save empty array to avoid undefined in DB
                cursor.execute("""
                    UPDATE simulation_runs
                    SET severity_lines = %s
                    WHERE simulation_id = %s
                """, (Json([]), simulation_id))
                return

            # ✅ GET COORDINATES (Priority Order)
            coords_to_attach = None

            # Priority 1: From road_info in results_data
            road_info = results_data.get('road_info', {})
            if isinstance(road_info, dict):
                coords_to_attach = (
                    road_info.get('coordinates') or 
                    road_info.get('coords') or 
                    road_info.get('geometry')
                )
                if coords_to_attach:
                    print(f"  ✅ Using coordinates from road_info ({len(coords_to_attach)} points)")

            # Priority 2: Fetch from existing simulation in database
            if not coords_to_attach:
                try:
                    cursor.execute("""
                        SELECT ST_Y(disruption_geometry) as lat, 
                            ST_X(disruption_geometry) as lng
                        FROM simulation_runs 
                        WHERE simulation_id = %s
                    """, (simulation_id,))
                    
                    point = cursor.fetchone()
                    
                    if point and point[0] and point[1]:
                        lat, lng = float(point[0]), float(point[1])
                        # Create 3-point line segment
                        coords_to_attach = [
                            [lat - 0.003, lng - 0.003],
                            [lat, lng],
                            [lat + 0.003, lng + 0.003]
                        ]
                        print(f"  ✅ Generated coordinates from DB geometry: ({lat:.4f}, {lng:.4f})")
                except Exception as e:
                    print(f"  ⚠️ Could not fetch disruption geometry: {e}")

            # Priority 3: Default Calamba coordinates
            if not coords_to_attach:
                coords_to_attach = [
                    [14.2090, 121.1640],
                    [14.2100, 121.1650],
                    [14.2110, 121.1660]
                ]
                print("  ⚠️ Using default Calamba coordinates")

            # ✅ ATTACH coordinates to ALL lines
            for entry in severity_lines:
                entry['coordinates'] = coords_to_attach

            # ✅ VALIDATE before saving
            valid_lines = []
            for line in severity_lines:
                coords = line.get('coordinates')
                if coords and isinstance(coords, list) and len(coords) > 0:
                    # Ensure each coordinate is [lat, lng] format
                    if all(isinstance(c, list) and len(c) == 2 for c in coords):
                        valid_lines.append(line)
                    else:
                        print(f"  ⚠️ Skipping line with malformed coordinates")
                else:
                    print(f"  ⚠️ Skipping line without coordinates")

            if not valid_lines:
                print("  ❌ No valid severity lines after validation!")
                valid_lines = []

            print(f"  ✅ Validated {len(valid_lines)} severity_lines")

            # Save to database
            cursor.execute("""
                UPDATE simulation_runs
                SET severity_lines = %s
                WHERE simulation_id = %s
            """, (Json(valid_lines), simulation_id))
            
            print(f"  ✅ Saved {len(valid_lines)} severity_lines to database")
            
        except Exception as e:
            print(f"  ❌ Error in _save_severity_lines: {e}")
            import traceback
            traceback.print_exc()
            # Save empty array as fallback
            try:
                cursor.execute("""
                    UPDATE simulation_runs
                    SET severity_lines = %s
                    WHERE simulation_id = %s
                """, (Json([]), simulation_id))
                print("  ⚠️ Saved empty severity_lines as fallback")
            except:
                pass
    
    # ============================================================
    # ✅ FIXED: Save Time Segment Results (No duplicate INSERT)
    # ============================================================
    
    def _save_time_segment_results(self, cursor, simulation_id: int, results_data: Dict):
        """
        ✅ FIXED: Save time segment summaries (morning/afternoon/night)
        Now correctly inserts into run_results table
        """
        try:
            time_segments = results_data.get('time_segments', {})
            
            if not time_segments:
                print("  ⚠️ No time segments to save")
                return
            
            # Synthetic segment_ids for time periods
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
                ON CONFLICT (simulation_id, segment_id) DO UPDATE SET
                    delay_ratio = EXCLUDED.delay_ratio,
                    estimated_delay_minutes = EXCLUDED.estimated_delay_minutes,
                    congestion_level = EXCLUDED.congestion_level
            """
            
            for segment_name, segment_data in time_segments.items():
                if segment_name not in segment_id_map:
                    continue
                
                # Calculate averages from segment data
                light_hours = segment_data.get('light', 0)
                moderate_hours = segment_data.get('moderate', 0)
                heavy_hours = segment_data.get('heavy', 0)
                total_hours = light_hours + moderate_hours + heavy_hours
                
                if total_hours == 0:
                    continue
                
                # Estimate average severity
                avg_severity = (
                    (light_hours * 0.25) + 
                    (moderate_hours * 1.0) + 
                    (heavy_hours * 1.75)
                ) / total_hours
                
                # Estimate delay
                avg_delay = avg_severity * 10  # Rough estimate
                
                # Determine congestion level
                if avg_severity < 0.5:
                    congestion_level = 'light'
                elif avg_severity < 1.5:
                    congestion_level = 'moderate'
                else:
                    congestion_level = 'heavy'
                
                cursor.execute(insert_query, (
                    simulation_id,
                    segment_id_map[segment_name],
                    avg_severity,
                    50.0,  # Placeholder speed
                    congestion_level,
                    avg_delay,
                    avg_severity if segment_name == 'morning' else None,
                    avg_severity if segment_name == 'afternoon' else None,
                    avg_severity if segment_name == 'night' else None,
                    85.0  # Confidence
                ))
            
            print(f"  ✅ Saved {len(time_segments)} time segment results")
            
        except Exception as e:
            print(f"  ❌ Error saving time segment results: {e}")
            import traceback
            traceback.print_exc()
            raise
    
    # ============================================================
    # EXISTING METHODS (Kept as-is)
    # ============================================================
    
    def _save_mitigation_recommendations(self, cursor, simulation_id: int, results_data: Dict, simulation_data: Dict):
        """Save AI-generated mitigation recommendations using Groq"""
        try:
            # Import Groq service
            from services.groq_service import GroqService
            
            groq = GroqService()
            
            # Generate recommendations using AI
            print("  🤖 Generating AI recommendations with Groq...")
            
            # ✅ FIX: Ensure we have proper summary data
            summary = results_data.get('summary', {})
            if not summary:
                # Build basic summary from hourly predictions
                hourly = results_data.get('hourly_predictions', [])
                if hourly:
                    avg_sev = sum(p.get('severity', 0) for p in hourly) / len(hourly)
                    heavy_hrs = sum(1 for p in hourly if p.get('severity', 0) >= 2.0)
                    summary = {
                        'avg_severity': avg_sev,
                        'heavy_percentage': (heavy_hrs / len(hourly)) * 100,
                        'total_hours': len(hourly),
                        'avg_delay_minutes': sum(p.get('delay_info', {}).get('additional_delay_min', 0) for p in hourly) / len(hourly)
                    }
            
            recommendations = groq.generate_mitigation_recommendations(
                simulation_data=simulation_data,
                results_summary=summary
            )
            
            if not recommendations:
                print("  ⚠️ No recommendations generated - using fallback")
                # Use fallback if Groq fails
                recommendations = groq._fallback_recommendations(simulation_data, summary)
            
            if not recommendations:
                print("  ⚠️ No recommendations available")
                return
            
            insert_query = """
                INSERT INTO mitigation_recommendations (
                    simulation_id,
                    recommendation_type,
                    recommendation_text,
                    priority_level,
                    estimated_impact,
                    cost_estimate,
                    implementation_timeline
                ) VALUES (%s, %s, %s, %s, %s, %s, %s)
            """
            
            for rec in recommendations:
                cursor.execute(insert_query, (
                    simulation_id,
                    rec.get('type', 'general'),
                    rec.get('text', ''),
                    rec.get('priority', 'medium'),
                    rec.get('impact', ''),
                    rec.get('cost', 'medium'),
                    rec.get('timeline', 'short-term')
                ))
            
            print(f"  ✅ Saved {len(recommendations)} AI-generated recommendations")
            
        except Exception as e:
            print(f"  ❌ Error saving recommendations: {e}")
            import traceback
            traceback.print_exc()
            # Don't raise - allow simulation to save even if recommendations fail
    
    def _save_travel_time_advice(self, cursor, simulation_id: int, results_data: Dict):
        """Save travel time recommendations"""
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
                light = period_data.get('light', 0)
                moderate = period_data.get('moderate', 0)
                heavy = period_data.get('heavy', 0)
                total = light + moderate + heavy
                
                if total == 0:
                    continue
                
                avg_severity = ((light * 0.25) + (moderate * 1.0) + (heavy * 1.75)) / total
                avg_delay = avg_severity * 10
                
                recommended = avg_severity < 1.0
                
                if avg_severity < 0.5:
                    congestion_severity = 'light'
                    advice_text = f"Good time to travel. Expected delay: ~{round(avg_delay)} min."
                elif avg_severity < 1.5:
                    congestion_severity = 'moderate'
                    advice_text = f"Expect some delays: ~{round(avg_delay)} min."
                else:
                    congestion_severity = 'heavy'
                    advice_text = f"Heavy traffic expected. Delay: ~{round(avg_delay)} min. Consider alternate route."
                
                cursor.execute(insert_query, (
                    simulation_id,
                    period_key,
                    recommended,
                    avg_delay,
                    congestion_severity,
                    advice_text
                ))
            
            print(f"  ✅ Saved {len(time_segments)} travel advice entries")
            
        except Exception as e:
            print(f"  ❌ Error saving travel advice: {e}")
    
    def _log_action(self, cursor, user_id: int, action_type: str, entity_type: str, entity_id: int, details: Dict = None):
        """Log action to audit log"""
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
            print(f"  ⚠️ Failed to log action: {e}")
    
    # ============================================================
    # ✅ ENHANCED: Retrieval Methods
    # ============================================================
    
    def get_simulation_by_id(self, simulation_id: int) -> Optional[Dict]:
        """
        ✅ Get simulation with ALL saved data including severity lines
        """
        conn = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            cursor.execute("""
                SELECT 
                    sr.*,
                    ST_AsText(sr.disruption_geometry) as disruption_geometry,
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
            
            # Get related data
            cursor.execute("""
                SELECT * FROM run_results
                WHERE simulation_id = %s
                ORDER BY segment_id
            """, (simulation_id,))
            simulation['results'] = [dict(r) for r in cursor.fetchall()]
            
            cursor.execute("""
                SELECT * FROM mitigation_recommendations
                WHERE simulation_id = %s
                ORDER BY priority_level DESC
            """, (simulation_id,))
            simulation['recommendations'] = [dict(r) for r in cursor.fetchall()]
            
            cursor.execute("""
                SELECT * FROM travel_time_advice
                WHERE simulation_id = %s
                ORDER BY time_period
            """, (simulation_id,))
            simulation['travel_advice'] = [dict(r) for r in cursor.fetchall()]
            
            return simulation
            
        except Exception as e:
            print(f"❌ Error retrieving simulation: {e}")
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
                    updated_at,
                    is_edited,
                    last_edited_at
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