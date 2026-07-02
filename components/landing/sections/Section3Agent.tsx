import { useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import GhostMascot from '../GhostMascot';

gsap.registerPlugin(ScrollTrigger);

export default function Section3Agent() {
  const sectionRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const bubblesRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);

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
        },
      });

      // ENTRANCE (0% - 30%)
      // Agent card slides in from right with 3D rotation
      scrollTl.fromTo(
        cardRef.current,
        { x: '60vw', rotateY: -55, z: -220, opacity: 0 },
        { x: 0, rotateY: -10, z: 0, opacity: 1, ease: 'none' },
        0
      );

      // Ghost mascot scales up
      scrollTl.fromTo(
        ghostRef.current,
        { scale: 0.85, z: -120, opacity: 0 },
        { scale: 1, z: 40, opacity: 1, ease: 'none' },
        0
      );

      // Chat bubbles slide in
      if (bubblesRef.current) {
        const bubbles = bubblesRef.current.querySelectorAll('.chat-bubble');
        scrollTl.fromTo(
          bubbles,
          { x: 120, opacity: 0 },
          { x: 0, opacity: 1, stagger: 0.03, ease: 'none' },
          0.05
        );
      }

      // Typing indicator
      scrollTl.fromTo(
        indicatorRef.current,
        { scale: 0.9, opacity: 0 },
        { scale: 1, opacity: 1, ease: 'none' },
        0.2
      );

      // EXIT (70% - 100%)
      scrollTl.fromTo(
        cardRef.current,
        { rotateY: -10, x: 0, opacity: 1 },
        { rotateY: -35, x: '-18vw', opacity: 0, ease: 'power2.in' },
        0.70
      );

      scrollTl.fromTo(
        ghostRef.current,
        { z: 40, opacity: 1 },
        { z: 220, opacity: 0, ease: 'power2.in' },
        0.70
      );

      if (bubblesRef.current) {
        const bubbles = bubblesRef.current.querySelectorAll('.chat-bubble');
        scrollTl.fromTo(
          bubbles,
          { x: 0, opacity: 1 },
          { x: '-10vw', opacity: 0, ease: 'power2.in' },
          0.70
        );
      }

      scrollTl.fromTo(
        indicatorRef.current,
        { opacity: 1 },
        { opacity: 0, ease: 'power2.in' },
        0.75
      );
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative w-full h-screen overflow-hidden z-30"
      style={{ backgroundColor: '#0B0C10' }}
    >
      {/* Background glow */}
      <div className="absolute inset-0 bg-radial-glow opacity-50 pointer-events-none" />
      <div className="absolute inset-0 bg-dot-grid opacity-30 pointer-events-none" />

      {/* Agent Card */}
      <div
        className="perspective-container absolute flex items-center justify-center"
        style={{
          left: '50%',
          top: '52%',
          transform: 'translate(-50%, -50%)',
          width: '92vw',
          maxWidth: '1100px',
          height: '64vh',
          minHeight: '460px',
        }}
      >
        <div
          ref={cardRef}
          className="w-full h-full relative"
          style={{
            transformStyle: 'preserve-3d',
            transform: 'rotateY(-10deg)',
          }}
        >
          {/* Inner glow */}
          <div className="absolute inset-0 bg-radial-glow opacity-50 pointer-events-none" />

          {/* Micro label */}
          <span className="micro-label absolute top-5 left-6">AGENT CHAT</span>

          {/* Ghost Mascot - center left */}
          <div
            ref={ghostRef}
            className="absolute left-[8%] md:left-[12%] top-1/2 -translate-y-1/2 w-[32%] md:w-[28%]"
            style={{ transformStyle: 'preserve-3d', transform: 'translateY(-50%) translateZ(40px)' }}
          >
            <GhostMascot className="w-full h-auto drop-shadow-[0_0_30px_rgba(251,203,10,0.3)]" />
          </div>

          {/* Divider line */}
          <div className="absolute left-[42%] md:left-[45%] top-[12%] bottom-[12%] w-px bg-[rgba(255,255,255,0.08)]" />

          {/* Chat panel - right side */}
          <div
            ref={bubblesRef}
            className="absolute right-6 md:right-10 top-[16%] bottom-[16%] left-[46%] md:left-[48%] flex flex-col justify-center gap-4"
          >
            {/* User bubble */}
            <div className="chat-bubble self-end max-w-[90%] bg-[rgba(255,255,255,0.06)] rounded-2xl rounded-tr-sm px-4 py-3 border border-[rgba(255,255,255,0.08)]">
              <p className="text-sm md:text-base text-[#F4F6FF]">
                Send $120 to the design contractor every Friday.
              </p>
            </div>

            {/* Agent bubble */}
            <div className="chat-bubble self-start max-w-[95%] bg-[rgba(251,203,10,0.08)] rounded-2xl rounded-tl-sm px-4 py-3 border border-[rgba(251,203,10,0.25)]">
              <p className="text-sm md:text-base text-[#F4F6FF]">
                Got it. Weekly $120 to Design Contractor •••1234. First send: this Friday.
              </p>
            </div>

            {/* Typing indicator */}
            <div
              ref={indicatorRef}
              className="self-start flex items-center gap-1.5 px-4 py-2 rounded-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] w-fit"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#FBCB0A] animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-[#FBCB0A] animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-[#FBCB0A] animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
