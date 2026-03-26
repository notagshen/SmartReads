import React from 'react';
import styles from './Header.module.css';
import { useAppContext } from '../../contexts/AppContext';
import { FaMoon, FaSun, FaCog } from 'react-icons/fa';

const Header = () => {
    const { theme, toggleTheme, openSettingsModal } = useAppContext();

    const handleThemeToggle = () => {
        // 添加主题切换动画效果
        document.body.style.transition = 'background-color 0.5s ease, color 0.5s ease';
        toggleTheme();
    };

    const handleLogoClick = () => {
        window.location.assign(window.location.origin);
    };

    return (
        <header className={`${styles.header} animate-slide-down`}>
            <div className={styles.headerContent}>
                <button
                    type="button"
                    className={`${styles.logo} ${styles.logoButton}`}
                    onClick={handleLogoClick}
                    title="返回主域名首页"
                >
                    <i className="fas fa-book-open"></i>
                    <span>SmartReads</span>
                </button>
                <div className={styles.headerActions}>
                    <button 
                        className={`${styles.btnIcon} ${styles.themeToggle}`} 
                        onClick={handleThemeToggle}
                        title={theme === 'light' ? '切换到暗色主题' : '切换到亮色主题'}
                    >
                        {theme === 'light' ? <FaMoon /> : <FaSun />}
                    </button>
                    <button 
                        className={styles.btnIcon} 
                        onClick={openSettingsModal}
                        title="打开设置"
                    >
                        <FaCog />
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Header; 
