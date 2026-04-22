import Link from 'next/link';
import { Section } from '@/components/layout/Section';
import { Reveal } from '@/components/motion/Reveal';

export default function NotFound() {
  return (
    <Section spacing="roomy" containerSize="narrow" className="text-center">
      <Reveal>
        <p className="text-eyebrow mb-6">404</p>
        <h1 className="text-headline mb-6">This page doesn&rsquo;t exist.</h1>
        <p className="text-lead mb-10">
          The link you followed may be broken, or the page may have been moved or retired. Head
          back home and we&rsquo;ll get you to where you were going.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium bg-[hsl(var(--foreground))] text-[hsl(var(--background))] hover:opacity-90 transition-opacity"
        >
          Back to home
          <span aria-hidden>→</span>
        </Link>
      </Reveal>
    </Section>
  );
}
