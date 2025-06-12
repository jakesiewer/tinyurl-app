import { redisClient } from '../config/redis';

class CodeGenerator {
  private readonly characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  private readonly defaultLength = 6;
  private readonly maxRetries = 5;

  private generateRandomCode(length: number = this.defaultLength): string {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += this.characters.charAt(Math.floor(Math.random() * this.characters.length));
    }
    return result;
  }

  public async generateUniqueCode(): Promise<string> {
    let length = this.defaultLength;
    let retries = 0;

    while (retries < this.maxRetries) {
      const code = this.generateRandomCode(length);
      
      try {
        const exists = await redisClient.urlExists(code);
        
        if (!exists) {
          return code;
        }
        
        retries++;
        
        if (retries === 2) {
          length = 7;
        }
        
      } catch (error) {
        console.error('Error checking code uniqueness:', error);
        throw new Error('Failed to generate unique code due to Redis error');
      }
    }

    return this.generateRandomCode(8);
  }

//   public isValidCode(code: string): boolean {
//     if (!code || code.length < 6 || code.length > 8) {
//       return false;
//     }

//     return /^[A-Za-z0-9]+$/.test(code);
//   }

//   public async generateMultipleCodes(count: number): Promise<string[]> {
//     const codes: string[] = [];
    
//     for (let i = 0; i < count; i++) {
//       const code = await this.generateUniqueCode();
//       codes.push(code);
//     }
    
//     return codes;
//   }

//   public getStats(): { 
//     charactersAvailable: number;
//     possibleCombinations6: number;
//     possibleCombinations7: number;
//     possibleCombinations8: number;
//   } {
//     const base = this.characters.length;
//     return {
//       charactersAvailable: base,
//       possibleCombinations6: Math.pow(base, 6),
//       possibleCombinations7: Math.pow(base, 7),
//       possibleCombinations8: Math.pow(base, 8),
//     };
//   }
}

// Export singleton instance
export const codeGenerator = new CodeGenerator();
export default codeGenerator;