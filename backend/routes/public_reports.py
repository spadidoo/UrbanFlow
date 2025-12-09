from flask import Blueprint, request, jsonify
from supabase import create_client
import os
from datetime import datetime, timedelta
from werkzeug.utils import secure_filename



public_reports_bp = Blueprint('public_reports', __name__)

UPLOAD_FOLDER = '/home/urbanflow/uploads/public_reports'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'heif'}

# Initialize Supabase client
supabase = create_client(
    os.getenv('SUPABASE_URL'),
    os.getenv('SUPABASE_KEY')
)

def ensure_utc_timestamp(dt):
    """Ensure datetime is in UTC and formatted with Z suffix"""
    if dt is None:
        return None
    if isinstance(dt, str):
        if not dt.endswith('Z') and not dt.endswith('+00:00'):
            return dt.replace('+00:00', 'Z') if '+00:00' in dt else dt + 'Z'
        return dt.replace('+00:00', 'Z')
    return dt.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@public_reports_bp.route('/api/public-reports', methods=['POST'])
def create_report():
    """Create a new public report"""
    try:
        print("Received report submission")
        print("Files:", request.files)
        print("Form data:", request.form)
        
        # Check if request has file
        image_url = None
        if 'image' in request.files:
            file = request.files['image']
            print(f"File received: {file.filename}")
            
            if file and file.filename and allowed_file(file.filename):
                filename = secure_filename(f"{datetime.now().timestamp()}_{file.filename}")
                
                # Create uploads directory if it doesn't exist
                os.makedirs(UPLOAD_FOLDER, exist_ok=True)
                
                filepath = os.path.join(UPLOAD_FOLDER, filename)
                file.save(filepath)
                image_url = f"/uploads/{filename}"
                print(f"File saved to: {filepath}")
            else:
                print("File not allowed or empty")
        
        # Get form data
        latitude = float(request.form.get('latitude'))
        longitude = float(request.form.get('longitude'))
        report_type = request.form.get('report_type')
        description = request.form.get('description')
        severity = request.form.get('severity')
        reporter_name = request.form.get('reporter_name', 'Anonymous')
        
        # Create report data matching your schema exactly
        report_data = {
            'latitude': latitude,
            'longitude': longitude,
            'location': f'POINT({longitude} {latitude})',
            'report_type': report_type,
            'description': description,
            'severity': severity,
            'reporter_name': reporter_name,
            'road_name': '',
            'status': 'pending',
            'image_url': image_url,
            # These will be set when publishing
            'published_by': None,
            'published_at': None,
            'expires_at': None
        }
        
        result = supabase.table('public_reports').insert(report_data).execute()
        
        return jsonify({
            'success': True,
            'data': result.data[0]
        }), 201
        
    except Exception as e:
        print(f"Error creating report: {str(e)}")
        return jsonify({'error': str(e)}), 500


def ensure_utc_timestamp(dt):
    """Ensure datetime is in UTC and formatted with Z suffix"""
    if dt is None:
        return None
    if isinstance(dt, str):
        if not dt.endswith('Z') and not dt.endswith('+00:00'):
            return dt.replace('+00:00', 'Z') if '+00:00' in dt else dt + 'Z'
        return dt.replace('+00:00', 'Z')
    return dt.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'


@public_reports_bp.route('/api/public-reports', methods=['GET'])
def get_reports():
    """Get all active public reports (excludes dismissed AND resolved)"""
    try:
        # ✅ Fetch ALL reports first to see what we have
        all_reports = supabase.table('public_reports')\
            .select('*')\
            .order('reported_at', desc=True)\
            .execute()
        
        print(f"\n📊 TOTAL REPORTS IN DATABASE: {len(all_reports.data)}")
        
        # ✅ Log status breakdown
        status_counts = {}
        for r in all_reports.data:
            status = r.get('status', 'unknown')
            status_counts[status] = status_counts.get(status, 0) + 1
            if status in ['resolved', 'dismissed']:
                print(f"   ❌ Filtering out: ID={r['id']}, Status={status}, Type={r.get('report_type')}")
        
        print(f"📋 Status breakdown: {status_counts}")
        
        # ✅ Filter out dismissed AND resolved on Python side (double safety)
        active_reports = [
            r for r in all_reports.data 
            if r.get('status') not in ['dismissed', 'resolved']
        ]
        
        print(f"✅ ACTIVE REPORTS TO RETURN: {len(active_reports)}")
        
        # ✅ Ensure all timestamps have 'Z' suffix
        for report in active_reports:
            report['reported_at'] = ensure_utc_timestamp(report.get('reported_at'))
            report['published_at'] = ensure_utc_timestamp(report.get('published_at'))
            report['expires_at'] = ensure_utc_timestamp(report.get('expires_at'))
        
        return jsonify({
            'success': True,
            'data': active_reports
        }), 200
        
    except Exception as e:
        print(f"❌ Error fetching reports: {str(e)}")
        return jsonify({'error': str(e)}), 500


