import {
  CODON_TABLE, START_CODON, STOP_CODONS, AMINO_PROPS,
  sha256, type AminoAcidProps,
} from "./dna";

export interface Protein {
  index: number;
  startIndex: number;
  stopIndex: number;
  stopCodon: string;
  codons: string[];
  aminoAcids: string[];
  sequence: string;
  length: number;
  hash: string;
}

export interface IntergenicRegion {
  startIndex: number;
  endIndex: number;
  sequence: string;
  hash: string;
}

export interface ProteinAnalysis {
  charge: number;
  polarity: number;
  hydrophobicity: number;
  dominantRole: string;
  sizeProfile: Record<string, number>;
  roles: Record<string, number>;
}

export interface RibosomeResult {
  proteins: Protein[];
  intergenicRegions: IntergenicRegion[];
  publicKeyChain: string;
  publicKeyHash: string;
}

/**
 * Ribosome: scans a DNA strand, translates codons into proteins,
 * captures inter-genic regions (between STOP and next START),
 * and folds them into a single protein chain (public key).
 */
export function ribosome(dna: string): RibosomeResult {
  const proteins: Protein[] = [];
  const intergenicRegions: IntergenicRegion[] = [];
  let i = 0;
  let lastStopEnd = 0;
  let proteinIdx = 0;

  while (i < dna.length - 2) {
    const codon = dna.slice(i, i + 3);

    if (codon === START_CODON) {
      // Capture inter-genic region before this START
      if (i > lastStopEnd) {
        const igSeq = dna.slice(lastStopEnd, i);
        if (igSeq.length > 0) {
          intergenicRegions.push({
            startIndex: lastStopEnd,
            endIndex: i,
            sequence: igSeq,
            hash: sha256(igSeq),
          });
        }
      }

      const protein: Partial<Protein> = {
        index: proteinIdx,
        startIndex: i,
        codons: [],
        aminoAcids: [],
      };

      let j = i;
      while (j < dna.length - 2) {
        const c = dna.slice(j, j + 3);
        const aa = CODON_TABLE[c];
        if (!aa) { j += 3; continue; }

        protein.codons!.push(c);

        if (STOP_CODONS.has(c)) {
          protein.stopIndex = j + 2;
          protein.stopCodon = c;
          lastStopEnd = j + 3;
          break;
        }

        protein.aminoAcids!.push(aa);
        j += 3;
      }

      if (protein.aminoAcids!.length >= 3) {
        protein.sequence = protein.aminoAcids!.join("-");
        protein.length = protein.aminoAcids!.length;
        protein.hash = sha256(protein.sequence!);
        proteins.push(protein as Protein);
        proteinIdx++;
      }

      i = (protein.stopIndex ?? j) + 1;
    } else {
      i++;
    }
  }

  // Capture trailing inter-genic region
  if (lastStopEnd < dna.length) {
    const igSeq = dna.slice(lastStopEnd);
    if (igSeq.length > 0) {
      intergenicRegions.push({
        startIndex: lastStopEnd,
        endIndex: dna.length,
        sequence: igSeq,
        hash: sha256(igSeq),
      });
    }
  }

  const chain = foldProteinChain(proteins, intergenicRegions);

  return {
    proteins,
    intergenicRegions,
    publicKeyChain: chain,
    publicKeyHash: sha256(chain),
  };
}

export function analyzeProtein(protein: Protein): ProteinAnalysis {
  let totalCharge = 0;
  let polarCount = 0;
  let hydrophobicCount = 0;
  const roles: Record<string, number> = {};
  const sizes: Record<string, number> = { tiny: 0, small: 0, medium: 0, large: 0 };

  for (const aa of protein.aminoAcids) {
    const props = AMINO_PROPS[aa];
    if (!props) continue;
    totalCharge += props.charge;
    if (props.polar) polarCount++;
    if (props.hydrophobic) hydrophobicCount++;
    sizes[props.size] = (sizes[props.size] || 0) + 1;
    roles[props.role] = (roles[props.role] || 0) + 1;
  }

  const len = protein.aminoAcids.length || 1;
  return {
    charge: totalCharge,
    polarity: polarCount / len,
    hydrophobicity: hydrophobicCount / len,
    dominantRole: Object.entries(roles).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "unknown",
    sizeProfile: sizes,
    roles,
  };
}

/**
 * Protein chain folding: inter-genic regions determine how proteins
 * connect into a single chain. The inter-genic DNA between each
 * protein pair acts as "glue" — its hash determines the bond ordering.
 * The result is a single seamless chain (public key) where the
 * original protein boundaries are undetectable.
 */
function foldProteinChain(proteins: Protein[], intergenics: IntergenicRegion[]): string {
  if (proteins.length === 0) return "";
  if (proteins.length === 1) return proteins[0].sequence;

  // Use inter-genic region hashes to determine the order of protein folding.
  // Each inter-genic region's hash byte determines the "bond type" used
  // to join the protein before and after it in the chain.
  const bondedSequences: string[] = [];

  for (let i = 0; i < proteins.length; i++) {
    bondedSequences.push(proteins[i].sequence);

    if (i < proteins.length - 1 && i < intergenics.length) {
      // The intergenic region produces a "linker" amino acid sequence
      // by hashing the region and mapping bytes to amino acids
      const linker = intergenicToLinker(intergenics[i]);
      bondedSequences.push(linker);
    }
  }

  return bondedSequences.join("-");
}

