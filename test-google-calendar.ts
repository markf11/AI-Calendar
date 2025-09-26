// Simple test to verify Google Calendar integration
import { GoogleCalendarService } from './src/services/GoogleCalendarService';

// Mock environment variables
process.env.GOOGLE_CLIENT_ID = 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/callback';

async function testGoogleCalendarService() {
  try {
    console.log('Testing Google Calendar Service...');
    
    const service = new GoogleCalendarService();
    console.log('✓ GoogleCalendarService instantiated successfully');
    
    const authUrl = service.getAuthUrl();
    console.log('✓ Auth URL generated:', authUrl.substring(0, 50) + '...');
    
    console.log('✓ All basic tests passed!');
    return true;
  } catch (error) {
    console.error('✗ Error:', error);
    return false;
  }
}

testGoogleCalendarService().then(success => {
  process.exit(success ? 0 : 1);
});