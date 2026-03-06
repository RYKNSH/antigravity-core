import { AbsoluteFill, useCurrentFrame, interpolate, Sequence } from 'remotion';
import React from 'react';

interface StepItem { title: string; description: string; }

interface DemoProps {
    title: string;
    steps: StepItem[];
}

export const Demo: React.FC<DemoProps> = ({ title, steps = [] }) => {
    const frame = useCurrentFrame();
    const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });

    return (
        <AbsoluteFill style={{ backgroundColor: '#0A0A0A', padding: 80, flexDirection: 'column', justifyContent: 'flex-start' }}>
            <h1 style={{ color: '#FFFFFF', fontSize: 56, fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, opacity: titleOpacity, margin: '0 0 60px' }}>
                {title}
            </h1>
            {steps.map((step, i) => {
                const stepStart = 40 + i * 80;
                const stepOpacity = interpolate(frame, [stepStart, stepStart + 20], [0, 1], { extrapolateRight: 'clamp' });
                const stepY = interpolate(frame, [stepStart, stepStart + 20], [20, 0], { extrapolateRight: 'clamp' });
                return (
                    <div key={i} style={{ opacity: stepOpacity, transform: `translateY(${stepY}px)`, marginBottom: 40, display: 'flex', alignItems: 'flex-start', gap: 24 }}>
                        <div style={{ backgroundColor: '#C0C0C0', color: '#0A0A0A', width: 48, height: 48, borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 24, flexShrink: 0 }}>
                            {i + 1}
                        </div>
                        <div>
                            <div style={{ color: '#FFFFFF', fontSize: 36, fontWeight: 700, fontFamily: 'Noto Sans JP, sans-serif' }}>{step.title}</div>
                            <div style={{ color: '#888', fontSize: 28, marginTop: 8, fontFamily: 'Noto Sans JP, sans-serif' }}>{step.description}</div>
                        </div>
                    </div>
                );
            })}
        </AbsoluteFill>
    );
};
