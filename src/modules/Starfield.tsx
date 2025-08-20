import React, { useEffect, useRef } from 'react';

interface Props { density?: number; speed?: number; }

// 星空动画层：仅在 galaxy 暗色变体下挂载
export const Starfield: React.FC<Props> = ({ density = 130, speed = 0.04 }) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    useEffect(() => {
        const canvas = canvasRef.current; if (!canvas) return;
        const ctx = canvas.getContext('2d'); if (!ctx) return;
        let w = canvas.width = window.innerWidth;
        let h = canvas.height = window.innerHeight;
        const onResize = () => { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; };
        window.addEventListener('resize', onResize);

        interface Star { x: number; y: number; z: number; r: number; tw: number; }
        const stars: Star[] = [];
        for (let i = 0; i < density; i++) {
            stars.push({
                x: Math.random() * w,
                y: Math.random() * h,
                z: Math.random() * 0.7 + 0.3,
                r: Math.random() * 1.2 + 0.3,
                tw: Math.random() * Math.PI * 2
            });
        }

        let running = true;
        function loop() {
            if (!running) return;
            if (!ctx) return;
            ctx.clearRect(0, 0, w, h);
            for (const s of stars) {
                s.y += s.z * speed * 60; // 视差下落
                if (s.y > h + 20) { s.y = -20; s.x = Math.random() * w; s.z = Math.random() * 0.7 + 0.3; }
                s.tw += 0.03 + s.z * 0.02;
                const alpha = 0.3 + Math.sin(s.tw) * 0.3 + s.z * 0.4;
                const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 4);
                grad.addColorStop(0, `rgba(255,255,255,${alpha})`);
                grad.addColorStop(0.5, `rgba(150,180,255,${alpha * 0.4})`);
                grad.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(s.x, s.y, s.r * 4, 0, Math.PI * 2);
                ctx.fill();
            }
            requestAnimationFrame(loop);
        }
        loop();
        return () => { running = false; window.removeEventListener('resize', onResize); };
    }, [density, speed]);
    return <canvas ref={canvasRef} className="fixed inset-0 -z-10 pointer-events-none opacity-70" />;
};
