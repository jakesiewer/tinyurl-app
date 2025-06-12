import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { redisClient } from './config/redis';
import urlRoutes from './routes/urlRoutes';
import { errorHandler } from './middleware/validation';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} - ${req.method} ${req.path} - ${req.ip}`);
  next();
});

app.use('/', urlRoutes);

app.use(errorHandler);

app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource was not found',
    path: req.originalUrl
  });
});

const gracefulShutdown = async (signal: string) => {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
  
  server.close(async () => {
    console.log('HTTP server closed');
    
    try {
      await redisClient.disconnect();
      console.log('Redis connection closed');
    } catch (error) {
      console.error('Error closing Redis connection:', error);
    }
    
    console.log('Graceful shutdown completed');
    process.exit(0);
  });

  setTimeout(() => {
    console.log('Force shutdown after 10 seconds');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // In production, exit the process
  // process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // In production, exit the process
  process.exit(1);
});

const startServer = async () => {
  try {
    await redisClient.connect();
    console.log('Connected to Redis successfully');

    const server = app.listen(PORT, () => {
      console.log(`🚀 TinyURL Server is running on port ${PORT}`);
      console.log(`📊 Health check available at: http://localhost:${PORT}/health`);
      console.log(`🔗 Base URL: ${process.env.BASE_URL || `http://localhost:${PORT}`}`);
      console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    global.server = server;

    return server;
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

declare global {
  var server: any;
}

const server = global.server;

startServer().catch((error) => {
  console.error('Error starting server:', error);
  process.exit(1);
});

export default app;