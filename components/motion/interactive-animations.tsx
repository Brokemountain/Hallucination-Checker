"use client";

import { motion, useMotionValue, useTransform } from "framer-motion";
import { useRef, type ReactNode } from "react";

interface FloatAnimationProps {
  children: ReactNode;
  className?: string;
  duration?: number;
  amplitude?: number;
  delay?: number;
}

export function FloatAnimation({
  children,
  className,
  duration = 6,
  amplitude = 8,
  delay = 0,
}: FloatAnimationProps) {
  return (
    <motion.div
      className={className}
      animate={{
        y: [0, -amplitude, 0],
      }}
      transition={{
        duration,
        repeat: Infinity,
        delay,
        ease: "easeInOut",
      }}
    >
      {children}
    </motion.div>
  );
}

interface PulseAnimationProps {
  children: ReactNode;
  className?: string;
  scale?: number;
  duration?: number;
}

export function PulseAnimation({
  children,
  className,
  scale = 1.05,
  duration = 2,
}: PulseAnimationProps) {
  return (
    <motion.div
      className={className}
      animate={{
        scale: [1, scale, 1],
      }}
      transition={{
        duration,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      {children}
    </motion.div>
  );
}

interface ShimmerProps {
  children: ReactNode;
  className?: string;
  duration?: number;
}

export function Shimmer({ children, className, duration = 2 }: ShimmerProps) {
  return (
    <motion.div
      className={className}
      animate={{
        backgroundPosition: ["200% 0", "-200% 0"],
      }}
      transition={{
        duration,
        repeat: Infinity,
        ease: "linear",
      }}
    >
      {children}
    </motion.div>
  );
}

interface MagneticButtonProps {
  children: ReactNode;
  className?: string;
  strength?: number;
}

export function MagneticButton({ children, className, strength = 0.3 }: MagneticButtonProps) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const deltaX = (event.clientX - centerX) * strength;
    const deltaY = (event.clientY - centerY) * strength;
    x.set(deltaX);
    y.set(deltaY);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ x, y }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
    >
      {children}
    </motion.div>
  );
}

interface ParallaxCardProps {
  children: ReactNode;
  className?: string;
  tiltIntensity?: number;
}

export function ParallaxCard({ children, className, tiltIntensity = 15 }: ParallaxCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const rotateX = useTransform(y, [-0.5, 0.5], [`-${tiltIntensity}deg`, `${tiltIntensity}deg`]);
  const rotateY = useTransform(x, [-0.5, 0.5], [`${tiltIntensity}deg`, `-${tiltIntensity}deg`]);

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const percentX = (event.clientX - centerX) / (rect.width / 2);
    const percentY = (event.clientY - centerY) / (rect.height / 2);
    x.set(percentX);
    y.set(percentY);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ rotateX, rotateY, transformPerspective: 1000 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
    >
      {children}
    </motion.div>
  );
}

interface TextScrambleProps {
  text: string;
  className?: string;
  duration?: number;
}

export function TextScramble({ text, className, duration = 0.8 }: TextScrambleProps) {
  const displayText = useMotionValue(text);
  const [currentText, setCurrentText] = useState(text);

  // Simple scramble - in production you'd implement full character scramble
  useEffect(() => {
    const timeout = setTimeout(() => {
      setCurrentText(text);
    }, duration * 1000);
    return () => clearTimeout(timeout);
  }, [text, duration]);

  return <motion.span className={className}>{currentText}</motion.span>;
}

import { useState, useEffect } from "react";
