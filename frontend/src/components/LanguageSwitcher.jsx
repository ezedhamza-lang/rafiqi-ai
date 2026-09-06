/**
 * Language Switcher Component - Batch 6
 * 
 * Provides a toggle button to switch between Arabic (RTL) and English (LTR).
 * Integrates with the existing i18n system and persists choice in localStorage.
 * 
 * Features:
 * - Animated language toggle
 * - Flag icons for visual indication
 * - Smooth direction transition
 * - Accessible (ARIA labels, keyboard navigation)
 * - Syncs with Backend locale API (optional)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useI18n } from '../i18n/index.jsx';

// Flag emoji or SVG icons for languages
const LANGUAGE_OPTIONS = [
  {
    code: 'ar',
    name: 'العربية',
    nameEn: 'Arabic',
    flag: '🇹🇳', // Tunisia flag (can be changed)
    dir: 'rtl',
    label: 'التبديل إلى العربية'
  },
  {
    code: 'en',
    name: 'English',
    nameEn: 'English',
    flag: '🇬🇧', // UK/US flag
    dir: 'ltr',
    label: 'Switch to English'
  }
];

export default function LanguageSwitcher({ 
  compact = false, 
  showLabel = true,
  className = '',
  onLanguageChange 
}) {
  const { lang, setLang, t } = useI18n();
  const [isChanging, setIsChanging] = useState(false);
  
  // Get current and next language
  const currentLang = LANGUAGE_OPTIONS.find(l => l.code === lang) || LANGUAGE_OPTIONS[0];
  const nextLang = LANGUAGE_OPTIONS.find(l => l.code !== lang) || LANGUAGE_OPTIONS[1];
  
  /**
   * Handle language change with smooth transition
   */
  const handleLanguageChange = useCallback(async () => {
    if (isChanging) return;
    
    setIsChanging(true);
    
    try {
      // Add transition class to document
      document.body.classList.add('direction-changing');
      
      // Change language
      await setLang(nextLang.code);
      
      // Call optional callback
      if (onLanguageChange) {
        onLanguageChange(nextLang.code, nextLang.dir);
      }
      
      // Remove transition class after animation
      setTimeout(() => {
        document.body.classList.remove('direction-changing');
        setIsChanging(false);
      }, 300); // Match CSS transition duration
      
    } catch (error) {
      console.error('Language change error:', error);
      setIsChanging(false);
      document.body.classList.remove('direction-changing');
    }
  }, [setLang, isChanging, onLanguageChange, nextLang]);
  
  /**
   * Keyboard handler for accessibility
   */
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleLanguageChange();
    }
  }, [handleLanguageChange]);
  
  // Compact version (small icon only)
  if (compact) {
    return (
      <button
        onClick={handleLanguageChange}
        onKeyDown={handleKeyDown}
        className={`language-switcher-compact ${className}`}
        title={t(`header.switchTo${currentLang.code === 'ar' ? 'En' : 'Ar'}`)}
        aria-label={t(`header.switchTo${currentLang.code === 'ar' ? 'En' : 'Ar'}`)}
        type="button"
        disabled={isChanging}
      >
        <span className="flag-icon" role="img" aria-label={currentLang.nameEn}>
          {nextLang.flag}
        </span>
        {isChanging && <span className="spinner-small" />}
      </button>
    );
  }
  
  // Full version (flag + text)
  return (
    <div className={`language-switcher ${className}`} role="group" aria-label="Language selector">
      {/* Current Language Display */}
      <div className="language-current" aria-live="polite">
        <span className="flag-icon" role="img" aria-label={currentLang.nameEn}>
          {currentLang.flag}
        </span>
        {showLabel && (
          <span className="language-name">
            {currentLang.code === 'ar' ? currentLang.name : currentLang.nameEn}
          </span>
        )}
      </div>
      
      {/* Toggle Button */}
      <button
        onClick={handleLanguageChange}
        onKeyDown={handleKeyDown}
        className="language-toggle-btn"
        title={t(`header.switchTo${currentLang.code === 'ar' ? 'En' : 'Ar'}`)}
        aria-label={t(`header.switchTo${currentLang.code === 'ar' ? 'En' : 'Ar'}`)}
        type="button"
        disabled={isChanging}
      >
        <span className="toggle-content">
          <span className="flag-icon flag-next" role="img" aria-label={nextLang.nameEn}>
            {nextLang.flag}
          </span>
          {showLabel && (
            <span className="language-name language-next">
              {nextLang.code === 'ar' ? nextLang.name : nextLang.nameEn}
            </span>
          )}
          <span className="toggle-arrow">→</span>
        </span>
        
        {isChanging && (
          <span className="loading-overlay" aria-hidden="true">
            <span className="spinner" />
          </span>
        )}
      </button>
      
      {/* Direction Indicator */}
      <span className="dir-indicator" aria-hidden="true">
        {currentLang.dir.toUpperCase()}
      </span>
    </div>
  );
}