@public_reports_bp.route('/api/public-reports/<report_id>', methods=['GET', 'PATCH', 'DELETE', 'OPTIONS'])
def update_report_status(report_id):
    """Update report status (for planners)"""
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PATCH,DELETE,OPTIONS')
        return response, 200
    
    if request.method == 'GET':
        try:
            result = supabase.table('public_reports')\
                .select('*')\
                .eq('id', report_id)\
                .execute()
            
            if result.data:
                return jsonify({'success': True, 'data': result.data[0]}), 200
            else:
                return jsonify({'error': 'Report not found'}), 404
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    if request.method == 'PATCH':
        try:
            data = request.json
            action = data.get('action')
            
            # Check if report exists first
            check = supabase.table('public_reports').select('*').eq('id', report_id).execute()
            print(f"Report exists check: {len(check.data)} records found")
            
            if not check.data:
                return jsonify({'error': 'Report not found'}), 404
            
            update_data = {}
            
            if action == 'publish':
                duration_hours = data.get('duration_hours', 12)
                if duration_hours > 12:
                    duration_hours = 12
                
                now = datetime.utcnow()
                expires = now + timedelta(hours=duration_hours)
                
                # ✅ FIX: Add 'Z' suffix to mark as UTC
                update_data = {
                    'status': 'published',
                    'published_at': now.strftime('%Y-%m-%dT%H:%M:%S') + 'Z',
                    'expires_at': expires.strftime('%Y-%m-%dT%H:%M:%S') + 'Z'
                }
                
                print(f"✅ Publishing report {report_id} - expires in {duration_hours}h")
                print(f"   Published at: {update_data['published_at']}")
                print(f"   Expires at: {update_data['expires_at']}")
                
            elif action == 'resolve':
                update_data = {'status': 'resolved'}
                print(f"✅ Resolving report {report_id}")
                
            elif action == 'dismiss':
                update_data = {'status': 'dismissed'}
                print(f"✅ Dismissing report {report_id}")
                
            else:
                return jsonify({'error': 'Invalid action'}), 400
            
            # Execute the update
            result = supabase.table('public_reports')\
                .update(update_data)\
                .eq('id', report_id)\
                .execute()
            
            if result.data:
                print(f"✅ Successfully updated report {report_id} to status: {update_data.get('status')}")
                return jsonify({
                    'success': True,
                    'data': result.data[0]
                }), 200
            else:
                print(f"⚠️ Update returned no data for report {report_id}")
                return jsonify({
                    'success': False,
                    'error': 'Update failed - no data returned'
                }), 500
            
        except Exception as e:
            print(f"❌ Error updating report: {str(e)}")
            return jsonify({'error': str(e)}), 500
    
    if request.method == 'DELETE':
        try:
            result = supabase.table('public_reports')\
                .delete()\
                .eq('id', report_id)\
                .execute()
            
            print(f"🗑️ Deleted report {report_id}")
            return jsonify({'success': True}), 200
        except Exception as e:
            return jsonify({'error': str(e)}), 500


@public_reports_bp.route('/api/public-reports/published', methods=['GET'])
def get_published_reports():
    """Get all published reports that haven't expired (for public map)"""
    try:
        now = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S') + 'Z'
        
        result = supabase.table('public_reports')\
            .select('*')\
            .eq('status', 'published')\
            .gte('expires_at', now)\
            .order('published_at', desc=True)\
            .execute()
        
        print(f"📍 Found {len(result.data)} active published reports")
        
        return jsonify({
            'success': True,
            'data': result.data
        }), 200
        
    except Exception as e:
        print(f"Error fetching published reports: {str(e)}")
        return jsonify({'error': str(e)}), 500


@public_reports_bp.route('/api/public-reports/cleanup-expired', methods=['POST'])
def cleanup_expired_reports():
    """Mark expired published reports as resolved"""
    try:
        now = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S') + 'Z'
        
        result = supabase.table('public_reports')\
            .update({'status': 'resolved'})\
            .eq('status', 'published')\
            .lt('expires_at', now)\
            .execute()
        
        cleaned_count = len(result.data) if result.data else 0
        print(f"🧹 Cleaned up {cleaned_count} expired reports")
        
        return jsonify({
            'success': True,
            'cleaned': cleaned_count
        }), 200
        
    except Exception as e:
        print(f"Error cleaning up expired reports: {str(e)}")
        return jsonify({'error': str(e)}), 500