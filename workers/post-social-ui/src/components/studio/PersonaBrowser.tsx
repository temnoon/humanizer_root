/**
 * PersonaBrowser - Browse and select personas for transformation
 *
 * Features:
 * - Browse mode: View global and personal personas
 * - Create mode: Extract personas from Gutenberg books
 * - Filter/search personas
 * - Click to select for transformation
 */

import { Component, createSignal, createResource, Show, For, createEffect } from 'solid-js';
import { authStore } from '@/stores/auth';
import {
  personasService,
  type Persona,
  type GutenbergBook,
  type GutenbergBookPreview,
  type ExtractedPersona,
} from '@/services/personas';

interface PersonaBrowserProps {
  selectedPersona: string;
  onSelectPersona: (persona: string) => void;
  onClose?: () => void;
}

type ViewMode = 'browse' | 'gutenberg';
type GutenbergTab = 'search' | 'direct';

export const PersonaBrowser: Component<PersonaBrowserProps> = (props) => {
  // View state
  const [viewMode, setViewMode] = createSignal<ViewMode>('browse');
  const [filterText, setFilterText] = createSignal('');

  // Gutenberg state
  const [gutenbergTab, setGutenbergTab] = createSignal<GutenbergTab>('search');
  const [searchQuery, setSearchQuery] = createSignal('');
  const [directInput, setDirectInput] = createSignal('');
  const [searchResults, setSearchResults] = createSignal<GutenbergBook[]>([]);
  const [selectedBook, setSelectedBook] = createSignal<GutenbergBookPreview | null>(null);
  const [customName, setCustomName] = createSignal('');
  const [isSearching, setIsSearching] = createSignal(false);
  const [isFetchingBook, setIsFetchingBook] = createSignal(false);
  const [isExtracting, setIsExtracting] = createSignal(false);
  const [extractedPersona, setExtractedPersona] = createSignal<ExtractedPersona | null>(null);
  const [error, setError] = createSignal<string | null>(null);

  // Fetch personas
  const [personas] = createResource(async () => {
    try {
      const token = authStore.token();
      return await personasService.getAllPersonas(token || undefined);
    } catch (err) {
      console.error('Failed to load personas:', err);
      return { global: [], personal: [] };
    }
  });

  // Filtered personas
  const filteredPersonas = () => {
    const filter = filterText().toLowerCase();
    const data = personas();
    if (!data) return { global: [], personal: [] };

    const filterFn = (p: Persona) =>
      !filter ||
      p.name.toLowerCase().includes(filter) ||
      p.description.toLowerCase().includes(filter);

    return {
      global: data.global.filter(filterFn),
      personal: data.personal.filter(filterFn),
    };
  };

  // Search Gutenberg
  const handleSearch = async () => {
    const query = searchQuery().trim();
    if (query.length < 2) return;

    setIsSearching(true);
    setError(null);
    setSelectedBook(null);

    try {
      const results = await personasService.searchGutenberg(query);
      setSearchResults(results.books);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  // Fetch book by ID
  const handleFetchBook = async (bookIdOrUrl: string | number) => {
    setIsFetchingBook(true);
    setError(null);

    try {
      const preview = await personasService.getGutenbergBook(bookIdOrUrl);
      setSelectedBook(preview);
      setCustomName(`${preview.authors[0]?.split(' ')[0] || 'Author'} (${preview.title.split(' ').slice(0, 2).join(' ')})`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch book');
    } finally {
      setIsFetchingBook(false);
    }
  };

  // Extract persona
  const handleExtractPersona = async () => {
    const book = selectedBook();
    if (!book) return;

    const token = authStore.token();
    if (!token) {
      setError('Please log in to create personas');
      return;
    }

    setIsExtracting(true);
    setError(null);

    try {
      const result = await personasService.extractPersonaFromGutenberg(
        book.id,
        customName() || undefined,
        token
      );
      setExtractedPersona(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction failed');
    } finally {
      setIsExtracting(false);
    }
  };

  // Use extracted persona
  const handleUseExtracted = () => {
    const extracted = extractedPersona();
    if (extracted) {
      props.onSelectPersona(extracted.name);
      // Reset state
      setExtractedPersona(null);
      setSelectedBook(null);
      setViewMode('browse');
    }
  };

  return (
    <div class="persona-browser">
      {/* Mode Toggle */}
      <div class="persona-browser-tabs">
        <button
          class={`browser-tab ${viewMode() === 'browse' ? 'active' : ''}`}
          onClick={() => setViewMode('browse')}
        >
          Browse Personas
        </button>
        <button
          class={`browser-tab ${viewMode() === 'gutenberg' ? 'active' : ''}`}
          onClick={() => setViewMode('gutenberg')}
        >
          + From Gutenberg
        </button>
      </div>

      {/* Error Display */}
      <Show when={error()}>
        <div class="persona-browser-error">{error()}</div>
      </Show>

      {/* Browse Mode */}
      <Show when={viewMode() === 'browse'}>
        <div class="persona-browser-browse">
          {/* Filter Input */}
          <div class="persona-filter">
            <input
              type="text"
              placeholder="Filter personas..."
              value={filterText()}
              onInput={(e) => setFilterText(e.currentTarget.value)}
            />
          </div>

          {/* Persona Lists */}
          <div class="persona-lists">
            {/* Global Personas */}
            <Show when={filteredPersonas().global.length > 0}>
              <div class="persona-section">
                <div class="persona-section-header">Global Personas</div>
                <For each={filteredPersonas().global}>
                  {(persona) => (
                    <button
                      class={`persona-card ${props.selectedPersona === persona.name ? 'selected' : ''}`}
                      onClick={() => props.onSelectPersona(persona.name)}
                    >
                      <span class="persona-name">{persona.name}</span>
                      <span class="persona-description">{persona.description}</span>
                    </button>
                  )}
                </For>
              </div>
            </Show>

            {/* Personal Personas */}
            <Show when={filteredPersonas().personal.length > 0}>
              <div class="persona-section">
                <div class="persona-section-header">My Personas</div>
                <For each={filteredPersonas().personal}>
                  {(persona) => (
                    <button
                      class={`persona-card ${props.selectedPersona === persona.name ? 'selected' : ''}`}
                      onClick={() => props.onSelectPersona(persona.name)}
                    >
                      <span class="persona-name">{persona.name}</span>
                      <span class="persona-description">{persona.description}</span>
                      <Show when={persona.sourceInfo?.bookTitle}>
                        <span class="persona-source">From: {persona.sourceInfo?.bookTitle}</span>
                      </Show>
                    </button>
                  )}
                </For>
              </div>
            </Show>

            {/* Empty State */}
            <Show when={!personas.loading && filteredPersonas().global.length === 0 && filteredPersonas().personal.length === 0}>
              <div class="persona-empty">
                No personas found. Create one from a Gutenberg book!
              </div>
            </Show>
          </div>
        </div>
      </Show>

      {/* Gutenberg Mode */}
      <Show when={viewMode() === 'gutenberg'}>
        <div class="persona-browser-gutenberg">
          {/* Show Extracted Persona Result */}
          <Show when={extractedPersona()}>
            <div class="extracted-persona-result">
              <h4>Persona Extracted!</h4>
              <div class="extracted-persona-card">
                <div class="extracted-name">{extractedPersona()!.name}</div>
                <div class="extracted-description">{extractedPersona()!.description}</div>
                <div class="extracted-attributes">
                  <div><strong>Voice:</strong> {extractedPersona()!.attributes.voice}</div>
                  <div><strong>Tone:</strong> {extractedPersona()!.attributes.tone}</div>
                  <div><strong>Perspective:</strong> {extractedPersona()!.attributes.perspective}</div>
                </div>
              </div>
              <div class="extracted-actions">
                <button class="btn-primary" onClick={handleUseExtracted}>
                  Use This Persona
                </button>
                <button class="btn-secondary" onClick={() => setExtractedPersona(null)}>
                  Extract Another
                </button>
              </div>
            </div>
          </Show>

          {/* Book Selection UI */}
          <Show when={!extractedPersona()}>
            {/* Gutenberg Tabs */}
            <div class="gutenberg-tabs">
              <button
                class={`gutenberg-tab ${gutenbergTab() === 'search' ? 'active' : ''}`}
                onClick={() => setGutenbergTab('search')}
              >
                Search
              </button>
              <button
                class={`gutenberg-tab ${gutenbergTab() === 'direct' ? 'active' : ''}`}
                onClick={() => setGutenbergTab('direct')}
              >
                By ID/URL
              </button>
            </div>

            {/* Search Tab */}
            <Show when={gutenbergTab() === 'search'}>
              <div class="gutenberg-search">
                <div class="search-input-row">
                  <input
                    type="text"
                    placeholder="Search by title or author..."
                    value={searchQuery()}
                    onInput={(e) => setSearchQuery(e.currentTarget.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <button
                    onClick={handleSearch}
                    disabled={isSearching() || searchQuery().length < 2}
                  >
                    {isSearching() ? 'Searching...' : 'Search'}
                  </button>
                </div>

                {/* Search Results */}
                <div class="search-results">
                  <For each={searchResults()}>
                    {(book) => (
                      <button
                        class="book-card"
                        onClick={() => handleFetchBook(book.id)}
                        disabled={isFetchingBook()}
                      >
                        <span class="book-title">{book.title}</span>
                        <span class="book-author">{book.authors.join(', ')}</span>
                        <span class="book-downloads">{book.downloadCount.toLocaleString()} downloads</span>
                      </button>
                    )}
                  </For>
                </div>
              </div>
            </Show>

            {/* Direct Input Tab */}
            <Show when={gutenbergTab() === 'direct'}>
              <div class="gutenberg-direct">
                <p class="direct-hint">
                  Enter a Gutenberg book ID or URL (e.g., "1342" or "gutenberg.org/ebooks/1342")
                </p>
                <div class="direct-input-row">
                  <input
                    type="text"
                    placeholder="Book ID or URL..."
                    value={directInput()}
                    onInput={(e) => setDirectInput(e.currentTarget.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleFetchBook(directInput())}
                  />
                  <button
                    onClick={() => handleFetchBook(directInput())}
                    disabled={isFetchingBook() || !directInput().trim()}
                  >
                    {isFetchingBook() ? 'Fetching...' : 'Fetch Book'}
                  </button>
                </div>
              </div>
            </Show>

            {/* Selected Book Preview */}
            <Show when={selectedBook()}>
              <div class="book-preview">
                <div class="book-preview-header">
                  <h4>{selectedBook()!.title}</h4>
                  <p class="book-preview-author">{selectedBook()!.authors.join(', ')}</p>
                </div>
                <div class="book-preview-sample">
                  <div class="sample-label">Sample Text ({selectedBook()!.sampleLength.toLocaleString()} chars)</div>
                  <div class="sample-text">{selectedBook()!.sampleText.substring(0, 500)}...</div>
                </div>
                <div class="book-preview-actions">
                  <div class="custom-name-input">
                    <label>Persona Name (optional):</label>
                    <input
                      type="text"
                      placeholder="e.g., Austen (Witty)"
                      value={customName()}
                      onInput={(e) => setCustomName(e.currentTarget.value)}
                    />
                  </div>
                  <button
                    class="btn-primary"
                    onClick={handleExtractPersona}
                    disabled={isExtracting()}
                  >
                    {isExtracting() ? 'Extracting Persona...' : 'Extract Persona'}
                  </button>
                </div>
              </div>
            </Show>
          </Show>
        </div>
      </Show>
    </div>
  );
};
