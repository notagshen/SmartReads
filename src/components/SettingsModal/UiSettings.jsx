import React from 'react';
import styles from './UiSettings.module.css';
import { useAppContext } from '../../contexts/AppContext';

const UiSettings = () => {
    const { theme, setTheme } = useAppContext();

    return (
        <form className={styles.form}>
            <div className={styles.formGroup}>
                <label>主题:</label>
                <div className={styles.radioGroup}>
                    <label className={styles.radioItem}>
                        <input 
                            type="radio" 
                            name="theme" 
                            value="light" 
                            checked={theme === 'light'}
                            onChange={(e) => setTheme(e.target.value)}
                        />
                        <span>亮色主题</span>
                    </label>
                    <label className={styles.radioItem}>
                        <input 
                            type="radio" 
                            name="theme" 
                            value="dark" 
                            checked={theme === 'dark'}
                            onChange={(e) => setTheme(e.target.value)}
                        />
                        <span>暗色主题</span>
                    </label>
                    {/* <label className={styles.radioItem}>
                        <input 
                            type="radio" 
                            name="theme" 
                            value="system" 
                            checked={theme === 'system'}
                            onChange={(e) => setTheme(e.target.value)}
                        />
                        <span>跟随系统</span>
                    </label> */}
                </div>
            </div>
        </form>
    );
};

export default UiSettings; 