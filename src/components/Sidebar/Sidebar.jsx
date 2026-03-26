import React, { useState } from 'react';
import styles from './Sidebar.module.css';
import { FaFileImport, FaBrain } from 'react-icons/fa';
import TabButton from '../common/TabButton/TabButton';
import PreprocessPanel from './PreprocessPanel/PreprocessPanel';
import AnalysisPanel from './AnalysisPanel/AnalysisPanel';

const Sidebar = () => {
  const [activeTab, setActiveTab] = useState('preprocess');

  return (
    <aside className={styles.sidebar}>
      <nav className={styles.navTabs}>
        <TabButton
          icon={<FaFileImport />}
          label="预处理"
          isActive={activeTab === 'preprocess'}
          onClick={() => setActiveTab('preprocess')}
        />
        <TabButton
          icon={<FaBrain />}
          label="分析"
          isActive={activeTab === 'analysis'}
          onClick={() => setActiveTab('analysis')}
        />
      </nav>
      <div className={styles.tabContent}>
        {activeTab === 'preprocess' && <PreprocessPanel />}
        {activeTab === 'analysis' && <AnalysisPanel />}
      </div>
    </aside>
  );
};

export default Sidebar; 