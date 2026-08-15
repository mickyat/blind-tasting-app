import type { EventTheme } from '@/lib/types'

// Simple flat-illustration SVGs for the template picker tiles - hand-drawn
// shapes (no external images/icon libraries), one per theme, drawn in a
// light/white palette so they read clearly against each theme's swatch
// color underneath. Deliberately abstract/iconic rather than realistic -
// the goal is "reads as wine/beer/pizza at a glance", not photorealism.
const VIEWBOX = '0 0 200 150'

function Wine() {
  return (
    <svg viewBox={VIEWBOX} preserveAspectRatio="xMidYMid slice" className="h-full w-full">
      <path
        d="M78 20 C78 55 70 62 70 78 C70 96 86 106 100 106 C114 106 130 96 130 78 C130 62 122 55 122 20 Z"
        fill="#f6ecd6"
        opacity="0.9"
      />
      <path
        d="M73 40 C74 60 72 63 72 78 C72 94 86 103 100 103 C114 103 128 94 128 78 C128 63 126 60 127 40 Z"
        fill="#7f1d3d"
      />
      <rect x="97" y="106" width="6" height="26" fill="#f6ecd6" opacity="0.9" />
      <ellipse cx="100" cy="134" rx="26" ry="6" fill="#f6ecd6" opacity="0.9" />
      <circle cx="145" cy="35" r="3" fill="#f6ecd6" opacity="0.7" />
      <circle cx="155" cy="50" r="2" fill="#f6ecd6" opacity="0.5" />
    </svg>
  )
}

function Meat() {
  return (
    <svg viewBox={VIEWBOX} preserveAspectRatio="xMidYMid slice" className="h-full w-full">
      <path d="M75 118 C55 108 60 90 75 92 C70 78 90 60 105 68 C122 58 145 75 138 95 C150 100 145 122 128 118 C115 128 90 128 75 118 Z" fill="#f6ecd6" opacity="0.92" />
      <line x1="78" y1="82" x2="118" y2="112" stroke="#7c2d12" strokeWidth="4" strokeLinecap="round" />
      <line x1="92" y1="72" x2="132" y2="102" stroke="#7c2d12" strokeWidth="4" strokeLinecap="round" />
      <line x1="66" y1="98" x2="104" y2="126" stroke="#7c2d12" strokeWidth="4" strokeLinecap="round" />
      <path d="M60 130 C64 118 72 116 76 124 C70 122 64 126 60 130 Z" fill="#f59e0b" opacity="0.85" />
      <path d="M110 138 C114 124 124 122 128 132 C120 130 114 134 110 138 Z" fill="#f59e0b" opacity="0.7" />
    </svg>
  )
}

function Beer() {
  return (
    <svg viewBox={VIEWBOX} preserveAspectRatio="xMidYMid slice" className="h-full w-full">
      <path d="M62 45 h58 v70 a10 10 0 0 1 -10 10 h-38 a10 10 0 0 1 -10 -10 Z" fill="#f9f0d9" opacity="0.9" />
      <path d="M120 58 h14 a10 10 0 0 1 10 10 v20 a10 10 0 0 1 -10 10 h-14 Z" fill="none" stroke="#f9f0d9" strokeWidth="5" opacity="0.9" />
      <path d="M62 45 h58 v14 h-58 Z" fill="#fff8e7" />
      <circle cx="70" cy="38" r="6" fill="#fff8e7" />
      <circle cx="84" cy="33" r="7" fill="#fff8e7" />
      <circle cx="100" cy="37" r="6" fill="#fff8e7" />
      <circle cx="112" cy="34" r="5" fill="#fff8e7" />
      <circle cx="80" cy="90" r="2.5" fill="#f9f0d9" opacity="0.6" />
      <circle cx="95" cy="105" r="2" fill="#f9f0d9" opacity="0.5" />
    </svg>
  )
}

function Coffee() {
  return (
    <svg viewBox={VIEWBOX} preserveAspectRatio="xMidYMid slice" className="h-full w-full">
      <ellipse cx="95" cy="120" rx="42" ry="8" fill="#f2e6d0" opacity="0.5" />
      <path d="M65 60 h60 l-6 46 a10 10 0 0 1 -10 9 h-28 a10 10 0 0 1 -10 -9 Z" fill="#f2e6d0" opacity="0.92" />
      <path d="M125 68 h12 a12 12 0 0 1 0 24 h-8" fill="none" stroke="#f2e6d0" strokeWidth="5" opacity="0.9" />
      <path d="M85 30 c6 8 -6 10 0 18" stroke="#f2e6d0" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.85" />
      <path d="M100 26 c6 8 -6 10 0 18" stroke="#f2e6d0" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.7" />
    </svg>
  )
}

function Whiskey() {
  return (
    <svg viewBox={VIEWBOX} preserveAspectRatio="xMidYMid slice" className="h-full w-full">
      <path d="M68 55 h64 l-8 60 a8 8 0 0 1 -8 7 h-32 a8 8 0 0 1 -8 -7 Z" fill="#f9f0d9" opacity="0.25" />
      <path d="M74 90 l6 25 a8 8 0 0 0 8 7 h32 a8 8 0 0 0 8 -7 l6 -25 Z" fill="#c2701a" opacity="0.9" />
      <rect x="90" y="72" width="24" height="24" rx="4" fill="#fdf6e8" opacity="0.9" />
      <line x1="94" y1="76" x2="94" y2="92" stroke="#e8d9b8" strokeWidth="2" />
      <line x1="102" y1="76" x2="102" y2="92" stroke="#e8d9b8" strokeWidth="2" />
    </svg>
  )
}

