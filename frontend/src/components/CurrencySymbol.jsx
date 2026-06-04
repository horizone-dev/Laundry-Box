import React from 'react';
import { useSettings } from '../store/SettingsContext';

export default function CurrencySymbol({ size = 16, className = "" }) {
  const { settings } = useSettings();
  
  return (
    <span 
      className={className}
      style={{ 
        fontSize: typeof size === 'number' ? `${size}px` : size,
        fontWeight: 700,
        color: 'inherit',
        marginRight: '2px',
        fontFamily: 'inherit',
        display: 'inline-block',
        direction: 'ltr',
        unicodeBidi: 'bidi-override'
      }}
    >
      {settings?.currencySymbol || 'د.إ'}
    </span>
  );
}
