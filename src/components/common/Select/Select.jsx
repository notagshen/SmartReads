import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import styles from './Select.module.css';

const Select = ({
    label,
    options = [],
    value,
    defaultValue,
    onChange,
    disabled = false,
    placeholder,
    size = 'md', // 'sm' | 'md' | 'lg'
    fullWidth = true,
    name,
    id
}) => {
    // 兼容受控/非受控
    const isControlled = value !== undefined;
    const [internalValue, setInternalValue] = useState(defaultValue ?? '');
    const currentValue = isControlled ? value : internalValue;

    const [open, setOpen] = useState(false);
    const controlWrapRef = useRef(null);
    const listRef = useRef(null);

    const selectedOption = useMemo(() => options.find(o => String(o.value) === String(currentValue)), [options, currentValue]);

    const emitChange = useCallback((nextValue) => {
        if (!isControlled) setInternalValue(nextValue);
        if (onChange) {
            // 兼容旧签名：onChange(e) -> e.target.value
            onChange({ target: { value: nextValue, name, id } });
        }
    }, [isControlled, onChange, name, id]);

    const handleToggle = () => {
        if (disabled) return;
        setOpen(v => !v);
    };

    const handleSelect = (v) => {
        emitChange(v);
        setOpen(false);
    };

    // 关闭逻辑
    useEffect(() => {
        const onDocClick = (e) => {
            if (!controlWrapRef.current) return;
            if (!controlWrapRef.current.contains(e.target)) setOpen(false);
        };
        const onEsc = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onDocClick);
        document.addEventListener('keydown', onEsc);
        return () => {
            document.removeEventListener('mousedown', onDocClick);
            document.removeEventListener('keydown', onEsc);
        };
    }, []);

    // 键盘导航
    useEffect(() => {
        if (!open || !listRef.current) return;
        const activeIdx = Math.max(options.findIndex(o => String(o.value) === String(currentValue)), 0);
        const items = listRef.current.querySelectorAll(`.${styles.option}`);
        if (items[activeIdx]) items[activeIdx].scrollIntoView({ block: 'nearest' });
    }, [open, currentValue, options]);

    const onKeyDown = (e) => {
        if (!open) {
            if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setOpen(true);
            }
            return;
        }
        const idx = options.findIndex(o => String(o.value) === String(currentValue));
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const next = options[Math.min(idx + 1, options.length - 1)] || options[idx];
            if (next) emitChange(next.value);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prev = options[Math.max(idx - 1, 0)] || options[idx];
            if (prev) emitChange(prev.value);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            setOpen(false);
        } else if (e.key === 'Escape') {
            setOpen(false);
        }
    };

    return (
        <div className={`${styles.formGroup} ${fullWidth ? styles.fullWidth : ''}`}>
            {label && (
                <label className={styles.label} htmlFor={id}>{label}</label>
            )}

            <div className={styles.controlWrap} ref={controlWrapRef}>
                <button
                    id={id}
                    name={name}
                    type="button"
                    className={`${styles.trigger} ${styles[size]} ${disabled ? styles.disabled : ''}`}
                    onClick={handleToggle}
                    onKeyDown={onKeyDown}
                    aria-haspopup="listbox"
                    aria-expanded={open}
                    disabled={disabled}
                >
                    <span className={`${styles.value} ${!selectedOption ? styles.placeholder : ''}`}>
                        {selectedOption ? selectedOption.label : (placeholder || '请选择')}
                    </span>
                    <span className={`${styles.caret} ${open ? styles.caretOpen : ''}`} aria-hidden>▾</span>
                </button>

                {open && (
                    <div className={styles.menu} role="listbox" ref={listRef} tabIndex={-1}>
                        {options.map((opt) => {
                            const selected = String(opt.value) === String(currentValue);
                            return (
                                <div
                                    key={opt.value}
                                    className={`${styles.option} ${selected ? styles.optionSelected : ''}`}
                                    role="option"
                                    aria-selected={selected}
                                    onClick={() => handleSelect(opt.value)}
                                >
                                    <span className={styles.optionLabel}>{opt.label}</span>
                                    {selected && <span className={styles.check}>✓</span>}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Select; 