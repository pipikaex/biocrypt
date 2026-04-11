interface Props {
  dna: string;
  maxLength?: number;
}

export function DNAVisualization({ dna, maxLength = 600 }: Props) {
  const display = dna.length > maxLength ? dna.slice(0, maxLength) : dna;
  const bases = display.split("");

  return (
    <div className="dna-strand">
      {bases.map((base, i) => (
        <span key={i} className={`base-${base}`}>{base}</span>
      ))}
      {dna.length > maxLength && (
        <span className="text-muted"> ...({dna.length - maxLength} more bases)</span>
      )}
    </div>
  );
}
