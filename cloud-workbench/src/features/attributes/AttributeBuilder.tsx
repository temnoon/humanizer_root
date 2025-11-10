/**
 * Attribute Builder Component
 * Main conversational UI for creating custom personas, namespaces, styles, and voices
 * through natural language dialogue with LLMs.
 */

import React, { useState, useCallback } from 'react';
import type { AttributeType, AttributeDefinition } from './types';
import { DialoguePanel } from './DialoguePanel';
import { AttributePreview } from './AttributePreview';
import { ExampleStarters } from './ExampleStarters';
import { useAttributeExtraction } from './useAttributeExtraction';

interface AttributeBuilderProps {
  type: AttributeType;
  onComplete: (definition: AttributeDefinition) => void;
  onCancel: () => void;
}

export const AttributeBuilder: React.FC<AttributeBuilderProps> = ({
  type,
  onComplete,
  onCancel,
}) => {
  const [showExamples, setShowExamples] = useState(true);
  const [currentDefinition, setCurrentDefinition] = useState<AttributeDefinition | null>(null);
  const [dialogueId, setDialogueId] = useState<string | null>(null);

  const {
    messages,
    isLoading,
    extract,
    refine,
    reset,
  } = useAttributeExtraction();

  const handleStarterSelect = useCallback((prompt: string) => {
    setShowExamples(false);
    extract(type, prompt);
  }, [type, extract]);

  const handleUserInput = useCallback((input: string) => {
    if (dialogueId) {
      refine(dialogueId, input);
    } else {
      extract(type, input);
    }
  }, [type, dialogueId, extract, refine]);

  const handleDefinitionReceived = useCallback((definition: AttributeDefinition, id?: string) => {
    setCurrentDefinition(definition);
    if (id) {
      setDialogueId(id);
    }
  }, []);

  const handleSave = useCallback(() => {
    if (currentDefinition) {
      onComplete(currentDefinition);
    }
  }, [currentDefinition, onComplete]);

  const handleStartOver = useCallback(() => {
    reset();
    setCurrentDefinition(null);
    setDialogueId(null);
    setShowExamples(true);
  }, [reset]);

  const getTypeLabel = () => {
    switch (type) {
      case 'persona': return 'Persona';
      case 'namespace': return 'Namespace';
      case 'style': return 'Style';
      case 'voice': return 'Voice';
      default: return 'Attribute';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">
              Create Custom {getTypeLabel()}
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Describe what you have in mind, and I'll help you create it
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-500 hover:text-white transition-colors"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Chat or Examples */}
          <div className="flex-1 flex flex-col border-r border-gray-800">
            {showExamples && messages.length === 0 ? (
              <ExampleStarters
                type={type}
                onSelect={handleStarterSelect}
                onCustomInput={handleStarterSelect}
              />
            ) : (
              <DialoguePanel
                messages={messages}
                isLoading={isLoading}
                onSendMessage={handleUserInput}
                onDefinitionReceived={handleDefinitionReceived}
              />
            )}
          </div>

          {/* Right Panel - Preview */}
          {currentDefinition && (
            <div className="w-96 flex flex-col">
              <AttributePreview
                definition={currentDefinition}
                type={type}
                onSave={handleSave}
                onEdit={() => {/* TODO: Implement inline editing */}}
                onStartOver={handleStartOver}
              />
            </div>
          )}
        </div>

        {/* Footer Status Bar */}
        {isLoading && (
          <div className="px-6 py-2 border-t border-gray-800 bg-gray-950">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              <span className="text-sm text-gray-400">AI is thinking...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};