/**
 * Profile Cards - Horizontal scroll cards for Personas and Styles
 *
 * Features:
 * - Horizontal scroll with touch support
 * - Tooltip on hover/touch showing full description
 * - Selection state with visual feedback
 * - Support for hiding rarely used profiles
 */

import { useState, useRef, useEffect, type MouseEvent, type TouchEvent } from 'react';
import type { PersonaDefinition, StyleDefinition } from '../../lib/transform';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

interface ProfileCardProps<T extends PersonaDefinition | StyleDefinition> {
  profile: T;
  selected: boolean;
  onSelect: (profile: T) => void;
  disabled?: boolean;
}

interface ProfileCardsContainerProps<T extends PersonaDefinition | StyleDefinition> {
  profiles: T[];
  selectedName: string;
  onSelect: (profile: T) => void;
  disabled?: boolean;
  showAllProfiles?: boolean;
  onToggleShowAll?: () => void;
  hiddenProfiles?: Set<string>;
  type: 'persona' | 'style';
}

// ═══════════════════════════════════════════════════════════════════
// TOOLTIP
// ═══════════════════════════════════════════════════════════════════

interface TooltipState {
  visible: boolean;
  content: string;
  x: number;
  y: number;
}

function ProfileTooltip({ state }: { state: TooltipState }) {
  if (!state.visible || !state.content) return null;

  return (
    <div
      className="profile-tooltip"
      style={{
        left: state.x,
        top: state.y,
      }}
    >
      {state.content}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SINGLE PROFILE CARD
// ═══════════════════════════════════════════════════════════════════

function ProfileCard<T extends PersonaDefinition | StyleDefinition>({
  profile,
  selected,
  onSelect,
  disabled,
}: ProfileCardProps<T>) {
  const [tooltipState, setTooltipState] = useState<TooltipState>({
    visible: false,
    content: '',
    x: 0,
    y: 0,
  });
  const cardRef = useRef<HTMLButtonElement>(null);
  const tooltipTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get description - handle both persona and style types
  const description = profile.description ||
    ('style_prompt' in profile ? (profile as StyleDefinition).style_prompt?.substring(0, 100) : '') ||
    'No description';

  // Show tooltip after hover delay
  const showTooltip = (e: MouseEvent | TouchEvent) => {
    if (tooltipTimeout.current) {
      clearTimeout(tooltipTimeout.current);
    }

    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Position tooltip above the card
    const x = rect.left + rect.width / 2;
    const y = rect.top - 8;

    tooltipTimeout.current = setTimeout(() => {
      setTooltipState({
        visible: true,
        content: description,
        x,
        y,
      });
    }, 300); // 300ms delay before showing
  };

  const hideTooltip = () => {
    if (tooltipTimeout.current) {
      clearTimeout(tooltipTimeout.current);
      tooltipTimeout.current = null;
    }
    setTooltipState(prev => ({ ...prev, visible: false }));
  };

  // Handle touch - show tooltip on long press
  const handleTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0];
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;

    tooltipTimeout.current = setTimeout(() => {
      setTooltipState({
        visible: true,
        content: description,
        x: touch.clientX,
        y: rect.top - 8,
      });
    }, 500); // Longer delay for touch
  };

  const handleTouchEnd = () => {
    hideTooltip();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (tooltipTimeout.current) {
        clearTimeout(tooltipTimeout.current);
      }
    };
  }, []);

  return (
    <>
      <button
        ref={cardRef}
        className={`profile-card ${selected ? 'profile-card--selected' : ''}`}
        onClick={() => onSelect(profile)}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        disabled={disabled}
        title={description}
      >
        <span className="profile-card__icon">{profile.icon || '◐'}</span>
        <span className="profile-card__name">{profile.name}</span>
      </button>
      <ProfileTooltip state={tooltipState} />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PROFILE CARDS CONTAINER (Horizontal Scroll)
// ═══════════════════════════════════════════════════════════════════

export function ProfileCardsContainer<T extends PersonaDefinition | StyleDefinition>({
  profiles,
  selectedName,
  onSelect,
  disabled,
  showAllProfiles = true,
  onToggleShowAll,
  hiddenProfiles = new Set(),
  type,
}: ProfileCardsContainerProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Filter profiles based on visibility
  const visibleProfiles = showAllProfiles
    ? profiles
    : profiles.filter(p => !hiddenProfiles.has(p.name));

  // Check scroll state
  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;

    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
    }
    return () => {
      if (el) {
        el.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      }
    };
  }, [profiles, showAllProfiles]);

  // Scroll helpers
  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;

    const scrollAmount = el.clientWidth * 0.8;
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  const hiddenCount = profiles.length - visibleProfiles.length;

  return (
    <div className="profile-cards">
      {/* Scroll indicator left */}
      {canScrollLeft && (
        <button
          className="profile-cards__scroll profile-cards__scroll--left"
          onClick={() => scroll('left')}
          aria-label="Scroll left"
        >
          ‹
        </button>
      )}

      {/* Cards container */}
      <div className="profile-cards__scroll-container" ref={scrollRef}>
        {visibleProfiles.map(profile => (
          <ProfileCard
            key={profile.name}
            profile={profile}
            selected={selectedName === profile.name}
            onSelect={onSelect}
            disabled={disabled}
          />
        ))}

        {/* Show more button if profiles are hidden */}
        {hiddenCount > 0 && onToggleShowAll && (
          <button
            className="profile-card profile-card--more"
            onClick={onToggleShowAll}
          >
            <span className="profile-card__icon">+{hiddenCount}</span>
            <span className="profile-card__name">More</span>
          </button>
        )}
      </div>

      {/* Scroll indicator right */}
      {canScrollRight && (
        <button
          className="profile-cards__scroll profile-cards__scroll--right"
          onClick={() => scroll('right')}
          aria-label="Scroll right"
        >
          ›
        </button>
      )}

      {/* Show all toggle */}
      {onToggleShowAll && profiles.length > 4 && (
        <div className="profile-cards__toggle">
          <button
            className="profile-cards__show-all"
            onClick={onToggleShowAll}
          >
            {showAllProfiles ? 'Show less' : `Show all (${profiles.length})`}
          </button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

export { ProfileCard };
export type { ProfileCardProps, ProfileCardsContainerProps };
