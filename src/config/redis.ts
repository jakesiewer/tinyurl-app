import { createClient, RedisClientType } from 'redis';
import { RedisConfig } from '../types';

class RedisConnection {
  private client: RedisClientType;
  private isConnected: boolean = false;

  constructor() {
    const config: RedisConfig = {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    };

    this.client = createClient(config);

    // Event handlers
    this.client.on('error', (err) => {
      console.error('Redis Client Error:', err);
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      console.log('Connected to Redis');
      this.isConnected = true;
    });

    this.client.on('disconnect', () => {
      console.log('Disconnected from Redis');
      this.isConnected = false;
    });
  }

  public async connect(): Promise<void> {
    try {
      if (!this.isConnected) {
        await this.client.connect();
      }
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      if (this.isConnected) {
        await this.client.disconnect();
      }
    } catch (error) {
      console.error('Failed to disconnect from Redis:', error);
      throw error;
    }
  }

  public getClient(): RedisClientType {
    return this.client;
  }

  public isRedisConnected(): boolean {
    return this.isConnected;
  }

  // URL-specific methods
  public async setUrl(code: string, data: string, expireInSeconds?: number): Promise<void> {
    try {
      if (expireInSeconds) {
        await this.client.setEx(code, expireInSeconds, data);
      } else {
        await this.client.set(code, data);
      }
    } catch (error) {
      console.error('Error setting URL in Redis:', error);
      throw error;
    }
  }

  public async getUrl(code: string): Promise<string | null> {
    try {
      return await this.client.get(code);
    } catch (error) {
      console.error('Error getting URL from Redis:', error);
      throw error;
    }
  }

  public async deleteUrl(code: string): Promise<number> {
    try {
      return await this.client.del(code);
    } catch (error) {
      console.error('Error deleting URL from Redis:', error);
      throw error;
    }
  }

  public async urlExists(code: string): Promise<boolean> {
    try {
      const exists = await this.client.exists(code);
      return exists === 1;
    } catch (error) {
      console.error('Error checking URL existence in Redis:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const redisClient = new RedisConnection();
export default redisClient;