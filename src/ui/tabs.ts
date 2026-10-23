export function initTabs(): void {
  const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>('.tab'));
  const panels = Array.from(document.querySelectorAll<HTMLElement>('.tab-panel'));
  for (const tab of tabs) {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => { t.classList.toggle('active', t === tab); t.setAttribute('aria-selected', String(t === tab)); });
      document.dispatchEvent(new CustomEvent('astra:tab-change', {detail: tab.dataset.tab}));
      panels.forEach((p) => p.classList.toggle('active', p.id === `tab-${tab.dataset.tab}`));
    });
  }
}
