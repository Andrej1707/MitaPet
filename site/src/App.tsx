import { useEffect, useRef, useState } from "react";

type DesktopEvent = {
  id: string;
  label: string;
  short: string;
  reaction: string;
  mood: string;
  memory: string;
  face: "soft" | "focused" | "sleepy" | "spark";
  accent: string;
};

const desktopEvents: DesktopEvent[] = [
  {
    id: "build",
    label: "Build failed",
    short: "ERR",
    reaction: "Okay. Deep breath. The semicolon did not win; it merely delayed us.",
    mood: "Determined",
    memory: "You prefer fixing one error at a time.",
    face: "focused",
    accent: "#ff8e72",
  },
  {
    id: "late",
    label: "2:13 AM coding",
    short: "LATE",
    reaction: "That function has had four names. Water first, naming crisis second.",
    mood: "Protective",
    memory: "Late-night sessions need gentle interruptions.",
    face: "sleepy",
    accent: "#f2c875",
  },
  {
    id: "ship",
    label: "Deploy succeeded",
    short: "LIVE",
    reaction: "It shipped! I absolutely believed in you the entire time. Mostly.",
    mood: "Electric",
    memory: "Small wins deserve visible celebrations.",
    face: "spark",
    accent: "#b9f6d8",
  },
  {
    id: "quiet",
    label: "Focus mode",
    short: "ZEN",
    reaction: "Quiet mode active. I will guard the corner and judge your tab count silently.",
    mood: "Calm",
    memory: "During focus blocks, fewer words feel better.",
    face: "soft",
    accent: "#9ec8ff",
  },
];

const moods = [
  { name: "Cozy", value: 72, note: "Soft comments, slower motion, gentle check-ins." },
  { name: "Curious", value: 88, note: "Notices changes and asks small contextual questions." },
  { name: "Chaotic", value: 96, note: "More dramatic reactions, tiny celebrations, zero chill." },
  { name: "Quiet", value: 42, note: "Stays present without interrupting the flow." },
];

const faqItems = [
  {
    question: "Is Mita-Pet always watching my screen?",
    answer:
      "No. Screen awareness is optional and visible. Manual Ask captures only when requested; Auto Vision must be explicitly enabled and shows its current status and interval.",
  },
  {
    question: "Are screenshots stored?",
    answer:
      "The current desktop app downscales captures for a request and does not permanently store them. The project aims for local-first processing wherever practical.",
  },
  {
    question: "Does it work without an API key?",
    answer:
      "Yes. The animated desktop companion, local reactions, movement, and personality behaviors work without Vision or Voice Mode.",
  },
  {
    question: "Is Mita-Pet a chatbot?",
    answer:
      "Not really. Chat can be part of it, but the core idea is ambient presence: a character that lives on the desktop, reacts at the right moment, and remembers the texture of your sessions.",
  },
];

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 10h11M11 5l5 5-5 5" />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.8a9.5 9.5 0 0 0-3 18.5c.5.1.7-.2.7-.5v-1.9c-2.8.6-3.4-1.2-3.4-1.2-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 0 1.6 1.1 1.6 1.1.9 1.6 2.4 1.1 3 .8.1-.7.4-1.1.7-1.4-2.3-.3-4.7-1.1-4.7-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.8 1a9.5 9.5 0 0 1 5 0c1.9-1.3 2.8-1 2.8-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.4 4.8-4.7 5 .4.3.7 1 .7 1.9v2.8c0 .3.2.6.7.5A9.5 9.5 0 0 0 12 2.8Z" />
    </svg>
  );
}

function Mascot({ face = "soft", compact = false }: { face?: DesktopEvent["face"]; compact?: boolean }) {
  return (
    <div className={`mascot mascot--${face} ${compact ? "mascot--compact" : ""}`} aria-hidden="true">
      <span className="mascot__ear mascot__ear--left" />
      <span className="mascot__ear mascot__ear--right" />
      <span className="mascot__antenna" />
      <span className="mascot__body">
        <span className="mascot__fringe" />
        <span className="mascot__eye mascot__eye--left" />
        <span className="mascot__eye mascot__eye--right" />
        <span className="mascot__mouth" />
        <span className="mascot__cheek mascot__cheek--left" />
        <span className="mascot__cheek mascot__cheek--right" />
      </span>
      <span className="mascot__foot mascot__foot--left" />
      <span className="mascot__foot mascot__foot--right" />
    </div>
  );
}

