      <div className="panel-content">
        {/* Category Tabs - Always visible */}
        <div className="category-tabs">
          {categories.map((cat) => (
            <button
              key={cat.id}
              className={`category-tab ${activeCategory === cat.id ? 'active' : ''}`}
              onClick={() => handleCategoryChange(cat.id)}
            >
              <span className="tab-icon">{cat.icon}</span>
              <span className="tab-label">{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Privacy Warning */}
        {provider === 'cloudflare' && currentBuffer && (
          <div className="privacy-warning">
            <div className="warning-icon">⚠️</div>
            <div className="warning-content">
              <strong>Cloud Mode Active</strong>
              <p>Content will be sent to Cloudflare Workers for processing</p>
            </div>
          </div>
        )}

        {/* Tool List */}
        <div className="tools-list">
          {/* Transformations & Analysis need a buffer */}
          {(activeCategory === 'transformations' || activeCategory === 'analysis') && !currentBuffer ? (
            <div className="no-buffer-message">
              <div className="message-icon">📄</div>
              <p>Load content to use {activeCategory === 'transformations' ? 'transformation' : 'analysis'} tools</p>
            </div>
          ) : (
            <>
              {activeCategory === 'transformations' && <TransformationTools buffer={currentBuffer} />}
              {activeCategory === 'analysis' && <AnalysisTools />}
              {activeCategory === 'network' && <NetworkTools />}
              {activeCategory === 'bookmaking' && <BookmakingTools />}
            </>
          )}
        </div>
      </div>
