import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
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
 * Reveals a sequence of text lines one character at a time, like a typed
 * caption, pausing briefly between lines. Reduces to the full text
 * instantly under "prefers-reduced-motion". Returns the number of visible
 * characters per line plus which line is currently mid-type, so callers
 * can slice their own strings and keep full control of markup/classes.
 */
export function useTypewriter(
  lines: string[],
  {
    speed = 34,
    linePause = 420,
    startDelay = 150,
  }: { speed?: number; linePause?: number; startDelay?: number } = {},
) {
  const reduceMotion = useReducedMotion();
  const lineLengths = useMemo(() => lines.map(l => l.length), [lines]);
  const schedule = useMemo(() => {
    const times: number[] = [];
    let t = 0;
    lineLengths.forEach((len, li) => {
      for (let i = 0; i < len; i++) {
        times.push(t);
        t += speed;
      }
      if (li < lineLengths.length - 1) t += linePause;
    });
    return times;
  }, [lineLengths, speed, linePause]);
  const total = schedule.length;

  const [typed, setTyped] = useState(reduceMotion ? total : 0);
  const [done, setDone] = useState(reduceMotion);

  useEffect(() => {
    if (reduceMotion || total === 0) {
      setTyped(total);
      setDone(true);
      return;
    }
    setDone(false);
    setTyped(0);
    let raf = 0;
    let cancelled = false;
    let count = 0;
    const startTime = performance.now() + startDelay;
    // Reveals at most one character per frame, even if a slow/dropped frame
    // means we're behind schedule -- catching up by dumping several
    // characters into a single frame reads as a stutter rather than a typed
    // cadence, so we'd rather catch up gradually over the next few frames.
    const step = (now: number) => {
      if (cancelled) return;
      const elapsed = now - startTime;
      if (elapsed >= 0 && count < total && schedule[count] <= elapsed) {
        count += 1;
        setTyped(count);
      }
      if (count < total) {
        raf = requestAnimationFrame(step);
      } else {
        setDone(true);
      }
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [schedule, total, startDelay, reduceMotion]);

  const typedLines = useMemo(() => {
    let remaining = typed;
    return lineLengths.map(len => {
      const take = Math.max(0, Math.min(len, remaining));
      remaining -= len;
      return take;
    });
  }, [typed, lineLengths]);

  const activeLineIndex = done
    ? -1
    : typedLines.findIndex((n, i) => n < lineLengths[i]);

  return { typedLines, done, activeLineIndex };
}

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
