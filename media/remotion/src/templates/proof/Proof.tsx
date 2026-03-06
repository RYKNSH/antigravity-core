import { AbsoluteFill, useCurrentFrame, interpolate, useVideoConfig } from 'remotion';
import React from 'react';

interface StatItem {
    value: string;
    unit: string;
    label: string;
}

interface ProofProps {
    headline: string;          // メイン見出し（\n改行対応）
    stats: StatItem[];         // 数値一覧（2〜3件推奨）
    testimonial?: string;      // 証言テキスト（\n改行対応）
    source?: string;           // 証言者名
}

export const Proof: React.FC<ProofProps> = ({ headline, stats, testimonial, source }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    // 見出し
    const headlineOpacity = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: 'clamp' });
    const headlineY = interpolate(frame, [0, 18], [30, 0], { extrapolateRight: 'clamp' });

    // 区切り線
    const lineWidth = interpolate(frame, [20, 40], [0, 140], { extrapolateRight: 'clamp' });

    return (
        <AbsoluteFill style={{
            backgroundColor: '#0A0A0A',
            justifyContent: 'center',
            alignItems: 'center',
            fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic Pro", sans-serif',
            padding: '0 72px',
        }}>
            {/* 上部ハイライトライン */}
            <div style={{
                position: 'absolute', top: 0, left: 0, right: 0,
                height: 3,
                background: 'linear-gradient(to right, transparent, #C0C0C0, transparent)',
                opacity: interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' }),
            }} />

            <div style={{ width: '100%', textAlign: 'center' }}>
                {/* 見出し */}
                <h1 style={{
                    color: '#FFFFFF',
                    fontSize: 80,
                    fontWeight: 700,
                    lineHeight: 1.3,
                    margin: '0 0 40px',
                    whiteSpace: 'pre-line',
                    opacity: headlineOpacity,
                    transform: `translateY(${headlineY}px)`,
                }}>
                    {headline}
                </h1>

                {/* アクセントライン */}
                <div style={{
                    width: lineWidth,
                    height: 2,
                    backgroundColor: '#C0C0C0',
                    margin: '0 auto 72px',
                    borderRadius: 1,
                }} />

                {/* 数値グリッド */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 48,
                    marginBottom: 80,
                }}>
                    {stats.map((stat, i) => {
                        const statOpacity = interpolate(frame, [30 + i * 12, 46 + i * 12], [0, 1], { extrapolateRight: 'clamp' });
                        const statY = interpolate(frame, [30 + i * 12, 46 + i * 12], [24, 0], { extrapolateRight: 'clamp' });
                        return (
                            <div key={i} style={{
                                textAlign: 'center',
                                opacity: statOpacity,
                                transform: `translateY(${statY}px)`,
                                flex: 1,
                            }}>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'baseline',
                                    justifyContent: 'center',
                                    gap: 6,
                                }}>
                                    <span style={{
                                        color: '#FFFFFF',
                                        fontSize: 104,
                                        fontWeight: 700,
                                        lineHeight: 1,
                                    }}>
                                        {stat.value}
                                    </span>
                                    <span style={{
                                        color: '#C0C0C0',
                                        fontSize: 52,
                                        fontWeight: 500,
                                    }}>
                                        {stat.unit}
                                    </span>
                                </div>
                                <div style={{
                                    color: '#C0C0C0',
                                    fontSize: 32,
                                    fontWeight: 400,
                                    marginTop: 12,
                                    letterSpacing: '0.04em',
                                }}>
                                    {stat.label}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* 証言 */}
                {testimonial && (
                    <div style={{
                        borderLeft: '3px solid #C0C0C0',
                        paddingLeft: 40,
                        textAlign: 'left',
                        opacity: interpolate(frame, [80, 95], [0, 1], { extrapolateRight: 'clamp' }),
                    }}>
                        <p style={{
                            color: '#FFFFFF',
                            fontSize: 40,
                            fontWeight: 400,
                            lineHeight: 1.7,
                            margin: '0 0 20px',
                            whiteSpace: 'pre-line',
                        }}>
                            {testimonial}
                        </p>
                        {source && (
                            <p style={{
                                color: '#C0C0C0',
                                fontSize: 30,
                                fontWeight: 400,
                                margin: 0,
                                letterSpacing: '0.04em',
                            }}>
                                {source}
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* 下部ハイライトライン */}
            <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                height: 3,
                background: 'linear-gradient(to right, transparent, #C0C0C0, transparent)',
                opacity: interpolate(frame, [60, 80], [0, 1], { extrapolateRight: 'clamp' }),
            }} />
        </AbsoluteFill>
    );
};
