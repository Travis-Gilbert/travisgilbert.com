import type { Metadata } from 'next';
import { profile } from '@/lib/profile';

export const metadata: Metadata = {
  title: 'Connect',
  description: 'How to get in touch.',
};

export default function ConnectPage() {
  return (
    <>
      <p className="kicker">Open channel</p>
      <h1>Connect</h1>
      <p className="lede">
        I am always interested in hearing from people who think about the same things: design,
        infrastructure, systems, and the decisions that shape them.
      </p>
      <ul className="connect-list">
        <li>
          <span>Site</span>
          <a href={profile.siteUrl}>{profile.siteUrl.replace('https://', '')}</a>
        </li>
        <li>
          <span>GitHub</span>
          <a href={profile.githubUrl}>{profile.githubLabel}</a>
        </li>
        <li>
          <span>Email</span>
          <a href={`mailto:${profile.email}`}>{profile.email}</a>
        </li>
      </ul>
      <h2>What I want to hear about</h2>
      <ul className="quiet-list">
        <li>Design decisions you have noticed that deserve a closer look</li>
        <li>Corrections or additional context for published work</li>
        <li>Collaboration on research or video projects</li>
        <li>Interesting reading recommendations</li>
      </ul>
      <h2>What I do not want to hear about</h2>
      <ul className="quiet-list">
        <li>SEO services or link exchanges</li>
        <li>Unsolicited pitches for products</li>
        <li>Exciting partnership opportunities</li>
      </ul>
    </>
  );
}
