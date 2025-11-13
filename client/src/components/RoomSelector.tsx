import React, { useState } from 'react';

interface RoomSelectorProps {
    currentRoomId: string;
    onRoomChange: (roomId: string) => void;
    isConnected: boolean;
}

const RoomSelector: React.FC<RoomSelectorProps> = ({ currentRoomId, onRoomChange, isConnected }) => {
    const [showSelector, setShowSelector] = useState(false);
    const [newRoomId, setNewRoomId] = useState(currentRoomId);

    const handleRoomChange = () => {
        if (newRoomId.trim() && newRoomId !== currentRoomId) {
            onRoomChange(newRoomId.trim());
            setShowSelector(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleRoomChange();
        }
    };

    return (
        <div style={{
            position: 'absolute',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 15,
            background: 'rgba(255, 255, 255, 0.95)',
            padding: '15px',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
            minWidth: '300px'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <span style={{ fontWeight: 'bold', fontSize: '16px' }}>Комната: {currentRoomId}</span>
                <button
                    onClick={() => setShowSelector(!showSelector)}
                    style={{
                        padding: '4px 8px',
                        border: '1px solid #ccc',
                        background: 'white',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                    }}
                >
                    {showSelector ? 'Отмена' : 'Сменить'}
                </button>
            </div>
            
            {showSelector && (
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <input
                        type="text"
                        value={newRoomId}
                        onChange={(e) => setNewRoomId(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Введите ID комнаты"
                        style={{
                            flex: 1,
                            padding: '8px',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            fontSize: '14px'
                        }}
                    />
                    <button
                        onClick={handleRoomChange}
                        disabled={!isConnected || !newRoomId.trim() || newRoomId === currentRoomId}
                        style={{
                            padding: '8px 16px',
                            border: '1px solid #ccc',
                            background: isConnected && newRoomId.trim() && newRoomId !== currentRoomId ? '#4CAF50' : '#ccc',
                            color: 'white',
                            borderRadius: '4px',
                            cursor: isConnected && newRoomId.trim() && newRoomId !== currentRoomId ? 'pointer' : 'not-allowed',
                            fontSize: '14px'
                        }}
                    >
                        Присоединиться
                    </button>
                </div>
            )}
            
            {!isConnected && (
                <div style={{ 
                    marginTop: '10px', 
                    padding: '8px', 
                    background: '#fff3cd', 
                    border: '1px solid #ffeaa7',
                    borderRadius: '4px',
                    fontSize: '12px',
                    color: '#856404'
                }}>
                    Подключение к серверу...
                </div>
            )}
        </div>
    );
};

export default RoomSelector; 