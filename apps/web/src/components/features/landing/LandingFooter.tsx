'use client';

import { Link } from '@/lib/i18n/navigation';
import { Logo } from '@/components/ui/logo';
import { cn } from '@/lib/utils';

interface FooterLink {
  label: string;
  href: string;
}

interface FooterSection {
  title: string;
  links: FooterLink[];
}

interface LandingFooterProps {
  description?: string;
  sections: FooterSection[];
  copyright: string;
  className?: string;
}

export function LandingFooter({ description, sections, copyright, className }: LandingFooterProps) {
  return (
    <footer className={cn('border-t bg-card', className)}>
      <div className="container mx-auto px-4 py-8 sm:py-12">
        {/* Main Footer Content */}
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand Section */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2 mb-4">
              <Logo size="md" />
            </Link>
            {description && (
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                {description}
              </p>
            )}
          </div>

          {/* Link Sections */}
          {sections.map((section, index) => (
            <div key={index}>
              <h3 className="font-semibold mb-3 sm:mb-4 text-sm sm:text-base">{section.title}</h3>
              <ul className="space-y-2 sm:space-y-3">
                {section.links.map((link, linkIndex) => (
                  <li key={linkIndex}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 sm:mt-12 pt-6 sm:pt-8 border-t">
          <p className="text-xs sm:text-sm text-muted-foreground text-center">{copyright}</p>
        </div>
      </div>
    </footer>
  );
}
