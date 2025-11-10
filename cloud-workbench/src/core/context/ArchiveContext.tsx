import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  id?: string;
}

interface Conversation {
  id: string;
  title: string;
  folder: string;
  messages: ConversationMessage[];
}

interface ArchiveContextType {
  selectedConv: Conversation | null;
  selectedMessageIndex: number | null;
  setSelectedConv: (conv: Conversation | null) => void;
  setSelectedMessageIndex: (index: number | null) => void;
  nextMessage: () => void;
  prevMessage: () => void;
}

const ArchiveContext = createContext<ArchiveContextType | null>(null);

export function ArchiveProvider({ children }: { children: ReactNode }) {
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [selectedMessageIndex, setSelectedMessageIndex] = useState<number | null>(null);

  const nextMessage = () => {
    if (selectedConv && selectedMessageIndex !== null && selectedMessageIndex < selectedConv.messages.length - 1) {
      setSelectedMessageIndex(selectedMessageIndex + 1);
    }
  };

  const prevMessage = () => {
    if (selectedMessageIndex !== null && selectedMessageIndex > 0) {
      setSelectedMessageIndex(selectedMessageIndex - 1);
    }
  };

  return (
    <ArchiveContext.Provider value={{
      selectedConv,
      selectedMessageIndex,
      setSelectedConv,
      setSelectedMessageIndex,
      nextMessage,
      prevMessage
    }}>
      {children}
    </ArchiveContext.Provider>
  );
}

export function useArchive() {
  const context = useContext(ArchiveContext);
  if (!context) {
    throw new Error('useArchive must be used within ArchiveProvider');
  }
  return context;
}
