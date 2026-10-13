/**
 * Símbolo Q oficial do Quorum Lab, usado exatamente como fornecido
 * (arquivo original em brand/original; aqui apenas recortado e redimensionado).
 * Quando a versão completa da logo for entregue, adicioná-la em public/brand e
 * apontar `variant="completa"` para ela — sem redesenhar a marca em código.
 */
export function BrandMark({ height = 46, className = "brand-mark" }: { height?: number; className?: string }) {
  const width = Math.round((height * 1305) / 934);
  return (
    <img
      className={className}
      src="/brand/q-192.png"
      srcSet="/brand/q-96.png 96w, /brand/q-192.png 192w, /brand/q-384.png 384w"
      sizes={`${width}px`}
      width={width}
      height={height}
      alt="Quorum Lab"
      decoding="async"
    />
  );
}
