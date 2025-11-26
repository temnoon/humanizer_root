/**
 * Project Gutenberg Service
 * 
 * Provides access to the entire Project Gutenberg catalog via the Gutendex API.
 * Organized hierarchically for efficient browsing in the archive panel.
 * 
 * API: https://gutendex.com/
 * ~70,000 public domain books
 */

export interface GutenbergAuthor {
  name: string;
  birth_year: number | null;
  death_year: number | null;
}

export interface GutenbergBook {
  id: number;
  title: string;
  authors: GutenbergAuthor[];
  subjects: string[];
  bookshelves: string[];
  languages: string[];
  copyright: boolean;
  media_type: string;
  download_count: number;
  formats: Record<string, string>;
}

export interface GutenbergResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: GutenbergBook[];
}

// Hierarchical category structure for efficient browsing
export interface GutenbergCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  topic?: string;        // For gutendex topic search
  bookshelf?: string;    // For specific bookshelf
  count?: number;
  children?: GutenbergCategory[];
}

// Main categories for the archive panel
export const GUTENBERG_CATEGORIES: GutenbergCategory[] = [
  {
    id: 'philosophy',
    name: 'Philosophy',
    icon: '🎭',
    description: 'Western & Eastern philosophical works',
    children: [
      { id: 'phil-western', name: 'Western Philosophy', icon: '📜', description: '', topic: 'philosophy western' },
      { id: 'phil-eastern', name: 'Eastern Philosophy', icon: '☯️', description: '', topic: 'philosophy eastern' },
      { id: 'phil-ethics', name: 'Ethics & Morality', icon: '⚖️', description: '', topic: 'ethics morality' },
      { id: 'phil-metaphysics', name: 'Metaphysics', icon: '🌌', description: '', topic: 'metaphysics' },
      { id: 'phil-logic', name: 'Logic & Epistemology', icon: '🧠', description: '', topic: 'logic epistemology' },
    ]
  },
  {
    id: 'literature',
    name: 'Literature',
    icon: '📚',
    description: 'Fiction, poetry, and drama',
    children: [
      { id: 'lit-fiction', name: 'Fiction', icon: '📖', description: '', topic: 'fiction' },
      { id: 'lit-poetry', name: 'Poetry', icon: '🎵', description: '', topic: 'poetry' },
      { id: 'lit-drama', name: 'Drama', icon: '🎭', description: '', topic: 'drama plays' },
      { id: 'lit-essays', name: 'Essays & Letters', icon: '✉️', description: '', topic: 'essays letters' },
      { id: 'lit-classics', name: 'Classics', icon: '🏛️', description: '', bookshelf: 'Classics' },
    ]
  },
  {
    id: 'science',
    name: 'Science',
    icon: '🔬',
    description: 'Natural philosophy and scientific works',
    children: [
      { id: 'sci-physics', name: 'Physics', icon: '⚛️', description: '', topic: 'physics' },
      { id: 'sci-biology', name: 'Biology', icon: '🧬', description: '', topic: 'biology natural history' },
      { id: 'sci-astronomy', name: 'Astronomy', icon: '🔭', description: '', topic: 'astronomy' },
      { id: 'sci-chemistry', name: 'Chemistry', icon: '⚗️', description: '', topic: 'chemistry' },
      { id: 'sci-math', name: 'Mathematics', icon: '📐', description: '', topic: 'mathematics' },
    ]
  },
  {
    id: 'psychology',
    name: 'Psychology',
    icon: '🧠',
    description: 'Mind, consciousness, and human behavior',
    children: [
      { id: 'psych-mind', name: 'Mind & Consciousness', icon: '💭', description: '', topic: 'psychology consciousness' },
      { id: 'psych-behavior', name: 'Human Behavior', icon: '🎯', description: '', topic: 'psychology behavior' },
      { id: 'psych-dreams', name: 'Dreams & Symbolism', icon: '🌙', description: '', topic: 'dreams psychology' },
    ]
  },
  {
    id: 'religion',
    name: 'Religion & Spirituality',
    icon: '🕊️',
    description: 'Sacred texts and spiritual traditions',
    children: [
      { id: 'rel-christianity', name: 'Christianity', icon: '✝️', description: '', topic: 'christianity bible' },
      { id: 'rel-buddhism', name: 'Buddhism', icon: '☸️', description: '', topic: 'buddhism' },
      { id: 'rel-hinduism', name: 'Hinduism', icon: '🕉️', description: '', topic: 'hinduism vedas' },
      { id: 'rel-islam', name: 'Islam', icon: '☪️', description: '', topic: 'islam quran' },
      { id: 'rel-mysticism', name: 'Mysticism', icon: '✨', description: '', topic: 'mysticism spirituality' },
    ]
  },
  {
    id: 'history',
    name: 'History',
    icon: '📜',
    description: 'Historical accounts and biographies',
    children: [
      { id: 'hist-ancient', name: 'Ancient World', icon: '🏛️', description: '', topic: 'ancient history greece rome' },
      { id: 'hist-medieval', name: 'Medieval', icon: '⚔️', description: '', topic: 'medieval history' },
      { id: 'hist-modern', name: 'Modern History', icon: '🌍', description: '', topic: 'modern history' },
      { id: 'hist-biography', name: 'Biography', icon: '👤', description: '', topic: 'biography' },
    ]
  },
  {
    id: 'authors',
    name: 'By Author',
    icon: '✍️',
    description: 'Browse by notable authors',
    children: [
      { id: 'auth-plato', name: 'Plato', icon: '📜', description: '', topic: 'plato' },
      { id: 'auth-aristotle', name: 'Aristotle', icon: '📜', description: '', topic: 'aristotle' },
      { id: 'auth-shakespeare', name: 'Shakespeare', icon: '🎭', description: '', topic: 'shakespeare' },
      { id: 'auth-nietzsche', name: 'Nietzsche', icon: '⚡', description: '', topic: 'nietzsche' },
      { id: 'auth-dostoevsky', name: 'Dostoevsky', icon: '📕', description: '', topic: 'dostoevsky' },
      { id: 'auth-kant', name: 'Kant', icon: '🔮', description: '', topic: 'kant' },
      { id: 'auth-hegel', name: 'Hegel', icon: '♾️', description: '', topic: 'hegel' },
      { id: 'auth-james', name: 'William James', icon: '🧠', description: '', topic: 'william james' },
    ]
  },
];

