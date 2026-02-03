/**
 * Test script to simulate frontend to backend proxy request
 */

async function testProxyFlow() {
  try {
    console.log('1. Login to get cookies...');
    const loginResponse = await fetch('http://localhost:3000/user-auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'admin',
        password: 'changeme123'
      }),
    });

    const loginData = await loginResponse.json();
    console.log('Login response:', loginData.success ? 'Success' : 'Failed');
    
    // Extract cookies from response
    const setCookieHeaders = loginResponse.headers.getSetCookie();
    console.log('Cookies received:', setCookieHeaders?.length || 0);
    console.log('Cookie values:', setCookieHeaders?.map(c => c.split(';')[0]) || []);
    
    if (!setCookieHeaders || setCookieHeaders.length === 0) {
      console.error('No cookies received from login!');
      return;
    }

    // Join cookies for subsequent requests
    const cookieHeader = setCookieHeaders.map(c => c.split(';')[0]).join('; ');
    
    console.log('\n2. Try to create user with cookies...');
    const createUserResponse = await fetch('http://localhost:3000/admin/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader
      },
      body: JSON.stringify({
        username: 'testuser2',
        password: 'testpass123',
        email: 'test2@example.com',
        fullName: 'Test User 2',
        isActive: true
      }),
    });

    const createUserData = await createUserResponse.json();
    console.log('Create user response:', {
      status: createUserResponse.status,
      success: createUserData.success,
      data: createUserData.data,
      error: createUserData.error
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

testProxyFlow();
