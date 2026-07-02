import { useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Globe, Link2, CreditCard, Wallet, Building2, Coins, Banknote, Landmark } from 'lucide-react';


gsap.registerPlugin(ScrollTrigger);

const orbitIcons = [
  { Icon: CreditCard, angle: 0 },
  { Icon: Wallet, angle: 45 },
  { Icon: Building2, angle: 90 },
  { Icon: Coins, angle: 135 },
  { Icon: Banknote, angle: 180 },
  { Icon: Link2, angle: 225 },
  { Icon: Globe, angle: 270 },
  { Icon: Landmark, angle: 315 },
];

export default function Section5Network() {
  const sectionRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const orbitRef = useRef<HTMLDivElement>(null);
  const dotsRef = useRef<(HTMLDivElement | null)[]>([]);
  const iconRefs = useRef<(SVGSVGElement | null)[]>([]);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      // Title
      gsap.fromTo(
        titleRef.current,
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          scrollTrigger: {
            trigger: titleRef.current,
            start: 'top 80%',
            end: 'top 55%',
            scrub: true,
          },
        }
      );

      // Orbit ring entrance
      gsap.fromTo(
        orbitRef.current,
        { scale: 0.9, opacity: 0 },
        {
          scale: 1,
          opacity: 1,
          scrollTrigger: {
            trigger: orbitRef.current,
            start: 'top 80%',
            end: 'top 40%',
            scrub: true,
          },
        }
      );

      // Orbit ring continuous rotation
      gsap.fromTo(
        orbitRef.current,
        { rotate: -45 },
        {
          rotate: 45,
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            start: 'top bottom',
            end: 'bottom top',
            scrub: 1.5,
          },
        }
      );

      // Counter-rotate the icons to keep them upright
      iconRefs.current.forEach((icon) => {
        if (!icon) return;
        gsap.fromTo(
          icon,
          { rotate: 45 },
          {
            rotate: -45,
            ease: 'none',
            scrollTrigger: {
              trigger: section,
              start: 'top bottom',
              end: 'bottom top',
              scrub: 1.5,
            },
          }
        );
      });

      // Orbit dots - radial outward stagger
      dotsRef.current.forEach((dot, i) => {
        if (!dot) return;
        const angle = (i * 45 * Math.PI) / 180;
        const dist = 16;
        gsap.fromTo(
          dot,
          { x: -Math.cos(angle) * dist, y: -Math.sin(angle) * dist, opacity: 0, scale: 0.8 },
          {
            x: 0,
            y: 0,
            opacity: 1,
            scale: 1,
            scrollTrigger: {
              trigger: orbitRef.current,
              start: 'top 75%',
              end: 'top 40%',
              scrub: true,
            },
          }
        );
      });

      // Text cards
      cardsRef.current.forEach((card) => {
        if (!card) return;
        gsap.fromTo(
          card,
          { y: 50, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            scrollTrigger: {
              trigger: card,
              start: 'top 85%',
              end: 'top 60%',
              scrub: true,
            },
          }
        );
      });
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative w-full py-[10vh] md:py-[12vh] z-50"
      style={{ backgroundColor: '#0B0C10' }}
    >
      {/* Background glow */}
      <div className="absolute inset-0 bg-radial-glow opacity-40 pointer-events-none" />

      <div className="relative max-w-[1200px] mx-auto px-6 md:px-12">
        {/* Title */}
        <div ref={titleRef} className="text-center mb-12 md:mb-16 opacity-0">
          <h2 className="font-heading text-3xl md:text-[42px] font-semibold text-[#F4F6FF] mb-4 tracking-tight">
            Connected to everything.
          </h2>
          <p className="text-base md:text-lg text-[#A7B0C8] max-w-[520px] mx-auto">
            Banks, cards, wallets, chains. One invisible layer.
          </p>
        </div>

        {/* Orbit visualization */}
        <div className="flex justify-center mb-12 md:mb-16">
          <div className="relative w-[280px] h-[280px] md:w-[360px] md:h-[360px]">
            {/* Center ghost (static, uncontained) */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
              <img src="/images/ghost-mascot.png" alt="GhostPay" className="w-24 h-24 md:w-32 md:h-32 object-contain drop-shadow-[0_0_20px_rgba(251,203,10,0.4)]" />
            </div>

            {/* Orbit container (spins on scroll) */}
            <div
              ref={orbitRef}
              className="absolute inset-0 opacity-0 z-10"
            >
              {/* Orbit ring */}
              <svg
                className="absolute inset-0 w-full h-full"
                viewBox="0 0 360 360"
                fill="none"
              >
                <circle
                  cx="180"
                  cy="180"
                  r="170"
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth="1"
                  strokeDasharray="8 6"
                />
              </svg>

              {/* Orbit dots */}
              {orbitIcons.map(({ Icon, angle }, i) => {
                const rad = (angle * Math.PI) / 180;
                const r = 170;
                const x = 180 + r * Math.cos(rad);
                const y = 180 + r * Math.sin(rad);
                return (
                  <div
                    key={i}
                    ref={(el) => { dotsRef.current[i] = el; }}
                    className="absolute w-10 h-10 md:w-12 md:h-12 rounded-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] flex items-center justify-center"
                    style={{
                      left: `${(x / 360) * 100}%`,
                      top: `${(y / 360) * 100}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    <Icon ref={(el) => { iconRefs.current[i] = el; }} className="w-5 h-5 md:w-6 md:h-6 text-[#A7B0C8]" strokeWidth={1.5} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-[800px] mx-auto">
          {[
            { title: 'Multi-chain ready', desc: 'Ethereum, Solana, Bitcoin, and 20+ networks supported natively.' },
            { title: 'Bank-grade APIs', desc: 'SOC 2 Type II compliant infrastructure with 99.99% uptime SLA.' },
          ].map((item, i) => (
            <div
              key={item.title}
              ref={(el) => { cardsRef.current[i] = el; }}
              className="opacity-0"
            >
              <div className="p-6 h-full flex flex-col items-center text-center">
                <h3 className="font-heading text-xl font-semibold text-[#F4F6FF] mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-[#A7B0C8] leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
