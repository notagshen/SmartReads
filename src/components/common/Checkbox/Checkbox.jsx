import React, { useEffect, useRef } from 'react';
import styles from './Checkbox.module.css';

const Checkbox = ({
    checked = false,
    indeterminate = false,
    onChange,
    disabled = false,
    label,
    size = 'md', // 'sm' | 'md' | 'lg'
    id,
    name
}) => {
    const inputRef = useRef(null);

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.indeterminate = indeterminate && !checked;
        }
    }, [indeterminate, checked]);

    return (
        <label className={`${styles.checkbox} ${styles[size]} ${disabled ? styles.disabled : ''}`} htmlFor={id}>
            <input
                ref={inputRef}
                id={id}
                name={name}
                type="checkbox"
                className={styles.input}
                checked={checked}
                onChange={(e) => onChange && onChange(e.target.checked, e)}
                disabled={disabled}
            />
            <span className={styles.control} aria-hidden>
                <svg viewBox="0 0 20 20" className={styles.iconCheck}>
                    <polyline points="4 11 8 15 16 6" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <svg viewBox="0 0 20 20" className={styles.iconInd}>
                    <line x1="5" y1="10" x2="15" y2="10" strokeWidth="2" strokeLinecap="round" />
                </svg>
            </span>
            {label && <span className={styles.label}>{label}</span>}
        </label>
    );
};

export default Checkbox; 