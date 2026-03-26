import React from 'react';
import styles from './Button.module.css';

const Button = ({ label, onClick, variant = 'primary', icon, fullWidth = false, disabled = false }) => {
    const buttonClasses = `
        ${styles.btn}
        ${styles[variant]}
        ${fullWidth ? styles.fullWidth : ''}
    `;

    return (
        <button className={buttonClasses} onClick={onClick} disabled={disabled}>
            {icon && <span className={styles.icon}>{icon}</span>}
            {label}
        </button>
    );
};

export default Button; 