/**
 * Animated Text Component
 *
 * Reveals text with a gradient fade-in animation (left-to-right).
 * Creates a "beat of recognition" as the user anticipates the sentence forming.
 *
 * Features:
 * - Character-by-character reveal
 * - Gradient mask animation
 * - Configurable delay and speed
 * - Smooth, organic feeling
 */

import { Component, createSignal, onMount, onCleanup } from 'solid-js';
import './AnimatedText.css';

interface AnimatedTextProps {
  text: string;
  delay?: number;          // Initial delay in ms (default: 100)
  speed?: number;          // Characters per second (default: 50)
  onComplete?: () => void; // Callback when animation completes
  className?: string;
}

export const AnimatedText: Component<AnimatedTextProps> = (props) => {
  const [revealedText, setRevealedText] = createSignal('');
  const [isComplete, setIsComplete] = createSignal(false);

  let intervalId: number | undefined;

  onMount(() => {
    const delay = props.delay ?? 100;
    const speed = props.speed ?? 50; // chars per second
    const charDelay = 1000 / speed;  // ms per char

    // Initial delay to create anticipation
    setTimeout(() => {
      let currentIndex = 0;
      const text = props.text;

      intervalId = setInterval(() => {
        if (currentIndex < text.length) {
          currentIndex++;
          setRevealedText(text.substring(0, currentIndex));
        } else {
          clearInterval(intervalId);
          setIsComplete(true);
          props.onComplete?.();
        }
      }, charDelay) as any;
    }, delay);
  });

  onCleanup(() => {
    if (intervalId) {
      clearInterval(intervalId);
    }
  });

  return (
    <span
      class={`animated-text ${isComplete() ? 'complete' : 'revealing'} ${props.className || ''}`}
      aria-label={props.text}
    >
      <span class="revealed-content">
        {revealedText()}
      </span>
      <span class="gradient-mask" />
    </span>
  );
};

/**
 * Animated Paragraph Component
 *
 * Reveals full paragraphs with gradient animation.
 * Better for longer text blocks.
 */

interface AnimatedParagraphProps {
  text: string;
  delay?: number;
  speed?: number;
  onComplete?: () => void;
  className?: string;
}

export const AnimatedParagraph: Component<AnimatedParagraphProps> = (props) => {
  return (
    <p class={`animated-paragraph ${props.className || ''}`}>
      <AnimatedText
        text={props.text}
        delay={props.delay}
        speed={props.speed}
        onComplete={props.onComplete}
      />
    </p>
  );
};

/**
 * Animated Response Component
 *
 * Special component for curator responses.
 * Splits into paragraphs and animates sequentially.
 */

interface AnimatedResponseProps {
  content: string;
  delay?: number;
  speed?: number;
  onComplete?: () => void;
}

export const AnimatedResponse: Component<AnimatedResponseProps> = (props) => {
  const [currentParagraph, setCurrentParagraph] = createSignal(0);
  const paragraphs = () => props.content.split('\n\n').filter(p => p.trim());

  const handleParagraphComplete = () => {
    if (currentParagraph() < paragraphs().length - 1) {
      // Small pause between paragraphs (creates rhythm)
      setTimeout(() => {
        setCurrentParagraph(currentParagraph() + 1);
      }, 150);
    } else {
      props.onComplete?.();
    }
  };

  return (
    <div class="animated-response">
      {paragraphs().map((paragraph, index) => {
        // Only show paragraphs up to current
        if (index > currentParagraph()) return null;

        // Animate current paragraph
        if (index === currentParagraph()) {
          return (
            <AnimatedParagraph
              text={paragraph}
              delay={index === 0 ? (props.delay ?? 100) : 0}
              speed={props.speed}
              onComplete={handleParagraphComplete}
            />
          );
        }

        // Show completed paragraphs (no animation)
        return <p class="completed-paragraph">{paragraph}</p>;
      })}
    </div>
  );
};

export default AnimatedText;
