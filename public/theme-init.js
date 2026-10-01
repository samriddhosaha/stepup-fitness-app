// Runs before first paint (and before the app bundle) so dark-mode users never see a light flash.
// The Profile > Appearance setting caches its value in localStorage under this key.
try {
  var a = localStorage.getItem('stepup-appearance')
  if (a === 'light' || a === 'dark') document.documentElement.setAttribute('data-theme', a)
} catch {}
