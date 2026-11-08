/**
 * Warm drifting aurora background (React Bits "Aurora" look) built from
 * blurred gradients and CSS transforms: GPU-cheap on phones, no WebGL.
 * Use on the sign-in screen only.
 */
export function Aurora() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-bg">
      <div
        className="absolute -left-1/4 -top-1/4 h-[70vh] w-[120vw] rounded-full opacity-70 blur-[80px]"
        style={{
          background: 'radial-gradient(closest-side, #ffd84d, transparent)',
          animation: 'aurora-a 16s ease-in-out infinite',
        }}
      />
      <div
        className="absolute -right-1/4 top-1/4 h-[60vh] w-[100vw] rounded-full opacity-60 blur-[90px]"
        style={{
          background: 'radial-gradient(closest-side, #ff7a45, transparent)',
          animation: 'aurora-b 20s ease-in-out infinite',
        }}
      />
      <div
        className="absolute -bottom-1/4 left-0 h-[55vh] w-[110vw] rounded-full opacity-50 blur-[100px]"
        style={{
          background: 'radial-gradient(closest-side, #c2410c, transparent)',
          animation: 'aurora-c 24s ease-in-out infinite',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-bg/10 via-bg/45 to-bg/90" />
      <div className="grain absolute inset-0" />
    </div>
  )
}
