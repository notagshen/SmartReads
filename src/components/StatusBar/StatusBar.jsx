import React from 'react';
import styles from './StatusBar.module.css';
import { useAppContext } from '../../contexts/AppContext';
import { FaCircle, FaFile } from 'react-icons/fa';

const StatusBar = () => {
    const { chapterFiles, apiConnectionStatus } = useAppContext();

    return (
        <footer className={styles.statusBar}>
            <div className={styles.statusLeft}>
                <span className={`${styles.statusItem} ${apiConnectionStatus.isConnected ? styles.success : styles.error}`}>
                    <FaCircle />
                    {apiConnectionStatus.isConnected ? 'API已连接' : 'API未连接'}
                </span>
                <span className={styles.statusItem}>
                    <FaFile />
                    已加载 {chapterFiles.length} 个文件
                </span>
            </div>
            <div className={styles.statusRight}>
                <span className={styles.statusItem}>v1.0.0-beta</span>
            </div>
        </footer>
    );
};

export default StatusBar; 