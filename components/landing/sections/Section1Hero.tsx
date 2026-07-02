import { useEffect, useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Zap, Lock, Calendar } from 'lucide-react';
import GhostMascot from '../GhostMascot';
import { useRouter } from 'next/navigation';

gsap.registerPlugin(ScrollTrigger);

export default function Section1Hero() {
  const router = useRouter();
  const sectionRef = useRef<HTMLElement>(null);
  const heroCardRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const bodyRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLButtonElement>(null);
  const orbitRefs = useRef<(HTMLDivElement | null)[]>([]);
  const labelRef = useRef<HTMLSpanElement>(null);
  const loadTlRef = useRef<gsap.core.Timeline | null>(null);

  // Load animation (on mount)
  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      loadTlRef.current = tl;

      // Background glow
      tl.fromTo('.hero-glow', { opacity: 0 }, { opacity: 1, duration: 1.2 }, 0);

      // Hero card 3D entrance
      tl.fromTo(
        heroCardRef.current,
        { z: -300, rotateX: 18, rotateY: -18, opacity: 0 },
        { z: 0, rotateX: 8, rotateY: -10, opacity: 1, duration: 1.2 },
        0.1
      );

      // Ghost mascot
      tl.fromTo(
        ghostRef.current,
        { x: -40, z: -80, opacity: 0 },
        { x: 0, z: 0, opacity: 1, duration: 1 },
        0.25
      );

      // Label
      tl.fromTo(
        labelRef.current,
        { y: 16, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6 },
        0.3
      );

      // Title words
      if (titleRef.current) {
        const words = titleRef.current.querySelectorAll('.word');
        tl.fromTo(
          words,
          { y: 24, opacity: 0 },
          { y: 0, opacity: 1, stagger: 0.06, duration: 0.7 },
          0.35
        );
      }

      // Body
      tl.fromTo(
        bodyRef.current,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.7 },
        0.55
      );

      // CTA
      tl.fromTo(
        ctaRef.current,
        { y: 16, opacity: 0, scale: 0.96 },
        { y: 0, opacity: 1, scale: 1, duration: 0.6 },
        0.65
      );

      // Orbit cards fly in
      orbitRefs.current.forEach((orbit, i) => {
        if (!orbit) return;
        const directions = [
          { x: -120, y: 0, rotateZ: -6 },
          { x: 120, y: 0, rotateZ: 6 },
          { x: 0, y: 120, rotateZ: 4 },
        ];
        tl.fromTo(
          orbit,
          { x: directions[i].x, y: directions[i].y, rotateZ: directions[i].rotateZ, opacity: 0 },
          { x: 0, y: 0, rotateZ: 0, opacity: 1, duration: 0.9 },
          0.4 + i * 0.08
        );
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  // Scroll exit animation
  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      const scrollTl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: '+=130%',
          pin: true,
          scrub: 0.6,
          onLeaveBack: () => {
            // Reset all hero elements to visible when scrolling back to top
            gsap.set(heroCardRef.current, { opacity: 1, z: 0, rotateX: 8, rotateY: -10 });
            gsap.set(ghostRef.current, { opacity: 1, x: 0 });
            orbitRefs.current.forEach((orbit, i) => {
              if (!orbit) return;
              const settles = [
                { x: 0, y: 0, rotateY: 12 },
                { x: 0, y: 0, rotateY: -12 },
                { x: 0, y: 0, rotateX: 10 },
              ];
              gsap.set(orbit, { opacity: 1, x: settles[i].x, y: settles[i].y });
            });
          },
        },
      });

      // EXIT PHASE (70% - 100%)
      // Hero card moves toward camera
      scrollTl.fromTo(
        heroCardRef.current,
        { z: 0, rotateX: 8, opacity: 1 },
        { z: 280, rotateX: 2, opacity: 0, ease: 'power2.in' },
        0.70
      );

      // Ghost slides left
      scrollTl.fromTo(
        ghostRef.current,
        { x: 0, opacity: 1 },
        { x: '-22vw', opacity: 0, ease: 'power2.in' },
        0.70
      );

      // Orbit cards diverge
      const orbitExits = [
        { x: '-18vw', rotateY: 35 },
        { x: '18vw', rotateY: -35 },
        { y: '16vh', rotateX: 30 },
      ];
      orbitRefs.current.forEach((orbit, i) => {
        if (!orbit) return;
        scrollTl.fromTo(
          orbit,
          { x: 0, y: 0, opacity: 1 },
          { x: orbitExits[i].x || 0, y: orbitExits[i].y || 0, opacity: 0, ease: 'power2.in' },
          0.70
        );
      });
    }, section);

    return () => ctx.revert();
  }, []);

  const titleWords = 'Pay-as-you-go AI. On Celo.'.split(' ');

  return (
    <section
      ref={sectionRef}
      className="relative w-full h-screen overflow-hidden z-10"
      style={{ backgroundColor: '#0B0C10' }}
    >
      {/* Radial glow background */}
      <div className="hero-glow absolute inset-0 bg-radial-glow opacity-0 pointer-events-none" />

      {/* Dot grid pattern */}
      <div className="absolute inset-0 bg-dot-grid opacity-50 pointer-events-none" />

      {/* Orbit Card A - left */}
      <div
        ref={(el) => { orbitRefs.current[0] = el; }}
        className="absolute glass-card p-5 opacity-0 hidden lg:flex flex-col gap-2"
        style={{
          left: '14vw',
          top: '18vh',
          width: '18vw',
          maxWidth: '240px',
          transform: 'rotateY(12deg)',
        }}
      >
        <Zap className="w-6 h-6 text-[#FBCB0A]" strokeWidth={1.5} />
        <span className="font-heading text-lg font-medium text-[#F4F6FF]">Instant</span>
        <span className="text-sm text-[#A7B0C8]">Sub-second settlements worldwide</span>
      </div>

      {/* Orbit Card B - right */}
      <div
        ref={(el) => { orbitRefs.current[1] = el; }}
        className="absolute glass-card p-5 opacity-0 hidden lg:flex flex-col gap-2"
        style={{
          left: '72vw',
          top: '22vh',
          width: '20vw',
          maxWidth: '260px',
          transform: 'rotateY(-12deg)',
        }}
      >
        <Lock className="w-6 h-6 text-[#FBCB0A]" strokeWidth={1.5} />
        <span className="font-heading text-lg font-medium text-[#F4F6FF]">Encrypted</span>
        <span className="text-sm text-[#A7B0C8]">End-to-end zero-knowledge security</span>
      </div>

      {/* Orbit Card C - bottom */}
      <div
        ref={(el) => { orbitRefs.current[2] = el; }}
        className="absolute glass-card p-5 opacity-0 hidden lg:flex flex-col gap-2"
        style={{
          left: '66vw',
          top: '74vh',
          width: '22vw',
          maxWidth: '280px',
          transform: 'rotateX(10deg)',
        }}
      >
        <Calendar className="w-6 h-6 text-[#FBCB0A]" strokeWidth={1.5} />
        <span className="font-heading text-lg font-medium text-[#F4F6FF]">Scheduled</span>
        <span className="text-sm text-[#A7B0C8]">Automate recurring payments</span>
      </div>

      {/* Main Hero Card */}
      <div
        className="perspective-container absolute flex items-center justify-center"
        style={{
          left: '50%',
          top: '52%',
          transform: 'translate(-50%, -50%)',
          width: '90vw',
          maxWidth: '900px',
          height: '58vh',
          minHeight: '420px',
        }}
      >
        <div
          ref={heroCardRef}
          className="glass-card w-full h-full relative overflow-hidden"
          style={{
            transformStyle: 'preserve-3d',
            transform: 'rotateX(8deg) rotateY(-10deg)',
          }}
        >
          {/* Inner glow */}
          <div className="absolute inset-0 bg-radial-glow opacity-60 pointer-events-none" />

          {/* Micro label */}
          <span
            ref={labelRef}
            className="micro-label absolute top-6 left-6 opacity-0"
          >
            BUILT FOR MINIPAY
          </span>

          {/* Ghost Mascot - left side */}
          <div
            ref={ghostRef}
            className="absolute left-[4%] md:left-[6%] top-1/2 -translate-y-1/2 w-[38%] md:w-[34%] opacity-0"
            style={{ transformStyle: 'preserve-3d' }}
          >
            <GhostMascot className="w-full h-auto drop-shadow-[0_0_30px_rgba(251,203,10,0.3)]" />
          </div>

          {/* Content - right side */}
          <div className="absolute right-6 md:right-10 top-[18%] md:top-[22%] left-[42%] md:left-[46%] max-w-[48%]">
            <h1
              ref={titleRef}
              className="font-heading text-3xl md:text-5xl lg:text-[56px] font-semibold leading-[1.05] tracking-tight text-[#F4F6FF] mb-4 md:mb-6"
            >
              {titleWords.map((word, i) => (
                <span key={i} className="word inline-block mr-[0.25em]">
                  {word}
                </span>
              ))}
            </h1>

            <p
              ref={bodyRef}
              className="text-sm md:text-base text-[#A7B0C8] leading-relaxed mb-6 md:mb-8 opacity-0"
            >
              Your onchain AI agent on Celo. Pay per LLM call in cUSD/USDC — no subscription. Send stablecoins and store data, right inside MiniPay.
            </p>

            <button
              ref={ctaRef}
              onClick={() => router.push('/dashboard')}
              className="px-6 md:px-8 py-3 md:py-3.5 rounded-full bg-[#FBCB0A] text-[#0B0C10] font-heading font-semibold text-sm md:text-base hover:scale-105 hover:shadow-[0_0_30px_rgba(251,203,10,0.4)] transition-all duration-300 opacity-0"
            >
              Summon GhostPay
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
