import React from 'react';
import styles from './QueueList.module.css';
import { useAppContext } from '../../../../contexts/AppContext';

const QueueList = () => {
    const { analysisQueue, removeFromQueue } = useAppContext();

    return (
        <div className={styles.listSection}>
            <div className={styles.headerRow}>
                <label className={styles.label}>分析队列: ({analysisQueue.length} 个文件)</label>
            </div>
            <div className={styles.queueList}>
                {analysisQueue.length === 0 ? (
                    <div className={styles.emptyQueue}>队列为空</div>
                ) : (
                    analysisQueue.map((file) => (
                        <div
                            key={file.id}
                            className={styles.queueItem}
                        >
                            <span className={styles.queueName}>{file.name}</span>
                            <button
                                className={styles.btnRemove}
                                onClick={() => removeFromQueue(file.id)}
                                title="移除此项"
                            >
                                ×
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default QueueList; 