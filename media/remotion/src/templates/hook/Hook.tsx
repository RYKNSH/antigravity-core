import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import React from 'react';

interface HookProps {
    title: string;
    subtitle: string;
}

export const Hook: React.FC<HookProps> = ({ title, subtitle }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
    const subtitleOpacity = interpolate(frame, [20, 35], [0, 1], { extrapolateRight: 'clamp' });
    const scale = spring({ frame, fps, from: 0.8, to: 1.0, config: { damping: 12 } });

    return (
        <AbsoluteFill style={{ backgroundColor: '#0A0A0A', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ textAlign: 'center', padding: '0 60px', transform: `scale(${scale})` }}>
                <h1 style={{
                    color: '#FFFFFF',
                    fontSize: 80,
                    fontFamily: 'Noto Sans JP, sans-serif',
                    fontWeight: 700,
                    opacity: titleOpacity,
                    margin: 0,
                    lineHeight: 1.2,
                }}>
                    {title}
                </h1>
                <p style={{
                    color: '#C0C0C0',
                    fontSize: 40,
                    fontFamily: 'Noto Sans JP, sans-serif',
                    fontWeight: 400,
                    opacity: subtitleOpacity,
                    marginTop: 24,
                }}>
                    {subtitle}
                </p>
            </div>
        </AbsoluteFill>
    );
};
