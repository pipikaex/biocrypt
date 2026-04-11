import { Injectable, OnModuleInit } from "@nestjs/common";
import { NullifierRegistry, NullifierProof } from "@zcoin/core";
import * as fs from "fs";
import * as path from "path";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const REGISTRY_FILE = path.join(DATA_DIR, "nullifiers.json");

@Injectable()
export class RegistryService implements OnModuleInit {
  private registry = new NullifierRegistry();

  onModuleInit() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(REGISTRY_FILE)) {
      const data = JSON.parse(fs.readFileSync(REGISTRY_FILE, "utf-8"));
      this.registry.import(data);
      console.log(`Nullifier registry loaded: ${this.registry.size} entries`);
    }
  }

  private persist() {
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(this.registry.export()));
  }

  registerNullifier(proof: NullifierProof, sourceNode: string): boolean {
    const isNew = this.registry.register(proof, sourceNode);
    if (isNew) this.persist();
    return isNew;
  }

  isSpent(nullifier: string): boolean {
    return this.registry.isSpent(nullifier);
  }

  isCoinSpent(coinSerialHash: string): boolean {
    return this.registry.isCoinSpent(coinSerialHash);
  }

  getAllNullifiers(): NullifierProof[] {
    return this.registry.getAllNullifiers();
  }

  mergeFrom(proofs: NullifierProof[], sourceNode: string): number {
    const count = this.registry.mergeFrom(proofs, sourceNode);
    if (count > 0) this.persist();
    return count;
  }

  getConflicts() {
    return this.registry.getConflicts();
  }

  get size(): number {
    return this.registry.size;
  }
}
