import { NextResponse } from 'next/server';

// Backend URL from environment variable or default to localhost
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

/**
 * POST /api/auth/reset-password
 * 
 * This endpoint proxies the password reset request to your backend server.
 * 
 * Request body: { token: string, newPassword: string }
 * 
 * The backend should:
 * 1. Validate the token (exists, not expired, matches a user)
 * 2. If invalid/expired, return error: "This reset link is invalid or has expired"
 * 3. If valid:
 *    - Hash the new password
 *    - Update user's password in database
 *    - Invalidate/delete the token so it can't be reused
 *    - Return success message
 */
export async function POST(request) {
  try {
    // Parse the request body
    const payload = await request.json();

    // Forward the request to the backend
    const res = await fetch(`${BACKEND_URL}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const contentType = res.headers.get('content-type') || '';

    // Handle non-OK responses
    if (!res.ok) {
      if (contentType.includes('application/json')) {
        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
      } else {
        const text = await res.text();
        return NextResponse.json(
          { success: false, error: `Backend error: ${text}` },
          { status: res.status }
        );
      }
    }

    // Return successful response
    if (contentType.includes('application/json')) {
      const data = await res.json();
      return NextResponse.json(data, { status: res.status });
    }

    // Fallback to text response
    const text = await res.text();
    return NextResponse.json(
      { success: true, message: text },
      { status: res.status }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy error';
    return NextResponse.json(
      { success: false, error: `Proxy error: ${message}` },
      { status: 500 }
    );
  }
}