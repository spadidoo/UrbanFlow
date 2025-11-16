import os
from dotenv import load_dotenv
import psycopg2
from urllib.parse import urlparse

load_dotenv()

DATABASE_URL = os.getenv('DATABASE_URL')

print("=" * 60)
print("DATABASE CONNECTION TEST")
print("=" * 60)

print(f"\n1. DATABASE_URL found: {bool(DATABASE_URL)}")
if DATABASE_URL:
    url = urlparse(DATABASE_URL)
    print(f"   Host: {url.hostname}")
    print(f"   Database: {url.path[1:]}")
    print(f"   User: {url.username}")

try:
    print("\n2. Testing connection...")
    if DATABASE_URL:
        url = urlparse(DATABASE_URL)
        conn = psycopg2.connect(
            host=url.hostname,
            port=url.port or 5432,
            database=url.path[1:],
            user=url.username,
            password=url.password,
            sslmode='require'
        )
    else:
        conn = psycopg2.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            port=int(os.getenv('DB_PORT', 5432)),
            database=os.getenv('DB_NAME', 'urbanflow'),
            user=os.getenv('DB_USER', 'postgres'),
            password=os.getenv('DB_PASSWORD', '')
        )
    
    print("   ✅ Connection successful!")
    
    cursor = conn.cursor()
    
    # Check if users table exists
    print("\n3. Checking if 'users' table exists...")
    cursor.execute("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'users'
        );
    """)
    exists = cursor.fetchone()[0]
    
    if exists:
        print("   ✅ Users table exists!")
        
        # Count users
        cursor.execute("SELECT COUNT(*) FROM users;")
        count = cursor.fetchone()[0]
        print(f"   📊 Total users in table: {count}")
        
        if count > 0:
            # Show users
            cursor.execute("SELECT user_id, email, first_name, last_name, role FROM users;")
            users = cursor.fetchall()
            print("\n4. Users in database:")
            for user in users:
                print(f"   - ID: {user[0]}, Email: {user[1]}, Name: {user[2]} {user[3]}, Role: {user[4]}")
        else:
            print("   ⚠️  Users table is empty!")
    else:
        print("   ❌ Users table DOES NOT exist!")
        print("\n   You need to create it in Supabase Dashboard → SQL Editor")
    
    cursor.close()
    conn.close()
    
except Exception as e:
    print(f"   ❌ Error: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 60)