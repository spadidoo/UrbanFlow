# backend/routes/auth.py - UPDATED TO USE DatabaseService
import os
import jwt
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from functools import wraps
from werkzeug.security import check_password_hash, generate_password_hash
from psycopg2.extras import RealDictCursor

auth_bp = Blueprint('auth', __name__)

# ============================================================
# Import DatabaseService (already exists in your project)
# ============================================================
from services.database import DatabaseService

# Initialize database service
db = DatabaseService()

# ============================================================
# Password Helper Functions
# ============================================================

def verify_password(plain_password, hashed_password):
    """Verify a password against its hash"""
    return check_password_hash(hashed_password, plain_password)

def hash_password(password):
    """Hash a password"""
    return generate_password_hash(password)

# ============================================================
# JWT Token Functions
# ============================================================

def generate_token(user_id):
    """Generate JWT token for user"""
    payload = {
        'user_id': user_id,
        'exp': datetime.utcnow() + timedelta(days=7),
        'iat': datetime.utcnow()
    }
    
    secret = os.getenv('JWT_SECRET', 'your-secret-key-change-this')
    token = jwt.encode(payload, secret, algorithm='HS256')
    
    return token

def decode_token(token):
    """Decode JWT token"""
    try:
        secret = os.getenv('JWT_SECRET', 'your-secret-key-change-this')
        payload = jwt.decode(token, secret, algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

# ============================================================
# Token Required Decorator
# ============================================================

def token_required(f):
    """Decorator to require authentication token"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Get token from Authorization header
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(' ')[1]  # Bearer TOKEN
            except IndexError:
                return jsonify({'error': 'Invalid token format'}), 401
        
        if not token:
            return jsonify({'error': 'Token is missing'}), 401
        
        # Decode token
        payload = decode_token(token)
        
        if not payload:
            return jsonify({'error': 'Token is invalid or expired'}), 401
        
        # Get user from database
        conn = None
        try:
            conn = db._get_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            cursor.execute("""
                SELECT user_id, username, email, role
                FROM users
                WHERE user_id = %s
            """, (payload['user_id'],))
            
            user = cursor.fetchone()
            
            if not user:
                return jsonify({'error': 'User not found'}), 401
            
            current_user = dict(user)
            
        except Exception as e:
            print(f"Error in token_required: {e}")
            return jsonify({'error': 'Database error'}), 500
        finally:
            if conn:
                conn.close()
        
        return f(current_user, *args, **kwargs)
    
    return decorated

# ============================================================
# ROUTE: Login
# ============================================================

@auth_bp.route('/login', methods=['POST'])
def login():
    """
    Login endpoint
    
    Expected JSON:
    {
        "email": "planner@calamba.gov.ph",
        "password": "password123"
    }
    """
    conn = None
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        email = data.get('email')
        password = data.get('password')
        
        if not email or not password:
            return jsonify({'error': 'Email and password are required'}), 400
        
        # ✅ Use DatabaseService's connection method
        conn = db._get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get user including profile_photo
        cursor.execute("""
            SELECT 
                user_id,
                username,
                email,
                password_hash,
                first_name,
                last_name,
                role,
                organization,
                profile_photo,
                profile_photo_filename
            FROM users
            WHERE email = %s
        """, (email,))
        
        user = cursor.fetchone()
        
        if not user:
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # Verify password
        if not verify_password(password, user['password_hash']):
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # Generate token
        token = generate_token(user['user_id'])
        
        # Return success with token and user data
        return jsonify({
            'success': True,
            'token': token,
            'user': {
                'id': user['user_id'],
                'username': user['username'],
                'email': user['email'],
                'firstName': user['first_name'],
                'lastName': user['last_name'],
                'name': f"{user['first_name']} {user['last_name']}",
                'role': user['role'],
                'organization': user.get('organization'),
                'profile_photo': user.get('profile_photo'),
                'avatarUrl': user.get('profile_photo') or '/urban_planner_icon.png'
            }
        })
        
    except Exception as e:
        print(f"Login error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Internal server error'}), 500
    finally:
        if conn:
            conn.close()

# ============================================================
# ROUTE: Get Current User
# ============================================================

@auth_bp.route('/me', methods=['GET'])
@token_required
def get_current_user(current_user):
    """Get current authenticated user's information"""
    conn = None
    try:
        conn = db._get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute("""
            SELECT 
                user_id, username, email, first_name, last_name, role,
                organization, profile_photo, profile_photo_filename,
                created_at, updated_at
            FROM users
            WHERE user_id = %s
        """, (current_user['user_id'],))
        
        user = cursor.fetchone()
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        user_data = dict(user)
        
        return jsonify({
            'success': True,
            'user': {
                'id': user_data['user_id'],
                'username': user_data['username'],
                'email': user_data['email'],
                'firstName': user_data['first_name'],
                'lastName': user_data['last_name'],
                'name': f"{user_data['first_name']} {user_data['last_name']}",
                'role': user_data['role'],
                'organization': user_data.get('organization'),
                'profile_photo': user_data.get('profile_photo'),
                'avatarUrl': user_data.get('profile_photo') or '/urban_planner_icon.png'
            }
        })
        
    except Exception as e:
        print(f"Error fetching user: {e}")
        return jsonify({'error': 'Internal server error'}), 500
    finally:
        if conn:
            conn.close()

# ============================================================
# ROUTE: Update Profile
# ============================================================

@auth_bp.route('/update-profile', methods=['PUT'])
@token_required
def update_profile(current_user):
    """Update user profile"""
    conn = None
    try:
        data = request.get_json()
        
        conn = db._get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Build update query
        update_fields = []
        update_values = []
        
        if 'firstName' in data:
            update_fields.append("first_name = %s")
            update_values.append(data['firstName'])
        
        if 'lastName' in data:
            update_fields.append("last_name = %s")
            update_values.append(data['lastName'])
        
        if 'email' in data:
            update_fields.append("email = %s")
            update_values.append(data['email'])
        
        if update_fields:
            update_fields.append("updated_at = NOW()")
            update_values.append(current_user['user_id'])
            
            query = f"""
                UPDATE users 
                SET {', '.join(update_fields)}
                WHERE user_id = %s
            """
            
            cursor.execute(query, update_values)
            conn.commit()
        
        # Fetch updated user data
        cursor.execute("""
            SELECT 
                user_id, username, email, first_name, last_name, role,
                organization, profile_photo, profile_photo_filename
            FROM users
            WHERE user_id = %s
        """, (current_user['user_id'],))
        
        user = cursor.fetchone()
        
        return jsonify({
            'success': True,
            'message': 'Profile updated successfully',
            'user': {
                'id': user['user_id'],
                'username': user['username'],
                'email': user['email'],
                'firstName': user['first_name'],
                'lastName': user['last_name'],
                'name': f"{user['first_name']} {user['last_name']}",
                'role': user['role'],
                'organization': user.get('organization'),
                'profile_photo': user.get('profile_photo'),
                'avatarUrl': user.get('profile_photo') or '/urban_planner_icon.png'
            }
        })
        
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Update profile error: {e}")
        return jsonify({'error': 'Failed to update profile'}), 500
    finally:
        if conn:
            conn.close()

# ============================================================
# ROUTE: Change Password
# ============================================================

@auth_bp.route('/change-password', methods=['PUT'])
@token_required
def change_password(current_user):
    """Change user password"""
    conn = None
    try:
        data = request.get_json()
        
        current_password = data.get('currentPassword')
        new_password = data.get('newPassword')
        
        if not current_password or not new_password:
            return jsonify({'error': 'Both current and new passwords are required'}), 400
        
        if len(new_password) < 8:
            return jsonify({'error': 'New password must be at least 8 characters'}), 400
        
        conn = db._get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get current password hash
        cursor.execute("""
            SELECT password_hash
            FROM users
            WHERE user_id = %s
        """, (current_user['user_id'],))
        
        result = cursor.fetchone()
        
        if not result:
            return jsonify({'error': 'User not found'}), 404
        
        # Verify current password
        if not verify_password(current_password, result['password_hash']):
            return jsonify({'error': 'Current password is incorrect'}), 401
        
        # Hash new password
        new_password_hash = hash_password(new_password)
        
        # Update password
        cursor.execute("""
            UPDATE users
            SET password_hash = %s, updated_at = NOW()
            WHERE user_id = %s
        """, (new_password_hash, current_user['user_id']))
        
        conn.commit()
        
        return jsonify({
            'success': True,
            'message': 'Password changed successfully'
        })
        
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Change password error: {e}")
        return jsonify({'error': 'Failed to change password'}), 500
    finally:
        if conn:
            conn.close()

# ============================================================
# ROUTE: Logout
# ============================================================

@auth_bp.route('/logout', methods=['POST'])
def logout():
    """Logout endpoint"""
    return jsonify({
        'success': True,
        'message': 'Logged out successfully'
    })