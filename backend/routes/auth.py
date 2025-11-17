# backend/routes/auth.py
from flask import Blueprint, request, jsonify
from werkzeug.security import check_password_hash, generate_password_hash
import jwt
import datetime
from functools import wraps
import os
import psycopg2
from psycopg2.extras import RealDictCursor

auth_bp = Blueprint('auth', __name__)

# Get configuration from environment
SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
DATABASE_URL = os.getenv('DATABASE_URL')

def get_db_connection():
    """Get database connection using your Supabase credentials"""
    from dotenv import load_dotenv
    load_dotenv()
    
    DATABASE_URL = os.getenv('DATABASE_URL')
    
    if DATABASE_URL:
        # Use Supabase connection
        from urllib.parse import urlparse
        url = urlparse(DATABASE_URL)
        return psycopg2.connect(
            host=url.hostname,
            port=url.port or 5432,
            database=url.path[1:],
            user=url.username,
            password=url.password,
            sslmode='require'
        )
    else:
        # Fallback to local (but this won't work without local PostgreSQL)
        return psycopg2.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            port=int(os.getenv('DB_PORT', 5432)),
            database=os.getenv('DB_NAME', 'urbanflow'),
            user=os.getenv('DB_USER', 'postgres'),
            password=os.getenv('DB_PASSWORD', ''),
            sslmode='prefer'
        )

