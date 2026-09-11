import { type ReactNode, useRef } from "react";
import {
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";

/**
 * Fades + lifts children into view once, the first time they scroll into
 * the viewport. Collapses to an instant, static appearance when the visitor
 * has "prefers-reduced-motion" set.
 */
export function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
  as: Component = motion.div,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: typeof motion.div;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px -10% 0px" });
  const reduceMotion = useReducedMotion();

  return (
    <Component
      ref={ref}
      className={className}
      initial={reduceMotion ? undefined : { opacity: 0, y }}
      animate={
        reduceMotion
          ? undefined
          : inView
            ? { opacity: 1, y: 0 }
            : { opacity: 0, y }
      }
      transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </Component>
  );
}

/** Staggers Reveal-style entrances across a group of children (hero intro). */
export const staggerContainer = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.18, delayChildren: 0.1 },
  },
};

export const staggerItem = {
  hidden: { opacity: 0, y: 22 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.85, ease: [0.16, 1, 0.3, 1] as const },
  },
};

/**
 * Scales an image from ~1.08 down to 1 as the section holding it crosses
 * the viewport — the "Art of Braiding" editorial reveal. GPU-friendly
 * (transform only). No-ops to a static image under reduced motion.
 */
export function ScaleOnScroll({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [1.08, 1, 1.04]);

  if (reduceMotion) {
    return (
      <div ref={ref} className={className}>
        {children}
      </div>
    );
  }

  return (
    <motion.div ref={ref} className={className} style={{ scale }}>
      {children}
    </motion.div>
  );
}
