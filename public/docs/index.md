<style>
.hero { }

.hero-hi {
  color: var(--muted);
  margin-bottom: 6px;
  animation: h-fade 0.4s 0.2s both;
}
.hero-name {
  font-size: 2.4rem;
  font-weight: 700;
  color: var(--text-h);
  white-space: nowrap;
  overflow: hidden;
  width: 0;
  border-right: 2.5px solid var(--accent-hover);
  animation: h-name 0.9s steps(11) 0.6s forwards, h-cursor 1.9s ease 0.6s forwards;
}
.hero-role {
  font-size: 1.05rem;
  color: var(--link);
  white-space: nowrap;
  overflow: hidden;
  width: 0;
  margin-top: 8px;
  animation: h-role 0.8s steps(17) 1.7s forwards;
}
.hero-niche {
  font-size: 0.78rem;
  color: var(--accent-hover);
  letter-spacing: 0.07em;
  margin-top: 6px;
  opacity: 0;
  animation: h-fade 0.4s 2.7s forwards;
}
.hero-desc {
  margin-top: 28px;
  padding-top: 24px;
  border-top: 1px solid var(--table-border);
  color: var(--text);
  line-height: 1.8;
  opacity: 0;
  animation: h-up 0.5s ease-out 3.1s forwards;
}
.hero-cta {
  margin-top: 32px;
  display: flex;
  gap: 28px;
  flex-wrap: wrap;
  opacity: 0;
  animation: h-up 0.5s ease-out 3.7s forwards;
}
.hero-cta a {
  color: var(--link);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-bottom: 1px solid transparent;
  padding-bottom: 2px;
  transition: color 0.2s, border-color 0.2s;
}
.hero-cta a:hover {
  color: var(--text-h);
  border-bottom-color: var(--link);
  text-decoration: none;
}
.hero-cta a .arr { transition: transform 0.2s; }
.hero-cta a:hover .arr { transform: translateX(3px); }
.hero-photo {
  margin-top: 40px;
  display: flex;
  justify-content: center;
  opacity: 0;
  animation: h-up 0.5s ease-out 4.2s forwards;
}
.hero-photo img {
  width: 320px;
  height: auto;
  display: block;
  border-radius: 10px;
  border: 1px solid var(--table-border);
}

@keyframes h-name   { from { width: 0; } to { width: 11ch; } }
@keyframes h-cursor {
  0%, 47%  { border-color: var(--accent-hover); }
  54%      { border-color: transparent; }
  62%      { border-color: var(--accent-hover); }
  70%      { border-color: transparent; }
  78%      { border-color: var(--accent-hover); }
  86%, 100%{ border-color: transparent; }
}
@keyframes h-role   { from { width: 0; } to { width: 17ch; } }
@keyframes h-fade   { from { opacity: 0; } to { opacity: 1; } }
@keyframes h-up {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
</style>

<div class="hero">
  <div class="hero-hi">Hi, I'm</div>
  <div class="hero-name">João Jorge</div>
  <div class="hero-role">Software Engineer</div>
  <div class="hero-niche">Drone · Automotive · Embedded</div>
  <div class="hero-desc">
    A <strong>software engineer</strong> looking for a new challenge in Europe.
    I have experience delivering full-stack solutions for government tax systems
    and autonomous vehicle software. Currently seeking a role in
    <strong>drone, automotive, or embedded systems</strong> where software has
    direct operational impact.
  </div>
  <div class="hero-cta">
    <a href="#/about/experience">Experience <span class="arr">→</span></a>
    <a href="#/projects">Projects <span class="arr">→</span></a>
    <a href="#/blog">Blog <span class="arr">→</span></a>
  </div>
  <div class="hero-photo">
    <img src="/docs/about/DuckPhoto.jpeg" alt="João Jorge" width="640" height="863" loading="lazy" />
  </div>
</div>