const GUTENDEX_BASE = 'https://gutendex.com';

class GutenbergService {
  private cache = new Map<string, { data: GutenbergResponse; timestamp: number }>();
  private CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Search books by topic/subject
   */
  async searchByTopic(topic: string, page = 1): Promise<GutenbergResponse> {
    const cacheKey = `topic:${topic}:${page}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    const url = `${GUTENDEX_BASE}/books?topic=${encodeURIComponent(topic)}&page=${page}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Gutenberg API error: ${response.status}`);
    }
    const data: GutenbergResponse = await response.json();
    
    this.cache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  }

  /**
   * Search books by title/author
   */
  async search(query: string, page = 1): Promise<GutenbergResponse> {
    const cacheKey = `search:${query}:${page}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    const url = `${GUTENDEX_BASE}/books?search=${encodeURIComponent(query)}&page=${page}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Gutenberg API error: ${response.status}`);
    }
    const data: GutenbergResponse = await response.json();
    
    this.cache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  }

  /**
   * Get a specific book by ID
   */
  async getBook(id: number): Promise<GutenbergBook> {
    const cacheKey = `book:${id}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data.results[0];
    }

    const url = `${GUTENDEX_BASE}/books/${id}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Gutenberg API error: ${response.status}`);
    }
    const data: GutenbergBook = await response.json();
    
    // Store in cache as fake response
    this.cache.set(cacheKey, { 
      data: { count: 1, next: null, previous: null, results: [data] }, 
      timestamp: Date.now() 
    });
    return data;
  }

  /**
   * Get popular books
   */
  async getPopular(page = 1): Promise<GutenbergResponse> {
    const cacheKey = `popular:${page}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    const url = `${GUTENDEX_BASE}/books?page=${page}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Gutenberg API error: ${response.status}`);
    }
    const data: GutenbergResponse = await response.json();
    
    this.cache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  }

  /**
   * Get the text content of a book (plain text format)
   */
  getTextUrl(book: GutenbergBook): string | null {
    const formats = book.formats;
    // Prefer plain text UTF-8
    return formats['text/plain; charset=utf-8'] 
      || formats['text/plain; charset=us-ascii']
      || formats['text/plain']
      || formats['text/html; charset=utf-8']
      || formats['text/html']
      || null;
  }

  /**
   * Get categories for the archive panel
   */
  getCategories(): GutenbergCategory[] {
    return GUTENBERG_CATEGORIES;
  }

  /**
   * Find a category by ID
   */
  findCategory(categoryId: string): GutenbergCategory | null {
    for (const cat of GUTENBERG_CATEGORIES) {
      if (cat.id === categoryId) return cat;
      if (cat.children) {
        const child = cat.children.find(c => c.id === categoryId);
        if (child) return child;
      }
    }
    return null;
  }
}

export const gutenbergService = new GutenbergService();
