/**
 * Transparency Report Page
 */

import { Component } from 'solid-js';
import { A } from '@solidjs/router';

export const TransparencyPage: Component = () => {
  return (
    <div class="legal-page">
      <div class="legal-container">
        <nav class="legal-nav">
          <A href="/" class="back-link">← Back to Home</A>
        </nav>

        <article class="legal-content">
          <h1>Transparency Report</h1>
          <p class="effective-date"><strong>Report Period:</strong> January 1, 2026 - Present</p>

          <section>
            <h2>Our Commitment to Transparency</h2>
            <p>At humanizer.com, we believe in being transparent about how we handle government requests, legal demands, and other inquiries that may affect user privacy. This report provides information about:</p>
            <ul>
              <li>Legal requests we receive from governments and law enforcement</li>
              <li>How we respond to such requests</li>
              <li>Steps we take to protect user privacy</li>
              <li>Data about content removal and account actions</li>
            </ul>
          </section>

          <section>
            <h2>Government and Legal Requests</h2>
            <p>We publish data about legal requests we receive, including:</p>

            <h3>Types of Requests We May Receive</h3>
            <ul>
              <li><strong>Subpoenas</strong>: Court orders requiring disclosure of account information</li>
              <li><strong>Search Warrants</strong>: Judicial orders requiring disclosure of account contents</li>
              <li><strong>National Security Letters</strong>: Requests related to national security investigations</li>
              <li><strong>Court Orders</strong>: Various legal orders requiring specific actions</li>
              <li><strong>Emergency Requests</strong>: Urgent requests involving imminent harm</li>
            </ul>

            <h3>How We Respond</h3>
            <ul>
              <li>We carefully review every request for legal validity</li>
              <li>We challenge overbroad or inappropriate requests</li>
              <li>We notify users when legally permitted to do so</li>
              <li>We provide only the minimum information required by law</li>
              <li>We never provide encryption keys (we don't have them for zero-knowledge archives)</li>
            </ul>

            <div class="highlight">
              <p><strong>Important:</strong> Due to our zero-knowledge encryption architecture, we cannot access or provide the contents of encrypted archives, even if legally compelled. We can only provide metadata (file names, dates, sizes) and unencrypted account information.</p>
            </div>
          </section>

          <section>
            <h2>2026 Report Data</h2>
            <p class="note">This is our inaugural transparency report. Data collection began January 1, 2026.</p>

            <div class="stats-table">
              <table>
                <thead>
                  <tr>
                    <th>Request Type</th>
                    <th>Received</th>
                    <th>Complied (Full)</th>
                    <th>Complied (Partial)</th>
                    <th>Challenged/Rejected</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Subpoenas</td>
                    <td>0</td>
                    <td>0</td>
                    <td>0</td>
                    <td>0</td>
                  </tr>
                  <tr>
                    <td>Search Warrants</td>
                    <td>0</td>
                    <td>0</td>
                    <td>0</td>
                    <td>0</td>
                  </tr>
                  <tr>
                    <td>Court Orders</td>
                    <td>0</td>
                    <td>0</td>
                    <td>0</td>
                    <td>0</td>
                  </tr>
                  <tr>
                    <td>National Security Letters</td>
                    <td>0</td>
                    <td>0</td>
                    <td>0</td>
                    <td>0</td>
                  </tr>
                  <tr>
                    <td>Emergency Requests</td>
                    <td>0</td>
                    <td>0</td>
                    <td>0</td>
                    <td>0</td>
                  </tr>
                  <tr>
                    <td>DMCA Takedown Notices</td>
                    <td>0</td>
                    <td>0</td>
                    <td>0</td>
                    <td>0</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p class="note">Last updated: January 2026</p>
          </section>

          <section>
            <h2>Content Moderation</h2>
            <p>We track actions taken on content and accounts:</p>

            <div class="stats-table">
              <table>
                <thead>
                  <tr>
                    <th>Action Type</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Accounts suspended (Terms violation)</td>
                    <td>0</td>
                  </tr>
                  <tr>
                    <td>Accounts suspended (Abuse)</td>
                    <td>0</td>
                  </tr>
                  <tr>
                    <td>Content removed (User request)</td>
                    <td>0</td>
                  </tr>
                  <tr>
                    <td>Content removed (Legal requirement)</td>
                    <td>0</td>
                  </tr>
                  <tr>
                    <td>Transformations blocked (Policy violation)</td>
                    <td>0</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2>Warrant Canary</h2>
            <div class="warning-box">
              <p><strong>As of January 2026:</strong></p>
              <ul>
                <li>We have NOT received any National Security Letters</li>
                <li>We have NOT received any orders under the Foreign Intelligence Surveillance Act (FISA)</li>
                <li>We have NOT been subject to any gag orders that prevent disclosure of government requests</li>
                <li>We have NOT been required to insert any backdoors into our encryption</li>
              </ul>
              <p class="note">This canary is updated with each transparency report. If any statement is removed, it may indicate we can no longer make that assertion.</p>
            </div>
          </section>

          <section>
            <h2>Our Principles</h2>
            <ol>
              <li><strong>User notification:</strong> We notify users of legal requests unless prohibited by law or court order</li>
              <li><strong>Narrow compliance:</strong> We provide only the minimum data legally required</li>
              <li><strong>Legal review:</strong> All requests are reviewed by legal counsel</li>
              <li><strong>Challenge inappropriate requests:</strong> We push back on overbroad requests</li>
              <li><strong>Encryption integrity:</strong> We will never compromise our encryption or create backdoors</li>
              <li><strong>Regular reporting:</strong> We update this report at least annually</li>
            </ol>
          </section>

          <section>
            <h2>Report Archive</h2>
            <ul>
              <li><strong>2026:</strong> Current report (this page)</li>
            </ul>
            <p class="note">Historical reports will be archived and linked here as they become available.</p>
          </section>

          <section>
            <h2>Questions?</h2>
            <p>If you have questions about our transparency practices, please contact:</p>
            <div class="contact-box">
              <p><strong>Email:</strong> <a href="mailto:privacy@humanizer.com">privacy@humanizer.com</a></p>
              <p><strong>Mail:</strong><br />
              humanizer.com<br />
              Attn: Transparency Report<br />
              P.O. Box 724<br />
              Lynbrook, NY 11563<br />
              United States</p>
            </div>
          </section>

          <footer class="legal-footer">
            <p>© 2026 humanizer.com. All rights reserved.</p>
            <p>This report is updated at least annually.</p>
          </footer>
        </article>
      </div>
    </div>
  );
};
