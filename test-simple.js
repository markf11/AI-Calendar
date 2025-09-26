// Simple test to check if basic functionality works
const { GoogleCalendarService } = require('./dist/services/GoogleCalendarService');

console.log('Testing Google Calendar Service...');

try {
  const service = new GoogleCalendarService();
  console.log('✓ GoogleCalendarService instantiated successfully');
  
  const authUrl = service.getAuthUrl();
  console.log('✓ Auth URL generated:', authUrl);
  
  console.log('All basic tests passed!');
} catch (error) {
  console.error('✗ Error:', error.message);
}