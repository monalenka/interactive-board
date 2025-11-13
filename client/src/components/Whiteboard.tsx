import React, { useEffect, useRef, useState, useCallback } from 'react';
import { fabric } from 'fabric';
import { io, Socket } from 'socket.io-client';

// Вспомогательная функция для преобразования hex в rgba
const hexToRgba = (hex: string, opacity: number): string => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const Whiteboard: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
    const [activeTool, setActiveTool] = useState<'pencil' | 'select' | 'text' | 'eraser' | 'hand'>('pencil');
    const [brushColor, setBrushColor] = useState('#000000');
    const [brushOpacity, setBrushOpacity] = useState(1);
    const [brushSize, setBrushSize] = useState(5);
    const [eraserSize, setEraserSize] = useState(20);
    const [showBrushSettings, setShowBrushSettings] = useState(false);
    const [showEraserSettings, setShowEraserSettings] = useState(false);
    const [zoomLevel, setZoomLevel] = useState(100);
    const isErasing = useRef(false);
    const isPanning = useRef(false);
    const lastPosX = useRef(0);
    const lastPosY = useRef(0);
    const socketRef = useRef<Socket | null>(null);
    const [roomId, setRoomId] = useState<string>('room1'); // По умолчанию комната 1
    const [isConnected, setIsConnected] = useState(false);
    const [connectedUsers, setConnectedUsers] = useState<string[]>([]);

    // Инициализация сокета
    useEffect(() => {
        // Создаем подключение к серверу
        const socket = io('http://localhost:3001');
        socketRef.current = socket;

        // Обработчики событий сокета
        socket.on('connect', () => {
            console.log('Connected to server');
            setIsConnected(true);
            
            // Присоединяемся к комнате
            socket.emit('join-room', roomId);
        });

        socket.on('disconnect', () => {
            console.log('Disconnected from server');
            setIsConnected(false);
        });

        socket.on('user-joined', (userId: string) => {
            console.log('User joined:', userId);
            setConnectedUsers(prev => [...prev, userId]);
        });

        socket.on('user-left', (userId: string) => {
            console.log('User left:', userId);
            setConnectedUsers(prev => prev.filter(id => id !== userId));
        });

        socket.on('whiteboard-state', (data: any) => {
            console.log('Received whiteboard state');
            if (fabricCanvasRef.current && data) {
                fabricCanvasRef.current.loadFromJSON(data, () => {
                    fabricCanvasRef.current?.renderAll();
                });
            }
        });

        socket.on('whiteboard-change', (data: any) => {
            console.log('Received whiteboard change');
            if (fabricCanvasRef.current && data) {
                fabricCanvasRef.current.loadFromJSON(data, () => {
                    fabricCanvasRef.current?.renderAll();
                });
            }
        });

        return () => {
            socket.disconnect();
        };
    }, [roomId]);

    // Функция для отправки изменений на сервер
    const sendWhiteboardChange = useCallback((data: any) => {
        if (socketRef.current && isConnected) {
            socketRef.current.emit('whiteboard-change', data);
        }
    }, [isConnected]);

    // Обработчик удаления объектов по клавише Delete
    const handleKeyPress = useCallback((event: KeyboardEvent) => {
        if (fabricCanvasRef.current && event.key === 'Delete') {
            const activeObject = fabricCanvasRef.current.getActiveObject();
            if (activeObject) {
                fabricCanvasRef.current.remove(activeObject);
                fabricCanvasRef.current.discardActiveObject();
                fabricCanvasRef.current.renderAll();
                
                // Отправляем изменения на сервер
                const jsonData = fabricCanvasRef.current.toJSON();
                sendWhiteboardChange(jsonData);
            }
        }
    }, [sendWhiteboardChange]);

    // Функция для изменения масштаба
    const handleZoom = useCallback((delta: number, point: { x: number; y: number }) => {
        if (!fabricCanvasRef.current) return;

        let zoom = fabricCanvasRef.current.getZoom();
        zoom *= 0.999 ** delta;

        // Ограничиваем масштаб (10% - 500%)
        if (zoom > 5) zoom = 5;
        if (zoom < 0.1) zoom = 0.1;

        fabricCanvasRef.current.zoomToPoint(new fabric.Point(point.x, point.y), zoom);
        setZoomLevel(Math.round(zoom * 100));
        fabricCanvasRef.current.renderAll();
    }, []);

    // Функция для установки конкретного значения масштаба
    const setZoom = useCallback((level: number) => {
        if (!fabricCanvasRef.current) return;

        // Преобразуем проценты в коэффициент масштабирования
        const zoom = level / 100;

        // Ограничиваем масштаб (10% - 500%)
        if (zoom > 5) return;
        if (zoom < 0.1) return;

        const center = {
            x: fabricCanvasRef.current.getWidth() / 2,
            y: fabricCanvasRef.current.getHeight() / 2
        };

        fabricCanvasRef.current.zoomToPoint(new fabric.Point(center.x, center.y), zoom);
        setZoomLevel(level);
        fabricCanvasRef.current.renderAll();
    }, []);

    useEffect(() => {
        if (!canvasRef.current) return;

        // Создаем холст с большими размерами для бесконечной доски
        fabricCanvasRef.current = new fabric.Canvas(canvasRef.current, {
            width: window.innerWidth,
            height: window.innerHeight,
            isDrawingMode: true,
        });

        // Увеличиваем размер виртуального холста для бесконечной доски
        if (fabricCanvasRef.current) {
            fabricCanvasRef.current.setWidth(4000);
            fabricCanvasRef.current.setHeight(4000);

            // Центрируем viewport
            fabricCanvasRef.current.viewportTransform = [1, 0, 0, 1, 2000 - window.innerWidth / 2, 2000 - window.innerHeight / 2];

            // Настраиваем кисть по умолчанию
            fabricCanvasRef.current.freeDrawingBrush.width = brushSize;
            fabricCanvasRef.current.freeDrawingBrush.color = hexToRgba(brushColor, brushOpacity);

            // Добавляем обработчики событий для синхронизации
            fabricCanvasRef.current.on('path:created', () => {
                const jsonData = fabricCanvasRef.current?.toJSON();
                if (jsonData) {
                    sendWhiteboardChange(jsonData);
                }
            });

            fabricCanvasRef.current.on('object:added', () => {
                const jsonData = fabricCanvasRef.current?.toJSON();
                if (jsonData) {
                    sendWhiteboardChange(jsonData);
                }
            });

            fabricCanvasRef.current.on('object:modified', () => {
                const jsonData = fabricCanvasRef.current?.toJSON();
                if (jsonData) {
                    sendWhiteboardChange(jsonData);
                }
            });

            fabricCanvasRef.current.on('object:removed', () => {
                const jsonData = fabricCanvasRef.current?.toJSON();
                if (jsonData) {
                    sendWhiteboardChange(jsonData);
                }
            });
        }

        // Добавляем обработчик клавиши Delete
        window.addEventListener('keydown', handleKeyPress);

        // Добавляем обработчик колесика мыши для масштабирования
        const handleWheel = (event: WheelEvent) => {
            if (!fabricCanvasRef.current) return;

            event.preventDefault();
            const point = {
                x: event.offsetX,
                y: event.offsetY
            };

            handleZoom(event.deltaY, point);
        };

        if (canvasRef.current) {
            canvasRef.current.addEventListener('wheel', handleWheel);
        }

        const handleResize = () => {
            if (fabricCanvasRef.current) {
                fabricCanvasRef.current.setWidth(window.innerWidth);
                fabricCanvasRef.current.setHeight(window.innerHeight);
                fabricCanvasRef.current.renderAll();
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('keydown', handleKeyPress);
            window.removeEventListener('resize', handleResize);
            if (canvasRef.current) {
                canvasRef.current.removeEventListener('wheel', handleWheel);
            }
            if (fabricCanvasRef.current) {
                fabricCanvasRef.current.dispose();
            }
        };
    }, [handleKeyPress, handleZoom, sendWhiteboardChange]);

    // Обновляем кисть при изменении цвета, прозрачности или размера
    useEffect(() => {
        if (fabricCanvasRef.current && activeTool === 'pencil') {
            fabricCanvasRef.current.freeDrawingBrush.width = brushSize;
            fabricCanvasRef.current.freeDrawingBrush.color = hexToRgba(brushColor, brushOpacity);
        }
    }, [brushColor, brushOpacity, brushSize, activeTool]);

    // Функция для изменения инструмента
    const changeTool = (tool: 'pencil' | 'select' | 'text' | 'eraser' | 'hand') => {
        if (!fabricCanvasRef.current) return;

        // Удаляем все обработчики событий
        fabricCanvasRef.current.off('mouse:down');
        fabricCanvasRef.current.off('mouse:move');
        fabricCanvasRef.current.off('mouse:up');

        setActiveTool(tool);
        setShowBrushSettings(tool === 'pencil');
        setShowEraserSettings(tool === 'eraser');

        if (tool === 'pencil') {
            fabricCanvasRef.current.isDrawingMode = true;
            fabricCanvasRef.current.freeDrawingBrush.width = brushSize;
            fabricCanvasRef.current.freeDrawingBrush.color = hexToRgba(brushColor, brushOpacity);
            fabricCanvasRef.current.selection = false;
            fabricCanvasRef.current.defaultCursor = 'crosshair';
        } else if (tool === 'select') {
            fabricCanvasRef.current.isDrawingMode = false;
            fabricCanvasRef.current.selection = true;
            fabricCanvasRef.current.defaultCursor = 'default';
        } else if (tool === 'text') {
            fabricCanvasRef.current.isDrawingMode = false;
            fabricCanvasRef.current.selection = false;
            fabricCanvasRef.current.defaultCursor = 'text';

            fabricCanvasRef.current.on('mouse:down', (options) => {
                if (options.target) return;

                const text = new fabric.IText('Введите текст', {
                    left: options.pointer?.x,
                    top: options.pointer?.y,
                    fontFamily: 'Arial',
                    fontSize: 20,
                    fill: hexToRgba(brushColor, brushOpacity),
                });

                fabricCanvasRef.current?.add(text);
                fabricCanvasRef.current?.setActiveObject(text);
                fabricCanvasRef.current?.renderAll();

                // Отправляем изменения на сервер
                const jsonData = fabricCanvasRef.current?.toJSON();
                if (jsonData) {
                    sendWhiteboardChange(jsonData);
                }

                setActiveTool('select');
            });
        } else if (tool === 'eraser') {
            fabricCanvasRef.current.isDrawingMode = false;
            fabricCanvasRef.current.selection = false;
            fabricCanvasRef.current.defaultCursor = 'cell';

            // Обработчики для ластика
            fabricCanvasRef.current.on('mouse:down', (options) => {
                isErasing.current = true;
                eraseObjectsUnderPointer(options);
            });

            fabricCanvasRef.current.on('mouse:move', (options) => {
                if (isErasing.current) {
                    eraseObjectsUnderPointer(options);
                }
            });

            fabricCanvasRef.current.on('mouse:up', () => {
                isErasing.current = false;
            });
        } else if (tool === 'hand') {
            fabricCanvasRef.current.isDrawingMode = false;
            fabricCanvasRef.current.selection = false;
            fabricCanvasRef.current.defaultCursor = 'grab';

            // Обработчики для инструмента "Рука"
            fabricCanvasRef.current.on('mouse:down', (options) => {
                isPanning.current = true;
                if (fabricCanvasRef.current) {
                    fabricCanvasRef.current.defaultCursor = 'grabbing';
                }
                lastPosX.current = options.e.clientX;
                lastPosY.current = options.e.clientY;
            });

            fabricCanvasRef.current.on('mouse:move', (options) => {
                if (isPanning.current && fabricCanvasRef.current) {
                    // Убеждаемся, что viewportTransform существует
                    if (!fabricCanvasRef.current.viewportTransform) {
                        fabricCanvasRef.current.viewportTransform = [1, 0, 0, 1, 0, 0];
                    }
                    const vpt = fabricCanvasRef.current.viewportTransform;
                    vpt[4] += options.e.clientX - lastPosX.current;
                    vpt[5] += options.e.clientY - lastPosY.current;
                    fabricCanvasRef.current.requestRenderAll();
                    lastPosX.current = options.e.clientX;
                    lastPosY.current = options.e.clientY;
                }
            });

            fabricCanvasRef.current.on('mouse:up', () => {
                isPanning.current = false;
                if (fabricCanvasRef.current) {
                    fabricCanvasRef.current.defaultCursor = 'grab';
                }
            });
        }
    };

    // Функция для стирания объектов под указателем
    const eraseObjectsUnderPointer = useCallback((options: any) => {
        if (!fabricCanvasRef.current || !options.pointer) return;

        const pointer = options.pointer;
        const objects = fabricCanvasRef.current.getObjects();

        // Создаем виртуальную область ластика
        const eraserArea = new fabric.Circle({
            left: pointer.x - eraserSize / 2,
            top: pointer.y - eraserSize / 2,
            radius: eraserSize / 2,
            originX: 'left',
            originY: 'top',
            fill: 'transparent'
        });

        // Проверяем каждый объект на пересечение с областью ластика
        objects.forEach(obj => {
            if (obj.intersectsWithObject(eraserArea)) {
                fabricCanvasRef.current?.remove(obj);
            }
        });

        fabricCanvasRef.current.renderAll();
        
        // Отправляем изменения на сервер
        const jsonData = fabricCanvasRef.current.toJSON();
        sendWhiteboardChange(jsonData);
    }, [eraserSize, sendWhiteboardChange]);

    // Функция для сброса масштаба
    const resetZoom = useCallback(() => {
        if (!fabricCanvasRef.current) return;

        fabricCanvasRef.current.setViewportTransform([1, 0, 0, 1, 0, 0]);
        setZoomLevel(100);
        fabricCanvasRef.current.renderAll();
    }, []);

    return (
        <div style={{ position: 'relative', height: '100vh', overflow: 'hidden' }}>
            {/* Статус подключения - вверху слева */}
            <div style={{
                position: 'absolute',
                top: '20px',
                left: '20px',
                zIndex: 10,
                background: 'rgba(255, 255, 255, 0.9)',
                padding: '10px',
                borderRadius: '8px',
                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
                fontSize: '14px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                    <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: isConnected ? '#4CAF50' : '#f44336'
                    }}></div>
                    <span>{isConnected ? 'Подключено' : 'Отключено'}</span>
                </div>
                <div>Комната: {roomId}</div>
                <div>Пользователей: {connectedUsers.length + 1}</div>
            </div>

            {/* Основные инструменты - по центру вверху */}
            <div style={{
                position: 'absolute',
                top: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 10,
                display: 'flex',
                gap: '10px',
                background: 'rgba(255, 255, 255, 0.8)',
                padding: '10px',
                borderRadius: '8px',
                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)'
            }}>
                <button
                    className={`tool-button ${activeTool === 'pencil' ? 'active' : ''}`}
                    onClick={() => changeTool('pencil')}
                >
                    ✏️ Карандаш
                </button>
                <button
                    className={`tool-button ${activeTool === 'select' ? 'active' : ''}`}
                    onClick={() => changeTool('select')}
                >
                    ➟ Указатель
                </button>
                <button
                    className={`tool-button ${activeTool === 'text' ? 'active' : ''}`}
                    onClick={() => changeTool('text')}
                >
                    Текст
                </button>
                <button
                    className={`tool-button ${activeTool === 'eraser' ? 'active' : ''}`}
                    onClick={() => changeTool('eraser')}
                >
                    🧽 Ластик
                </button>
                <button
                    className={`tool-button ${activeTool === 'hand' ? 'active' : ''}`}
                    onClick={() => changeTool('hand')}
                >
                    ✋ Рука
                </button>
            </div>

            {/* Панель масштабирования - справа */}
            <div style={{
                position: 'absolute',
                right: '20px',
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 10,
                background: 'rgba(255, 255, 255, 0.8)',
                padding: '15px',
                borderRadius: '8px',
                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
                display: 'flex',
                flexDirection: 'column',
                gap: '15px',
                width: '120px'
            }}>
                <div style={{ textAlign: 'center', fontWeight: 'bold' }}>Масштаб: {zoomLevel}%</div>
                <input
                    type="range"
                    min="10"
                    max="500"
                    value={zoomLevel}
                    onChange={(e) => setZoom(parseInt(e.target.value))}
                    style={{ width: '100%' }}
                />
                <button onClick={resetZoom} className="tool-button" style={{ marginTop: '10px' }}>
                    Сбросить масштаб
                </button>
            </div>

            {/* Настройки кисти - слева, появляются только для карандаша */}
            {showBrushSettings && (
                <div style={{
                    position: 'absolute',
                    left: '20px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 10,
                    background: 'rgba(255, 255, 255, 0.8)',
                    padding: '15px',
                    borderRadius: '8px',
                    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '15px'
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                        <span style={{ fontWeight: 'bold' }}>Цвет</span>
                        <input
                            type="color"
                            value={brushColor}
                            onChange={(e) => setBrushColor(e.target.value)}
                            style={{ width: '40px', height: '40px', cursor: 'pointer' }}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                        <span style={{ fontWeight: 'bold' }}>Прозрачность</span>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={brushOpacity * 100}
                            onChange={(e) => setBrushOpacity(parseInt(e.target.value) / 100)}
                            style={{ width: '80px' }}
                        />
                        <span>{Math.round(brushOpacity * 100)}%</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                        <span style={{ fontWeight: 'bold' }}>Размер</span>
                        <input
                            type="range"
                            min="1"
                            max="50"
                            value={brushSize}
                            onChange={(e) => setBrushSize(parseInt(e.target.value))}
                            style={{ width: '80px' }}
                        />
                        <span>{brushSize}px</span>
                    </div>
                </div>
            )}

            {/* Настройки ластика - слева, появляются только для ластика */}
            {showEraserSettings && (
                <div style={{
                    position: 'absolute',
                    left: '20px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 10,
                    background: 'rgba(255, 255, 255, 0.8)',
                    padding: '15px',
                    borderRadius: '8px',
                    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '15px'
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                        <span style={{ fontWeight: 'bold' }}>Размер ластика</span>
                        <input
                            type="range"
                            min="5"
                            max="100"
                            value={eraserSize}
                            onChange={(e) => setEraserSize(parseInt(e.target.value))}
                            style={{ width: '80px' }}
                        />
                        <span>{eraserSize}px</span>
                    </div>
                </div>
            )}

            <div className="whiteboard-container" style={{ height: '100vh', cursor: fabricCanvasRef.current?.defaultCursor || 'default' }}>
                <canvas ref={canvasRef} />
            </div>
        </div>
    );
};

export default Whiteboard;