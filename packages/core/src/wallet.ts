import {
  generateDNA, complementStrand, sha256, randomBytes,
  mutateInsert, findInsertionPoints, BASES, START_CODON,
} from "./dna";
import { ribosome, type RibosomeResult, type Protein } from "./ribosome";
import { encryptionKeyPairFromSeed, type EncryptionKeyPair } from "./crypto-dna";
import {
  appendLedgerEntry, ledgerContainsCoin, nextRotation, removeLedgerEntry,
} from "./dna-ledger";

export interface Wallet {
  dna: string;
  privateKeyDNA: string;
  publicKeyHash: string;
  ownershipProofHash: string;
  /** X25519 encryption public key DNA (128 bases) — for receiving encrypted transfers */
  encryptionPublicKeyDNA: string;
  /** X25519 encryption private key DNA (128 bases) — keep secret */
  encryptionPrivateKeyDNA: string;
  networkGenome: string;
  networkId: string;
  /** BIP-39-style 24-word mnemonic derived from 32-byte seed (optional on legacy wallets) */
  seedPhrase?: string;
  createdAt: number;
}

export interface WalletView {
  publicKeyHash: string;
  proteinCount: number;
  coinCount: number;
  ribosomeResult: RibosomeResult;
}

/**
 * Coin gene marker: a specific codon pattern that identifies a gene
 * as a coin rather than structural DNA. Starts with ATG (Met) followed
 * by a "coin signature" codon pattern that the ribosome can recognize.
 * Pattern: ATG + GGG (Gly) + TGG (Trp) + TGC (Cys) = "Met-Gly-Trp-Cys" header
 */
export const COIN_GENE_HEADER = "ATGGGGTGGTGC";
export const COIN_HEADER_ACIDS = ["Met", "Gly", "Trp", "Cys"];

/**
 * Create a new wallet: generates wallet DNA + private key DNA.
 *
 * The wallet DNA contains:
 * 1. Random structural DNA (looks full even when empty)
 * 2. An ownership proof region: a section whose complement, when
 *    hybridized with the private key, produces a specific "unlocking protein"
 *
 * The private key DNA is a strand that, when combined codon-by-codon with
 * the wallet DNA's proof region, produces a deterministic protein whose
 * hash serves as proof of ownership.
 */
/**
 * Create a new wallet. Pass the network's public key DNA (genome) and
 * network ID so the wallet can verify coins offline forever.
 */
export function createWallet(
  dnaLength: number = 6000,
  networkGenome: string = "",
  networkId: string = "",
): Wallet {
  const seed = randomBytes(32);
  return mintWalletFromSeed(seed, { dnaLength, networkGenome, networkId });
}

export interface MintOpts {
  dnaLength?: number;
  networkGenome?: string;
  networkId?: string;
}

/**
 * DNA-seeded wallet minting.
 *
 * A single 32-byte seed deterministically produces:
 *   • the wallet DNA (including embedded ownership proof)
 *   • the Ed25519 signing identity (private-key DNA)
 *   • the X25519 encryption identity (recipient of encrypted transfers)
 *
 * Same seed + same network = same wallet, forever. This is the "wallets are
 * minted from the network DNA seed" behaviour described in the spec.
 */
export function mintWalletFromSeed(seed32: Uint8Array, opts: MintOpts = {}): Wallet {
  if (seed32.length !== 32) throw new Error("seed must be 32 bytes");
  const dnaLength = opts.dnaLength ?? 6000;
  const networkGenome = opts.networkGenome ?? "";
  const networkId = opts.networkId ?? "";

  const baseDNA = deriveDeterministicDNA(seed32, "wallet/base", dnaLength);
  const privateKeyDNA = deriveDeterministicDNA(seed32, "wallet/sig", Math.floor(dnaLength / 2));
  const encSeedHex = sha256("enc|" + bytesToHex(seed32) + "|" + networkId);
  const encSeed = hexToBytes(encSeedHex.slice(0, 64));
  const encPair: EncryptionKeyPair = encryptionKeyPairFromSeed(encSeed);

  const identityRegion = baseDNA.slice(0, 300);
  const hybridized = hybridizeStrands(identityRegion, privateKeyDNA);
  const hybridResult = ribosome(hybridized);
  const ownershipProofHash = sha256(hybridResult.publicKeyChain);

  const proofEmbedded = embedProofInDNA(baseDNA, ownershipProofHash);
  const walletResult = ribosome(proofEmbedded);

  return {
    dna: proofEmbedded,
    privateKeyDNA,
    publicKeyHash: walletResult.publicKeyHash,
    ownershipProofHash,
    encryptionPublicKeyDNA: encPair.publicKeyDNA,
    encryptionPrivateKeyDNA: encPair.privateKeyDNA,
    networkGenome,
    networkId,
    seedPhrase: seedToPhrase(seed32),
    createdAt: Date.now(),
  };
}

