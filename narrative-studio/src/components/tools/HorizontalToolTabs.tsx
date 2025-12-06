/**
 * HorizontalToolTabs - Scrollable tab bar for tool selection
 *
 * Features:
 * - Horizontal scrolling with arrow buttons
 * - Click icon to jump directly to tool
 * - Visual indicator for active tool
 * - Tooltips showing tool names
 */

import { useRef, useState, useEffect, useMemo } from 'react';
import { useToolTabs, TOOL_REGISTRY, type ToolId } from '../../contexts/ToolTabContext';
import { useAuth } from '../../contexts/AuthContext';

interface HorizontalToolTabsProps {
  className?: string;
}

export function HorizontalToolTabs({ className = '' }: HorizontalToolTabsProps) {
  const { activeToolId, setActiveToolId, navigateNext, navigatePrev } = useToolTabs();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Filter tools based on user role (admin-profiles only visible to admins)
  const visibleTools = useMemo(() => {
    return TOOL_REGISTRY.filter(tool => {
      if (tool.id === 'admin-profiles') return isAdmin;
      return true;
    });
  }, [isAdmin]);

  // Check scroll state
  const checkScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    setCanScrollLeft(container.scrollLeft > 0);
    setCanScrollRight(
      container.scrollLeft < container.scrollWidth - container.clientWidth - 1
    );
  };

  useEffect(() => {
    checkScroll();
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
      return () => {
        container.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      };
    }
  }, []);

  // Scroll to make active tab visible
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const activeIndex = visibleTools.findIndex(t => t.id === activeToolId);
    const tabWidth = 48; // Icon button width + gap
    const scrollTarget = activeIndex * tabWidth - container.clientWidth / 2 + tabWidth / 2;

    container.scrollTo({
      left: Math.max(0, scrollTarget),
      behavior: 'smooth',
    });
  }, [activeToolId, visibleTools]);

  const scrollLeft = () => {
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollBy({ left: -96, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollBy({ left: 96, behavior: 'smooth' });
    }
  };

  const handleTabClick = (toolId: ToolId) => {
    setActiveToolId(toolId);
  };

  return (
    <div
      className={`tool-tabs-container ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '6px 8px',
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-secondary)',
      }}
    >
      {/* Left Arrow */}
      <button
        onClick={navigatePrev}
        className="tool-tab-arrow"
        title="Previous tool"
        style={{
          width: '22px',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-tertiary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          flexShrink: 0,
          fontSize: '14px',
          fontWeight: 600,
        }}
      >
        ‹
      </button>

      {/* Scrollable Tab Container */}
      <div
        ref={scrollContainerRef}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-xs)',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          flex: 1,
        }}
      >
        {visibleTools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => handleTabClick(tool.id)}
            title={tool.label}
            className={`tool-tab-icon ${activeToolId === tool.id ? 'active' : ''}`}
            style={{
              width: '34px',
              height: '34px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: activeToolId === tool.id
                ? 'var(--accent-primary)'
                : 'var(--bg-tertiary)',
              backgroundImage: activeToolId === tool.id
                ? 'var(--accent-primary-gradient)'
                : 'none',
              border: activeToolId === tool.id
                ? '2px solid var(--accent-primary)'
                : '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              color: activeToolId === tool.id
                ? 'var(--text-inverse)'
                : 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '1.1rem',
              transition: 'all 0.15s ease',
              flexShrink: 0,
              position: 'relative',
            }}
          >
            <span>{tool.icon}</span>
            {/* Active indicator dot */}
            {activeToolId === tool.id && (
              <span
                style={{
                  position: 'absolute',
                  bottom: '-6px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent-primary)',
                }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Right Arrow */}
      <button
        onClick={navigateNext}
        className="tool-tab-arrow"
        title="Next tool"
        style={{
          width: '22px',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-tertiary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          flexShrink: 0,
          fontSize: '14px',
          fontWeight: 600,
        }}
      >
        ›
      </button>
    </div>
  );
}

// Tool label bar (optional - shows current tool name)
export function ToolLabelBar() {
  const { activeToolId } = useToolTabs();
  const activeTool = TOOL_REGISTRY.find(t => t.id === activeToolId);

  if (!activeTool) return null;

  return (
    <div
      style={{
        padding: 'var(--space-sm) var(--space-md)',
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-panel)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
        <span style={{ fontSize: '1.125rem' }}>{activeTool.icon}</span>
        <span
          style={{
            fontSize: '0.875rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}
        >
          {activeTool.label}
        </span>
      </div>
      <p
        style={{
          margin: 'var(--space-xs) 0 0',
          fontSize: '0.75rem',
          color: 'var(--text-tertiary)',
        }}
      >
        {activeTool.description}
      </p>
    </div>
  );
}
