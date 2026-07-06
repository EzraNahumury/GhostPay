import { useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import GhostMascot from '../GhostMascot';
import { Github, Twitter, MessageCircle, Mail } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const footerLinks = [
  {
    title: 'Product',
    links: ['Features', 'Security', 'Pricing', 'Changelog'],
  },
  {
    title: 'Company',
    links: ['About', 'Blog', 'Careers', 'Press'],
  },
  {
    title: 'Resources',
    links: ['Documentation', 'API Reference', 'Status', 'Support'],
  },
  {
    title: 'Legal',
    links: ['Privacy', 'Terms', 'Cookies', 'Licenses'],
  },
];

const socialLinks = [
  { icon: Twitter, label: 'Twitter' },
  { icon: Github, label: 'GitHub' },
  { icon: MessageCircle, label: 'Discord' },
  { icon: Mail, label: 'Email' },
];

export default function Section8Footer() {
  const sectionRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      // Main CTA card
      gsap.fromTo(
        cardRef.current,
        { scale: 0.92, rotateX: 10, opacity: 0 },
        {
          scale: 1,
          rotateX: 0,
          opacity: 1,
          scrollTrigger: {
            trigger: cardRef.current,
            start: 'top 80%',
            end: 'top 45%',
            scrub: true,
          },
        }
      );

      // Ghost mascot
      gsap.fromTo(
        ghostRef.current,
        { y: 24, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          scrollTrigger: {
            trigger: ghostRef.current,
            start: 'top 85%',
            end: 'top 60%',
            scrub: true,
          },
        }
      );

      // Footer columns stagger
      if (footerRef.current) {
        const cols = footerRef.current.querySelectorAll('.footer-col');
        gsap.fromTo(
          cols,
          { y: 20, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            stagger: 0.08,
            scrollTrigger: {
              trigger: footerRef.current,
              start: 'top 85%',
              end: 'top 65%',
              scrub: true,
            },
          }
        );
      }
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="footer"
      className="relative w-full min-h-screen z-[80] flex flex-col"
      style={{ backgroundColor: '#0B0C10' }}
    >
      {/* Background glow */}
      <div className="absolute inset-0 bg-radial-glow opacity-60 pointer-events-none" />
      <div className="absolute inset-0 bg-dot-grid opacity-30 pointer-events-none" />

      {/* Main CTA area (Free Layout) */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 md:px-12 py-[16vh] md:py-[20vh]">
        <div
          ref={cardRef}
          className="w-full relative flex flex-col items-center justify-center text-center"
        >
          {/* Ghost mascot */}
          <div
            ref={ghostRef}
            className="w-28 h-28 md:w-40 md:h-40 mb-8"
          >
            <GhostMascot className="w-full h-full object-contain drop-shadow-[0_0_60px_rgba(251,203,10,0.6)]" />
          </div>

          {/* Text */}
          <h2 className="font-heading text-5xl md:text-7xl font-bold text-[#F4F6FF] mb-6 tracking-tight">
            Meet your agent.
          </h2>
          <p className="text-lg md:text-xl text-[#A7B0C8] max-w-[600px] mb-12">
            Connect your wallet, create your onchain agent, and start paying per
            AI call in cUSD. Live on Celo, built for MiniPay.
          </p>

          {/* CTA Button */}
          <a
            href="/dashboard"
            className="inline-block px-10 py-5 rounded-full bg-[#FBCB0A] text-[#0B0C10] font-heading font-bold text-lg hover:scale-105 hover:shadow-[0_0_50px_rgba(251,203,10,0.6)] transition-all duration-300"
          >
            Launch the App
          </a>
        </div>
      </div>

      {/* Footer matching reference design */}
      <footer
        ref={footerRef}
        className="w-full relative overflow-hidden pt-20 pb-0 px-6 md:px-12 border-t border-[rgba(255,255,255,0.06)]"
      >
        <div className="max-w-[1400px] mx-auto w-full flex flex-col md:flex-row justify-between gap-12 relative z-10 pb-8">
          {/* Brand & Copyright (Left) */}
          <div className="footer-col flex flex-col justify-start max-w-[300px]">
            <a href="#" className="font-heading text-xl font-bold text-[#F4F6FF] mb-6 flex items-center gap-2">
              <img src="/logo.jpg" alt="GhostPay" className="w-8 h-8 rounded-lg object-contain bg-black" />
              GhostPay
            </a>
            <p className="text-sm text-[#A7B0C8] font-medium opacity-70">
              &copy; copyright GhostPay {new Date().getFullYear()}. All rights reserved.
            </p>
          </div>

          {/* Link Columns (Right) */}
          <div className="flex flex-wrap md:flex-nowrap gap-12 md:gap-24 lg:gap-32">
            <div className="footer-col flex flex-col gap-5">
              <h4 className="font-heading text-sm font-bold text-[#F4F6FF]">App</h4>
              <ul className="flex flex-col gap-4">
                <li><a href="/dashboard" className="text-sm text-[#A7B0C8] hover:text-white transition-colors">Dashboard</a></li>
                <li><a href="/chat" className="text-sm text-[#A7B0C8] hover:text-white transition-colors">AI Chat</a></li>
                <li><a href="/payments" className="text-sm text-[#A7B0C8] hover:text-white transition-colors">Payments</a></li>
                <li><a href="/vault" className="text-sm text-[#A7B0C8] hover:text-white transition-colors">Vault</a></li>
              </ul>
            </div>

            <div className="footer-col flex flex-col gap-5">
              <h4 className="font-heading text-sm font-bold text-[#F4F6FF]">Build</h4>
              <ul className="flex flex-col gap-4">
                <li><a href="https://github.com/EzraNahumury/GhostPay" target="_blank" rel="noreferrer" className="text-sm text-[#A7B0C8] hover:text-white transition-colors">GitHub</a></li>
                <li><a href="https://celoscan.io/address/0x718664652C3A7eb6A2c23D8986338a237087d7CD" target="_blank" rel="noreferrer" className="text-sm text-[#A7B0C8] hover:text-white transition-colors">Contracts (Celoscan)</a></li>
              </ul>
            </div>

            <div className="footer-col flex flex-col gap-5">
              <h4 className="font-heading text-sm font-bold text-[#F4F6FF]">Celo</h4>
              <ul className="flex flex-col gap-4">
                <li><a href="https://www.minipay.xyz/" target="_blank" rel="noreferrer" className="text-sm text-[#A7B0C8] hover:text-white transition-colors">MiniPay</a></li>
                <li><a href="https://docs.celo.org/" target="_blank" rel="noreferrer" className="text-sm text-[#A7B0C8] hover:text-white transition-colors">Celo Docs</a></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Gigantic Watermark Text (Bottom) */}
        <div className="w-full flex justify-center items-end mt-4 relative z-0 pointer-events-none select-none overflow-hidden">
          <span 
            className="font-heading font-black leading-none text-[transparent] bg-clip-text bg-gradient-to-b from-[#F4F6FF]/10 to-[#F4F6FF]/0"
            style={{ fontSize: 'clamp(100px, 22vw, 400px)', letterSpacing: '-0.04em', transform: 'translateY(15%)' }}
          >
            GhostPay
          </span>
        </div>
      </footer>
    </section>
  );
}
