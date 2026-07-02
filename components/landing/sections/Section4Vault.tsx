import { useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Shield, Fingerprint, FileCheck } from 'lucide-react';
import GhostMascot from '../GhostMascot';

gsap.registerPlugin(ScrollTrigger);

const chips = [
  { icon: Shield, label: 'Encrypted' },
  { icon: Fingerprint, label: 'Biometric' },
  { icon: FileCheck, label: 'Audited' },
];

export default function Section4Vault() {
  const sectionRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const lockRef = useRef<HTMLDivElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      const scrollTl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: '+=125%',
          pin: true,
          scrub: 0.6,
        },
      });

      // ENTRANCE (0% - 30%)
      // Vault card zooms in from deep Z
      scrollTl.fromTo(
        cardRef.current,
        { z: -600, rotateX: 25, scale: 0.92, opacity: 0 },
        { z: 0, rotateX: 0, scale: 1, opacity: 1, ease: 'none' },
        0
      );

      // Ghost fades in
      scrollTl.fromTo(
        ghostRef.current,
        { opacity: 0, scale: 0.9 },
        { opacity: 1, scale: 1, ease: 'none' },
        0.05
      );

      // Text block
      scrollTl.fromTo(
        textRef.current,
        { y: 40, opacity: 0 },
        { y: 0, opacity: 1, ease: 'none' },
        0.08
      );

      // Lock UI pops in
      scrollTl.fromTo(
        lockRef.current,
        { scale: 0.6, rotateZ: -20, opacity: 0 },
        { scale: 1, rotateZ: 0, opacity: 1, ease: 'none' },
        0.12
      );

      // Status chips stagger in
      if (chipsRef.current) {
        const chipEls = chipsRef.current.querySelectorAll('.status-chip');
        scrollTl.fromTo(
          chipEls,
          { y: 60, opacity: 0 },
          { y: 0, opacity: 1, stagger: 0.02, ease: 'none' },
          0.15
        );
      }

      // EXIT (70% - 100%)
      scrollTl.fromTo(
        cardRef.current,
        { y: 0, opacity: 1 },
        { y: '-18vh', opacity: 0, ease: 'power2.in' },
        0.70
      );

      scrollTl.fromTo(
        lockRef.current,
        { scale: 1, opacity: 1 },
        { scale: 0.85, opacity: 0, ease: 'power2.in' },
        0.70
      );
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="vault"
      className="relative w-full h-screen overflow-hidden z-40"
      style={{ backgroundColor: '#0B0C10' }}
    >
      {/* Background glow */}
      <div className="absolute inset-0 bg-radial-glow opacity-50 pointer-events-none" />
      <div className="absolute inset-0 bg-dot-grid opacity-30 pointer-events-none" />

      {/* Vault Card */}
      <div
        className="perspective-container absolute flex items-center justify-center"
        style={{
          left: '50%',
          top: '52%',
          transform: 'translate(-50%, -50%)',
          width: '90vw',
          maxWidth: '1000px',
          height: '60vh',
          minHeight: '420px',
        }}
      >
        <div
          ref={cardRef}
          className="w-full h-full relative"
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Inner glow */}
          <div className="absolute inset-0 bg-radial-glow opacity-50 pointer-events-none" />

          <div className="flex flex-col md:flex-row items-center justify-center gap-12 md:gap-24 h-full w-full px-6 md:px-12 z-10 relative">
            {/* Ghost Mascot (locked) - left side */}
            <div
              ref={ghostRef}
              className="w-[50%] md:w-[35%] max-w-[320px]"
            >
              <GhostMascot
                src="/images/ghost-locked.png"
                className="w-full h-auto drop-shadow-[0_0_30px_rgba(179,71,255,0.3)]"
                animate={false}
              />
            </div>

            {/* Content block - right side */}
            <div className="flex flex-col justify-center max-w-[480px]">
              {/* Text */}
              <div ref={textRef}>
                <h2 className="font-heading text-2xl md:text-4xl lg:text-[42px] font-semibold text-[#F4F6FF] mb-3 tracking-tight">
                  Your vault. Your rules.
                </h2>
                <p className="text-sm md:text-base text-[#A7B0C8] leading-relaxed max-w-[420px]">
                  End-to-end encryption. Local biometrics. Zero-knowledge architecture.
                </p>
              </div>

              {/* Lock icon */}
              <div
                ref={lockRef}
                className="mt-6 md:mt-8 flex items-center gap-3"
              >
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-full border-2 border-[#B347FF] flex items-center justify-center animate-pulse-slow">
                  <Shield className="w-6 h-6 md:w-7 md:h-7 text-[#B347FF]" strokeWidth={1.5} />
                </div>
                <span className="font-heading text-lg md:text-xl font-medium text-[#F4F6FF]">
                  Vault Active
                </span>
              </div>

              {/* Status chips */}
              <div ref={chipsRef} className="mt-6 flex flex-wrap gap-3">
                {chips.map((chip) => (
                  <div
                    key={chip.label}
                    className="status-chip flex items-center gap-2 px-4 py-2 rounded-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)]"
                  >
                    <chip.icon className="w-4 h-4 text-[#B347FF]" strokeWidth={1.5} />
                    <span className="text-sm text-[#A7B0C8]">{chip.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
