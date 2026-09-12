import Image from "next/image";

type RunnerProps = {
  side: "lula" | "flavio";
  leading: boolean;
};

const ASSETS = {
  lula: {
    src: "/characters/lula.png",
    alt: "Personagem cartoon de Lula correndo",
  },
  flavio: {
    src: "/characters/flavio.png",
    alt: "Personagem cartoon de Flávio Bolsonaro correndo",
  },
} as const;

export function Runner({ side, leading }: RunnerProps) {
  const asset = ASSETS[side];
  const tint = side === "lula" ? "#c62828" : "#1565c0";

  return (
    <div
      className={`relative ${leading ? "lead-glow" : ""} ${side === "lula" ? "animate-bob" : "animate-bob-delay"}`}
      style={{ color: tint }}
      aria-hidden
    >
      <div className="relative h-32 w-28 drop-shadow-[0_12px_18px_rgba(0,0,0,0.35)] md:h-40 md:w-36">
        <Image
          src={asset.src}
          alt={asset.alt}
          fill
          sizes="(max-width: 768px) 112px, 144px"
          className="object-contain object-bottom"
          priority
        />
      </div>
    </div>
  );
}
