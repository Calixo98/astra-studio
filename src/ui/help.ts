import { helpEntries } from './helpContent';

/** Help is presentation-only: no input events or audio state access. */
export function initHelp(): void {
  const main = document.querySelector('main');
  if (!main || document.getElementById('astra-help')) return;
  const panel = document.createElement('aside');
  panel.id = 'astra-help'; panel.className = 'help-popover'; panel.hidden = true;
  panel.tabIndex = 0; panel.setAttribute('role', 'region');
  panel.setAttribute('aria-labelledby', 'astra-help-title');
  document.body.append(panel);
  let active: HTMLButtonElement | null = null;
  let pinned = false, timer = 0, restoring = false;
  const entries = new WeakMap<HTMLButtonElement, typeof helpEntries[number]>();
  const attached = new WeakSet<Element>();
  function close(restore = false): void {
    clearTimeout(timer);
    const previous = active;
    active = null; pinned = false; panel.hidden = true;
    previous?.setAttribute('aria-expanded', 'false');
    previous?.removeAttribute('aria-describedby');
    if (restore && previous?.isConnected) { restoring = true; previous.focus(); restoring = false; }
  }
  function position(): void {
    if (!active || panel.hidden) return;
    const anchor = active.getBoundingClientRect();
    const width = panel.getBoundingClientRect().width;
    const height = panel.getBoundingClientRect().height;
    const top = anchor.bottom + 8 + height <= innerHeight - 8 ? anchor.bottom + 8 : Math.max(8, anchor.top - height - 8);
    panel.style.left = Math.max(8, Math.min(anchor.left, innerWidth - width - 8)) + 'px';
    panel.style.top = top + 'px';
  }
  function open(button: HTMLButtonElement): void {
    clearTimeout(timer);
    if (active === button) return;
    close(); active = button;
    const entry = entries.get(button)!;
    const heading = document.createElement('strong'); heading.id = 'astra-help-title'; heading.textContent = entry.title;
    const text = document.createElement('p'); text.id = 'astra-help-text'; text.textContent = entry.text;
    const dismiss = document.createElement('button'); dismiss.type = 'button'; dismiss.className = 'help-close'; dismiss.textContent = 'Cerrar ayuda';
    dismiss.addEventListener('click', () => close(true), {once:true});
    panel.replaceChildren(heading, text, dismiss); panel.hidden = false;
    button.setAttribute('aria-expanded','true'); button.setAttribute('aria-describedby','astra-help-text'); position();
  }
  const trigger = (target: EventTarget | null) => target instanceof Element ? target.closest<HTMLButtonElement>('.help-trigger') : null;
  function delayClose(): void {
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      if (!pinned && !panel.matches(':hover') && !panel.contains(document.activeElement) && active !== document.activeElement && !active?.matches(':hover')) close();
    }, 180);
  }
  function attach(): void {
    for (const entry of helpEntries) for (const element of main!.querySelectorAll(entry.selector)) {
      if (attached.has(element)) continue;
      attached.add(element);
      const button = document.createElement('button'); button.type = 'button'; button.className = 'help-trigger';
      button.textContent = 'i'; button.setAttribute('aria-label', 'Ayuda: ' + entry.title);
      button.setAttribute('aria-expanded','false'); button.setAttribute('aria-controls',panel.id);
      entries.set(button,entry);
      // Insert after the entire label, never make the help button activate its input.
      const label = element.closest('label');
      if (label) {
        const wrapper = document.createElement('div');
        wrapper.className = 'help-control';
        label.before(wrapper);
        wrapper.append(label, button);
      } else if (element.matches('button, input, select')) {
        const wrapper = document.createElement('span');
        wrapper.className = 'help-action';
        element.before(wrapper);
        wrapper.append(element, button);
      } else {
        element.classList.add('help-anchor');
        element.append(button);
      }
    }
  }
  document.addEventListener('pointerover', event => { const button=trigger(event.target); if(button) open(button); if(panel.contains(event.target as Node)) clearTimeout(timer); });
  document.addEventListener('pointerout', event => { if(trigger(event.target) || panel.contains(event.target as Node)) delayClose(); });
  document.addEventListener('focusin', event => {if(restoring) return; const button=trigger(event.target); if(button) open(button); else if(!panel.contains(event.target as Node)) close();});
  document.addEventListener('focusout', delayClose);
  document.addEventListener('click', event => {
    const button=trigger(event.target);
    if(button){ event.preventDefault(); event.stopPropagation(); if(active===button && pinned) close(); else {open(button); pinned=true;} }
    else if(!panel.contains(event.target as Node)) close();
  }, true);
  document.addEventListener('keydown', event => {
    if(event.key==='ArrowDown' && trigger(event.target)){event.preventDefault();open(trigger(event.target)!);panel.focus();}
    if(event.key==='Escape' && active){event.preventDefault(); const restore=panel.contains(document.activeElement);close(restore);}
    // Help text is keyboard-scrollable; do not let the editor Space shortcut play audio.
    if(panel.contains(event.target as Node) && event.code==='Space') event.stopPropagation();
  });
  document.addEventListener('astra:tab-change',()=>close());
  window.addEventListener('resize',()=>close());
  window.addEventListener('scroll',event=>{if(!panel.contains(event.target as Node)) close();},true);
  attach();
  // Only added/removed elements matter: ignore meter text and our own inserted buttons.
  const observer = new MutationObserver(records => {
    if(active && !active.isConnected) close();
    if(records.some(record => [...record.addedNodes].some(node => node instanceof Element && !node.classList.contains('help-trigger')))) attach();
  });
  observer.observe(main,{childList:true,subtree:true});
  window.addEventListener('pagehide',()=>{close();observer.disconnect();},{once:true});
}
