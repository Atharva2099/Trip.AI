import React, { useState, useEffect } from 'react';
import { Compass, MapPin, Calendar, DollarSign, Sparkles, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const UNSPLASH_IMAGES = [
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80',
  'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1920&q=80',
  'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1920&q=80',
  'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1920&q=80'
];

export default function LandingPage() {
  const { loginWithGitHub, loginWithGoogle } = useAuth();
  const [currentImage, setCurrentImage] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImage((i) => (i + 1) % UNSPLASH_IMAGES.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const features = [
    {
      icon: MapPin,
      title: 'Real Places',
      description: 'Every location is verified with real coordinates from OpenStreetMap.'
    },
    {
      icon: Calendar,
      title: 'Day-by-Day',
      description: 'Detailed hourly schedules with transport times between activities.'
    },
    {
      icon: DollarSign,
      title: 'Cost Breakdown',
      description: 'Per-person costs with a running total against your budget.'
    },
    {
      icon: Sparkles,
      title: 'AI-Powered',
      description: 'Personalized recommendations based on your interests and travel style.'
    }
  ];

  return (
    <div className="min-h-screen bg-cream">
      {/* Hero Section */}
      <section className="relative h-screen min-h-[600px] overflow-hidden">
        {/* Background images with crossfade */}
        {UNSPLASH_IMAGES.map((src, i) => (
          <div
            key={src}
            className="absolute inset-0 transition-opacity duration-1000"
            style={{ opacity: i === currentImage ? 1 : 0 }}
          >
            <img
              src={src}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        ))}

        {/* Dark overlay */}
        <div className="absolute inset-0 bg-ink/60" />

        {/* Content */}
        <div className="relative z-10 h-full flex flex-col justify-center px-6 md:px-12 lg:px-20">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-8">
              <Compass size={28} className="text-terra" strokeWidth={1.5} />
              <span className="font-serif text-2xl text-cream tracking-tight">Trip.AI</span>
            </div>

            <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl text-cream leading-[0.95] mb-6 tracking-tight">
              Plan your next<br />adventure
            </h1>

            <p className="text-cream/70 text-base md:text-lg max-w-lg mb-10 leading-relaxed">
              AI-crafted itineraries with real places, costs, and routes. 
              Tell us where you want to go — we handle the details.
            </p>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={loginWithGitHub}
                className="flex items-center gap-2 px-6 py-3 text-xs font-medium uppercase tracking-[0.14em] bg-cream text-ink hover:bg-cream-dark transition-colors"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                </svg>
                Continue with GitHub
              </button>
              <button
                onClick={loginWithGoogle}
                className="flex items-center gap-2 px-6 py-3 text-xs font-medium uppercase tracking-[0.14em] border border-cream/30 text-cream hover:bg-cream/10 transition-colors"
              >
                <svg viewBox="0 0 24 24" width="14" height="14">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>
            </div>

            <p className="mt-6 text-[10px] uppercase tracking-[0.14em] text-cream/40">
              No passwords needed. One-click sign in.
            </p>
          </div>
        </div>

        {/* Image dots indicator */}
        <div className="absolute bottom-8 left-6 md:left-12 lg:left-20 z-10 flex gap-2">
          {UNSPLASH_IMAGES.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentImage(i)}
              className={`w-8 h-[2px] transition-colors ${
                i === currentImage ? 'bg-terra' : 'bg-cream/30'
              }`}
            />
          ))}
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-8 right-6 md:right-12 lg:right-20 z-10">
          <button
            onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
            className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-cream/50 hover:text-cream transition-colors"
          >
            Learn more
            <ArrowRight size={12} />
          </button>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 md:py-32 px-6 md:px-12 lg:px-20 border-t border-rule">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0 border-t border-rule">
            {features.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className={`py-10 px-6 ${i > 0 ? 'md:border-l border-rule' : ''}`}
                >
                  <Icon size={20} className="text-terra mb-4" strokeWidth={1.5} />
                  <h3 className="font-serif text-lg text-ink mb-2">{feature.title}</h3>
                  <p className="text-sm text-ink-light leading-relaxed">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-rule py-8 px-6 md:px-12 lg:px-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Compass size={14} className="text-ink-muted" strokeWidth={1.5} />
            <span className="font-serif text-sm text-ink">Trip.AI</span>
          </div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-ink-muted">
            Free forever. No credit card required.
          </p>
        </div>
      </footer>
    </div>
  );
}
