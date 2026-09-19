(() => {
  const query = document.querySelector('#feature-query');
  const groups = [...document.querySelectorAll('.feature-group')];
  const cards = [...document.querySelectorAll('.feature-card')];
  const originalOpen = new Map();
  groups.forEach(group => group.querySelectorAll('.feature-card').forEach((card, i) => card.style.setProperty('--i', Math.min(i, 12))));
  let searching = false;
  function filter() {
    const terms = query.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length && !searching) groups.forEach(group => originalOpen.set(group, group.open));
    let total = 0;
    for (const group of groups) {
      let count = 0;
      for (const card of group.querySelectorAll('.feature-card')) {
        const text = card.textContent.toLocaleLowerCase();
        const matches = terms.every(term => text.includes(term));
        card.hidden = !matches;
        if (matches) count++;
      }
      group.hidden = count === 0;
      group.querySelector('.feature-group-count').textContent = count + '가지';
      if (terms.length) group.open = count > 0;
      else if (searching) group.open = originalOpen.get(group);
      total += count;
    }
    searching = terms.length > 0;
    document.querySelector('#feature-result').textContent = searching
      ? `${cards.length}가지 중 ${total}가지 기능` : `${cards.length}가지 기능 안내`;
    document.querySelector('#feature-empty').hidden = total > 0;
  }
  query.addEventListener('input', filter);
  document.querySelector('#feature-clear').addEventListener('click', () => {
    query.value = ''; filter(); query.focus();
  });
  filter();
  document.querySelector('.feature-search').hidden = false;
})();