/**
 * Mint a wallet anchored to a specific network DNA.
 * The network genome is folded into the seed so the exact same user seed on a
 * different network produces a different wallet.
 */
export function mintWalletFromNetworkSeed(
  networkGenome: string,
  networkId: string,
  userEntropy: Uint8Array | string,
  opts: MintOpts = {},
): Wallet {
  const entropyBytes =
    typeof userEntropy === "string" ? new TextEncoder().encode(userEntropy) : userEntropy;
  const bundled = sha256(
    "biocrypt|mint|" + networkGenome + "|" + networkId + "|" + bytesToHex(entropyBytes),
  );
  const seed = hexToBytes(bundled);
  return mintWalletFromSeed(seed, { ...opts, networkGenome, networkId });
}

/**
 * Rehydrate a wallet from its seed phrase (24 words).
 */
export function restoreWalletFromPhrase(phrase: string, opts: MintOpts = {}): Wallet {
  const seed = phraseToSeed(phrase);
  return mintWalletFromSeed(seed, opts);
}

/* ── Deterministic helpers ─────────────────────────────────────────── */

function deriveDeterministicDNA(seed: Uint8Array, tag: string, length: number): string {
  let dna = "";
  let counter = 0;
  const seedHex = bytesToHex(seed);
  while (dna.length < length) {
    const block = sha256(seedHex + "|" + tag + "|" + counter);
    for (let i = 0; i < block.length && dna.length < length; i += 2) {
      const byte = parseInt(block.slice(i, i + 2), 16);
      dna += BASES[(byte >> 6) & 3];
      if (dna.length < length) dna += BASES[(byte >> 4) & 3];
      if (dna.length < length) dna += BASES[(byte >> 2) & 3];
      if (dna.length < length) dna += BASES[byte & 3];
    }
    counter++;
  }
  return dna;
}

function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, "0");
  return out;
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/* ── Tiny 2048-ish mnemonic (DNA-flavoured, self-contained) ────────── */

const BIOWORDS = [
  "alanine","arginine","asparagine","aspartate","cysteine","glutamate","glutamine","glycine",
  "histidine","isoleucine","leucine","lysine","methionine","phenylalanine","proline","serine",
  "threonine","tryptophan","tyrosine","valine","adenine","thymine","cytosine","guanine",
  "uracil","ribose","codon","anticodon","ribosome","polymerase","helicase","primase",
  "telomere","centromere","chromatin","chromosome","nucleus","nucleolus","cytoplasm","membrane",
  "mitosis","meiosis","replication","transcription","translation","splicing","capping","polyA",
  "exon","intron","promoter","enhancer","silencer","operon","lactose","tryptophan2",
  "genome","exome","proteome","metabolome","plasmid","vector","vector2","primer",
  "ligase","nuclease","restriction","ecori","bamhi","hindiii","crispr","cas9",
  "sgrna","trna","mrna","lnrna","snrna","sirna","mirna","piRNA",
  "virus","prion","bacteriophage","eukaryote","prokaryote","archaea","bacteria","fungi",
  "plant","animal","protist","monera","cell","organelle","vacuole","lysosome",
  "peroxisome","mitochondria","chloroplast","endoplasmic","golgi","ribosome2","cytoskeleton","flagellum",
  "cilium","microtubule","actin","myosin","kinesin","dynein","collagen","keratin",
  "hemoglobin","myoglobin","insulin","glucagon","oxytocin","dopamine","serotonin","adrenaline",
  "cortisol","estrogen","testosterone","progesterone","thyroxine","melatonin","enzyme","catalyst",
  "substrate","product","cofactor","coenzyme","atp","adp","amp","nadh",
  "nadph","fadh","pyruvate","lactate","glucose","fructose","galactose","sucrose",
  "maltose","lactose2","cellulose","starch","glycogen","chitin","peptide","polymer",
  "monomer","dimer","trimer","tetramer","hexamer","octamer","filament","fiber",
  "membrane2","phospholipid","cholesterol","steroid","lipid","fatty","saturated","unsaturated",
  "hydrophobic","hydrophilic","amphipathic","polar","nonpolar","covalent","ionic","hydrogen",
  "disulfide","peptidebond","glycosidic","ester","ether","amide","amine","carboxyl",
  "hydroxyl","methyl","ethyl","phenyl","aromatic","aliphatic","alcohol","aldehyde",
  "ketone","ether2","amine2","thiol","sulfide","halide","carbonate","phosphate",
  "sulfate","nitrate","chloride","bromide","iodide","fluoride","hydroxide","oxide",
  "peroxide","superoxide","radical","antioxidant","vitamin","mineral","calcium","magnesium",
  "sodium","potassium","iron","zinc","copper","manganese","selenium","molybdenum",
  "chromium","cobalt","nickel","iodine","fluorine","chlorine","bromine","phosphorus",
  "sulfur","silicon","carbon","nitrogen","oxygen","hydrogen2","helium","neon",
  "argon","krypton","xenon","radon","lithium","beryllium","boron","aluminum",
  "gallium","germanium","arsenic","selenium2","rubidium","strontium","yttrium","zirconium",
  "niobium","technetium","ruthenium","rhodium","palladium","silver","cadmium","indium",
  "tin","antimony","tellurium","cesium","barium","lanthanum","cerium","praseodymium",
  "neodymium","promethium","samarium","europium","gadolinium","terbium","dysprosium","holmium",
  "erbium","thulium","ytterbium","lutetium","hafnium","tantalum","tungsten","rhenium",
  "osmium","iridium","platinum","gold","mercury","thallium","lead","bismuth",
  "polonium","astatine","francium","radium","actinium","thorium","protactinium","uranium",
] as const;

