(function() {
  try {
    var savedTheme = localStorage.getItem('theme');
    var theme = savedTheme || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', theme);
    // Folded by default: collapse unless user explicitly set to 'false'
    if (localStorage.getItem('sidebar_collapsed') !== 'false') {
      document.documentElement.classList.add('sidebar-collapsed');
    }
  } catch (e) {}
})();
