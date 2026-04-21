/**
 * BioCrypt v1 Genesis — FROZEN CONSTANTS.
 *
 * These values are the published protocol fingerprint for BioCrypt v1.
 * They are derived from a deterministic seed string (see GENESIS_SEED_MATERIAL
 * below) and shipped in every release. Nobody holds a matching private key —
 * the networkGenome is purely an identifier that every coin embeds to declare
 * "I belong to this network".
 *
 * Changing any of these constants forks the network into a new, incompatible
 * protocol. Do not change them after the first coin of v1 has been minted.
 */

export const PROTOCOL_VERSION = 1 as const;

/**
 * The deterministic seed string used at genesis. Preserved here for
 * transparency and reproducibility — anyone can run sha256() on it and verify
 * that GENESIS_NETWORK_GENOME below is the byte-for-byte DNA encoding of that
 * digest. See PROTOCOL.md for the derivation script.
 */
export const GENESIS_SEED_MATERIAL =
  "biocrypt-v1-genesis-2026-04-07-decentralized-genome";

/**
 * The 128-base DNA strand that identifies the BioCrypt v1 network.
 * Computed as: bytesToDNA(sha256(GENESIS_SEED_MATERIAL)).
 * No Ed25519 private key exists for this value — it is NOT a public key in the
 * cryptographic sense, only a published identifier.
 */
export const GENESIS_NETWORK_GENOME =
  "AGTCATTCTCGCTTTACCCGAGACGGATGCAGAGTGTCGAAGTCGCGATGGGACGGTTCCTAGCCCAGGAAGCACCGGCGCTGTTGGTTAGGCTTCTGGAATGTTCCCTGTCTCACCCCGTGCATCAT";

/**
 * sha256 hex digest of GENESIS_NETWORK_GENOME — used as a compact reference
 * in coin headers so verification never has to re-encode the full genome.
 */
export const GENESIS_GENOME_FINGERPRINT =
  "0eafe2a278696a5b4187dfff4deb5d1ca91e1366e7923c56514dab00e7619db7";

/**
 * Human-readable network identifier (first 12 hex chars of the fingerprint).
 */
export const GENESIS_NETWORK_ID = "biocrypt-0eafe2a27869";

/**
 * Initial DNA256 proof-of-work difficulty for v1 — number of leading 'T'
 * bases required on the 256-base PoW strand. 16 Ts = 32 leading zero bits =
 * equivalent to 8 leading hex zeros in a SHA-256 hex prefix.
 *
 * Can retarget upward via the difficulty adjustment rules but never below
 * this floor.
 */
export const GENESIS_LEADING_TS = 16 as const;

/**
 * Minimum DNA256 leading-T count that any coin must clear to be accepted by
 * a v1 verifier, regardless of network difficulty state. Locks the protocol
 * floor — old coins mined at the genesis difficulty remain valid forever.
 */
export const V1_MIN_LEADING_TS = 16 as const;

/**
 * Canonical timestamp (UTC) of the BioCrypt v1 genesis — April 7, 2026.
 */
export const GENESIS_TIMESTAMP_MS = Date.UTC(2026, 3, 7, 0, 0, 0);
