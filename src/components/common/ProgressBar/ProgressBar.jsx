import React from 'react';
import styles from './ProgressBar.module.css';

const ProgressBar = ({ percentage }) => {
    return (
        <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${percentage}%` }}></div>
        </div>
    );
};

export default ProgressBar; 