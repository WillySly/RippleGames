document.addEventListener('DOMContentLoaded', () => {
  const toggleButton = document.getElementById('menu-toggle');
  const collapsibleMenu = document.getElementById('navbar-collapsible');

  if (!toggleButton || !collapsibleMenu) return;

  const closeMenu = () => {
    collapsibleMenu.classList.remove('open');
    toggleButton.setAttribute('aria-expanded', 'false');
    toggleButton.classList.remove('is-active');
  };

  toggleButton.addEventListener('click', () => {
    const isOpen = collapsibleMenu.classList.toggle('open');
    toggleButton.setAttribute('aria-expanded', String(isOpen));
    toggleButton.classList.toggle('is-active', isOpen);
  });

  collapsibleMenu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', closeMenu);
  });
});
