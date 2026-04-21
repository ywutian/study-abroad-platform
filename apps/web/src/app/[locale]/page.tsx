'use client';

import { LandingHeader } from './_components/landing-header';
import { HeroSection } from './_components/hero-section';
import { TrustBar } from './_components/trust-bar';
import { ProblemStatement } from './_components/problem-statement';
import { BentoFeatures } from './_components/bento-features';
import { HowItWorks } from './_components/how-it-works';
import { SocialProof } from './_components/social-proof';
import { CTAFooter } from './_components/cta-footer';

export default function HomePage() {
  return (
    <div className="landing-premium min-h-screen w-full overflow-x-hidden bg-[var(--landing-bg)] text-[var(--landing-fg)]">
      <LandingHeader />
      <main>
        <HeroSection />
        <TrustBar />
        <ProblemStatement />
        <BentoFeatures />
        <HowItWorks />
        <SocialProof />
        <CTAFooter />
      </main>
    </div>
  );
}
