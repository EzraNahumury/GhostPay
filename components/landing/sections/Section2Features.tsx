import { useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function Section2Features() {
  const sectionRef = useRef<HTMLElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    const textEl = textRef.current;
    if (!section || !textEl) return;

    const ctx = gsap.context(() => {
      // Get all the words inside the text container
      const words = textEl.querySelectorAll('.word');
      
      // Animate opacity of each word sequentially as you scroll
      gsap.fromTo(
        words,
        { opacity: 0.15 }, // Start dim
        {
          opacity: 1, // Full white
          stagger: 0.1,
          scrollTrigger: {
            trigger: section,
            start: 'top top',
            end: '+=150%', // Pin for a long scroll
            pin: true,
            scrub: 1,
          },
        }
      );
    }, section);

    return () => ctx.revert();
  }, []);

  // Split text into words for GSAP targeting
  const splitText = (text: string) => {
    return text.split(' ').map((word, i) => (
      <span key={i} className="word inline-block mr-[2vw] mb-[1vh]">{word}</span>
    ));
  };

  return (
    <section
      ref={sectionRef}
      id="features"
      className="relative w-full h-screen flex items-center justify-center overflow-hidden z-20"
      style={{ backgroundColor: '#0B0C10' }}
    >
      {/* Dark minimalist background, no glowing boxes */}
      
      <div className="relative w-full max-w-[1900px] px-8 md:px-16 flex items-center">
        <div 
          ref={textRef} 
          className="font-heading font-black text-[10vw] md:text-[7vw] leading-[1.1] tracking-tighter text-[#F4F6FF]"
        >
          {splitText("Write what you want. GhostPay translates your raw intent into instant blockchain transactions.  No boxes. No forms.        Just action.")}
        </div>
      </div>
    </section>
  );
}
