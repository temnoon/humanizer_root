interface HelpPanelProps {
  onClose: () => void;
}

export default function HelpPanel({ onClose }: HelpPanelProps) {
  return (
    <div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 'var(--spacing-xl)'
      }}>
        <h2>Help & Documentation</h2>
        <button
          onClick={onClose}
          className="btn btn-secondary"
          style={{ padding: 'var(--spacing-xs) var(--spacing-md)' }}
        >
          Close
        </button>
      </div>

      <div style={{ display: 'grid', gap: 'var(--spacing-xl)' }}>
        {/* Allegorical Projection Help */}
        <section className="card">
          <h3 style={{ color: 'var(--accent-purple)', marginBottom: 'var(--spacing-md)' }}>
            🎭 Allegorical Projection
          </h3>

          <p style={{ marginBottom: 'var(--spacing-md)' }}>
            Transform your narrative by mapping it onto a fictional universe, retelling it through
            a specific narrator's voice and writing style.
          </p>

          <h4 style={{ fontSize: '1rem', marginBottom: 'var(--spacing-sm)' }}>5-Stage Pipeline:</h4>
          <ol style={{ marginBottom: 'var(--spacing-md)', paddingLeft: 'var(--spacing-lg)' }}>
            <li><strong>Deconstruct</strong> - Break narrative into core elements (actors, actions, conflicts)</li>
            <li><strong>Map</strong> - Find analogous elements in the target universe</li>
            <li><strong>Reconstruct</strong> - Rebuild the story in the new setting</li>
            <li><strong>Stylize</strong> - Apply persona voice and writing style</li>
            <li><strong>Reflect</strong> - Analyze what the transformation revealed</li>
          </ol>

          <h4 style={{ fontSize: '1rem', marginBottom: 'var(--spacing-sm)' }}>Configuration Options:</h4>
          <ul style={{ marginBottom: 'var(--spacing-md)', paddingLeft: 'var(--spacing-lg)' }}>
            <li><strong>Persona</strong> - The narrator's perspective (neutral, advocate, critic, philosopher, storyteller)</li>
            <li><strong>Namespace</strong> - The fictional universe (mythology, quantum, nature, corporate, medieval, science)</li>
            <li><strong>Style</strong> - Writing style (standard, academic, poetic, technical, casual)</li>
          </ul>

          <div style={{
            background: 'var(--bg-tertiary)',
            padding: 'var(--spacing-md)',
            borderRadius: 'var(--radius-md)',
            borderLeft: '3px solid var(--accent-purple)'
          }}>
            <strong>Best for:</strong> Exploring how your narrative translates across different cultural,
            conceptual, or narrative frameworks. Great for finding universal patterns in specific stories.
          </div>
        </section>

        {/* Round-Trip Translation Help */}
        <section className="card">
          <h3 style={{ color: 'var(--accent-cyan)', marginBottom: 'var(--spacing-md)' }}>
            🔄 Round-Trip Translation
          </h3>

          <p style={{ marginBottom: 'var(--spacing-md)' }}>
            Translate your text to an intermediate language and back to English. Analyze what meaning
            survives the journey and what changes along the way.
          </p>

          <h4 style={{ fontSize: '1rem', marginBottom: 'var(--spacing-sm)' }}>How It Works:</h4>
          <ol style={{ marginBottom: 'var(--spacing-md)', paddingLeft: 'var(--spacing-lg)' }}>
            <li><strong>Forward Translation</strong> - English → Selected Language</li>
            <li><strong>Backward Translation</strong> - Selected Language → English</li>
            <li><strong>Semantic Drift Analysis</strong> - Measure meaning preservation (0-100%)</li>
            <li><strong>Element Tracking</strong> - Identify preserved, lost, and gained elements</li>
          </ol>

          <h4 style={{ fontSize: '1rem', marginBottom: 'var(--spacing-sm)' }}>Supported Languages (18):</h4>
          <div style={{ marginBottom: 'var(--spacing-md)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--spacing-xs)' }}>
            {['Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Russian',
              'Chinese', 'Japanese', 'Korean', 'Arabic', 'Hebrew', 'Hindi',
              'Dutch', 'Swedish', 'Norwegian', 'Danish', 'Polish', 'Czech'].map(lang => (
              <div key={lang} style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                • {lang}
              </div>
            ))}
          </div>

          <div style={{
            background: 'var(--bg-tertiary)',
            padding: 'var(--spacing-md)',
            borderRadius: 'var(--radius-md)',
            borderLeft: '3px solid var(--accent-cyan)'
          }}>
            <strong>Best for:</strong> Understanding which concepts in your text are culture-specific
            vs. universal. Discover what survives translation and what gets transformed.
          </div>
        </section>

        {/* Maieutic Dialogue Help */}
        <section className="card">
          <h3 style={{ color: 'var(--accent-green)', marginBottom: 'var(--spacing-md)' }}>
            🤔 Maieutic Dialogue
          </h3>

          <p style={{ marginBottom: 'var(--spacing-md)' }}>
            Engage in Socratic questioning about your narrative. Through progressively deeper questions,
            uncover underlying assumptions, motivations, and universal themes.
          </p>

          <h4 style={{ fontSize: '1rem', marginBottom: 'var(--spacing-sm)' }}>5 Depth Levels:</h4>
          <ol style={{ marginBottom: 'var(--spacing-md)', paddingLeft: 'var(--spacing-lg)' }}>
            <li><strong>Surface Level</strong> (Depth 0) - Basic understanding of events and actors</li>
            <li><strong>Underlying Motivations</strong> (Depth 1) - Why things happened</li>
            <li><strong>Root Causes</strong> (Depth 2) - Fundamental tensions and conflicts</li>
            <li><strong>Assumptions & Worldview</strong> (Depth 3) - Unstated beliefs and frameworks</li>
            <li><strong>Universal & Archetypal</strong> (Depth 4) - Timeless patterns and themes</li>
          </ol>

          <h4 style={{ fontSize: '1rem', marginBottom: 'var(--spacing-sm)' }}>How the Dialogue Works:</h4>
          <ul style={{ marginBottom: 'var(--spacing-md)', paddingLeft: 'var(--spacing-lg)' }}>
            <li>Each turn asks one thoughtful question based on your previous answers</li>
            <li>Questions progressively deepen from surface to universal themes</li>
            <li>Your responses guide the dialogue's direction</li>
            <li>After each answer, key insights are automatically extracted</li>
            <li>At completion, a final synthesis captures the emergent understanding</li>
          </ul>

          <div style={{
            background: 'var(--bg-tertiary)',
            padding: 'var(--spacing-md)',
            borderRadius: 'var(--radius-md)',
            borderLeft: '3px solid var(--accent-green)'
          }}>
            <strong>Best for:</strong> Discovering hidden meanings in your own narratives. Particularly
            powerful for personal stories, decision-making processes, or understanding complex situations.
          </div>
        </section>

        {/* Tips & Best Practices */}
        <section className="card">
          <h3 style={{ marginBottom: 'var(--spacing-md)' }}>💡 Tips & Best Practices</h3>

          <div style={{ display: 'grid', gap: 'var(--spacing-md)' }}>
            <div>
              <h4 style={{ fontSize: '1rem', color: 'var(--accent-yellow)' }}>Text Length</h4>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                • Allegorical: Up to 10,000 characters (great for longer narratives)<br />
                • Round-Trip: Up to 5,000 characters (shorter texts work better)<br />
                • Maieutic: Up to 5,000 characters initial text, 2,000 per answer
              </p>
            </div>

            <div>
              <h4 style={{ fontSize: '1rem', color: 'var(--accent-yellow)' }}>Choosing Configurations</h4>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                • <strong>Neutral persona</strong> for objective retellings<br />
                • <strong>Critic/Advocate</strong> for exploring different perspectives<br />
                • <strong>Philosopher</strong> for deeper conceptual frameworks<br />
                • <strong>Storyteller</strong> for engaging narrative forms
              </p>
            </div>

            <div>
              <h4 style={{ fontSize: '1rem', color: 'var(--accent-yellow)' }}>Getting the Best Results</h4>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                • Be specific and concrete in your source narratives<br />
                • Try multiple configurations to see different perspectives<br />
                • In Maieutic dialogues, thoughtful answers yield better insights<br />
                • Compare round-trips through different languages for patterns
              </p>
            </div>
          </div>
        </section>

        {/* Troubleshooting */}
        <section className="card">
          <h3 style={{ marginBottom: 'var(--spacing-md)' }}>🔧 Troubleshooting</h3>

          <div style={{ display: 'grid', gap: 'var(--spacing-md)' }}>
            <div>
              <h4 style={{ fontSize: '1rem' }}>Transformation taking too long?</h4>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                Transformations typically take 30-60 seconds. Longer texts or complex configurations
                may take up to 2 minutes. If it exceeds this, refresh and try again with shorter text.
              </p>
            </div>

            <div>
              <h4 style={{ fontSize: '1rem' }}>Results don't make sense?</h4>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                Try simplifying your source text or using a different configuration. Some narratives
                work better in certain namespaces. Experiment to find the best match.
              </p>
            </div>

            <div>
              <h4 style={{ fontSize: '1rem' }}>Authentication issues?</h4>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                Make sure your password is at least 8 characters. If you're logged out unexpectedly,
                your session may have expired - simply log in again.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
