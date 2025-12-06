/**
 * Terms of Service Page
 */

import { Component } from 'solid-js';
import { A } from '@solidjs/router';

export const TermsPage: Component = () => {
  return (
    <div class="legal-page">
      <div class="legal-container">
        <nav class="legal-nav">
          <A href="/" class="back-link">← Back to Home</A>
        </nav>

        <article class="legal-content">
          <h1>Terms of Service</h1>
          <p class="effective-date"><strong>Effective Date:</strong> January 1, 2026 | <strong>Last Updated:</strong> January 1, 2026</p>

          <section>
            <h2>1. Agreement to Terms</h2>
            <p>By accessing or using humanizer.com (the "Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not access or use the Service.</p>
            <div class="contact-box">
              <p><strong>Service Provider:</strong></p>
              <p>humanizer.com<br />
              P.O. Box 724<br />
              Lynbrook, NY 11563<br />
              United States</p>
            </div>
          </section>

          <section>
            <h2>2. Description of Service</h2>
            <p>humanizer.com provides a narrative transformation and analysis platform that enables users to:</p>
            <ul>
              <li><strong>Transform text narratives</strong> using AI-powered tools based on phenomenological and literary techniques</li>
              <li><strong>Analyze narratives</strong> using computational and semantic analysis methods</li>
              <li><strong>Store conversations and documents</strong> in encrypted personal archives</li>
              <li><strong>Access transformation tools</strong> including: Allegorical Transformation, Round-Trip Translation, AI Detection Analysis, Personalizer, and Multi-Reading Analysis</li>
            </ul>
            <p class="highlight"><strong>Important:</strong> Results are computational approximations and should be treated as creative and analytical tools, not as definitive or authoritative interpretations.</p>
          </section>

          <section>
            <h2>3. Account Registration</h2>
            <p>To use certain features, you must register for an account. You agree to:</p>
            <ul>
              <li>Provide accurate, current, and complete information</li>
              <li>Maintain the security of your password</li>
              <li>Accept responsibility for all activity under your account</li>
              <li>Immediately notify us of any unauthorized use</li>
            </ul>
            <p><strong>Age Requirement:</strong> You must be at least 13 years of age. If you are under 18, you represent that you have parental permission.</p>
          </section>

          <section>
            <h2>4. Subscription Plans and Billing</h2>
            <h3>Service Tiers</h3>
            <ul>
              <li><strong>Free Tier:</strong> Limited access with usage quotas</li>
              <li><strong>Pro Tier:</strong> Enhanced access with higher limits and premium features</li>
              <li><strong>Enterprise:</strong> Custom solutions with dedicated support</li>
            </ul>
            <h3>Billing Terms</h3>
            <ul>
              <li>Fees are billed in advance monthly or annually</li>
              <li>All fees are non-refundable except as required by law</li>
              <li>We may change fees with 30 days' notice</li>
            </ul>
            <h3>Cancellation</h3>
            <p>You may cancel anytime. You retain access until the end of your billing period. Your encrypted archive is retained for 90 days after cancellation.</p>
          </section>

          <section>
            <h2>5. Acceptable Use Policy</h2>
            <h3>Permitted Uses</h3>
            <ul>
              <li>Personal creative writing and narrative analysis</li>
              <li>Academic research and scholarship</li>
              <li>Professional content development</li>
              <li>Educational purposes</li>
            </ul>
            <h3>Prohibited Uses</h3>
            <p>You agree NOT to:</p>
            <ul>
              <li>Violate any laws or regulations</li>
              <li>Infringe intellectual property rights</li>
              <li>Generate harmful, defamatory, or hateful content</li>
              <li>Bypass usage limits or security features</li>
              <li>Use automated tools without permission</li>
              <li>Reverse engineer the Service</li>
              <li>Resell access without authorization</li>
              <li>Generate spam, malware, or phishing content</li>
            </ul>
          </section>

          <section>
            <h2>6. Intellectual Property Rights</h2>
            <h3>Service Ownership</h3>
            <p>The Service, including its design, software, and algorithms, is owned by humanizer.com and protected by intellectual property laws.</p>
            <h3>Your Content</h3>
            <p><strong>You retain all rights to content you upload.</strong> By using the Service, you grant us a limited license to process and store your content.</p>
            <h3>Generated Outputs</h3>
            <p>You may use AI-generated outputs for any lawful purpose, including commercial use. However, you are responsible for ensuring outputs don't infringe third-party rights.</p>
          </section>

          <section>
            <h2>7. Privacy and Data Security</h2>
            <p>Your use is governed by our <A href="/privacy">Privacy Policy</A>.</p>
            <h3>Zero-Knowledge Encryption</h3>
            <ul>
              <li>Archive content is encrypted on your device before transmission</li>
              <li>We cannot decrypt your archived content</li>
              <li>If you lose your password, we cannot recover your data</li>
            </ul>
            <h3>AI Processing</h3>
            <p>Input text is processed using third-party AI services. We do not authorize them to use your data for training.</p>
          </section>

          <section>
            <h2>8. Third-Party Services</h2>
            <p>The Service uses third-party AI providers and authentication services (e.g., GitHub, Google OAuth). Use is subject to their terms and privacy policies.</p>
          </section>

          <section>
            <h2>9. Disclaimers</h2>
            <div class="warning-box">
              <p><strong>THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND.</strong></p>
              <ul>
                <li>No warranty of accuracy for AI-generated content</li>
                <li>No warranty of uninterrupted or error-free service</li>
                <li>AI outputs may contain errors and require human review</li>
                <li>Outputs do not constitute professional, legal, or medical advice</li>
              </ul>
            </div>
          </section>

          <section>
            <h2>10. Limitation of Liability</h2>
            <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW:</p>
            <ul>
              <li>We are not liable for indirect, incidental, or consequential damages</li>
              <li>Our total liability is limited to amounts you paid us in the preceding 12 months, or $100, whichever is greater</li>
              <li>We are not liable for loss of encrypted data due to forgotten passwords</li>
            </ul>
          </section>

          <section>
            <h2>11. Indemnification</h2>
            <p>You agree to indemnify and hold harmless humanizer.com from claims arising from your violation of these Terms, your use of the Service, or content you generate and publish.</p>
          </section>

          <section>
            <h2>12. Termination</h2>
            <p><strong>By You:</strong> You may terminate your account at any time through account settings.</p>
            <p><strong>By Us:</strong> We may suspend or terminate accounts for Terms violations, abuse, or non-payment.</p>
            <p><strong>Effect:</strong> Upon termination, encrypted archives are retained for 90 days before deletion.</p>
          </section>

          <section>
            <h2>13. Dispute Resolution</h2>
            <p><strong>Governing Law:</strong> State of New York, United States</p>
            <p><strong>Arbitration:</strong> Disputes will be resolved by binding arbitration through the American Arbitration Association, except for small claims or intellectual property matters.</p>
            <div class="highlight">
              <p><strong>Class Action Waiver:</strong> You agree to bring claims only in your individual capacity, not as part of a class action.</p>
            </div>
            <p><strong>Opt-Out:</strong> You may opt out of arbitration within 30 days of accepting these Terms by writing to our mailing address.</p>
          </section>

          <section>
            <h2>14. Changes to Terms</h2>
            <p>We may modify these Terms at any time. Material changes will be communicated via email and website notice. Continued use after changes constitutes acceptance.</p>
          </section>

          <section>
            <h2>15. Contact</h2>
            <div class="contact-box">
              <p><strong>Email:</strong> <a href="mailto:support@humanizer.com">support@humanizer.com</a></p>
              <p><strong>Mail:</strong><br />
              humanizer.com<br />
              P.O. Box 724<br />
              Lynbrook, NY 11563<br />
              United States</p>
            </div>
          </section>

          <section>
            <h2>Acknowledgment</h2>
            <p>BY USING THE SERVICE, YOU ACKNOWLEDGE THAT YOU HAVE READ THESE TERMS OF SERVICE, UNDERSTAND THEM, AND AGREE TO BE BOUND BY THEM.</p>
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
