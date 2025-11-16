import requests

response = requests.post('http://localhost:5000/api/auth/login', json={
    'email': 'planner_calamba@example.gov',
    'password': 'password123'
})

print("Status Code:", response.status_code)
print("Response:", response.json())