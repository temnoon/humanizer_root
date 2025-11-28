interface WelcomeStepProps {
  onNext: () => void;
}

export function WelcomeStep({ onNext }: WelcomeStepProps) {
  return (
    <div className="text-center">
      {/* Logo/Icon */}
      <div
        className="w-20 h-20 rounded-2xl mx-auto mb-6 flex items-center justify-center"
        style={{ backgroundColor: 'var(--accent-primary)' }}
      >
        <svg
          className="w-10 h-10 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      </div>

      <h1
        className="text-3xl font-bold mb-3"
        style={{ color: 'var(--text-primary)' }}
      >
        Welcome to Humanizer Studio
      </h1>

      <p
        className="text-lg mb-8 max-w-md mx-auto"
        style={{ color: 'var(--text-secondary)' }}
      >
        Transform AI-generated text into natural, human-sounding content
        while preserving your voice and style.
      </p>

      {/* Feature highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 text-left">
        <FeatureCard
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          title="AI Detection"
          description="Identify AI-generated content with precision"
        />
        <FeatureCard
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          }
          title="Smart Rewriting"
          description="Transform text while keeping your meaning"
        />
        <FeatureCard
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          }
          title="Private & Local"
          description="Your data stays on your device"
        />
      </div>

      <button
        onClick={onNext}
        className="px-8 py-3 rounded-lg font-medium text-white transition-opacity hover:opacity-90"
        style={{ backgroundColor: 'var(--accent-primary)' }}
      >
        Get Started
      </button>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div
      className="p-4 rounded-lg"
      style={{ backgroundColor: 'var(--bg-tertiary)' }}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
        style={{ backgroundColor: 'var(--accent-primary)', opacity: 0.1 }}
      >
        <span style={{ color: 'var(--accent-primary)' }}>{icon}</span>
      </div>
      <h3
        className="font-medium mb-1"
        style={{ color: 'var(--text-primary)' }}
      >
        {title}
      </h3>
      <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
        {description}
      </p>
    </div>
  );
}
