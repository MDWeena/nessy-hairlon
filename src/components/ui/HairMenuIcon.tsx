interface HairMenuIconProps {
  open: boolean;
  color: string;
  size?: number;
}

export function HairMenuIcon({ open, color, size = 24 }: HairMenuIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      {/* Three wavy lines like hair strands */}
      <path d={open ? "M6 6L18 18" : "M3 6C5 4 7 8 9 6C11 4 13 8 15 6C17 4 19 8 21 6"} style={{ transition: "d 0.3s ease" }} />
      <path d={open ? "M6 18L18 6" : "M3 12C5 10 7 14 9 12C11 10 13 14 15 12C17 10 19 14 21 12"} style={{ transition: "d 0.3s ease, opacity 0.2s" }} opacity={open ? 0 : 1} />
      <path d={open ? "M6 18L18 6" : "M3 18C5 16 7 20 9 18C11 16 13 20 15 18C17 16 19 20 21 18"} style={{ transition: "d 0.3s ease" }} opacity={open ? 0 : 1} />
    </svg>
  );
}
