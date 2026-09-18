import { useTheme } from '../context/ThemeContext.jsx';

export default function DarkModeToggle() {
  const { theme, toggle } = useTheme();

  return (
    <button
      className="dark-mode-toggle"
      onClick={toggle}
      title={theme === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <span className="material-icons" style={{ fontSize: '1.1rem' }}>
        {theme === 'dark' ? 'light_mode' : 'dark_mode'}
      </span>
    </button>
  );
}