/**
 * Minimal Language Switcher for mobile/navbars
 * Just a small clickable flag that toggles
 */
export function MiniLanguageSwitcher({ className = '', onLanguageChange }) {
  const { lang, setLang, t } = useI18n();
  
  const nextLang = lang === 'ar' ? 'en' : 'ar';
  const nextFlag = lang === 'ar' ? '🇬🇧' : '🇹🇳';
  
  const handleClick = () => {
    setLang(nextLang);
    if (onLanguageChange) onLanguageChange(nextLang, nextLang === 'ar' ? 'rtl' : 'ltr');
  };
  
  return (
    <button
      onClick={handleClick}
      className={`mini-lang-switch ${className}`}
      title={t(`header.switchTo${lang === 'ar' ? 'En' : 'Ar'}`)}
      aria-label={t(`header.switchTo${lang === 'ar' ? 'En' : 'Ar'}`)}
      type="button"
    >
      <span role="img" aria-label={nextLang === 'ar' ? 'العربية' : 'English'}>
        {nextFlag}
      </span>
    </button>
  );
}

/**
 * Dropdown Language Selector
 * Shows all available languages in a dropdown menu
 */
export function LanguageDropdown({ className = '', onLanguageChange }) {
  const { lang, setLang } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const ref = React.useRef(null);
  
  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (ref.current && !ref.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const handleSelect = (code) => {
    const selected = LANGUAGE_OPTIONS.find(l => l.code === code);
    setLang(code);
    setIsOpen(false);
    if (onLanguageChange) onLanguageChange(code, selected?.dir);
  };
  
  const currentLang = LANGUAGE_OPTIONS.find(l => l.code === lang) || LANGUAGE_OPTIONS[0];
  
  return (
    <div className={`language-dropdown ${className}`} ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="dropdown-trigger"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        type="button"
      >
        <span className="flag-icon" role="img">{currentLang.flag}</span>
        <span className="current-lang-name">
          {currentLang.code === 'ar' ? currentLang.name : currentLang.nameEn}
        </span>
        <span className={`dropdown-arrow ${isOpen ? 'open' : ''}`}>▼</span>
      </button>
      
      {isOpen && (
        <ul className="dropdown-menu" role="listbox" aria-label="Select language">
          {LANGUAGE_OPTIONS.map(option => (
            <li
              key={option.code}
              role="option"
              aria-selected={option.code === lang}
              className={option.code === lang ? 'selected' : ''}
            >
              <button
                onClick={() => handleSelect(option.code)}
                className="dropdown-option"
                type="button"
              >
                <span className="flag-icon" role="img">{option.flag}</span>
                <span className="option-name">
                  {option.code === 'ar' ? option.name : option.nameEn}
                </span>
                {option.code === lang && <span className="check-mark">✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export { LANGUAGE_OPTIONS };
