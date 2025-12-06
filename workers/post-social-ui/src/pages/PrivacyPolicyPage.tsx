/**
 * Privacy Policy Page
 */

import { Component } from 'solid-js';
import { A } from '@solidjs/router';

export const PrivacyPolicyPage: Component = () => {
  return (
    <div class="legal-page">
      <div class="legal-container">
        <nav class="legal-nav">
          <A href="/" class="back-link">← Back to Home</A>
        </nav>

        <article class="legal-content">
          <h1>Privacy Policy</h1>
          <p class="effective-date"><strong>Effective Date:</strong> January 1, 2026 | <strong>Last Updated:</strong> January 1, 2026</p>

          <section>
            <h2>1. Introduction</h2>
            <p>Welcome to humanizer.com ("we," "us," or "our"). We are committed to protecting your privacy and providing transparency about how we collect, use, store, and protect your personal information.</p>
            <p>This Privacy Policy explains:</p>
            <ul>
              <li>What information we collect and why</li>
              <li>How we use your information</li>
              <li>How we protect your information</li>
              <li>Your rights and choices regarding your information</li>
              <li>How to contact us with questions or concerns</li>
            </ul>
            <p>By using humanizer.com (the "Service"), you agree to the collection and use of information in accordance with this Privacy Policy.</p>
            <div class="contact-box">
              <p><strong>Service Provider:</strong></p>
              <p>humanizer.com<br />
              P.O. Box 724<br />
              Lynbrook, NY 11563<br />
              United States<br />
              Email: <a href="mailto:privacy@humanizer.com">privacy@humanizer.com</a></p>
            </div>
          </section>

          <section>
            <h2>2. Information We Collect</h2>

            <h3>2.1 Information You Provide Directly</h3>
            <p><strong>Account Information:</strong></p>
            <ul>
              <li>Email address (required for registration)</li>
              <li>Username/display name</li>
              <li>Password (stored as cryptographic hash, never in plain text)</li>
              <li>Authentication credentials (e.g., OAuth providers like GitHub, Google)</li>
              <li>Profile preferences and settings</li>
              <li>Subscription tier and billing preferences</li>
            </ul>

            <p><strong>Content You Create:</strong></p>
            <ul>
              <li>Text narratives you upload or paste into the Service</li>
              <li>Transformation and analysis requests</li>
              <li>Parameters and settings you choose for transformations</li>
              <li>Outputs generated from transformation tools</li>
              <li>Notes, annotations, and session metadata</li>
            </ul>

            <p><strong>Archive Content:</strong></p>
            <ul>
              <li>Files and conversations you upload to your encrypted archive</li>
              <li>Metadata about archived files (title, date, file size, message count)</li>
              <li>Archive encryption password (NEVER transmitted to our servers or stored by us)</li>
            </ul>

            <h3>2.2 Information Collected Automatically</h3>
            <p><strong>Usage Data:</strong></p>
            <ul>
              <li>Pages and features you access</li>
              <li>Time, frequency, and duration of your activities</li>
              <li>Transformation tool usage patterns</li>
              <li>API usage metrics</li>
              <li>Error logs and diagnostic information</li>
            </ul>

            <h3>2.3 Information from Third Parties</h3>
            <p><strong>Authentication Providers:</strong></p>
            <ul>
              <li>If you use third-party authentication (e.g., GitHub, Google, Discord), we receive limited information such as email address and authentication token</li>
            </ul>
            <p><strong>Payment Processors:</strong></p>
            <ul>
              <li>Payment and billing information is processed by third-party payment processors (we do not store complete credit card numbers)</li>
            </ul>
          </section>

          <section>
            <h2>3. How We Use Your Information</h2>
            <h3>3.1 Provide and Improve the Service</h3>
            <ul>
              <li><strong>Process transformations</strong>: Use your input text with AI models to generate requested transformations and analyses</li>
              <li><strong>Store your work</strong>: Maintain your narratives, operations, and session history</li>
              <li><strong>Enable features</strong>: Support archive encryption, Canvas workspace, session persistence</li>
              <li><strong>Personalize experience</strong>: Remember your preferences and settings</li>
            </ul>
            <p class="highlight"><strong>Important</strong>: We do NOT use your content to train AI models without your explicit consent.</p>
          </section>

          <section>
            <h2>4. Zero-Knowledge Encryption and Archive Privacy</h2>
            <p>Our archive feature uses <strong>zero-knowledge encryption</strong>, meaning:</p>
            <ul>
              <li><strong>Client-side encryption</strong>: Your files are encrypted on your device BEFORE being sent to our servers</li>
              <li><strong>Key derivation</strong>: Encryption keys are derived from a password you set using PBKDF2 (100,000 iterations)</li>
              <li><strong>We cannot decrypt</strong>: We do not have your encryption keys and cannot access your encrypted content</li>
              <li><strong>End-to-end security</strong>: Only you can decrypt and view your archived files</li>
            </ul>

            <h3>4.1 What We Can and Cannot See</h3>
            <p><strong>What We CAN See (Metadata):</strong> File titles, upload date, file size, folder structure</p>
            <p><strong>What We CANNOT See (Encrypted Content):</strong> Actual text content, message content, file contents</p>

            <div class="warning-box">
              <p><strong>Critical Information:</strong></p>
              <ul>
                <li>Your archive encryption password is NEVER transmitted to our servers</li>
                <li>We cannot recover your encrypted data if you lose your password</li>
                <li>There is NO "forgot password" option for archive encryption</li>
              </ul>
            </div>
          </section>

          <section>
            <h2>5. Cookies and Tracking Technologies</h2>
            <p><strong>Essential Cookies (Cannot be Disabled):</strong></p>
            <ul>
              <li>Session authentication tokens</li>
              <li>CSRF protection tokens</li>
              <li>Security and fraud prevention</li>
            </ul>
            <p><strong>Optional Cookies:</strong></p>
            <ul>
              <li>User preferences (theme, layout settings)</li>
              <li>Usage statistics and feature adoption</li>
            </ul>
            <p>We honor "Do Not Track" (DNT) signals by disabling optional analytics when DNT is enabled.</p>
          </section>

          <section>
            <h2>6. How We Share Your Information</h2>
            <p class="highlight"><strong>We do NOT sell your personal information.</strong></p>
            <p>We share information with third parties only as necessary to provide the Service:</p>
            <ul>
              <li><strong>AI Model Providers</strong>: We send your input text to third-party AI services for transformation processing. These providers do NOT use your data to train models.</li>
              <li><strong>Cloud Infrastructure</strong>: Cloudflare Workers, D1, and R2 for hosting and storage</li>
              <li><strong>Payment Processors</strong>: Stripe handles billing and subscription management</li>
            </ul>
          </section>

          <section>
            <h2>7. Data Retention</h2>
            <p><strong>Active Accounts:</strong></p>
            <ul>
              <li>Account data retained while account is active</li>
              <li>Encrypted archives retained indefinitely while account is active</li>
              <li>Session logs retained 90 days</li>
            </ul>
            <p><strong>Deleted Accounts:</strong></p>
            <ul>
              <li>Account credentials deleted within 24 hours</li>
              <li>Encrypted archives retained 90 days (grace period)</li>
              <li>Permanent deletion after 90 days</li>
            </ul>
          </section>

          <section>
            <h2>8. Data Security</h2>
            <p>We implement industry-standard security measures:</p>
            <ul>
              <li><strong>Encryption in transit</strong>: TLS 1.3 for all data transmission</li>
              <li><strong>Encryption at rest</strong>: AES-256 encryption for database storage</li>
              <li><strong>Archive encryption</strong>: AES-256-GCM client-side encryption (zero-knowledge)</li>
              <li><strong>Infrastructure</strong>: ISO 27001 certified cloud infrastructure (Cloudflare)</li>
            </ul>
          </section>

          <section>
            <h2>9. International Data Transfers</h2>
            <p>Our servers are primarily located in the United States. We implement appropriate safeguards including Standard Contractual Clauses (SCCs) for EU data transfers and comply with GDPR and CCPA.</p>
          </section>

          <section>
            <h2>10. Children's Privacy</h2>
            <p>The Service is not intended for children under the age of 13. We do not knowingly collect personal information from children under 13.</p>
          </section>

          <section>
            <h2>11. Your Privacy Rights</h2>
            <p>Regardless of location, you have the following rights:</p>
            <ul>
              <li><strong>Access</strong>: Request a copy of your personal information</li>
              <li><strong>Correction</strong>: Request correction of inaccurate information</li>
              <li><strong>Deletion</strong>: Request deletion of your personal information</li>
              <li><strong>Portability</strong>: Request your data in a machine-readable format</li>
              <li><strong>Withdraw Consent</strong>: Withdraw consent for processing</li>
            </ul>
            <p>EU/EEA users have additional rights under GDPR. California residents have rights under CCPA/CPRA.</p>
            <p>To exercise your rights, email <a href="mailto:privacy@humanizer.com">privacy@humanizer.com</a> with subject "Privacy Rights Request".</p>
          </section>

          <section>
            <h2>12. Changes to This Privacy Policy</h2>
            <p>We may update this Privacy Policy from time to time. For material changes, we will provide email notification and at least 30 days advance notice.</p>
          </section>

          <section>
            <h2>13. Contact Us</h2>
            <div class="contact-box">
              <p><strong>Email:</strong> <a href="mailto:privacy@humanizer.com">privacy@humanizer.com</a></p>
              <p><strong>Mail:</strong><br />
              humanizer.com<br />
              Attn: Privacy Officer<br />
              P.O. Box 724<br />
              Lynbrook, NY 11563<br />
              United States</p>
              <p><strong>Data Protection Officer (EU/EEA):</strong> <a href="mailto:dpo@humanizer.com">dpo@humanizer.com</a></p>
            </div>
          </section>

          <footer class="legal-footer">
            <p>© 2026 humanizer.com. All rights reserved.</p>
            <p>Version 1.0 | Effective January 1, 2026</p>
          </footer>
        </article>
      </div>
    </div>
  );
};