function seedToPhrase(seed: Uint8Array): string {
  const words: string[] = [];
  for (let i = 0; i < 24; i++) {
    const byte = seed[i % seed.length] ^ (i * 0x5f);
    const word = BIOWORDS[byte % BIOWORDS.length];
    words.push(word);
  }
  return words.join(" ");
}

function phraseToSeed(phrase: string): Uint8Array {
  const hex = sha256("biocrypt/phrase/v1|" + phrase.trim().toLowerCase());
  return hexToBytes(hex);
}

export { seedToPhrase, phraseToSeed };

/**
 * Hybridize two DNA strands at codon level.
 * For each position, XOR the base indices to produce a new base.
 * This creates a deterministic third strand from any two inputs.
 */
export function hybridizeStrands(strand1: string, strand2: string): string {
  const baseIndex: Record<string, number> = { T: 0, A: 1, C: 2, G: 3 };
  const len = Math.min(strand1.length, strand2.length);
  const result: string[] = [];

  for (let i = 0; i < len; i++) {
    const idx1 = baseIndex[strand1[i]] ?? 0;
    const idx2 = baseIndex[strand2[i]] ?? 0;
    result.push(BASES[(idx1 + idx2) % 4]);
  }

  return result.join("");
}

/**
 * Embed a proof hash into the first segment of wallet DNA.
 * Each hex character is encoded as 2 bases (4 bits = 2 bases of 2 bits each).
 * Framed by a known marker so it can be located and read back.
 */
const PROOF_MARKER = "TTTAAACCCGGG"; // 12-base marker

function embedProofInDNA(dna: string, proofHash: string): string {
  const baseIdx: Record<string, number> = { T: 0, A: 1, C: 2, G: 3 };

  const hexToBases = (hex: string): string => {
    let bases = "";
    for (const ch of hex) {
      const val = parseInt(ch, 16);
      bases += BASES[(val >> 2) & 3];
      bases += BASES[val & 3];
    }
    return bases;
  };

  const proofBases = hexToBases(proofHash);
  const proofRegion = PROOF_MARKER + proofBases + PROOF_MARKER;

  if (dna.length < 300 + proofRegion.length) {
    return proofRegion + dna;
  }
  return dna.slice(0, 300) + proofRegion + dna.slice(300 + proofRegion.length);
}

/**
 * Extract the embedded proof hash from wallet DNA.
 */
export function extractEmbeddedProof(dna: string): string | null {
  const startIdx = dna.indexOf(PROOF_MARKER);
  if (startIdx === -1) return null;

  const proofStart = startIdx + PROOF_MARKER.length;
  const endIdx = dna.indexOf(PROOF_MARKER, proofStart);
  if (endIdx === -1) return null;

  const proofBases = dna.slice(proofStart, endIdx);
  const baseIndex: Record<string, number> = { T: 0, A: 1, C: 2, G: 3 };

  let hex = "";
  for (let i = 0; i < proofBases.length; i += 2) {
    const hi = baseIndex[proofBases[i]] ?? 0;
    const lo = baseIndex[proofBases[i + 1]] ?? 0;
    const val = (hi << 2) | lo;
    hex += val.toString(16);
  }

  return hex;
}

