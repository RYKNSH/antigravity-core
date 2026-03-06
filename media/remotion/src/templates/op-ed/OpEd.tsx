import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import React from 'react';

interface OpEdProps {
    logoText: string;
    tagline: string;
}

export const OpEd: React.FC<OpEdProps> = ({ logoText, tagline }) => {
    const frame = useCurrentFrame();
    const { fps, durationInFrames } = useVideoConfig();

    // フェードイン → ホールド → フェードアウト
    const opacity = interpolate(
        frame,
        [0, 20, durationInFrames - 20, durationInFrames],
        [0, 1, 1, 0],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    const scale = spring({ frame, fps, from: 0.85, to: 1.0, config: { damping: 14, stiffness: 120 } });

    // ロゴテキストを1文字ずつフェードイン
    const chars = logoText.split('');
    const letterDelay = 3;

    return (
        <AbsoluteFill style={{ backgroundColor: '#0A0A0A', justifyContent: 'center', alignItems: 'center', opacity }}>
            <div style={{ textAlign: 'center', transform: `scale(${scale})` }}>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                    {chars.map((char, i) => {
                        const charOpacity = interpolate(frame, [i * letterDelay, i * letterDelay + 10], [0, 1], { extrapolateRight: 'clamp' });
                        return (
                            <span key={i} style={{
                                color: '#FFFFFF',
                                fontSize: 96,
                                fontFamily: 'Noto Sans JP, sans-serif',
                                fontWeight: 700,
                                letterSpacing: 8,
                                opacity: charOpacity,
                            }}>
                                {char}
                            </span>
                        );
                    })}
                </div>
                <p style={{
                    color: '#C0C0C0',
                    fontSize: 32,
                    fontFamily: 'Noto Sans JP, sans-serif',
                    fontWeight: 300,
                    letterSpacing: 4,
                    marginTop: 16,
                    opacity: interpolate(frame, [30, 50], [0, 1], { extrapolateRight: 'clamp' }),
                }}>
                    {tagline}
                </p>
            </div>
        </AbsoluteFill>
    );
};
