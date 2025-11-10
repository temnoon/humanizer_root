/**
 * Example Starters Component
 * Pre-written examples to inspire users and get them started quickly
 */

import React, { useState } from 'react';
import type { AttributeType, ExampleStarter } from './types';

interface ExampleStartersProps {
  type: AttributeType;
  onSelect: (prompt: string) => void;
  onCustomInput: (input: string) => void;
}

const EXAMPLE_STARTERS: ExampleStarter[] = [
  // Personas
  {
    type: 'persona',
    title: 'Victorian Naturalist',
    description: 'A curious explorer documenting discoveries with wonder',
    prompt: 'A Victorian naturalist explaining discoveries with childlike wonder and precise scientific detail',
    category: 'Historical'
  },
  {
    type: 'persona',
    title: 'Jazz Musician',
    description: 'Complex ideas through musical metaphors',
    prompt: 'A jazz musician who describes everything through improvisation and rhythm metaphors',
    category: 'Artistic'
  },
  {
    type: 'persona',
    title: 'Stoic Philosopher',
    description: 'Calm analysis through classical wisdom',
    prompt: 'A stoic philosopher analyzing situations with detachment and ancient wisdom',
    category: 'Philosophical'
  },
  {
    type: 'persona',
    title: 'Child Prodigy',
    description: 'Brilliant insights with innocent perspective',
    prompt: 'A 10-year-old genius who understands complex topics but explains them with childlike enthusiasm',
    category: 'Unique'
  },

  // Namespaces
  {
    type: 'namespace',
    title: 'Quantum Mechanics',
    description: 'Superposition, entanglement, and uncertainty',
    prompt: 'Quantum mechanics concepts like superposition, wave functions, and observer effects',
    category: 'Scientific'
  },
  {
    type: 'namespace',
    title: 'Culinary Arts',
    description: 'Flavors, techniques, and gastronomy',
    prompt: 'Culinary metaphors using cooking techniques, flavors, and kitchen chemistry',
    category: 'Artistic'
  },
  {
    type: 'namespace',
    title: 'Ocean Navigation',
    description: 'Tides, currents, and maritime wisdom',
    prompt: 'Maritime navigation using stars, tides, currents, and seafaring traditions',
    category: 'Adventure'
  },
  {
    type: 'namespace',
    title: 'Garden Ecology',
    description: 'Growth, seasons, and natural cycles',
    prompt: 'Garden ecosystem metaphors with plant growth, seasonal changes, and symbiotic relationships',
    category: 'Nature'
  },

  // Styles
  {
    type: 'style',
    title: 'Hemingway Brevity',
    description: 'Short sentences. Clear meaning.',
    prompt: 'Ernest Hemingway style with short, declarative sentences and no unnecessary words',
    category: 'Literary'
  },
  {
    type: 'style',
    title: 'Stream of Consciousness',
    description: 'Flowing thoughts without interruption',
    prompt: 'Stream of consciousness style like Virginia Woolf with flowing, uninterrupted thoughts',
    category: 'Literary'
  },
  {
    type: 'style',
    title: 'Academic Precision',
    description: 'Formal, cited, thoroughly explained',
    prompt: 'Academic writing with precise terminology, citations, and structured argumentation',
    category: 'Formal'
  },
  {
    type: 'style',
    title: 'Beat Poetry',
    description: 'Raw, rhythmic, spontaneous',
    prompt: 'Beat generation poetry style with raw emotion, jazz rhythms, and spontaneous expression',
    category: 'Artistic'
  },

  // Voices
  {
    type: 'voice',
    title: 'Wise Grandmother',
    description: 'Warm stories with hidden lessons',
    prompt: 'A wise grandmother sharing life lessons through warm personal stories',
    category: 'Personal'
  },
  {
    type: 'voice',
    title: 'Tech Startup Founder',
    description: 'Disrupting paradigms with enthusiasm',
    prompt: 'A tech startup founder disrupting industries and pivoting paradigms with infectious enthusiasm',
    category: 'Professional'
  },
  {
    type: 'voice',
    title: 'Nature Documentary',
    description: 'David Attenborough-style observation',
    prompt: 'David Attenborough narrating the hidden dramas of everyday life',
    category: 'Documentary'
  },
  {
    type: 'voice',
    title: 'Film Noir Detective',
    description: 'Cynical observations in shadowy prose',
    prompt: 'A 1940s private detective narrating with cynical observations and shadowy metaphors',
    category: 'Genre'
  }
];

export const ExampleStarters: React.FC<ExampleStartersProps> = ({
  type,
  onSelect,
  onCustomInput,
}) => {
  const [customInput, setCustomInput] = useState('');

  const examples = EXAMPLE_STARTERS.filter(ex => ex.type === type);
  const categories = [...new Set(examples.map(ex => ex.category))];

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customInput.trim()) {
      onCustomInput(customInput.trim());
      setCustomInput('');
    }
  };

  return (
    <div className="h-full flex flex-col p-6">
      {/* Custom Input */}
      <form onSubmit={handleCustomSubmit} className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Describe your {type} idea:
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder={`e.g., "A ${type === 'persona' ? 'wise old tree that has seen centuries pass' :
                         type === 'namespace' ? 'world of dreams and subconscious symbols' :
                         type === 'style' ? 'poetic but technical writing style' :
                         'sarcastic teenager from the future'}"`}
            className="flex-1 bg-gray-800 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={!customInput.trim()}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              customInput.trim()
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            Create
          </button>
        </div>
      </form>

      {/* Divider */}
      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-700"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-3 bg-gray-900 text-gray-500">Or start with an example</span>
        </div>
      </div>

      {/* Example Grid */}
      <div className="flex-1 overflow-y-auto">
        {categories.map(category => (
          <div key={category} className="mb-6">
            <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
              {category}
            </h4>
            <div className="grid grid-cols-1 gap-3">
              {examples
                .filter(ex => ex.category === category)
                .map((example, index) => (
                  <button
                    key={index}
                    onClick={() => onSelect(example.prompt)}
                    className="text-left p-4 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors group"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h5 className="font-medium text-white group-hover:text-blue-400 transition-colors">
                          {example.title}
                        </h5>
                        <p className="text-sm text-gray-400 mt-1">
                          {example.description}
                        </p>
                      </div>
                      <svg className="w-5 h-5 text-gray-600 group-hover:text-blue-400 transition-colors mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};