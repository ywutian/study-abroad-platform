'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/lib/i18n/navigation';
import { motion } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Rocket, User, GraduationCap, Brain, ArrowRight, X } from 'lucide-react';

const PENDING_ONBOARDING_KEY = 'showQuickExperience';

export function QuickExperience() {
  const t = useTranslations('dashboard.quickExperience');
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const pending = localStorage.getItem(PENDING_ONBOARDING_KEY);
    if (pending === 'true') {
      setOpen(true);
    }
  }, []);

  const handleClose = () => {
    setOpen(false);
    localStorage.removeItem(PENDING_ONBOARDING_KEY);
  };

  const handleGetStarted = () => {
    handleClose();
    router.push('/profile');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden" showCloseButton={false}>
        {/* Header gradient area */}
        <div className="relative bg-gradient-to-br from-primary/15 via-primary/5 to-transparent px-8 pt-10 pb-6">
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
            onClick={handleClose}
          >
            <X className="h-4 w-4" />
          </Button>

          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.1 }}
            className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-5"
          >
            <Rocket className="w-7 h-7 text-primary" />
          </motion.div>

          <DialogHeader className="text-left">
            <DialogTitle className="text-2xl font-bold">{t('title')}</DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm mt-2 leading-relaxed">
              {t('subtitle')}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Steps */}
        <div className="px-8 py-5 space-y-4">
          {[
            { icon: User, text: t('step1'), delay: 0.15 },
            { icon: GraduationCap, text: t('step2'), delay: 0.2 },
            { icon: Brain, text: t('step3'), delay: 0.25 },
          ].map((step, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: step.delay }}
              className="flex items-start gap-3"
            >
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                <step.icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-sm text-foreground leading-relaxed pt-1">{step.text}</p>
            </motion.div>
          ))}
        </div>

        {/* Footer */}
        <DialogFooter className="px-8 pb-8 pt-2 flex-row gap-3 sm:justify-between">
          <Button variant="ghost" onClick={handleClose} className="text-muted-foreground">
            {t('skip')}
          </Button>
          <Button onClick={handleGetStarted}>
            {t('getStarted')}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
