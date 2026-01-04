from flask import Blueprint, request, jsonify
from services.groq_service import GroqService
from services.database import DatabaseService
import traceback

recommendations_bp = Blueprint('recommendations', __name__)

@recommendations_bp.route('/api/generate-recommendations', methods=['POST'])
def generate_recommendations():
    """
    Generate AI recommendations for a simulation
    Called after simulation completes
    """
    try:
        # Parse request data safely
        data = request.get_json(silent=True) or {}
        
        print("\n" + "="*60)
        print("🔥 /api/generate-recommendations called")
        print("="*60)
        print(f"Request data keys: {list(data.keys())}")
        
        simulation_id = data.get('simulation_id')
        simulation_data = data.get('simulation_data') or {}
        results_summary = data.get('results_summary') or {}
        
        print(f"simulation_id: {simulation_id}")
        print(f"simulation_data keys: {list(simulation_data.keys())}")
        print(f"results_summary keys: {list(results_summary.keys())}")
        
        # Validate required data
        if not simulation_id:
            print("❌ Missing simulation_id")
            return jsonify({
                'success': False,
                'error': 'simulation_id is required'
            }), 400
        
        # Ensure we have minimum required data
        if not simulation_data:
            print("⚠️ Empty simulation_data, using defaults")
            simulation_data = {
                'disruption_type': 'roadwork',
                'area': 'Unknown',
                'road_corridor': 'Unknown',
                'disruption_location': 'Unknown location',
                'start_datetime': '',
                'end_datetime': '',
                'description': ''
            }
        
        if not results_summary:
            print("⚠️ Empty results_summary, using defaults")
            results_summary = {
                'avg_severity': 1.0,
                'heavy_percentage': 0,
                'total_hours': 0,
                'avg_delay_minutes': 0
            }
        
        # Initialize Groq service
        print("🤖 Initializing Groq service...")
        groq = GroqService()
        
        # Generate recommendations
        print(f"🤖 Generating recommendations for simulation {simulation_id}...")
        recommendations = groq.generate_mitigation_recommendations(
            simulation_data=simulation_data,
            results_summary=results_summary
        )
        
        if not recommendations:
            print("❌ No recommendations generated")
            return jsonify({
                'success': False,
                'error': 'Failed to generate recommendations'
            }), 500
        
        print(f"✅ Generated {len(recommendations)} recommendations")
        
        # Save to database
        print("💾 Saving to database...")
        db = DatabaseService()
        conn = db._get_connection()
        cursor = conn.cursor()
        
        try:
            # Clear existing recommendations for this simulation
            cursor.execute(
                """
                DELETE FROM mitigation_recommendations 
                WHERE simulation_id = %s
                """,
                (simulation_id,)
            )
            print(f"  🗑️ Cleared old recommendations for simulation {simulation_id}")
            
            # Insert new recommendations
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
            
            for i, rec in enumerate(recommendations, 1):
                cursor.execute(
                    insert_query,
                    (
                        simulation_id,
                        rec.get('type', 'general'),
                        rec.get('text', ''),
                        rec.get('priority', 'medium'),
                        rec.get('impact', ''),
                        rec.get('cost', 'medium'),
                        rec.get('timeline', 'short-term')
                    )
                )
                print(f"  ✅ Saved recommendation {i}/{len(recommendations)}")
            
            conn.commit()
            print(f"✅ Saved {len(recommendations)} recommendations to database")
            
        except Exception as db_error:
            conn.rollback()
            print(f"❌ Database error: {db_error}")
            traceback.print_exc()
            return jsonify({
                'success': False,
                'error': f'Database error: {str(db_error)}'
            }), 500
            
        finally:
            cursor.close()
            conn.close()
        
        print("="*60)
        print("✅ Recommendations generated and saved successfully")
        print("="*60)
        
        return jsonify({
            'success': True,
            'recommendations': recommendations,
            'count': len(recommendations)
        })
    
    except Exception as e:
        print("\n" + "="*60)
        print("❌ ERROR in generate_recommendations")
        print("="*60)
        print(f"Error: {e}")
        traceback.print_exc()
        print("="*60)
        
        return jsonify({
            'success': False,
            'error': str(e),
            'details': 'Check server logs for full traceback'
        }), 500