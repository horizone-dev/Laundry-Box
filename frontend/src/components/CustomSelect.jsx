import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import styles from './CustomSelect.module.css';

export default function CustomSelect({ value, onChange, options, style, paddingLeft = '0px' }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className={styles.selectContainer} ref={dropdownRef} style={style}>
      <div 
        className={`${styles.selectHeader} ${isOpen ? styles.activeHeader : ''}`} 
        onClick={() => setIsOpen(!isOpen)}
        style={{ paddingLeft: paddingLeft !== '0px' ? `calc(1rem + ${paddingLeft})` : '1rem' }}
      >
        <span className={styles.selectedValue}>{selectedOption ? selectedOption.label : 'Select option'}</span>
        <ChevronDown size={16} className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`} />
      </div>
      {isOpen && (
        <div className={styles.selectList}>
          {options.map(opt => (
            <div
              key={opt.value}
              className={`${styles.selectItem} ${value === opt.value ? styles.selected : ''}`}
              onClick={() => {
                onChange({ target: { value: opt.value } });
                setIsOpen(false);
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