function Cheese() {
  return (
    <svg viewBox={VIEWBOX} preserveAspectRatio="xMidYMid slice" className="h-full w-full">
      <path d="M40 108 L120 42 L162 108 Z" fill="#f6f0d6" opacity="0.92" />
      <circle cx="95" cy="90" r="7" fill="#a16207" opacity="0.35" />
      <circle cx="120" cy="80" r="5" fill="#a16207" opacity="0.35" />
      <circle cx="110" cy="100" r="4" fill="#a16207" opacity="0.35" />
      <circle cx="135" cy="95" r="6" fill="#a16207" opacity="0.3" />
    </svg>
  )
}

function Sausage() {
  return (
    <svg viewBox={VIEWBOX} preserveAspectRatio="xMidYMid slice" className="h-full w-full">
      <path
        d="M50 60 C50 46 62 40 72 46 C82 38 100 44 98 58 C112 52 128 62 122 76 C136 74 146 88 136 100 C142 112 130 124 116 118 C108 128 90 126 88 112 C74 118 60 108 66 94 C54 96 44 84 50 74 Z"
        fill="#a3552f"
        opacity="0.92"
      />
      <path d="M78 50 c4 4 4 8 0 12" stroke="#7c2d12" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.6" />
      <path d="M108 66 c4 4 4 8 0 12" stroke="#7c2d12" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.6" />
      <path d="M126 92 c4 4 4 8 0 12" stroke="#7c2d12" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.6" />
    </svg>
  )
}

function Burger() {
  return (
    <svg viewBox={VIEWBOX} preserveAspectRatio="xMidYMid slice" className="h-full w-full">
      <path d="M55 60 a45 30 0 0 1 90 0 Z" fill="#f0c987" opacity="0.95" />
      <circle cx="80" cy="38" r="2.5" fill="#fff" opacity="0.7" />
      <circle cx="100" cy="32" r="2.5" fill="#fff" opacity="0.7" />
      <circle cx="120" cy="40" r="2.5" fill="#fff" opacity="0.7" />
      <path d="M52 64 h96 l-6 12 h-84 Z" fill="#4d7c0f" opacity="0.85" />
      <rect x="54" y="76" width="92" height="16" rx="6" fill="#6b3a1f" opacity="0.92" />
      <path d="M54 96 h92 l4 8 h-100 Z" fill="#f6e27a" opacity="0.85" />
      <path d="M50 106 h100 a8 10 0 0 1 -8 14 h-84 a8 10 0 0 1 -8 -14 Z" fill="#f0c987" opacity="0.95" />
    </svg>
  )
}

function Pizza() {
  return (
    <svg viewBox={VIEWBOX} preserveAspectRatio="xMidYMid slice" className="h-full w-full">
      <path d="M100 35 L150 120 A70 70 0 0 1 50 120 Z" fill="#f6ecd6" opacity="0.55" />
      <path d="M100 35 L145 112 A62 62 0 0 1 55 112 Z" fill="#f2d675" opacity="0.9" />
      <path d="M100 35 L150 120 A70 70 0 0 1 50 120 Z" fill="none" stroke="#f6ecd6" strokeWidth="7" opacity="0.5" />
      <circle cx="95" cy="75" r="7" fill="#c2340f" opacity="0.85" />
      <circle cx="118" cy="90" r="6" fill="#c2340f" opacity="0.85" />
      <circle cx="88" cy="98" r="6" fill="#c2340f" opacity="0.85" />
      <circle cx="105" cy="105" r="5" fill="#c2340f" opacity="0.75" />
    </svg>
  )
}

function Default() {
  return (
    <svg viewBox={VIEWBOX} preserveAspectRatio="xMidYMid slice" className="h-full w-full">
      <path
        d="M82 24 C82 46 76 50 76 62 C76 76 88 84 100 84 C112 84 124 76 124 62 C124 50 118 46 118 24 Z"
        fill="#f4f4f5"
        opacity="0.85"
      />
      <rect x="97" y="84" width="6" height="20" fill="#f4f4f5" opacity="0.85" />
      <ellipse cx="100" cy="108" rx="22" ry="5" fill="#f4f4f5" opacity="0.85" />
      <path d="M60 40 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3 Z" fill="#f4f4f5" opacity="0.6" />
      <path d="M140 55 l2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5 Z" fill="#f4f4f5" opacity="0.5" />
    </svg>
  )
}

const ILLUSTRATIONS: Record<EventTheme, () => React.JSX.Element> = {
  default: Default,
  wine: Wine,
  meat: Meat,
  beer: Beer,
  coffee: Coffee,
  whiskey: Whiskey,
  cheese: Cheese,
  sausage: Sausage,
  burger: Burger,
  pizza: Pizza,
}

export default function TemplateIllustration({ theme }: { theme: EventTheme }) {
  const Illustration = ILLUSTRATIONS[theme] ?? Default
  return <Illustration />
}
