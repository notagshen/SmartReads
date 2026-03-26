import React from 'react';
import styles from './TabButton.module.css';

const TabButton = ({ icon, label, isActive, onClick }) => {
  const buttonClasses = `${styles.navTab} ${isActive ? styles.active : ''}`;
  return (
    <button className={buttonClasses} onClick={onClick}>
      <span className={styles.icon}>{icon}</span>
      <span>{label}</span>
    </button>
  );
};

export default TabButton; 