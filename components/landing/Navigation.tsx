import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';


gsap.registerPlugin(ScrollTrigger);

export default function Navigation() {
  const navRef = useRef<HTMLElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 80);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden';
      gsap.to('.menu-overlay', { opacity: 1, pointerEvents: 'all', duration: 0.5, ease: 'power3.out' });
      gsap.fromTo('.menu-link', 
        { x: -60, opacity: 0 },
        { x: 0, opacity: 1, stagger: 0.05, duration: 0.6, ease: 'power3.out', delay: 0.15 }
      );
    } else {
      document.body.style.overflow = '';
      gsap.to('.menu-overlay', { opacity: 0, pointerEvents: 'none', duration: 0.4, ease: 'power3.in' });
    }
  }, [menuOpen]);

  const scrollToSection = (id: string) => {
    setMenuOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <>
      <nav
        ref={navRef}
        className={`fixed top-0 left-0 w-full z-50 transition-all duration-500 ${
          scrolled ? 'bg-[#0B0C10]/80 backdrop-blur-md' : 'bg-transparent'
        }`}
      >
        <div className="flex items-center justify-between px-6 md:px-12 py-5 max-w-[1920px] mx-auto">
          {/* Logo */}
          <a href="#" className="flex items-center gap-2 font-heading text-xl font-semibold tracking-tight text-[#F4F6FF]">
            <img src="/logo.jpg" alt="GhostPay" className="h-8 w-8 rounded-md object-contain bg-black" />
            Ghost<span className="text-[#FBCB0A]">Pay</span>
          </a>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-10">
            <button onClick={() => scrollToSection('features')} className="text-sm text-[#A7B0C8] hover:text-[#F4F6FF] transition-colors duration-300">
              Product
            </button>
            <button onClick={() => scrollToSection('vault')} className="text-sm text-[#A7B0C8] hover:text-[#F4F6FF] transition-colors duration-300">
              Security
            </button>
            <button onClick={() => scrollToSection('pricing')} className="text-sm text-[#A7B0C8] hover:text-[#F4F6FF] transition-colors duration-300">
              Pricing
            </button>
            <button onClick={() => scrollToSection('footer')} className="text-sm text-[#A7B0C8] hover:text-[#F4F6FF] transition-colors duration-300">
              Docs
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden flex flex-col gap-1.5 z-50 relative"
            aria-label="Toggle menu"
          >
            <span className={`w-6 h-0.5 bg-[#F4F6FF] transition-all duration-300 ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
            <span className={`w-6 h-0.5 bg-[#F4F6FF] transition-all duration-300 ${menuOpen ? 'opacity-0' : ''}`} />
            <span className={`w-6 h-0.5 bg-[#F4F6FF] transition-all duration-300 ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      <div className="menu-overlay fixed inset-0 z-40 bg-[#0B0C10] opacity-0 pointer-events-none md:hidden">
        <div className="flex flex-col items-start justify-center h-full px-10 gap-8">
          {[
            { label: 'Product', id: 'features' },
            { label: 'Security', id: 'vault' },
            { label: 'Pricing', id: 'pricing' },
            { label: 'Docs', id: 'footer' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => scrollToSection(item.id)}
              className="menu-link font-heading text-4xl font-medium text-[#F4F6FF] hover:text-[#FBCB0A] transition-colors duration-300"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
