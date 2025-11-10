/**
 * Attribute Preview Component
 * Shows the extracted/refined attribute definition with actions
 */

import React, { useState } from 'react';
import type { AttributeDefinition, AttributeType } from './types';

interface AttributePreviewProps {
  definition: AttributeDefinition;
  type: AttributeType;
  onSave: () => void;
  onEdit: () => void;
  onStartOver: () => void;
}

export const AttributePreview: React.FC<AttributePreviewProps> = ({
  definition,
  type,
  onSave,
  onEdit,
  onStartOver,
}) => {
  const [showExample, setShowExample] = useState(false);
  const [exampleText, setExampleText] = useState('');

  const getPromptField = () => {
    switch (type) {
      case 'persona':
      case 'voice':
        return { label: 'System Prompt', value: definition.systemPrompt };
      case 'namespace':
        return { label: 'Context Prompt', value: definition.contextPrompt };
      case 'style':
        return { label: 'Style Prompt', value: definition.stylePrompt };
      default:
        return null;
    }
  };

  const promptField = getPromptField();

  return (
    <div className="h-full flex flex-col p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Preview</h3>

      {/* Definition Details */}
      <div className="flex-1 overflow-y-auto space-y-4">
        {/* Name */}
        <div>
          <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Name</label>
          <p className="mt-1 text-white font-medium">{definition.name}</p>
        </div>

        {/* Description */}
        <div>
          <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Description</label>
          <p className="mt-1 text-gray-300">{definition.description}</p>
        </div>

        {/* Prompt Field */}
        {promptField && promptField.value && (
          <div>
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              {promptField.label}
            </label>
            <div className="mt-1 bg-gray-800 rounded-lg p-3">
              <p className="text-gray-300 text-sm font-mono whitespace-pre-wrap">
                {promptField.value}
              </p>
            </div>
          </div>
        )}

        {/* Examples */}
        {definition.examples && definition.examples.length > 0 && (
          <div>
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Examples</label>
            <div className="mt-1 space-y-2">
              {definition.examples.map((example, index) => (
                <div key={index} className="bg-gray-800 rounded-lg p-3">
                  <p className="text-gray-300 text-sm italic">"{example}"</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        {definition.tags && definition.tags.length > 0 && (
          <div>
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Tags</label>
            <div className="mt-1 flex flex-wrap gap-2">
              {definition.tags.map((tag, index) => (
                <span
                  key={index}
                  className="px-2 py-1 bg-gray-800 text-gray-300 text-xs rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Category */}
        {definition.category && (
          <div>
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Category</label>
            <p className="mt-1 text-gray-300">{definition.category}</p>
          </div>
        )}

        {/* Example Generation */}
        <div className="border-t border-gray-800 pt-4">
          <button
            onClick={() => setShowExample(!showExample)}
            className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
          >
            {showExample ? 'Hide' : 'Show'} Example Output
          </button>

          {showExample && (
            <div className="mt-3">
              <textarea
                value={exampleText}
                onChange={(e) => setExampleText(e.target.value)}
                placeholder="Enter some text to see how this attribute would transform it..."
                className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
              <button
                onClick={() => {/* TODO: Generate example */}}
                className="mt-2 px-4 py-2 bg-gray-700 text-white rounded-lg text-sm hover:bg-gray-600 transition-colors"
              >
                Generate Example
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex flex-col gap-2">
        <button
          onClick={onSave}
          className="w-full px-4 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
        >
          Save & Use This {type.charAt(0).toUpperCase() + type.slice(1)}
        </button>
        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            Edit
          </button>
          <button
            onClick={onStartOver}
            className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            Start Over
          </button>
        </div>
      </div>
    </div>
  );
};