'use client';

/**
 * 首页 — 8 section 叙事弧
 * Hero → Trust → Problem → Features → HowItWorks → SocialProof → CTA → Footer
 * 视觉节奏: Light → Tinted → Light → Tinted → Light → DARK → Tinted → Footer
 */

import { LandingHeader } from './_components/landing-header';
import { HeroSection } from './_components/hero-section';
import { TrustBar } from './_components/trust-bar';
import { ProblemStatement } from './_components/problem-statement';
import { BentoFeatures } from './_components/bento-features';
import { HowItWorks } from './_components/how-it-works';
import { SocialProof } from './_components/social-proof';
import { CTAFooter } from './_components/cta-footer';
import { ScrollProgress } from './_components/scroll-progress';
import { ScrollSection } from './_components/scroll-section';
import { SectionTransition } from './_components/section-transition';
import { CursorSpotlight } from './_components/cursor-spotlight';

export default function HomePage() {
  return (
    <>
      {/* Fixed elements — outside wrapper to avoid overflow/transform conflicts */}
      <ScrollProgress />
      <CursorSpotlight />
      <LandingHeader />

      {/* Scrollable content */}
      <div className="min-h-screen overflow-x-hidden">
        {/* 1. Hero — zone-light, section-expansive */}
        <HeroSection />

        {/* 2. TrustBar — zone-tinted, section-compact */}
        <ScrollSection effect="fade-up" offset={['start 80%', 'start 35%']}>
          <TrustBar />
        </ScrollSection>

        {/* 3. ProblemStatement — zone-light, section-normal */}
        <ScrollSection effect="fade-blur">
          <ProblemStatement />
        </ScrollSection>

        {/* 4. BentoFeatures — zone-tinted, section-expansive */}
        <ScrollSection effect="fade-scale" offset={['start 75%', 'start 30%']}>
          <BentoFeatures />
        </ScrollSection>

        {/* 5. HowItWorks — zone-light, section-normal */}
        <ScrollSection effect="fade-up" offset={['start 70%', 'start 25%']}>
          <HowItWorks />
        </ScrollSection>

        {/* Transition: light → dark */}
        <SectionTransition direction="to-dark" />

        {/* 6. SocialProof — zone-dark, section-expansive */}
        <SocialProof />

        {/* Transition: dark → light */}
        <SectionTransition direction="from-dark" />

        {/* 7. CTA — zone-tinted, section-expansive */}
        <ScrollSection effect="fade-up" offset={['start 80%', 'start 40%']}>
          <CTAFooter />
        </ScrollSection>
      </div>
    </>
  );
}
