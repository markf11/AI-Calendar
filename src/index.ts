import { config } from './config/environment';
import { Database } from './config/database';
import { RedisClient } from './config/redis';
import { createApp } from './api';
import { getWebSocketService } from './services/WebSocketService';
import { createServer } from 'http';

const app = createApp();
const server = createServer(app);
const webSocketService = getWebSocketService();

// Initialize WebSocket server
webSocketService.initialize(server);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  
  try {
    const db = Database.getInstance();
    const redis = RedisClient.getInstance();
    
    await Promise.all([
      webSocketService.shutdown(),
      db.close(),
      redis.disconnect()
    ]);
    
    console.log('All connections closed');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
});

// Start server
const PORT = config.port;
server.listen(PORT, () => {
  console.log(`🚀 Momentum Calendar API server running on port ${PORT}`);
  console.log(`📊 Environment: ${config.nodeEnv}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`🔌 WebSocket server available at ws://localhost:${PORT}/ws`);
});

export default app;