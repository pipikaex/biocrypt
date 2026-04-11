import { Injectable } from "@nestjs/common";
import { NullifierProof } from "@zcoin/core";
import { RegistryService } from "../registry/registry.service";

@Injectable()
export class GossipService {
  private peers = new Map<string, { connectedAt: number; lastSync: number }>();

  constructor(private registry: RegistryService) {}

  registerPeer(peerId: string): void {
    this.peers.set(peerId, { connectedAt: Date.now(), lastSync: 0 });
  }

  removePeer(peerId: string): void {
    this.peers.delete(peerId);
  }

  receiveNullifiers(proofs: NullifierProof[], sourceNode: string): { newCount: number; total: number } {
    const newCount = this.registry.mergeFrom(proofs, sourceNode);
    return { newCount, total: this.registry.size };
  }

  getNullifiersForSync(): NullifierProof[] {
    return this.registry.getAllNullifiers();
  }

  checkCoinSpent(coinSerialHash: string): boolean {
    return this.registry.isCoinSpent(coinSerialHash);
  }

  getPeerCount(): number {
    return this.peers.size;
  }

  getStatus() {
    return {
      peers: this.peers.size,
      nullifiers: this.registry.size,
      conflicts: this.registry.getConflicts().length,
    };
  }
}
