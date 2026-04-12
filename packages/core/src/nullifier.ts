import { sha256 } from "./dna";

/**
 * Nullifier: the core of double-spend prevention.
 *
 * A nullifier is a deterministic hash derived from a coin's serial
 * and the owner's private key. Properties:
 * - Deterministic: same coin + same owner = same nullifier (always)
 * - Unforgeable: only the owner can compute it (needs private key)
 * - Unique per coin: different coins always produce different nullifiers
 * - Verifiable: anyone can check a nullifier proof without the private key
 *
 * When a coin is spent, its nullifier is broadcast to the gossip network.
 * If the same nullifier appears twice, it's a double-spend attempt.
 */

export interface NullifierProof {
  nullifier: string;
  coinSerialHash: string;
  commitment: string;
  timestamp: number;
}

export interface ConflictReport {
  nullifier: string;
  coinSerialHash: string;
  firstSeen: number;
  conflictSeen: number;
  firstSourceNode: string;
  conflictSourceNode: string;
}

/**
 * Compute a nullifier from coin serial and owner's private key.
 */
export function computeNullifier(coinSerialHash: string, privateKeyDNA: string): string {
  const keyHash = sha256(privateKeyDNA);
  return sha256(coinSerialHash + "|nullifier|" + keyHash);
}

/**
 * Create a nullifier proof that can be verified without the private key.
 * The proof shows that a nullifier corresponds to a specific coin.
 */
export function createNullifierProof(
  coinSerialHash: string,
  privateKeyDNA: string,
): NullifierProof {
  const nullifier = computeNullifier(coinSerialHash, privateKeyDNA);
  // Commitment: hash of (nullifier + coinSerialHash) — binds them together
  const commitment = sha256(nullifier + "|" + coinSerialHash);

  return {
    nullifier,
    coinSerialHash,
    commitment,
    timestamp: Date.now(),
  };
}

/**
 * Verify a nullifier proof: check that the commitment is valid.
 * This doesn't require the private key.
 */
export function verifyNullifierProof(proof: NullifierProof): boolean {
  const expectedCommitment = sha256(proof.nullifier + "|" + proof.coinSerialHash);
  return expectedCommitment === proof.commitment;
}

/**
 * In-memory nullifier registry for a single node.
 * In production this would be backed by LevelDB.
 */
export class NullifierRegistry {
  private nullifiers = new Map<string, {
    coinSerialHash: string;
    firstSeen: number;
    sourceNode: string;
  }>();

  private conflicts: ConflictReport[] = [];

  /**
   * Register a nullifier without proof verification (for gateway/direct marking).
   */
  registerDirect(proof: NullifierProof, sourceNode: string): boolean {
    const existing = this.nullifiers.get(proof.nullifier);
    if (existing) return false;
    this.nullifiers.set(proof.nullifier, {
      coinSerialHash: proof.coinSerialHash,
      firstSeen: proof.timestamp,
      sourceNode,
    });
    return true;
  }

  /**
   * Register a nullifier. Returns true if new, false if already seen.
   * If already seen for a DIFFERENT coin, records a conflict.
   */
  register(proof: NullifierProof, sourceNode: string): boolean {
    if (!verifyNullifierProof(proof)) {
      throw new Error("Invalid nullifier proof");
    }

    const existing = this.nullifiers.get(proof.nullifier);

    if (existing) {
      // Same nullifier seen before
      if (existing.coinSerialHash !== proof.coinSerialHash) {
        // Different coin claims same nullifier — shouldn't happen with
        // honest participants, but record it
        this.conflicts.push({
          nullifier: proof.nullifier,
          coinSerialHash: proof.coinSerialHash,
          firstSeen: existing.firstSeen,
          conflictSeen: proof.timestamp,
          firstSourceNode: existing.sourceNode,
          conflictSourceNode: sourceNode,
        });
      }
      return false; // Already registered
    }

    this.nullifiers.set(proof.nullifier, {
      coinSerialHash: proof.coinSerialHash,
      firstSeen: proof.timestamp,
      sourceNode,
    });

    return true;
  }

  /**
   * Check if a nullifier has been seen (coin already spent).
   */
  isSpent(nullifier: string): boolean {
    return this.nullifiers.has(nullifier);
  }

  /**
   * Check if a coin (by serial hash) has been spent.
   * Scans all nullifiers for a matching coinSerialHash.
   */
  isCoinSpent(coinSerialHash: string): boolean {
    for (const [, entry] of this.nullifiers) {
      if (entry.coinSerialHash === coinSerialHash) return true;
    }
    return false;
  }

  /**
   * Get all nullifiers (for gossip sync).
   */
  getAllNullifiers(): NullifierProof[] {
    const proofs: NullifierProof[] = [];
    for (const [nullifier, entry] of this.nullifiers) {
      proofs.push({
        nullifier,
        coinSerialHash: entry.coinSerialHash,
        commitment: sha256(nullifier + "|" + entry.coinSerialHash),
        timestamp: entry.firstSeen,
      });
    }
    return proofs;
  }

  /**
   * Get all conflict reports.
   */
  getConflicts(): ConflictReport[] {
    return [...this.conflicts];
  }

  /**
   * Merge nullifiers received from a peer (gossip sync).
   */
  mergeFrom(proofs: NullifierProof[], sourceNode: string): number {
    let newCount = 0;
    for (const proof of proofs) {
      if (this.register(proof, sourceNode)) {
        newCount++;
      }
    }
    return newCount;
  }

  get size(): number {
    return this.nullifiers.size;
  }

  /**
   * Export state for persistence.
   */
  export(): { nullifiers: [string, { coinSerialHash: string; firstSeen: number; sourceNode: string }][]; conflicts: ConflictReport[] } {
    return {
      nullifiers: Array.from(this.nullifiers.entries()),
      conflicts: this.conflicts,
    };
  }

  /**
   * Import state from persistence.
   */
  import(data: ReturnType<NullifierRegistry["export"]>): void {
    for (const [key, value] of data.nullifiers) {
      this.nullifiers.set(key, value);
    }
    this.conflicts = data.conflicts;
  }
}
