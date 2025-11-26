/**
 * Lightbox - Media Viewer Overlay
 * 
 * Full-screen overlay for viewing:
 * - Images
 * - PDFs
 * - Videos
 * - Code snippets
 * 
 * Supports keyboard navigation and zoom.
 */

import { Component, createSignal, createEffect, Show, onMount, onCleanup } from 'solid-js';

export interface LightboxItem {
  type: 'image' | 'pdf' | 'video' | 'code';
  src: string;
  alt?: string;
  title?: string;
  caption?: string;
  language?: string; // for code
}

interface LightboxProps {
  item: LightboxItem | null;
  items?: LightboxItem[]; // for gallery navigation
  currentIndex?: number;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
}

export const Lightbox: Component<LightboxProps> = (props) => {
  const [zoom, setZoom] = createSignal(1);
  const [position, setPosition] = createSignal({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = createSignal(false);
  const [dragStart, setDragStart] = createSignal({ x: 0, y: 0 });
  const [isLoading, setIsLoading] = createSignal(true);
  
  // Keyboard navigation
  const handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'Escape':
        props.onClose();
        break;
      case 'ArrowRight':
        props.onNext?.();
        break;
      case 'ArrowLeft':
        props.onPrev?.();
        break;
      case '+':
      case '=':
        setZoom(z => Math.min(3, z + 0.25));
        break;
      case '-':
        setZoom(z => Math.max(0.5, z - 0.25));
        break;
      case '0':
        setZoom(1);
        setPosition({ x: 0, y: 0 });
        break;
    }
  };
  
  onMount(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
  });
  
  onCleanup(() => {
    document.removeEventListener('keydown', handleKeyDown);
    document.body.style.overflow = '';
  });
  
  // Reset on item change
  createEffect(() => {
    if (props.item) {
      setZoom(1);
      setPosition({ x: 0, y: 0 });
      setIsLoading(true);
    }
  });
  
  // Drag to pan when zoomed
  const handleMouseDown = (e: MouseEvent) => {
    if (zoom() > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position().x, y: e.clientY - position().y });
    }
  };
  
  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging()) {
      setPosition({
        x: e.clientX - dragStart().x,
        y: e.clientY - dragStart().y
      });
    }
  };
  
  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  // Wheel to zoom
  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(z => Math.min(3, Math.max(0.5, z + delta)));
  };
  
  const hasNavigation = () => props.items && props.items.length > 1;
  
  return (
    <Show when={props.item}>
      <div 
        class="lightbox-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget) props.onClose();
        }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Close Button */}
        <button class="lightbox-close" onClick={props.onClose}>
          ×
        </button>
        
        {/* Navigation */}
        <Show when={hasNavigation()}>
          <button 
            class="lightbox-nav prev"
            onClick={props.onPrev}
            disabled={props.currentIndex === 0}
          >
            ‹
          </button>
          <button 
            class="lightbox-nav next"
            onClick={props.onNext}
            disabled={props.currentIndex === (props.items?.length || 0) - 1}
          >
            ›
          </button>
        </Show>
        
        {/* Content */}
        <div 
          class="lightbox-content"
          onMouseDown={handleMouseDown}
          onWheel={handleWheel}
          style={{
            transform: `translate(${position().x}px, ${position().y}px) scale(${zoom()})`,
            cursor: zoom() > 1 ? (isDragging() ? 'grabbing' : 'grab') : 'default'
          }}
        >
          {/* Image */}
          <Show when={props.item!.type === 'image'}>
            <Show when={isLoading()}>
              <div class="lightbox-loading">Loading...</div>
            </Show>
            <img 
              src={props.item!.src}
              alt={props.item!.alt || ''}
              class="lightbox-image"
              onLoad={() => setIsLoading(false)}
              style={{ opacity: isLoading() ? 0 : 1 }}
            />
          </Show>
          
          {/* Video */}
          <Show when={props.item!.type === 'video'}>
            <video
              src={props.item!.src}
              controls
              autoplay
              class="lightbox-video"
            />
          </Show>
          
          {/* PDF */}
          <Show when={props.item!.type === 'pdf'}>
            <iframe
              src={props.item!.src}
              class="lightbox-pdf"
              title={props.item!.title || 'PDF Document'}
            />
          </Show>
          
          {/* Code */}
          <Show when={props.item!.type === 'code'}>
            <pre class="lightbox-code">
              <code class={`language-${props.item!.language || 'text'}`}>
                {props.item!.src}
              </code>
            </pre>
          </Show>
        </div>
        
        {/* Footer */}
        <div class="lightbox-footer">
          <Show when={props.item!.title || props.item!.caption}>
            <div class="lightbox-info">
              <Show when={props.item!.title}>
                <h4 class="lightbox-title">{props.item!.title}</h4>
              </Show>
              <Show when={props.item!.caption}>
                <p class="lightbox-caption">{props.item!.caption}</p>
              </Show>
            </div>
          </Show>
          
          {/* Zoom Controls */}
          <div class="lightbox-controls">
            <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}>−</button>
            <span class="zoom-level">{Math.round(zoom() * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(3, z + 0.25))}>+</button>
            <button onClick={() => { setZoom(1); setPosition({ x: 0, y: 0 }); }}>Reset</button>
          </div>
          
          {/* Counter */}
          <Show when={hasNavigation()}>
            <div class="lightbox-counter">
              {(props.currentIndex || 0) + 1} / {props.items?.length}
            </div>
          </Show>
        </div>
      </div>
    </Show>
  );
};

// Export singleton state for global lightbox access
import { createSignal as createGlobalSignal } from 'solid-js';

const [lightboxState, setLightboxState] = createGlobalSignal<{
  items: LightboxItem[];
  currentIndex: number;
} | null>(null);

export const openLightbox = (item: LightboxItem | LightboxItem[], startIndex = 0) => {
  const items = Array.isArray(item) ? item : [item];
  setLightboxState({ items, currentIndex: startIndex });
};

export const closeLightbox = () => {
  setLightboxState(null);
};

export const useLightbox = () => ({
  state: lightboxState,
  open: openLightbox,
  close: closeLightbox,
  next: () => {
    const state = lightboxState();
    if (state && state.currentIndex < state.items.length - 1) {
      setLightboxState({ ...state, currentIndex: state.currentIndex + 1 });
    }
  },
  prev: () => {
    const state = lightboxState();
    if (state && state.currentIndex > 0) {
      setLightboxState({ ...state, currentIndex: state.currentIndex - 1 });
    }
  }
});
