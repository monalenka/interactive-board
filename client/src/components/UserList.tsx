import React from 'react';

interface UserListProps {
    connectedUsers: string[];
    currentUserId: string;
}

const UserList: React.FC<UserListProps> = ({ connectedUsers, currentUserId }) => {
    return (
        <div style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            zIndex: 10,
            background: 'rgba(255, 255, 255, 0.9)',
            padding: '15px',
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
            minWidth: '200px'
        }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>Подключенные пользователи</h3>
            <div style={{ marginBottom: '8px' }}>
                <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    padding: '4px 0'
                }}>
                    <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: '#4CAF50'
                    }}></div>
                    <span style={{ fontSize: '14px' }}>Вы (Вы)</span>
                </div>
            </div>
            {connectedUsers.map((userId, index) => (
                <div key={userId} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    padding: '4px 0'
                }}>
                    <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: '#2196F3'
                    }}></div>
                    <span style={{ fontSize: '14px' }}>Пользователь {index + 1}</span>
                </div>
            ))}
            {connectedUsers.length === 0 && (
                <div style={{ 
                    fontSize: '14px', 
                    color: '#666', 
                    fontStyle: 'italic',
                    padding: '4px 0'
                }}>
                    Только вы в комнате
                </div>
            )}
        </div>
    );
};

export default UserList; 