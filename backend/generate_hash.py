from werkzeug.security import generate_password_hash, check_password_hash

password = "password123"
hash = generate_password_hash(password)

print("=" * 60)
print("PASSWORD HASH GENERATOR")
print("=" * 60)
print(f"\nPassword: {password}")
print(f"\nGenerated Hash:\n{hash}")

# Test if the hash works
test = check_password_hash(hash, password)
print(f"\n✅ Hash verification test: {test}")

print("\n" + "=" * 60)
print("SQL TO RUN IN SUPABASE:")
print("=" * 60)
print(f"""
UPDATE users 
SET password_hash = '{hash}'
WHERE email = 'planner_calamba@example.gov';

SELECT user_id, email, first_name, last_name, 
       LEFT(password_hash, 50) as hash_preview
FROM users 
WHERE email = 'planner_calamba@example.gov';
""")