def token_required(f):
    """Decorator to protect routes that require authentication"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        
        if not token:
            return jsonify({'error': 'Token is missing'}), 401
        
        try:
            if token.startswith('Bearer '):
                token = token[7:]
            
            data = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
            current_user_id = data['user_id']
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        
        return f(current_user_id, *args, **kwargs)
    
    return decorated

@auth_bp.route('/login', methods=['POST'])
def login():
    """Login endpoint - validates credentials and returns JWT token"""
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    
    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400
    
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Fetch user - using your table's column names
        cursor.execute('''
            SELECT user_id, username, email, password_hash, 
                   first_name, last_name, full_name, avatar_url, role 
            FROM users 
            WHERE email = %s AND is_active = true
        ''', (email,))
        
        user = cursor.fetchone()
        
        if not user:
            return jsonify({'error': 'Invalid email or password'}), 401
        
        # Check password
        if not check_password_hash(user['password_hash'], password):
            return jsonify({'error': 'Invalid email or password'}), 401
        
        # Generate JWT token (expires in 24 hours)
        token = jwt.encode({
            'user_id': user['user_id'],
            'email': user['email'],
            'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
        }, SECRET_KEY, algorithm='HS256')
        
        # Update last_login
        cursor.execute(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = %s',
            (user['user_id'],)
        )
        conn.commit()
        
        # Return user data and token
        return jsonify({
            'token': token,
            'user': {
                'id': user['user_id'],
                'username': user['username'],
                'email': user['email'],
                'firstName': user['first_name'],
                'lastName': user['last_name'],
                'name': user['full_name'] or f"{user['first_name']} {user['last_name']}",
                'avatarUrl': user['avatar_url'],
                'role': user['role']
            }
        }), 200
        
    except Exception as e:
        print(f"❌ Login error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'An error occurred during login'}), 500
    finally:
        if conn:
            cursor.close()
            conn.close()

@auth_bp.route('/me', methods=['GET'])
@token_required
def get_current_user(current_user_id):
    """Get current user information using JWT token"""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute('''
            SELECT user_id, username, email, first_name, last_name, 
                   full_name, avatar_url, role 
            FROM users 
            WHERE user_id = %s AND is_active = true
        ''', (current_user_id,))
        
        user = cursor.fetchone()
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify({
            'user': {
                'id': user['user_id'],
                'username': user['username'],
                'email': user['email'],
                'firstName': user['first_name'],
                'lastName': user['last_name'],
                'name': user['full_name'] or f"{user['first_name']} {user['last_name']}",
                'avatarUrl': user['avatar_url'],
                'role': user['role']
            }
        }), 200
        
    except Exception as e:
        print(f"❌ Get user error: {str(e)}")
        return jsonify({'error': 'An error occurred'}), 500
    finally:
        if conn:
            cursor.close()
            conn.close()

@auth_bp.route('/update-profile', methods=['PUT'])
@token_required
def update_profile(current_user_id):
    """Update user profile (name and email)"""
    data = request.get_json()
    first_name = data.get('firstName')
    last_name = data.get('lastName')
    email = data.get('email')
    
    if not first_name or not last_name or not email:
        return jsonify({'error': 'First name, last name, and email are required'}), 400
    
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Check if email is already taken
        cursor.execute(
            'SELECT user_id FROM users WHERE email = %s AND user_id != %s',
            (email, current_user_id)
        )
        if cursor.fetchone():
            return jsonify({'error': 'Email already in use'}), 400
        
        # Update user - also update full_name
        full_name = f"{first_name} {last_name}"
        cursor.execute('''
            UPDATE users 
            SET first_name = %s, last_name = %s, email = %s, 
                full_name = %s, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = %s
        ''', (first_name, last_name, email, full_name, current_user_id))
        
        conn.commit()
        
        return jsonify({
            'message': 'Profile updated successfully',
            'user': {
                'id': current_user_id,
                'email': email,
                'firstName': first_name,
                'lastName': last_name,
                'name': full_name
            }
        }), 200
        
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"❌ Update profile error: {str(e)}")
        return jsonify({'error': 'An error occurred'}), 500
    finally:
        if conn:
            cursor.close()
            conn.close()

@auth_bp.route('/change-password', methods=['PUT'])
@token_required
def change_password(current_user_id):
    """Change user password"""
    data = request.get_json()
    current_password = data.get('currentPassword')
    new_password = data.get('newPassword')
    
    if not current_password or not new_password:
        return jsonify({'error': 'Current password and new password are required'}), 400
    
    if len(new_password) < 6:
        return jsonify({'error': 'New password must be at least 6 characters'}), 400
    
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get current password hash
        cursor.execute(
            'SELECT password_hash FROM users WHERE user_id = %s',
            (current_user_id,)
        )
        user = cursor.fetchone()
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Verify current password
        if not check_password_hash(user['password_hash'], current_password):
            return jsonify({'error': 'Current password is incorrect'}), 401
        
        # Update password
        new_password_hash = generate_password_hash(new_password)
        cursor.execute('''
            UPDATE users 
            SET password_hash = %s, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = %s
        ''', (new_password_hash, current_user_id))
        
        conn.commit()
        
        return jsonify({'message': 'Password changed successfully'}), 200
        
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"❌ Change password error: {str(e)}")
        return jsonify({'error': 'An error occurred'}), 500
    finally:
        if conn:
            cursor.close()
            conn.close()

@auth_bp.route('/register', methods=['POST'])
def register():
    """Register a new user"""
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    first_name = data.get('firstName')
    last_name = data.get('lastName')
    
    if not email or not password or not first_name or not last_name:
        return jsonify({'error': 'All fields are required'}), 400
    
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400
    
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Check if email already exists
        cursor.execute('SELECT user_id FROM users WHERE email = %s', (email,))
        if cursor.fetchone():
            return jsonify({'error': 'Email already registered'}), 400
        
        # Create username from email
        username = email.split('@')[0]
        full_name = f"{first_name} {last_name}"
        
        # Create new user
        password_hash = generate_password_hash(password)
        cursor.execute('''
            INSERT INTO users (username, email, password_hash, first_name, last_name, full_name, role, is_active)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING user_id
        ''', (username, email, password_hash, first_name, last_name, full_name, 'planner', True))
        
        user_id = cursor.fetchone()['user_id']
        conn.commit()
        
        # Generate token
        token = jwt.encode({
            'user_id': user_id,
            'email': email,
            'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
        }, SECRET_KEY, algorithm='HS256')
        
        return jsonify({
            'message': 'Registration successful',
            'token': token,
            'user': {
                'id': user_id,
                'username': username,
                'email': email,
                'firstName': first_name,
                'lastName': last_name,
                'name': full_name,
                'role': 'planner'
            }
        }), 201
        
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"❌ Registration error: {str(e)}")
        return jsonify({'error': 'An error occurred during registration'}), 500
    finally:
        if conn:
            cursor.close()
            conn.close()