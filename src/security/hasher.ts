import crypto from 'crypto';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';

/**
 * Modern Production Argon2id Password Hasher
 * Supports Argon2id natively with backward-compatible scrypt verification.
 */

export async function hashPassword(password: string): Promise<string> {
  return await argonHash(password, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

export async function verifyPassword(password: string, combinedHash: string): Promise<boolean> {
  try {
    if (!combinedHash || typeof combinedHash !== 'string') {
      return false;
    }

    // 1. Argon2id verification
    if (combinedHash.startsWith('$argon2')) {
      return await argonVerify(combinedHash, password);
    }

    // 2. Backward compatibility with scrypt
    if (combinedHash.startsWith('$scrypt$')) {
      const parts = combinedHash.split('$');
      if (parts.length !== 5) return false;
      const salt = parts[3];
      const originalHash = parts[4];

      return new Promise((resolve) => {
        crypto.scrypt(
          password,
          salt,
          64,
          {
            cost: 16384,
            blockSize: 8,
            parallelization: 1,
            maxmem: 32 * 1024 * 1024,
          },
          (err, derivedKey) => {
            if (err) return resolve(false);
            const computedHash = derivedKey.toString('hex');
            const isMatch = crypto.timingSafeEqual(
              Buffer.from(computedHash, 'utf8'),
              Buffer.from(originalHash, 'utf8')
            );
            resolve(isMatch);
          }
        );
      });
    }

    return false;
  } catch {
    return false;
  }
}