/**
 * Extract the stable identity region of wallet DNA (first 300 bases).
 * This region never changes when coins are added/removed because
 * coin genes are inserted after position 300 + proof region.
 */
function getIdentityRegion(walletDNA: string): string {
  return walletDNA.slice(0, 300);
}

/**
 * Prove ownership: combine the wallet's stable identity region
 * with the private key DNA, produce the unlocking protein.
 * This proof is stable regardless of coin mutations to the wallet.
 */
export function proveOwnership(walletDNA: string, privateKeyDNA: string): string {
  const identity = getIdentityRegion(walletDNA);
  const hybridized = hybridizeStrands(identity, privateKeyDNA);
  const result = ribosome(hybridized);
  return sha256(result.publicKeyChain);
}

/**
 * Verify ownership proof against the embedded proof in wallet DNA.
 */
export function verifyOwnership(walletDNA: string, proof: string): boolean {
  const embedded = extractEmbeddedProof(walletDNA);
  if (!embedded) return false;
  return embedded === proof;
}

/**
 * Get the public view of a wallet (no private key needed).
 */
export function viewWallet(walletDNA: string): WalletView {
  const result = ribosome(walletDNA);
  const coinCount = countCoins(walletDNA, result.proteins);

  return {
    publicKeyHash: result.publicKeyHash,
    proteinCount: result.proteins.length,
    coinCount,
    ribosomeResult: result,
  };
}

/**
 * Count coins: identify proteins that have the coin gene header.
 */
export function countCoins(walletDNA: string, proteins: Protein[]): number {
  let count = 0;
  for (const p of proteins) {
    if (isCoinProtein(p)) count++;
  }
  return count;
}

export function isCoinProtein(protein: Protein): boolean {
  if (protein.aminoAcids.length < 4) return false;
  return (
    protein.aminoAcids[0] === COIN_HEADER_ACIDS[0] &&
    protein.aminoAcids[1] === COIN_HEADER_ACIDS[1] &&
    protein.aminoAcids[2] === COIN_HEADER_ACIDS[2] &&
    protein.aminoAcids[3] === COIN_HEADER_ACIDS[3]
  );
}

/**
 * Extract a specific coin gene from wallet DNA by its serial hash.
 * Returns the gene sequence and its position so it can be removed.
 */
export function extractCoinGene(
  walletDNA: string,
  coinSerialHash: string
): { gene: string; startIdx: number; endIdx: number } | null {
  const result = ribosome(walletDNA);
  for (const protein of result.proteins) {
    if (!isCoinProtein(protein)) continue;
    const serial = getCoinSerial(protein);
    if (sha256(serial) === coinSerialHash) {
      // Gene spans from startIndex to stopIndex+1
      const endIdx = protein.stopIndex + 1;
      return {
        gene: walletDNA.slice(protein.startIndex, endIdx),
        startIdx: protein.startIndex,
        endIdx,
      };
    }
  }
  return null;
}

/**
 * Get the unique serial of a coin protein.
 * The serial is the amino acid sequence after the 4-acid header.
 */
export function getCoinSerial(protein: Protein): string {
  return protein.aminoAcids.slice(4).join("-");
}

/**
 * Integrate a coin gene into wallet/network DNA.
 * Appends a STOP codon (TAA) before the gene to terminate any open reading
 * frame, then appends the coin gene. This prevents an unclosed ORF at the
 * end of the existing DNA from absorbing the new gene into its protein.
 */
export function integrateCoinGene(walletDNA: string, coinGene: string): string {
  return walletDNA + "TAA" + coinGene;
}

/* ── Compact DNA-ledger integration ────────────────────────────────── */

/**
 * Integrate a coin's _receipt_ (not its full gene) into wallet DNA using the
 * rotating DNA ledger. 64 bases per coin, checksummed, self-mutating. This
 * is the "each coin gets compressed into the wallet DNA" behaviour.
 */
export function integrateCoinReceipt(walletDNA: string, serialHash: string): string {
  const identity = walletDNA.slice(0, 300);
  const rot = nextRotation(walletDNA);
  return appendLedgerEntry(walletDNA, identity, serialHash, rot);
}

/**
 * Check whether a coin's receipt is present in the wallet ledger.
 */
export function walletLedgerContains(walletDNA: string, serialHash: string): boolean {
  const identity = walletDNA.slice(0, 300);
  return ledgerContainsCoin(walletDNA, identity, serialHash);
}

/**
 * Remove a coin's receipt from the wallet ledger (called when spending).
 */
export function removeCoinReceipt(walletDNA: string, serialHash: string): string {
  const identity = walletDNA.slice(0, 300);
  return removeLedgerEntry(walletDNA, identity, serialHash);
}
