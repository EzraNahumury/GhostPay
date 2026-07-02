import { useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Check, Sparkles } from 'lucide-react';


gsap.registerPlugin(ScrollTrigger);

const plans = [
  {
    name: 'Phantom',
    description: 'For personal use',
    price: '$0',
    period: '/mo',
    features: ['5 sends per month', 'Basic scheduling', 'Standard support', 'Web access'],
    cta: 'Start Free',
    highlighted: false,
  },
  {
    name: 'Poltergeist',
    description: 'For power users',
    price: '$12',
    period: '/mo',
    features: ['Unlimited sends', 'Smart scheduling', 'Priority support', 'API access', 'Multi-chain'],
    cta: 'Go Pro',
    highlighted: true,
  },
  {
    name: 'Haunt',
    description: 'For teams',
    price: '$49',
    period: '/mo',
    features: ['Multi-agent', 'Shared vaults', 'SSO & SAML', 'Dedicated support', 'Custom integrations'],
    cta: 'Contact Sales',
    highlighted: false,
  },
];

export default function Section7Pricing() {
  const sectionRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
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

      // Cards with stagger
      cardsRef.current.forEach((card, i) => {
        if (!card) return;
        const isMiddle = i === 1;

        gsap.fromTo(
          card,
          { y: 100, rotateX: 14, scale: 0.9, opacity: 0 },
          {
            y: isMiddle ? -20 : 0,
            rotateX: 0,
            scale: isMiddle ? 1.05 : 1,
            opacity: 1,
            scrollTrigger: {
              trigger: card,
              start: 'top 85%',
              end: 'top 50%',
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
      id="pricing"
      className="relative w-full py-[10vh] md:py-[12vh] z-[70]"
      style={{ backgroundColor: '#0B0C10' }}
    >
      {/* Background glow */}
      <div className="absolute inset-0 bg-radial-glow opacity-40 pointer-events-none" />

      <div className="relative max-w-[1200px] mx-auto px-6 md:px-12">
        {/* Title */}
        <div ref={titleRef} className="text-center mb-10 md:mb-16 opacity-0">
          <h2 className="font-heading text-3xl md:text-[42px] font-semibold text-[#F4F6FF] mb-4 tracking-tight">
            Pick your presence.
          </h2>
          <p className="text-base md:text-lg text-[#A7B0C8] max-w-[480px] mx-auto">
            Start free, upgrade when you need more power.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 perspective-container">
          {plans.map((plan, i) => (
            <div
              key={plan.name}
              ref={(el) => { cardsRef.current[i] = el; }}
              className="opacity-0"
              style={{ transformStyle: 'preserve-3d' }}
            >
              <div
                className={`p-6 md:p-8 h-full flex flex-col relative rounded-3xl transition-all duration-300 ${
                  plan.highlighted
                    ? 'glass-card border border-[#FBCB0A]/30 bg-[rgba(18,15,28,0.8)] shadow-[0_0_40px_rgba(251,203,10,0.15)] z-10'
                    : 'border border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.04)]'
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute inset-0 bg-gradient-to-b from-[#FBCB0A]/10 to-transparent rounded-3xl pointer-events-none" />
                )}
                {/* Plan header */}
                <div className="mb-6">
                  {plan.highlighted && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[rgba(251,203,10,0.15)] text-[#FBCB0A] text-xs font-medium mb-4">
                      <Sparkles className="w-3 h-3" />
                      Most Popular
                    </span>
                  )}
                  <h3 className="font-heading text-2xl font-semibold text-[#F4F6FF] mb-1">
                    {plan.name}
                  </h3>
                  <p className="text-sm text-[#A7B0C8]">{plan.description}</p>
                </div>

                {/* Price */}
                <div className="mb-6">
                  <span className="font-heading text-4xl md:text-5xl font-bold text-[#F4F6FF]">
                    {plan.price}
                  </span>
                  <span className="text-[#A7B0C8]">{plan.period}</span>
                </div>

                {/* Features */}
                <ul className="flex-1 space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check className="w-4 h-4 text-[#FBCB0A] mt-0.5 flex-shrink-0" strokeWidth={2} />
                      <span className="text-sm text-[#A7B0C8]">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <button
                  className={`w-full py-3 rounded-full font-heading font-semibold text-sm transition-all duration-300 ${
                    plan.highlighted
                      ? 'bg-[#FBCB0A] text-[#0B0C10] hover:scale-105 hover:shadow-[0_0_30px_rgba(251,203,10,0.4)]'
                      : 'bg-[rgba(255,255,255,0.05)] text-[#F4F6FF] hover:bg-[rgba(251,203,10,0.2)] hover:text-[#FBCB0A]'
                  }`}
                >
                  {plan.cta}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
