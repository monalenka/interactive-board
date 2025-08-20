import React, { useEffect, useRef, useState, useCallback } from 'react';
import { fabric } from 'fabric';

const Whiteboard: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
    const [activeTool, setActiveTool] = useState<'pencil' | 'select' | 'text' | 'eraser' | 'hand'>('pencil');
    const [brushColor, setBrushColor] = useState('#000000');
    const [brushSize, setBrushSize] = useState(5);
    const [eraserSize, setEraserSize] = useState(20);
    const [showBrushSettings, setShowBrushSettings] = useState(false);
    const [showEraserSettings, setShowEraserSettings] = useState(false);
    const [zoomLevel, setZoomLevel] = useState(100);
    const isErasing = useRef(false);
    const isPanning = useRef(false);
    const lastPosX = useRef(0);
    const lastPosY = useRef(0);

    const handleKeyPress = useCallback((event: KeyboardEvent) => {
        if (fabricCanvasRef.current && event.key === 'Delete') {
            const activeObject = fabricCanvasRef.current.getActiveObject();
            if (activeObject) {
                fabricCanvasRef.current.remove(activeObject);
                fabricCanvasRef.current.discardActiveObject();
                fabricCanvasRef.current.renderAll();
            }
        }
    }, []);

    const handleZoom = useCallback((delta: number, point: { x: number; y: number }) => {
        if (!fabricCanvasRef.current) return;

        let zoom = fabricCanvasRef.current.getZoom();
        zoom *= 0.999 ** delta;

        if (zoom > 5) zoom = 5;
        if (zoom < 0.1) zoom = 0.1;

        fabricCanvasRef.current.zoomToPoint(new fabric.Point(point.x, point.y), zoom);
        setZoomLevel(Math.round(zoom * 100));
        fabricCanvasRef.current.renderAll();
    }, []);

    useEffect(() => {
        if (!canvasRef.current) return;

        fabricCanvasRef.current = new fabric.Canvas(canvasRef.current, {
            width: window.innerWidth,
            height: window.innerHeight,
            isDrawingMode: true,
        });

        if (fabricCanvasRef.current) {
            fabricCanvasRef.current.setWidth(4000);
            fabricCanvasRef.current.setHeight(4000);

            fabricCanvasRef.current.viewportTransform = [1, 0, 0, 1, 2000 - window.innerWidth / 2, 2000 - window.innerHeight / 2];

            fabricCanvasRef.current.freeDrawingBrush.width = brushSize;
            fabricCanvasRef.current.freeDrawingBrush.color = brushColor;
        }

        window.addEventListener('keydown', handleKeyPress);

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
    }, [handleKeyPress, handleZoom]);

    useEffect(() => {
        if (fabricCanvasRef.current && activeTool === 'pencil') {
            fabricCanvasRef.current.freeDrawingBrush.width = brushSize;
            fabricCanvasRef.current.freeDrawingBrush.color = brushColor;
        }
    }, [brushColor, brushSize, activeTool]);

    const changeTool = (tool: 'pencil' | 'select' | 'text' | 'eraser' | 'hand') => {
        if (!fabricCanvasRef.current) return;

        fabricCanvasRef.current.off('mouse:down');
        fabricCanvasRef.current.off('mouse:move');
        fabricCanvasRef.current.off('mouse:up');

        setActiveTool(tool);
        setShowBrushSettings(tool === 'pencil');
        setShowEraserSettings(tool === 'eraser');

        if (tool === 'pencil') {
            fabricCanvasRef.current.isDrawingMode = true;
            fabricCanvasRef.current.freeDrawingBrush.width = brushSize;
            fabricCanvasRef.current.freeDrawingBrush.color = brushColor;
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
                    fill: brushColor,
                });

                fabricCanvasRef.current?.add(text);
                fabricCanvasRef.current?.setActiveObject(text);
                fabricCanvasRef.current?.renderAll();

                setActiveTool('select');
            });
        } else if (tool === 'eraser') {
            fabricCanvasRef.current.isDrawingMode = false;
            fabricCanvasRef.current.selection = false;
            fabricCanvasRef.current.defaultCursor = 'cell';

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

    const eraseObjectsUnderPointer = useCallback((options: any) => {
        if (!fabricCanvasRef.current || !options.pointer) return;

        const pointer = options.pointer;
        const objects = fabricCanvasRef.current.getObjects();

        const eraserArea = new fabric.Circle({
            left: pointer.x - eraserSize / 2,
            top: pointer.y - eraserSize / 2,
            radius: eraserSize / 2,
            originX: 'left',
            originY: 'top',
            fill: 'transparent'
        });

        objects.forEach(obj => {
            if (obj.intersectsWithObject(eraserArea)) {
                fabricCanvasRef.current?.remove(obj);
            }
        });

        fabricCanvasRef.current.renderAll();
    }, [eraserSize]);

    const zoomIn = useCallback(() => {
        if (!fabricCanvasRef.current) return;

        const zoom = fabricCanvasRef.current.getZoom();
        const newZoom = zoom * 1.2;

        if (newZoom > 5) return;

        const center = {
            x: fabricCanvasRef.current.getWidth() / 2,
            y: fabricCanvasRef.current.getHeight() / 2
        };

        fabricCanvasRef.current.zoomToPoint(new fabric.Point(center.x, center.y), newZoom);
        setZoomLevel(Math.round(newZoom * 100));
        fabricCanvasRef.current.renderAll();
    }, []);

    const zoomOut = useCallback(() => {
        if (!fabricCanvasRef.current) return;

        const zoom = fabricCanvasRef.current.getZoom();
        const newZoom = zoom / 1.2;

        if (newZoom < 0.1) return;

        const center = {
            x: fabricCanvasRef.current.getWidth() / 2,
            y: fabricCanvasRef.current.getHeight() / 2
        };

        fabricCanvasRef.current.zoomToPoint(new fabric.Point(center.x, center.y), newZoom);
        setZoomLevel(Math.round(newZoom * 100));
        fabricCanvasRef.current.renderAll();
    }, []);

    const resetZoom = useCallback(() => {
        if (!fabricCanvasRef.current) return;

        fabricCanvasRef.current.setViewportTransform([1, 0, 0, 1, 0, 0]);
        setZoomLevel(100);
        fabricCanvasRef.current.renderAll();
    }, []);

    return (
        <div style={{ position: 'relative', height: '100vh', overflow: 'hidden' }}>
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
                gap: '10px'
            }}>
                <button onClick={zoomIn} className="tool-button">
                    ➕
                </button>
                <div style={{ textAlign: 'center', fontWeight: 'bold' }}>
                    {zoomLevel}%
                </div>
                <button onClick={zoomOut} className="tool-button">
                    ➖
                </button>
                <button onClick={resetZoom} className="tool-button">
                    ⟳
                </button>
            </div>

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