function WindowBar({ label, status }: { label: string; status?: string }) {
  return (
    <div className="window-bar">
      <span className="window-dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span>{label}</span>
      {status && <span className="window-status">{status}</span>}
    </div>
  );
}

function App() {
  const [activeEvent, setActiveEvent] = useState(desktopEvents[0]);
  const [activeMood, setActiveMood] = useState(moods[0]);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<number | undefined>(undefined);
  const installCommand = "git clone https://github.com/Andrej1707/MitaPet.git";

  useEffect(() => {
    return () => window.clearTimeout(copyTimer.current);
  }, []);

  const copyInstall = async () => {
    try {
      let copiedWithClipboard = false;
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(installCommand);
          copiedWithClipboard = true;
        } catch {
          copiedWithClipboard = false;
        }
      }

      if (!copiedWithClipboard) {
        const fallback = document.createElement("textarea");
        fallback.value = installCommand;
        fallback.setAttribute("readonly", "");
        fallback.style.position = "fixed";
        fallback.style.opacity = "0";
        document.body.appendChild(fallback);
        fallback.select();
        const copiedWithFallback = document.execCommand("copy");
        fallback.remove();
        if (!copiedWithFallback) throw new Error("Clipboard copy was rejected");
      }
      setCopied(true);
      window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <header className="site-header">
        <a className="brand" href="#top" aria-label="Mita-Pet home">
          <span className="brand-mark"><Mascot compact /></span>
          <span>Mita-Pet</span>
          <small>desktop companion</small>
        </a>
        <nav aria-label="Main navigation">
          <a href="#lab">Live demo</a>
          <a href="#privacy">Privacy</a>
          <a href="#roadmap">Roadmap</a>
        </nav>
        <a className="header-github" href="https://github.com/Andrej1707/MitaPet" target="_blank" rel="noreferrer">
          <GithubIcon />
          <span>View source</span>
        </a>
      </header>

      <main id="main">
        <section className="hero" id="top">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="pulse-dot" />
              Companion core online
            </div>
            <h1>
              Your desktop,
              <span>but less lonely.</span>
            </h1>
            <p className="hero-lede">
              Mita-Pet is a tiny AI companion that lives on your screen, notices the moment,
              remembers the vibe, and reacts like it actually shares the desktop with you.
            </p>
            <div className="hero-actions">
              <a className="button button--primary" href="#install">
                Wake Mita up <ArrowIcon />
              </a>
              <a className="button button--quiet" href="#lab">
                Try the desktop lab
              </a>
            </div>
            <div className="hero-proof" aria-label="Project principles">
              <span>Open source</span>
              <span>Windows native</span>
              <span>Vision optional</span>
            </div>
          </div>

          <div className="desktop-stage" aria-label="Illustration of Mita-Pet living on a desktop">
            <div className="stage-orbit stage-orbit--one" />
            <div className="stage-orbit stage-orbit--two" />
            <div className="desktop-window desktop-window--code">
              <WindowBar label="night-build.ts" />
              <div className="code-lines" aria-hidden="true">
                <span><i>01</i> companion.observe()</span>
                <span><i>02</i> mood.set("curious")</span>
                <span className="code-hot"><i>03</i> desktop.feelAlive()</span>
                <span><i>04</i> memory.keep("small win")</span>
              </div>
            </div>
            <div className="desktop-window desktop-window--status">
              <WindowBar label="mita://presence" status="LIVE" />
              <div className="status-grid">
                <div><span>Mood</span><strong>curious</strong></div>
                <div><span>Energy</span><strong>84%</strong></div>
                <div><span>Vision</span><strong>invited</strong></div>
              </div>
              <div className="meter"><i /></div>
            </div>
            <div className="reaction-bubble">
              <span className="reaction-meta">Mita noticed a deploy</span>
              <strong>That green check looks suspiciously good on you.</strong>
            </div>
            <div className="mascot-dock">
              <span className="signal-ring" />
              <Mascot face="spark" />
              <span className="dock-shadow" />
            </div>
            <div className="cursor-trail" aria-hidden="true">
              <i /><i /><i />
              <svg viewBox="0 0 24 28"><path d="m3 2 17 12-8 2-4 8L3 2Z" /></svg>
            </div>
            <div className="desktop-taskbar">
              <span className="task-logo"><Mascot compact /></span>
              <span />
              <span />
              <span />
              <time>02:13</time>
            </div>
          </div>
        </section>

        <section className="manifesto section-shell" aria-labelledby="what-title">
          <div className="section-index">01 / PRESENCE</div>
          <div className="manifesto-copy">
            <p className="kicker">Not another chat tab.</p>
            <h2 id="what-title">A small presence that belongs to the screen.</h2>
          </div>
          <div className="manifesto-note">
            <p>
              Normal assistants wait behind a text box. Mita lives at the edge of your work:
              wandering, reacting, keeping quiet when focus matters, and showing up when the moment deserves it.
            </p>
            <div className="difference-list">
              <span><b>Ambient</b> instead of demanding</span>
              <span><b>Contextual</b> instead of generic</span>
              <span><b>Expressive</b> instead of transactional</span>
            </div>
          </div>
        </section>

        <section className="lab section-shell" id="lab" aria-labelledby="lab-title">
          <div className="lab-heading">
            <div>
              <div className="section-index">02 / LIVE DESKTOP LAB</div>
              <p className="kicker">Click a moment. Watch the companion change.</p>
              <h2 id="lab-title">Context creates the reaction.</h2>
            </div>
            <p>
              A tiny simulation of how screen events, mood, and remembered preferences can shape one response.
            </p>
          </div>

          <div className="lab-console">
            <div className="event-rail" role="group" aria-label="Choose a desktop event">
              <span className="rail-label">Incoming event</span>
              {desktopEvents.map((event) => (
                <button
                  type="button"
                  key={event.id}
                  className={event.id === activeEvent.id ? "is-active" : ""}
                  onClick={() => setActiveEvent(event)}
                  aria-pressed={event.id === activeEvent.id}
                >
                  <span>{event.short}</span>
                  {event.label}
                </button>
              ))}
            </div>

            <div className="simulated-desktop" style={{ "--event-accent": activeEvent.accent } as React.CSSProperties}>
              <WindowBar label="mita_desktop.exe" status="OBSERVING: VISIBLE" />
              <div className="sim-grid" aria-live="polite">
                <div className="sim-scene">
                  <div className="sim-app">
                    <div className="sim-app__head"><span /><span /><span /></div>
                    <div className="sim-app__body">
                      <i /><i /><i /><i /><i />
                    </div>
                  </div>
                  <div className="sim-reaction">
                    <span>Mita says</span>
                    <strong>{activeEvent.reaction}</strong>
                  </div>
                  <div className="sim-mascot">
                    <Mascot face={activeEvent.face} />
                  </div>
                </div>
                <aside className="context-panel">
                  <div className="context-title">
                    <span className="pulse-dot" />
                    Context stack
                  </div>
                  <dl>
                    <div><dt>EVENT</dt><dd>{activeEvent.label}</dd></div>
                    <div><dt>MOOD</dt><dd>{activeEvent.mood}</dd></div>
                    <div><dt>MEMORY</dt><dd>{activeEvent.memory}</dd></div>
                    <div><dt>OUTPUT</dt><dd>Overlay reaction</dd></div>
                  </dl>
                  <div className="privacy-chip">
                    <span>Capture indicator</span>
                    <strong>visible</strong>
                  </div>
                </aside>
              </div>
            </div>
          </div>
        </section>

        <section className="signal-strip" aria-label="Mita-Pet feature highlights">
          <div><span>01</span><strong>Screen-aware reactions</strong><p>Responds to the moment, not just a prompt.</p></div>
          <div><span>02</span><strong>Desktop-native presence</strong><p>Transparent overlay, motion, bubbles, and drag.</p></div>
          <div><span>03</span><strong>Memory with texture</strong><p>Keeps useful session context and preferences.</p></div>
          <div><span>04</span><strong>Behavior you control</strong><p>Intervals, modes, limits, and personality settings.</p></div>
        </section>

        <section className="inner-life section-shell" aria-labelledby="inner-title">
          <div className="inner-intro">
            <div className="section-index">03 / INNER LIFE</div>
            <p className="kicker">Personality is a system, not a paint job.</p>
            <h2 id="inner-title">Mood changes how presence feels.</h2>
            <p>
              Mita can turn the same desktop signal into a soft nudge, a curious observation,
              or a slightly dramatic celebration. You decide how much personality gets through.
            </p>
          </div>

          <div className="mood-machine">
            <WindowBar label="personality.engine" status="USER TUNABLE" />
            <div className="mood-screen">
              <div className="mood-portrait">
                <span className="mood-halo" />
                <Mascot face={activeMood.name === "Quiet" ? "sleepy" : activeMood.name === "Chaotic" ? "spark" : "soft"} />
                <span>{activeMood.name}</span>
              </div>
              <div className="mood-readout">
                <span>EXPRESSION LEVEL</span>
                <strong>{activeMood.value}%</strong>
                <div className="mood-meter"><i style={{ width: `${activeMood.value}%` }} /></div>
                <p>{activeMood.note}</p>
              </div>
            </div>
            <div className="mood-controls" role="group" aria-label="Choose a personality mood">
              {moods.map((mood) => (
                <button
                  type="button"
                  key={mood.name}
                  className={mood.name === activeMood.name ? "is-active" : ""}
                  onClick={() => setActiveMood(mood)}
                  aria-pressed={mood.name === activeMood.name}
                >
                  {mood.name}
                </button>
              ))}
            </div>
          </div>

          <div className="memory-stack" aria-label="Example memory cards">
            <div className="memory-card memory-card--back">
              <span>SESSION NOTE 018</span>
              <p>Quiet after 11 PM.</p>
            </div>
            <div className="memory-card memory-card--middle">
              <span>PREFERENCE 007</span>
              <p>Celebrate successful builds.</p>
            </div>
            <div className="memory-card memory-card--front">
              <span>MEMORY CARD 024</span>
              <strong>"One error at a time works best."</strong>
              <p>Kept because it makes future support feel personal, not repetitive.</p>
              <i>session memory / editable</i>
            </div>
          </div>
        </section>

        <section className="privacy section-shell" id="privacy" aria-labelledby="privacy-title">
          <div className="privacy-visual">
            <div className="capture-frame">
              <span className="corner corner--tl" />
              <span className="corner corner--tr" />
              <span className="corner corner--bl" />
              <span className="corner corner--br" />
              <div className="capture-status">
                <span className="pulse-dot" />
                Screen observation active
              </div>
              <div className="capture-window">
                <span />
                <span />
                <span />
              </div>
              <div className="capture-controls">
                <span>Next check in</span>
                <strong>00:58</strong>
                <span className="capture-pause" aria-hidden="true">Pause</span>
              </div>
            </div>
          </div>
          <div className="privacy-copy">
            <div className="section-index">04 / CLEAR BY DESIGN</div>
            <p className="kicker">Awareness without the creepy part.</p>
            <h2 id="privacy-title">If Mita can see, you can see that she can.</h2>
            <p>
              Screen observation should never hide in the background. Mita-Pet is built around explicit modes,
              visible status, user-set intervals, and limits you can inspect.
            </p>
            <ul className="privacy-list">
              <li><span>01</span><div><strong>Opt-in capture</strong><p>Manual Ask by default. Auto Vision only after you enable it.</p></div></li>
              <li><span>02</span><div><strong>Visible activity</strong><p>Status and countdown make observation understandable.</p></div></li>
              <li><span>03</span><div><strong>Local-first intent</strong><p>Keep behavior and storage on-device wherever practical.</p></div></li>
              <li><span>04</span><div><strong>No permanent screenshot archive</strong><p>Current captures are resized for a request, not kept as a hidden history.</p></div></li>
            </ul>
          </div>
        </section>

        <section className="roadmap section-shell" id="roadmap" aria-labelledby="roadmap-title">
          <div className="roadmap-title">
            <div className="section-index">05 / UPDATE LOG</div>
            <p className="kicker">The companion is still learning new tricks.</p>
            <h2 id="roadmap-title">Roadmap from pet to platform.</h2>
          </div>
          <div className="update-log">
            <article className="update update--live">
              <span className="update-version">NOW / v2</span>
              <div><strong>Desktop presence</strong><p>Animated overlay, reactions, optional Vision, push-to-talk Voice Mode, settings, and limits.</p></div>
              <i>SHIPPED</i>
            </article>
            <article className="update">
              <span className="update-version">NEXT / v2.x</span>
              <div><strong>Deeper personality</strong><p>Editable memories, mood arcs, more companion behaviors, and calmer focus states.</p></div>
              <i>IN DESIGN</i>
            </article>
            <article className="update">
              <span className="update-version">LATER / v3</span>
              <div><strong>Plugin actions</strong><p>Safe, permissioned actions that let Mita help with tools instead of only commenting.</p></div>
              <i>RESEARCH</i>
            </article>
            <article className="update">
              <span className="update-version">FUTURE</span>
              <div><strong>Companion workshop</strong><p>Custom voices, personalities, looks, behaviors, and community-made extensions.</p></div>
              <i>OPEN IDEA</i>
            </article>
          </div>
        </section>

        <section className="install section-shell" id="install" aria-labelledby="install-title">
          <div className="install-copy">
            <div className="section-index">06 / BOOT SEQUENCE</div>
            <p className="kicker">Bring a little life to Windows.</p>
            <h2 id="install-title">Clone it. Run it. Meet your new corner-dweller.</h2>
            <p>
              Mita-Pet is open source. Run the desktop app locally, inspect how Vision works,
              or shape the next reaction with the project.
            </p>
            <a className="text-link" href="https://github.com/Andrej1707/MitaPet/releases/latest" target="_blank" rel="noreferrer">
              Prefer an installer? Open the latest Windows release <ArrowIcon />
            </a>
          </div>
          <div className="terminal">
            <WindowBar label="powershell.exe" status="READY" />
            <div className="terminal-body">
              <p><span>PS</span> C:\Users\you&gt; <strong>{installCommand}</strong></p>
              <p><span>PS</span> C:\Users\you&gt; <strong>cd MitaPet</strong></p>
              <p><span>PS</span> C:\Users\you\MitaPet&gt; <strong>npm install</strong></p>
              <p><span>PS</span> C:\Users\you\MitaPet&gt; <strong>npm start</strong><i className="terminal-cursor" /></p>
            </div>
            <div className="terminal-footer">
              <span>Node.js + Windows</span>
              <button type="button" onClick={copyInstall} className={copied ? "is-copied" : ""}>
                {copied ? "Copied" : "Copy clone command"}
              </button>
            </div>
          </div>
        </section>

        <section className="faq section-shell" aria-labelledby="faq-title">
          <div className="faq-heading">
            <div className="section-index">07 / QUESTIONS</div>
            <p className="kicker">Before you invite a small entity onto your desktop.</p>
            <h2 id="faq-title">Reasonable things to ask.</h2>
          </div>
          <div className="faq-list">
            {faqItems.map((item, index) => (
              <details key={item.question}>
                <summary><span>0{index + 1}</span>{item.question}<i /></summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="final-cta section-shell">
          <div className="final-orbit" />
          <Mascot face="spark" />
          <p className="kicker">Your screen has room for one more process.</p>
          <h2>Give the desktop<br />a little soul.</h2>
          <div className="hero-actions">
            <a className="button button--primary" href="https://github.com/Andrej1707/MitaPet" target="_blank" rel="noreferrer">
              <GithubIcon /> Explore on GitHub
            </a>
            <a className="button button--quiet" href="#top">Back to top</a>
          </div>
        </section>
      </main>

      <footer>
        <a className="brand" href="#top">
          <span className="brand-mark"><Mascot compact /></span>
          <span>Mita-Pet</span>
        </a>
        <p>Built in public. Screen-aware only when invited.</p>
        <div>
          <a href="https://github.com/Andrej1707/MitaPet" target="_blank" rel="noreferrer">GitHub</a>
          <a href="#privacy">Privacy</a>
          <a href="#roadmap">Roadmap</a>
        </div>
      </footer>
    </>
  );
}

export default App;