const AMINO_ACID_NAMES = Object.keys(AMINO_PROPS);

function intergenicToLinker(ig: IntergenicRegion): string {
  // Map intergenic hash bytes to amino acids to create a linker peptide
  const hashBytes = Uint8Array.from(ig.hash.match(/.{2}/g)!.map(h => parseInt(h, 16)));
  const linkerLength = Math.min(3, Math.max(1, Math.floor(ig.sequence.length / 10)));
  const acids: string[] = [];
  for (let i = 0; i < linkerLength; i++) {
    acids.push(AMINO_ACID_NAMES[hashBytes[i] % AMINO_ACID_NAMES.length]);
  }
  return acids.join("-");
}

export interface ProteinUnit {
  id: string;
  hash: string;
  length: number;
  sequence: string;
  aminoAcids: string[];
  analysis: ProteinAnalysis;
  bindingSites: string[];
  accepts: string[];
}

export interface Bond {
  from: string;
  to: string;
  type: string;
  strength: number;
}

export interface Cluster {
  members: string[];
  size: number;
  bindingSites: string[];
  emergentFunction: string;
}

export function remapProteins(proteins: Protein[]): { units: ProteinUnit[]; connections: Bond[] } {
  const ACCEPTOR_MAP: Record<string, string> = {
    positive_dock: "negative_dock",
    negative_dock: "positive_dock",
    membrane_anchor: "surface_receptor",
    surface_receptor: "membrane_anchor",
    enzyme_site: "lock_domain",
    lock_domain: "enzyme_site",
    signal_port: "signal_port",
  };

  const units = proteins.map((protein, index) => {
    const analysis = analyzeProtein(protein);
    const bindingSites: string[] = [];
    if (analysis.charge > 0) bindingSites.push("positive_dock");
    if (analysis.charge < 0) bindingSites.push("negative_dock");
    if (analysis.hydrophobicity > 0.4) bindingSites.push("membrane_anchor");
    if (analysis.polarity > 0.5) bindingSites.push("surface_receptor");
    if (analysis.dominantRole === "catalytic") bindingSites.push("enzyme_site");
    if (analysis.dominantRole === "binding") bindingSites.push("lock_domain");
    if (analysis.dominantRole === "signaling") bindingSites.push("signal_port");

    return {
      id: `P${index}`,
      hash: protein.hash,
      length: protein.length,
      sequence: protein.sequence,
      aminoAcids: protein.aminoAcids,
      analysis,
      bindingSites,
      accepts: bindingSites.map((s) => ACCEPTOR_MAP[s]).filter(Boolean),
    };
  });

  const connections: Bond[] = [];
  for (let i = 0; i < units.length; i++) {
    for (let j = i + 1; j < units.length; j++) {
      for (const site of units[i].bindingSites) {
        if (units[j].accepts.includes(site)) {
          connections.push({
            from: units[i].id,
            to: units[j].id,
            type: site,
            strength:
              Math.abs(units[i].analysis.charge - units[j].analysis.charge) +
              Math.abs(units[i].analysis.polarity - units[j].analysis.polarity),
          });
          break;
        }
      }
    }
  }

  return { units, connections };
}

export function buildAssembly(units: ProteinUnit[], connections: Bond[]): { clusters: Cluster[] } {
  const adjacency: Record<string, string[]> = {};
  units.forEach((u) => (adjacency[u.id] = []));
  connections.forEach((c) => {
    adjacency[c.from].push(c.to);
    adjacency[c.to].push(c.from);
  });

  const visited = new Set<string>();
  const clusters: Cluster[] = [];

  for (const unit of units) {
    if (visited.has(unit.id)) continue;
    const cluster: string[] = [];
    const stack = [unit.id];
    while (stack.length) {
      const current = stack.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);
      cluster.push(current);
      for (const neighbor of adjacency[current]) {
        if (!visited.has(neighbor)) stack.push(neighbor);
      }
    }

    const clusterUnits = cluster.map((id) => units.find((u) => u.id === id)!);
    const roles = clusterUnits.flatMap((u) => u.bindingSites);
    const hasEnzyme = clusterUnits.some((u) => u.bindingSites.includes("enzyme_site"));
    const hasSignal = clusterUnits.some((u) => u.bindingSites.includes("signal_port"));
    const hasMembrane = clusterUnits.some((u) => u.bindingSites.includes("membrane_anchor"));

    let fn: string;
    if (hasEnzyme && hasSignal) fn = "signal_processor";
    else if (hasEnzyme && hasMembrane) fn = "membrane_transporter";
    else if (hasSignal && hasMembrane) fn = "receptor";
    else if (hasEnzyme) fn = "catalyst";
    else if (hasSignal) fn = "messenger";
    else if (hasMembrane) fn = "structural_scaffold";
    else fn = "framework";

    clusters.push({
      members: cluster,
      size: cluster.length,
      bindingSites: [...new Set(roles)],
      emergentFunction: fn,
    });
  }

  return { clusters };
}
